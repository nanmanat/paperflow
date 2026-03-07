import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, mkdir, rm, access, chmod } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir, platform, arch } from 'os';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import https from 'https';
import { Octokit } from '@octokit/rest';

const execFileAsync = promisify(execFile);

const TECTONIC_VERSION = '0.15.0';
const TECTONIC_BIN_DIR = join(tmpdir(), 'paperflow-tectonic');
const TECTONIC_BIN = join(TECTONIC_BIN_DIR, 'tectonic');

function tectonicUrl(): string {
  const os = platform();
  const cpu = arch();
  if (os === 'darwin') {
    const target = cpu === 'arm64'
      ? 'aarch64-apple-darwin'
      : 'x86_64-apple-darwin';
    return `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${target}.tar.gz`;
  }
  return `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz`;
}

function httpsGetFollowRedirects(url: string): Promise<import('http').IncomingMessage> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'paperflow' } }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpsGetFollowRedirects(res.headers.location).then(resolve).catch(reject);
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

const FONT_DIR = join(tmpdir(), 'paperflow-fonts');

const THAI_FONTS = [
  { url: 'https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew-webfont.ttf',         file: 'THSarabunNew.ttf' },
  { url: 'https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew_bold-webfont.ttf',    file: 'THSarabunNew-Bold.ttf' },
  { url: 'https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew_italic-webfont.ttf',  file: 'THSarabunNew-Italic.ttf' },
  { url: 'https://cdn.jsdelivr.net/npm/font-th-sarabun-new@1.0.0/fonts/THSarabunNew_bolditalic-webfont.ttf', file: 'THSarabunNew-BoldItalic.ttf' },
];

async function ensureFonts(): Promise<void> {
  await mkdir(FONT_DIR, { recursive: true });
  await Promise.all(
    THAI_FONTS.map(async ({ url, file }) => {
      const dest = join(FONT_DIR, file);
      const alreadyExists = await access(dest).then(() => true).catch(() => false);
      if (alreadyExists) return;
      const res = await httpsGetFollowRedirects(url);
      await pipeline(res, createWriteStream(dest));
    })
  );
}

async function ensureTectonic(): Promise<string> {
  try {
    await access(TECTONIC_BIN);
    return TECTONIC_BIN;
  } catch {
    await mkdir(TECTONIC_BIN_DIR, { recursive: true });
    const tarPath = join(TECTONIC_BIN_DIR, 'tectonic.tar.gz');
    const res = await httpsGetFollowRedirects(tectonicUrl());
    await pipeline(res, createWriteStream(tarPath));
    await execFileAsync('tar', ['-xzf', tarPath, '-C', TECTONIC_BIN_DIR]);
    await chmod(TECTONIC_BIN, 0o755);
    return TECTONIC_BIN;
  }
}

const router = Router();

const TEXT_EXTENSIONS = new Set([
  '.tex', '.cls', '.sty', '.bst', '.bib', '.cfg', '.def', '.fd',
  '.ist', '.mst', '.glo', '.idx', '.txt', '.md',
]);

function isTextFile(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

const THAI_RANGE = /[\u0E00-\u0E7F]/;

function needsThaiPatch(source: string): boolean {
  return (
    THAI_RANGE.test(source) &&
    !source.includes('thaispec') &&
    !source.includes('fontspec') &&
    !source.includes('polyglossia')
  );
}

function patchThaiPreamble(source: string): string {
  return source.replace(
    /(\\documentclass(?:\[.*?\])?\{.*?\})/,
    '$1\n\\usepackage{fontspec}\n\\usepackage{polyglossia}\n\\setmainlanguage{thai}',
  );
}

function patchFontPaths(source: string, fontDir: string): string {
  const dir = fontDir.replace(/\\/g, '/') + '/';

  const replacement =
    `\\setmainfont[` +
    `Path=${dir},` +
    `UprightFont=THSarabunNew.ttf,` +
    `BoldFont=THSarabunNew-Bold.ttf,` +
    `ItalicFont=THSarabunNew-Italic.ttf,` +
    `BoldItalicFont=THSarabunNew-BoldItalic.ttf` +
    `]{TH Sarabun New}`;

  // Match \setmainfont with optional pre-name [...] AND optional post-name [...],
  // both of which may span multiple lines. [^\]]* stops at the first ] so it
  // won't accidentally consume unrelated brackets.
  let patched = source.replace(
    /\\setmainfont\s*(?:\[[^\]]*\]\s*)?\{TH Sarabun New\}\s*(?:\[[^\]]*\])?/gs,
    replacement,
  );

  const familyReplacement =
    `[Path=${dir},` +
    `UprightFont=THSarabunNew.ttf,` +
    `BoldFont=THSarabunNew-Bold.ttf,` +
    `ItalicFont=THSarabunNew-Italic.ttf,` +
    `BoldItalicFont=THSarabunNew-BoldItalic.ttf]`;

  patched = patched.replace(
    /\\newfontfamily(\s*\\[a-zA-Z]+)\s*(?:\[[^\]]*\]\s*)?\{TH Sarabun New\}\s*(?:\[[^\]]*\])?/gs,
    `\\newfontfamily$1${familyReplacement}{TH Sarabun New}`,
  );

  return patched;
}

router.post('/api/latex/compile', async (req: Request, res: Response) => {
  const { owner, repo, ref, filepath } = req.body as {
    owner?: string; repo?: string; ref?: string; filepath?: string;
  };
  const token = req.headers['x-github-token'] as string;

  if (!token) { res.status(401).json({ error: 'Missing X-Github-Token header' }); return; }
  if (!owner || !repo || !ref || !filepath) {
    res.status(400).json({ error: 'Missing owner, repo, ref, or filepath' });
    return;
  }

  let tmpDir: string | null = null;

  try {
    const octokit = new Octokit({ auth: token });

    const { data: treeData } = await octokit.rest.git.getTree({
      owner, repo, tree_sha: ref, recursive: '1',
    });

    tmpDir = await mkdtemp(join(tmpdir(), 'paperflow-latex-'));

    const fileBlobs = treeData.tree.filter((item) => item.type === 'blob' && item.path);

    await Promise.all(
      fileBlobs.map(async (item) => {
        const filePath = item.path!;
        const absPath = join(tmpDir!, filePath);
        await mkdir(dirname(absPath), { recursive: true });

        if (!isTextFile(filePath)) {
          try {
            const { data: blob } = await octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha! });
            await writeFile(absPath, Buffer.from(blob.content, 'base64'));
          } catch { /* skip unreadable blobs */ }
          return;
        }

        try {
          const { data: blob } = await octokit.rest.git.getBlob({ owner, repo, file_sha: item.sha! });
          await writeFile(absPath, Buffer.from(blob.content, 'base64').toString('utf-8'), 'utf-8');
        } catch { /* skip unreadable files */ }
      })
    );

    const texAbsPath = join(tmpDir, filepath);
    const outDir = dirname(texAbsPath);

    const [tectonic] = await Promise.all([ensureTectonic(), ensureFonts()]);

    const { readFile } = await import('fs/promises');
    let texSource = await readFile(texAbsPath, 'utf-8');
    if (needsThaiPatch(texSource)) {
      texSource = patchThaiPreamble(texSource);
    }
    texSource = patchFontPaths(texSource, FONT_DIR);
    await writeFile(texAbsPath, texSource, 'utf-8');
    await execFileAsync(
      tectonic,
      ['-X', 'compile', '--outfmt', 'pdf', '--outdir', outDir, texAbsPath],
      { timeout: 120000, cwd: outDir, env: { ...process.env, OSFONTDIR: FONT_DIR } },
    );

    const pdfPath = join(outDir, filepath.split('/').pop()!.replace(/\.tex$/, '.pdf'));
    const pdf = await readFile(pdfPath);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="preview.pdf"');
    res.send(pdf);
  } catch (err: any) {
    res.status(422).json({ error: err.stderr || err.message || 'compile failed' });
  } finally {
    if (tmpDir) rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;

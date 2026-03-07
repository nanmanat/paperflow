import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { Octokit } from '@octokit/rest';

const execFileAsync = promisify(execFile);
const router = Router();

const XELATEX  = '/Library/TeX/texbin/xelatex';
const PDFLATEX = '/Library/TeX/texbin/pdflatex';

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
    '$1\n\\usepackage{thaispec}',
  );
}

const LATEX_ARGS = ['-interaction=nonstopmode', '-halt-on-error'];

async function runLatex(engine: string, outDir: string, texAbsPath: string): Promise<void> {
  await execFileAsync(
    engine,
    [...LATEX_ARGS, '-output-directory', outDir, texAbsPath],
    { timeout: 60000, cwd: outDir },
  );
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

    const texSource = await readFile(texAbsPath, 'utf-8');
    if (needsThaiPatch(texSource)) {
      await writeFile(texAbsPath, patchThaiPreamble(texSource), 'utf-8');
    }

    const hasThai = THAI_RANGE.test(texSource);
    const engines = hasThai ? [XELATEX] : [XELATEX, PDFLATEX];

    let lastError: unknown;
    for (const engine of engines) {
      try {
        await runLatex(engine, outDir, texAbsPath);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (lastError) throw lastError;

    const pdfPath = join(outDir, filepath.split('/').pop()!.replace(/\.tex$/, '.pdf'));
    const pdf = await readFile(pdfPath);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="preview.pdf"');
    res.send(pdf);
  } catch (err: any) {
    let logContent = '';
    if (tmpDir) {
      const logPath = join(tmpDir, filepath!.replace(/\.tex$/, '.log'));
      try { logContent = await readFile(logPath, 'utf-8'); } catch { /* no log */ }
    }

    const errorLines = logContent
      .split('\n')
      .filter((l) => l.startsWith('!') || l.includes('Fatal error'))
      .slice(0, 10)
      .join('\n');

    res.status(422).json({ error: errorLines || err.message || 'compile failed' });
  } finally {
    if (tmpDir) rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;

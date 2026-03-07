import { Router, Request, Response } from 'express';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { Octokit } from '@octokit/rest';
import { compile } from 'node-latex-compiler';

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

    const texSource = await (await import('fs/promises')).readFile(texAbsPath, 'utf-8');
    if (needsThaiPatch(texSource)) {
      await writeFile(texAbsPath, patchThaiPreamble(texSource), 'utf-8');
    }

    const result = await compile({
      texFile: texAbsPath,
      outputDir: outDir,
    });

    if (result.status !== 'success') {
      res.status(422).json({ error: result.stderr || 'compile failed' });
      return;
    }

    const pdfPath = join(outDir, filepath.split('/').pop()!.replace(/\.tex$/, '.pdf'));
    const pdf = await (await import('fs/promises')).readFile(pdfPath);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'inline; filename="preview.pdf"');
    res.send(pdf);
  } catch (err: any) {
    res.status(422).json({ error: err.message || 'compile failed' });
  } finally {
    if (tmpDir) rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
});

export default router;

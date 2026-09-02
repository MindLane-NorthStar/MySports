// SVG -> PNG rasterizer for scripts/build_web_marks.py.
//
//     node web/scripts/rasterize-svg.mjs jobs.json
//
// `jobs.json` is [{ "src": "<abs .svg path>", "out": "<abs .png path>", "height": 512 }, ...].
// One Chromium instance does the whole batch and prints one line per job.
//
// Why a browser: the recipe table in build_web_marks.py needs true vector rasters for Disney+,
// HBO Max, Paramount+ and the SEC Network lockup. cairosvg installs on Windows but cannot load the
// native cairo DLL (see the note in requirements.txt), and Playwright's Chromium is already a
// dependency of the QA screenshot pass - so the renderer that ships the app also rasterizes its marks.

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const job of jobs) {
  const svg = readFileSync(job.src, 'utf8');
  // Transparent background, no margin: the mark is measured and trimmed on the Python side.
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}
            svg{display:block;height:${job.height}px;width:auto}</style>
     <div id="wrap" style="display:inline-block">${svg}</div>`,
    { waitUntil: 'load' }
  );
  const el = await page.$('#wrap');
  const shot = await el.screenshot({ omitBackground: true, type: 'png' });
  writeFileSync(job.out, shot);
  console.log(`ok ${job.out}`);
}

await browser.close();

/**
 * The three minutes behind the button, drawn as one HTML file.
 *
 * ## Why the app draws it and the generator does not
 *
 * The obvious version has the morning session write the HTML itself. It was
 * rejected twice over.
 *
 * A model writing markup writes *different* markup every day, so the page that
 * is supposed to feel like a fixture of the morning would arrive with a new
 * layout, a new typeface and a new idea about headings each time - and nobody
 * builds a reading habit on a page that keeps moving.
 *
 * And a file written as raw HTML by a model, then opened in a browser, is a file
 * that can contain anything a browser will run. Everything below is escaped, so
 * the worst a bad article can do is read strangely. "It would not write a script
 * tag" is a hope, not a boundary.
 *
 * So the generator writes values - paragraphs, list items, code - and this turns
 * them into a page. Same split as the rest of the app: something else writes,
 * Brief renders.
 *
 * ## Self-contained, deliberately
 *
 * No stylesheet link, no font from a CDN, no script. The file is opened straight
 * off disk, frequently on a morning where the point is not to be online yet, and
 * a page that needs the network to look right is a page that sometimes does not.
 */

import { readingMinutes } from '../domain/learn.js';

/** @param {unknown} value */
function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * The page's own styling, which is Brief's.
 *
 * It reads as the same product on purpose: this page is opened from the brief
 * and belongs to it, and a differently-styled tab reads as somebody else's
 * article that happened to be linked. Wider than the window, because a browser
 * page is read at arm's length rather than in a narrow column beside a desktop.
 */
const STYLE = `
  :root {
    --bg: #1b1c1f;
    --surface: #232428;
    --line: #34363c;
    --line-soft: #2b2c31;
    --text: #e7e8ec;
    --text-dim: #9b9ea7;
    --text-faint: #6e717a;
    --accent: #9a94f0;
    --accent-deep: #6a60c9;
    --accent-soft: rgba(154, 148, 240, 0.14);
    color-scheme: dark;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 48px 24px 96px;
    background: var(--bg);
    color: var(--text);
    font-family: "Segoe UI", "Segoe UI Variable", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.62;
  }

  main { max-width: 660px; margin: 0 auto; }

  .eyebrow {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.9px;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  h1 {
    margin: 10px 0 0;
    font-size: 30px;
    line-height: 1.22;
    font-weight: 650;
    letter-spacing: -0.2px;
    text-wrap: balance;
  }

  .standfirst {
    margin: 14px 0 0;
    font-size: 18px;
    line-height: 1.55;
    color: var(--text-dim);
  }

  .meta {
    margin: 18px 0 0;
    padding: 0 0 22px;
    border-bottom: 1px solid var(--line-soft);
    font-size: 12px;
    color: var(--text-faint);
  }

  h2 {
    margin: 38px 0 0;
    font-size: 17px;
    font-weight: 650;
    color: var(--text);
  }

  p { margin: 12px 0 0; }

  ul.points { margin: 12px 0 0; padding-left: 20px; }
  ul.points li { margin: 6px 0 0; }

  /* Code is read, not run, so it wraps rather than scrolling sideways: a
     horizontal scrollbar in a three-minute read is a line nobody finishes. */
  pre {
    margin: 16px 0 0;
    padding: 14px 16px;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-left: 2px solid var(--accent-deep);
    border-radius: 8px;
    overflow-x: auto;
    font-family: "Cascadia Mono", "Consolas", ui-monospace, monospace;
    font-size: 13.5px;
    line-height: 1.55;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .lang {
    display: block;
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .aside {
    margin: 18px 0 0;
    padding: 2px 0 2px 16px;
    border-left: 2px solid var(--accent-soft);
    color: var(--text-dim);
  }

  .takeaways {
    margin: 44px 0 0;
    padding: 20px 22px 22px;
    background: var(--surface);
    border: 1px solid var(--line-soft);
    border-radius: 10px;
  }

  .takeaways h2 { margin: 0; }
  .takeaways ul { margin: 12px 0 0; padding-left: 20px; }
  .takeaways li { margin: 7px 0 0; color: var(--text-dim); }

  .sources { margin: 34px 0 0; font-size: 13px; }
  .sources h2 { font-size: 13px; margin: 0 0 8px; color: var(--text-faint); font-weight: 600; }
  .sources a { color: var(--accent); text-decoration: none; }
  .sources a:hover { text-decoration: underline; }
  .sources li { margin: 4px 0 0; }

  .end { margin: 46px 0 0; }
  .end-rule {
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent-deep));
    opacity: 0.55;
  }
  .end-note { margin: 10px 0 0; font-size: 12px; color: var(--text-faint); }
`;

/**
 * One block of an article.
 *
 * @param {import('../domain/learn.js').Block} block
 */
function blockHtml(block) {
  if (block.kind === 'list') {
    return `<ul class="points">${block.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }
  if (block.kind === 'code') {
    const language = block.language ? `<span class="lang">${esc(block.language)}</span>` : '';
    return `<pre>${language}<code>${esc(block.code)}</code></pre>`;
  }
  if (block.kind === 'aside') {
    return `<p class="aside">${esc(block.text)}</p>`;
  }
  return `<p>${esc(block.text)}</p>`;
}

/**
 * Render one article as a standalone page.
 *
 * @param {import('../domain/learn.js').Article} article
 * @param {object} [about]
 * @param {string} [about.date] The brief it belongs to, `YYYY-MM-DD`.
 * @returns {string}
 */
export function renderArticle(article, { date } = {}) {
  const minutes = readingMinutes(article);

  const sections = article.sections
    .map(
      (section) =>
        `${section.heading === '' ? '' : `<h2>${esc(section.heading)}</h2>`}${section.blocks.map(blockHtml).join('')}`
    )
    .join('\n');

  const takeaways =
    article.takeaways.length === 0
      ? ''
      : `<section class="takeaways">
           <h2>Värt att ta med sig</h2>
           <ul>${article.takeaways.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>
         </section>`;

  const sources =
    article.sources.length === 0
      ? ''
      : `<section class="sources">
           <h2>Läs vidare</h2>
           <ul>${article.sources
             .map((source) => `<li><a href="${esc(source.url)}" rel="noreferrer noopener">${esc(source.title)}</a></li>`)
             .join('')}</ul>
         </section>`;

  return `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <!-- Nothing loads and nothing runs. The page is text this app wrote out of a
         file a model wrote, and the policy is what makes that sentence true
         rather than merely intended. -->
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
    <title>${esc(article.title)} · Brief</title>
    <style>${STYLE}</style>
  </head>
  <body>
    <main>
      <p class="eyebrow">En sak att kunna</p>
      <h1>${esc(article.title)}</h1>
      ${article.standfirst ? `<p class="standfirst">${esc(article.standfirst)}</p>` : ''}
      <p class="meta">${minutes} min${date ? ` · ur briefen ${esc(date)}` : ''}</p>

      ${sections}
      ${takeaways}
      ${sources}

      <div class="end">
        <div class="end-rule"></div>
        <p class="end-note">Det var allt. Tillbaka till dagen.</p>
      </div>
    </main>
  </body>
</html>
`;
}

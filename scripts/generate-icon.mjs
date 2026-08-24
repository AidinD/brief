/**
 * Brief's icon: the cup you read it over.
 *
 * A tapered body and a handle, in one weight, in periwinkle. The object of the
 * ritual rather than of the mechanics, the way PomPom draws a tomato and not a
 * timer: Brief is the thing you read once, early, before the day gets loud.
 *
 * ## Why this and not the column of prose
 *
 * The mark this replaces was three ragged lines and a heavier rule under them,
 * and it was argued for at length: the rule was wider than the text so it could
 * not be a hamburger menu, and the gap above it was nearly twice the line
 * spacing. The argument was sound and the picture still lost, because it was
 * furniture. Set beside the family - a tick, a nib, a thread, a ring and an
 * arrow, a tomato, four tally marks, a ship's wheel - Brief was the only app
 * that drew a piece of interface, and the only one without a curve in it.
 *
 * Eleven candidates were drawn before this one. What they taught, both worth
 * knowing before drawing the twelfth:
 *
 *   Paper collapses. At icon size a sheet is a rectangle, and every rectangle is
 *   already something: the file glyph, a window, a phone with a home button. A
 *   rolled dispatch came out a snail.
 *
 *   A disc plus anything horizontal is a finished glyph you did not choose. Disc
 *   on a bar is a bowler hat. Disc over a curve is an avatar, head and
 *   shoulders. Disc inside a broken line is a slider handle. Three attempts at
 *   sunrise, three other meanings.
 *
 * What the surviving marks in this suite have in common is a closed form and one
 * small distinguishing element: ring and tick, ring and arrow, outline and slit,
 * body and calyx. A cup is exactly that shape of idea, which is why it is the
 * one that held.
 *
 * ## Two drawings, per the family rule
 *
 * Below 32px the body widens, the stroke thickens and the handle grows. The
 * handle's counter is the whole reason: at 16px the hole in a handle drawn to
 * full-size proportions closes up, and a cup with a filled handle is a bucket.
 * Jot widens its ring's gap for the same reason and says so.
 *
 * The silhouette is the same at every size. Nib's generator is the warning
 * there: it once drew a genuinely different mark for the small frames and
 * Windows duly showed one logo in the taskbar and another in search.
 *
 * Run with `node scripts/generate-icon.mjs`. The output is committed to
 * resources/, because electron-builder needs it at package time and a build
 * should never depend on having run a script first.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderPng, renderIco, coverage, diagonalRamp, distArc, distPolyline, SMALL_BELOW } from 'keel/icon';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'resources');
mkdirSync(outDir, { recursive: true });

/** Periwinkle: Brief's slot on the family's cool end, kept from the old mark. */
const periwinkle = diagonalRamp([154, 148, 240], [106, 96, 201]);

/**
 * Both drawings as fractions of the canvas, matching BriefMark's 100-unit
 * viewBox in the header. Change one, change the other.
 *
 * `body` is the cup, open at the top and closed by joining the last point back
 * to the first. `handle` is an arc: `from` and `to` are degrees the way SVG
 * measures them, so it runs clockwise through three o'clock and its two ends
 * land inside the body's right edge rather than floating clear of it.
 */
const FULL = {
  weight: 0.072,
  body: [
    [0.205, 0.275],
    [0.635, 0.275],
    [0.585, 0.765],
    [0.255, 0.765]
  ],
  handle: { cx: 0.665, cy: 0.47, r: 0.115, from: 250, to: 110 }
};

const SMALL = {
  weight: 0.115,
  body: [
    [0.16, 0.275],
    [0.585, 0.275],
    [0.545, 0.775],
    [0.2, 0.775]
  ],
  handle: { cx: 0.64, cy: 0.475, r: 0.145, from: 255, to: 105 }
};

/** @param {number} x @param {number} y @param {number} size */
function shadeMark(x, y, size) {
  const mark = size < SMALL_BELOW ? SMALL : FULL;
  const half = (size * mark.weight) / 2;

  const outline = [...mark.body, mark.body[0]].map(([bx, by]) => [size * bx, size * by]);
  let alpha = coverage(distPolyline(x, y, outline), half);

  const handle = mark.handle;
  const distance = distArc(
    x,
    y,
    size * handle.cx,
    size * handle.cy,
    size * handle.r,
    handle.from,
    handle.to
  );
  alpha = Math.max(alpha, coverage(distance, half));

  if (alpha === 0) {
    return [0, 0, 0, 0];
  }
  const [red, green, blue] = periwinkle(x, y, size);
  return [red, green, blue, Math.round(255 * alpha)];
}

// The PNG electron-builder falls back to, and what non-Windows targets use.
writeFileSync(join(outDir, 'icon.png'), renderPng(512, shadeMark));

// What ships on Windows. 20 and 24 are in the ladder because the taskbar asks
// for them at 125% and 150% display scaling.
writeFileSync(join(outDir, 'icon.ico'), renderIco(shadeMark));

console.log('Wrote resources/icon.png and resources/icon.ico');

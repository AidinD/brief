/**
 * Brief's icon: a short column of text, and the rule that ends it.
 *
 * Three lines of decreasing, ragged length - a column of prose seen from far
 * enough away that you read the shape rather than the words - and then a gap,
 * and then a full-width rule heavier than any of them.
 *
 * That rule is the whole product. A brief has a bottom: you open it once, you
 * reach the end, you close it. Every reading surface that lost that property
 * lost it one item at a time, and the mark is a promise not to. If the icon ever
 * needs a fourth line, something has gone wrong upstream of the icon.
 *
 * Two things stop it reading as a hamburger menu, which the first draft did.
 * The rule is **wider than the text**, overhanging on both sides, which is the
 * one arrangement a menu icon never has; and the gap above it is nearly twice
 * the line spacing, so it sits under the text rather than in it.
 *
 * Periwinkle, because the warm half of the family spectrum is full - Jot has
 * coral, Nib brass, Loom madder, Helm terracotta - and because the app is the
 * thing you read before the day gets loud.
 *
 * Two drawings, per the family rule. Below 32px the middle line goes: three
 * lines at 16px are three one-pixel rules a pixel apart, which average into a
 * single grey block and say nothing. Two lines and the end rule still read as
 * "a short text, finished", which is the entire content of the picture.
 *
 * Run with `node scripts/generate-icon.mjs`. The output is committed to
 * resources/, because electron-builder needs it at package time and a build
 * should never depend on having run a script first.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderPng, renderIco, coverage, diagonalRamp, distSegment, SMALL_BELOW } from 'keel/icon';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'resources');
mkdirSync(outDir, { recursive: true });

/** Periwinkle: Brief's slot on the family's cool end. */
const periwinkle = diagonalRamp([154, 148, 240], [106, 96, 201]);

/**
 * Both drawings as fractions of the canvas, matching BriefMark's 100-unit
 * viewBox in the header. Change one, change the other.
 *
 * `lines` are [y, from x, to x]. The last entry of each drawing is the end rule
 * and is drawn at `ruleWeight`.
 */
const FULL = {
  weight: 0.082,
  ruleWeight: 0.115,
  lines: [
    [0.22, 0.21, 0.79],
    [0.37, 0.21, 0.72],
    [0.52, 0.21, 0.55]
  ],
  rule: [0.8, 0.13, 0.87]
};

const SMALL = {
  weight: 0.125,
  ruleWeight: 0.165,
  lines: [
    [0.23, 0.2, 0.8],
    [0.44, 0.2, 0.56]
  ],
  rule: [0.8, 0.12, 0.88]
};

/** @param {number} x @param {number} y @param {number} size */
function shadeMark(x, y, size) {
  const mark = size < SMALL_BELOW ? SMALL : FULL

  let alpha = 0;
  for (const [ly, from, to] of mark.lines) {
    const distance = distSegment(x, y, size * from, size * ly, size * to, size * ly);
    alpha = Math.max(alpha, coverage(distance, (size * mark.weight) / 2));
  }

  const [ry, rfrom, rto] = mark.rule;
  const ruleDistance = distSegment(x, y, size * rfrom, size * ry, size * rto, size * ry);
  alpha = Math.max(alpha, coverage(ruleDistance, (size * mark.ruleWeight) / 2));

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

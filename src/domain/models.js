/**
 * Which model does which job, and how you know it actually did.
 *
 * Two jobs, and they are not the same size:
 *
 *   fetch   read the web, pull out what happened. High volume, low judgement.
 *   judge   decide needs-you versus worth-knowing, and write the Swedish.
 *
 * Putting the big model on the fetch is the expensive mistake, and it is the
 * easy one to make by accident: whoever runs the morning session inherits
 * whatever model that session happens to be on. So the model is named here, the
 * scheduled command passes it explicitly, and - this is the part that matters -
 * the model that actually ran is recorded in the brief it produced.
 *
 * ## Why provenance rather than configuration
 *
 * A configured model is a statement of intent. It tells you nothing about what
 * ran. A session can be launched with the wrong flag, a scheduler can lose an
 * argument, a default can change under you - and the output looks identical
 * either way. So `brief.json` carries a `provenance` block naming the model per
 * section, the window shows it, and a mismatch is visible rather than inferred.
 *
 * The same reasoning as everywhere else in this suite: the check has to be on
 * the artefact, not on the instruction that was supposed to produce it.
 */

/**
 * @typedef {object} ModelChoice
 * @property {string} id The model id to pass to the session.
 * @property {string} why One line on why this tier and not another.
 */

/** @type {Record<'fetch' | 'judge', ModelChoice>} */
export const MODELS = {
  fetch: {
    id: 'claude-haiku-4-5-20251001',
    why: 'Reading pages and extracting what happened is volume work. A large model here costs many times more for an answer nobody can tell apart.'
  },
  judge: {
    id: 'claude-sonnet-5',
    why: 'Needs-you versus worth-knowing is the whole product, and the prose is read every morning. This is where the money belongs.'
  }
};

/**
 * Is the model that ran the one that was supposed to?
 *
 * Compares loosely on the family, because ids carry dates and a pinned snapshot
 * is still the right tier. `claude-haiku-4-5-20251001` matches `haiku`.
 *
 * @param {string | undefined} ran
 * @param {'fetch' | 'judge'} job
 * @returns {{ ok: boolean, expected: string, ran: string | null, job: string, short: string | null }}
 */
export function checkProvenance(ran, job) {
  const expected = MODELS[job].id;
  if (ran === undefined || ran.trim() === '') {
    return { ok: false, expected, ran: null, job, short: null };
  }

  const family = (/** @type {string} */ id) => {
    const match = /(fable|opus|sonnet|haiku)/i.exec(id);
    return match === null ? id.toLowerCase() : match[1].toLowerCase();
  };

  const wanted = family(expected);
  const actual = family(ran);
  if (wanted === actual) {
    return { ok: true, expected, ran, job, short: actual };
  }

  /*
   * The family name and the job, separately, so the window can phrase it.
   *
   * `note` used to carry the whole rationale for the tier - a paragraph about
   * where the money belongs - and pasting that into a warning box made it read
   * as a wall and as an accusation about configuration. The reasoning lives in
   * MODELS[job].why for anyone who wants it; a warning needs the fact.
   */
  return { ok: false, expected, ran, job, short: actual };
}

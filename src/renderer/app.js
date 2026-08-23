/**
 * The window.
 *
 * One render function and one delegated click handler. There is no router and
 * no view system, because there is one view: the brief, top to bottom, with an
 * end.
 *
 * What is deliberately absent is as much of the design as what is here. No
 * unread count, no badge, no "12 more stories", no infinite scroll, no refresh
 * button that fetches more. The brief is regenerated once a morning by
 * something else; this window shows what that produced and then stops.
 */

/**
 * The preload bridge.
 *
 * The window-control half is read back off keel's own declaration rather than
 * written out again - the same reason keel generates its declarations instead
 * of anyone hand-writing them.
 *
 * @type {{
 *   invoke: (name: string, args?: Record<string, any>) => Promise<any>,
 *   onChanged: (callback: () => void) => () => void
 * } & ReturnType<typeof import("keel/window").windowControlsBridge>}
 */
const brief = /** @type {any} */ (window).brief;

/** @type {string[]} */
const errors = [];
/** @type {any} */ (window).__errors = errors;
window.addEventListener('error', (e) => errors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

const page = /** @type {HTMLElement} */ (document.getElementById('page'));
const dateline = /** @type {HTMLElement} */ (document.getElementById('dateline'));

/** @param {unknown} value */
function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

/**
 * "Sunday 23 August", and "Thursday 2 January 2020" when it is not this year.
 *
 * The year is not decoration. The stale warning read "This is Thursday 2
 * January's brief" for a brief four years old, which is exactly as reassuring
 * as it is wrong - the whole point of that line is that you should not act on
 * what you are looking at.
 *
 * @param {string} date `YYYY-MM-DD`
 */
function longDate(date) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) {
    return date;
  }
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: year === new Date().getFullYear() ? undefined : 'numeric'
  });
}

/**
 * One item in the world section.
 *
 * @param {any} item
 * @param {boolean} needsYou
 */
function worldItem(item, needsYou) {
  const sources = (item.sources ?? [])
    .map(
      (/** @type {any} */ source, /** @type {number} */ index) =>
        `<button class="source" data-open="${esc(source.url)}">${esc(source.title || `source ${index + 1}`)}</button>`
    )
    .join('');

  return `
    <article class="item${needsYou ? ' needs' : ''}">
      <h3 class="item-headline">${esc(item.headline)}</h3>
      ${item.why ? `<p class="item-why">${esc(item.why)}</p>` : ''}
      ${item.anchor ? `<span class="anchor">${esc(item.anchor)}</span>` : ''}
      ${sources ? `<div class="sources">${sources}</div>` : ''}
    </article>`;
}

/**
 * One candidate in the confirm section.
 *
 * @param {any} candidate
 * @param {string | undefined} verdict
 */
function candidateRow(candidate, verdict) {
  const answers =
    verdict === undefined
      ? `<div class="answers">
           <button class="yes" data-answer="accepted" data-id="${esc(candidate.id)}">Yes</button>
           <button data-answer="rejected" data-id="${esc(candidate.id)}">Not this</button>
         </div>`
      : `<div class="verdict">${verdict === 'accepted' ? 'kept' : 'dropped'}</div>`;

  return `
    <article class="candidate${verdict === undefined ? '' : ' answered'}">
      <div class="candidate-body">
        <span class="kind">${esc(candidate.kind)}</span>
        <p class="candidate-text">${esc(candidate.text)}</p>
        ${candidate.why ? `<p class="candidate-why">${esc(candidate.why)}</p>` : ''}
        ${candidate.evidence ? `<p class="evidence">${esc(candidate.evidence)}</p>` : ''}
      </div>
      ${answers}
    </article>`;
}

/**
 * What to show when there is no brief.
 *
 * Not an error. Nothing is broken - a brief is written by something else, and
 * this is what "it has not run yet" looks like. So it says how to make one
 * rather than apologising.
 *
 * @param {any} status
 */
function nothingYet(status) {
  return `
    <div class="empty">
      <h2>No brief for today.</h2>
      <p>
        A brief is written by whoever assembles it - a scheduled session, or you
        asking for one - into <code>${esc(status?.dataDir ?? 'the data directory')}\\brief.json</code>.
        This window notices the moment it appears.
      </p>
      <p class="quiet">Nothing needs doing here. Close it and come back tomorrow.</p>
    </div>`;
}

/** @param {{ section: string, count: number }[]} dropped */
function overflowNote(dropped) {
  if (dropped.length === 0) {
    return '';
  }
  const parts = dropped.map((d) => `${d.count} from ${d.section}`).join(', ');
  return `
    <div class="problems">
      This brief was over its limit and ${parts} did not make it.
      <ul><li>A brief that keeps overflowing has a filter problem, not a length problem.</li></ul>
    </div>`;
}

/** @param {string[]} problems */
function problemsNote(problems) {
  if (problems.length === 0) {
    return '';
  }
  return `
    <div class="problems">
      Some of the brief could not be read:
      <ul>${problems.map((problem) => `<li>${esc(problem)}</li>`).join('')}</ul>
    </div>`;
}

async function render() {
  const [state, verdicts, status] = await Promise.all([
    brief.invoke('today'),
    brief.invoke('answered'),
    brief.invoke('status')
  ]);

  const version = document.getElementById('version');
  if (version && status?.version) {
    version.textContent = status.version;
  }

  if (state?.error) {
    page.innerHTML = `<div class="problems">${esc(state.error)}</div>`;
    return;
  }

  const { brief: today, dropped, problems, missing } = state;
  const stale = today.date !== state.today;

  dateline.textContent = missing ? '' : longDate(today.date);
  dateline.className = stale ? 'dateline stale' : 'dateline';
  dateline.title = stale ? 'This brief is not for today.' : '';

  if (missing) {
    page.innerHTML = nothingYet(status);
    return;
  }

  const world = today.world;
  const worldEmpty = world.needsYou.length === 0 && world.worthKnowing.length === 0;

  page.innerHTML = `
    ${problemsNote(problems)}
    ${overflowNote(dropped)}
    ${
      stale
        ? `<div class="problems">This is ${esc(longDate(today.date))}'s brief. Today is ${esc(longDate(state.today))}.</div>`
        : ''
    }

    <section class="section">
      <h2 class="section-title">The world</h2>
      <p class="section-note">Filtered by what you are holding, not by topic.</p>
      ${
        worldEmpty
          ? '<p class="quiet">Nothing out there touched your work today.</p>'
          : `
            ${
              world.needsYou.length > 0
                ? `<h3 class="subhead">Needs you</h3>${world.needsYou.map((/** @type {any} */ i) => worldItem(i, true)).join('')}`
                : '<h3 class="subhead">Needs you</h3><p class="quiet">Nothing.</p>'
            }
            ${
              world.worthKnowing.length > 0
                ? `<h3 class="subhead">Worth knowing</h3>${world.worthKnowing.map((/** @type {any} */ i) => worldItem(i, false)).join('')}`
                : ''
            }`
      }
    </section>

    <section class="section">
      <h2 class="section-title">Your week</h2>
      ${today.week.summary ? `<p class="week-summary">${esc(today.week.summary)}</p>` : ''}
      ${
        today.week.moments.length > 0
          ? `<ul class="moments">${today.week.moments
              .map(
                (/** @type {any} */ moment) =>
                  `<li class="moment"><span class="moment-when">${esc(moment.when ?? '')}</span><span>${esc(moment.text)}</span></li>`
              )
              .join('')}</ul>`
          : today.week.summary
            ? ''
            : '<p class="quiet">Not written yet.</p>'
      }
    </section>

    <section class="section">
      <h2 class="section-title">Confirm this</h2>
      <p class="section-note">Remembering, turned into reviewing. A few things, never a queue.</p>
      ${
        today.confirm.length > 0
          ? today.confirm
              .map((/** @type {any} */ candidate) => candidateRow(candidate, verdicts?.[candidate.id]))
              .join('')
          : '<p class="quiet">Nothing to confirm.</p>'
      }
    </section>

    <div class="end">
      <div class="end-rule"></div>
      <p class="end-note">That is the brief.</p>
    </div>`;
}

// One delegated listener for the whole page, so a redraw cannot leak handlers.
document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const link = target.closest('[data-open]');
  if (link instanceof HTMLElement) {
    await brief.invoke('openExternal', { url: link.dataset.open });
    return;
  }

  const answer = target.closest('[data-answer]');
  if (answer instanceof HTMLElement) {
    await brief.invoke('answer', { id: answer.dataset.id, verdict: answer.dataset.answer });
    await render();
  }
});

// The window is frameless, so these three are the title bar's job. They come
// from keel, like every other app in the suite.
const WINDOW_BUTTONS = {
  minimize: () => brief.minimizeWindow(),
  maximize: () => brief.toggleMaximizeWindow(),
  close: () => brief.closeWindow()
};

document.querySelectorAll('[data-window]').forEach((button) => {
  button.addEventListener('click', () => {
    const which = String(/** @type {HTMLElement} */ (button).dataset.window);
    /** @type {Record<string, () => void>} */ (WINDOW_BUTTONS)[which]?.();
  });
});

// A brief written while the window is open appears on its own. No refresh
// button, deliberately: a button that fetches is the first step towards a feed.
brief.onChanged(() => {
  void render();
});

void render();

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
           <button class="yes" data-answer="accepted" data-id="${esc(candidate.id)}">Keep it</button>
           <button data-answer="rejected" data-id="${esc(candidate.id)}">Not this</button>
         </div>`
      : `<div class="verdict">${verdict === 'accepted' ? 'kept' : 'dropped'}</div>`;

  // The kind is colour-coded and carries a plain gloss of what keeping it does,
  // because "decision" on its own does not say where it goes.
  /** @type {Record<string, string>} */
  const gloss = {
    decision: 'a decision worth a permanent record',
    story: 'a story worth having when you need one',
    delegation: 'a handover worth checking in on',
    person: 'someone worth a conversation'
  };

  return `
    <article class="candidate kind-${esc(candidate.kind)}${verdict === undefined ? '' : ' answered'}">
      <div class="candidate-body">
        <span class="kind">${esc(candidate.kind)}</span>
        <span class="kind-gloss">${esc(gloss[candidate.kind] ?? '')}</span>
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

/* ------------------------------------------------------ the send list -- */

/**
 * What may leave the machine, one row per thing you are holding.
 *
 * This page exists because the alternative was a JSON file, and a JSON file is
 * a bad place to make fifty small privacy decisions - which means they do not
 * get made, which means the list stays empty and the feature stays off.
 *
 * Two rules it keeps, both from `outbound.js`:
 *
 *   There is no "allow all". A switch that flips fifty rows is a switch that
 *   gets flipped without reading them.
 *
 *   The page shows the terms that would *actually* be sent, verbatim, not just
 *   which rows are on. An entry with an alias sends something other than its own
 *   label, and a control you have to mentally compile is one you will misread.
 */
async function renderOutbound() {
  const [state, topics] = await Promise.all([brief.invoke('outbound'), brief.invoke('interests')]);
  const entries = state?.entries ?? [];
  const sending = state?.sending ?? [];
  const wanted = topics?.interests ?? [];

  dateline.textContent = '';
  dateline.className = 'dateline';

  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.kind)) {
      groups.set(entry.kind, []);
    }
    groups.get(entry.kind).push(entry);
  }

  const row = (/** @type {any} */ entry) => `
    <label class="send-row${entry.send ? ' on' : ''}">
      <input type="checkbox" data-send="${esc(entry.label)}" data-kind="${esc(entry.kind)}"${entry.send ? ' checked' : ''} />
      <span class="send-label">${esc(entry.label)}</span>
      <input
        class="send-as"
        type="text"
        placeholder="send as…"
        value="${esc(entry.as ?? '')}"
        data-as="${esc(entry.label)}"
        data-kind="${esc(entry.kind)}"
        title="Send this description instead of the name itself"
      />
    </label>`;

  const interestRow = (/** @type {any} */ item) => `
    <div class="topic${item.send ? '' : ' off'}">
      <div class="topic-head">
        <input type="checkbox" data-topic-send="${esc(item.term)}"${item.send ? ' checked' : ''} title="Search for this" />
        <span class="topic-term">${esc(item.term)}</span>
        <button class="topic-remove" data-topic-remove="${esc(item.term)}" title="Remove">×</button>
      </div>
      <input
        class="topic-why"
        type="text"
        placeholder="why you care — what change would you want to hear about?"
        value="${esc(item.why ?? '')}"
        data-topic-why="${esc(item.term)}"
      />
      ${item.advice ? `<p class="topic-advice">${esc(item.advice)}</p>` : ''}
    </div>`;

  page.innerHTML = `
    <section class="section">
      <p class="eyebrow">What Brief looks for</p>
      <h2 class="section-heading">Interests</h2>
      <p class="section-note">
        Standing topics, written by you. These are the search - a board says what
        you are working on this week, never what you follow in general. Because
        you wrote them, they are sent by default.
      </p>

      <div class="topics">${wanted.map(interestRow).join('')}</div>

      <form class="topic-add" id="topic-add">
        <input type="text" name="term" placeholder="Unity, engineering ladders, EU AI Act…" autocomplete="off" />
        <button type="submit">Add</button>
      </form>
    </section>

    <section class="section">
      <p class="eyebrow">What makes a story matter to you</p>
      <h2 class="section-heading">From your board</h2>
      <p class="section-note">
        Context, not search terms. "Roblox changed its payout model" is a topic
        hit; "and Meteor Run is on your board" is what makes it need you today.
        Derived from Jot without asking, so nothing here is sent unless you tick it.
      </p>
      ${
        sending.length === 0
          ? '<p class="quiet">Nothing is cleared to send, so fetching the world will refuse.</p>'
          : `<div class="sending-preview">
               <div class="sending-head">${sending.length} ${sending.length === 1 ? 'term' : 'terms'} would be sent, exactly this:</div>
               <ul class="sending-list">${sending
                 .map((/** @type {any} */ s) => `<li>${esc(s.label)}</li>`)
                 .join('')}</ul>
             </div>`
      }
      ${
        state?.unreviewed > 0
          ? `<p class="section-note">${state.unreviewed} thing${state.unreviewed === 1 ? '' : 's'} on your board ${state.unreviewed === 1 ? 'is' : 'are'} not on this list yet.
             <button class="inline-action" data-refresh="1">Add them, switched off</button></p>`
          : ''
      }
    </section>

    ${[...groups.entries()]
      .map(
        ([kind, rows]) => `
          <section class="section">
            <h2 class="section-title">${esc(kind)}</h2>
            ${
              kind === 'area'
                ? `<p class="section-note">A category name is a filing label. Ticking "Household" sends those two words and nothing else, which a search engine can do nothing with - use the alias field, or leave these alone and rely on the tasks below.</p>`
                : ''
            }
            <div class="send-rows">${rows.map(row).join('')}</div>
          </section>`
      )
      .join('')}

    ${
      entries.length === 0
        ? `<div class="empty">
             <h2>Nothing to review yet.</h2>
             <p>Brief has not read your board, or the board is empty.</p>
             <p><button class="inline-action" data-refresh="1">Read the board</button></p>
           </div>`
        : ''
    }`;
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

  /*
   * The masthead's heading is a sentence, not a count.
   *
   * It is the most useful line on the page - it says what kind of morning this
   * is before you read anything - and phrasing it as prose is what keeps it from
   * becoming the badge this app refuses to have. On a quiet day it says so, in
   * as many words as a busy day gets.
   */
  const needs = world.needsYou.length;
  const shape =
    needs === 0
      ? 'Nothing needs you today.'
      : needs === 1
        ? 'One thing needs you.'
        : `${needs} things need you.`;

  page.innerHTML = `
    ${problemsNote(problems)}
    ${overflowNote(dropped)}
    ${
      stale
        ? `<div class="problems">This is ${esc(longDate(today.date))}'s brief. Today is ${esc(longDate(state.today))}.</div>`
        : ''
    }

    <header class="masthead">
      <p class="eyebrow">${esc(longDate(today.date))}</p>
      <h1 class="masthead-title">${esc(shape)}</h1>
    </header>

    <section class="section">
      <p class="eyebrow">Needs you, then worth knowing</p>
      <h2 class="section-heading">The world</h2>
      <p class="section-note">Filtered by what you follow and what you are carrying, not by topic words.</p>
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
      <p class="eyebrow">Written for you, not by you</p>
      <h2 class="section-heading">Your week</h2>
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
      <p class="eyebrow">Remembering, turned into reviewing</p>
      <h2 class="section-heading">Confirm this</h2>
      <p class="section-note">A few things, never a queue. Keeping one writes it down for good; turning one down is recorded too, so a bad filter shows up.</p>
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

/* ------------------------------------------------------------- routing -- */

/** Two pages: the brief, and the send list. Not a router. */
let view = 'brief';

const toggle = /** @type {HTMLButtonElement} */ (document.getElementById('view-toggle'));

async function draw() {
  toggle.textContent = view === 'brief' ? 'Sending' : 'Back to the brief';
  await (view === 'brief' ? render() : renderOutbound());
}

toggle.addEventListener('click', () => {
  view = view === 'brief' ? 'outbound' : 'brief';
  void draw();
});

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
    await draw();
    return;
  }

  const refresh = target.closest('[data-refresh]');
  if (refresh instanceof HTMLElement) {
    await brief.invoke('refreshOutbound');
    await draw();
    return;
  }

  const remove = target.closest('[data-topic-remove]');
  if (remove instanceof HTMLElement) {
    await brief.invoke('removeInterest', { term: remove.dataset.topicRemove });
    await draw();
  }
});

// Adding an interest is a form, so Enter works without a keydown handler.
document.addEventListener('submit', async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'topic-add') {
    return;
  }
  event.preventDefault();
  const field = /** @type {HTMLInputElement} */ (form.elements.namedItem('term'));
  const term = field.value.trim();
  if (term === '') {
    return;
  }
  await brief.invoke('setInterest', { term });
  await draw();
});

/*
 * The send list writes on change rather than behind a Save button.
 *
 * A Save button on a privacy control is a way to believe you have decided
 * something you have not. The file is the truth, and it should agree with the
 * screen at every moment.
 */
document.addEventListener('change', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (target.dataset.send !== undefined) {
    await brief.invoke('setOutbound', {
      label: target.dataset.send,
      kind: target.dataset.kind,
      send: target.checked
    });
    await draw();
    return;
  }

  if (target.dataset.as !== undefined) {
    await brief.invoke('setOutbound', {
      label: target.dataset.as,
      kind: target.dataset.kind,
      as: target.value
    });
    await draw();
    return;
  }

  if (target.dataset.topicSend !== undefined) {
    await brief.invoke('setInterest', { term: target.dataset.topicSend, send: target.checked });
    await draw();
    return;
  }

  if (target.dataset.topicWhy !== undefined) {
    await brief.invoke('setInterest', { term: target.dataset.topicWhy, why: target.value });
    await draw();
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
  if (view === 'brief') {
    void render();
  }
});

void draw();

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
 *   onChanged: (callback: () => void) => () => void,
 *   onProgress: (callback: (p: { stage: string, message: string } | null) => void) => () => void
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
 * The principle, drawn from the library in Nib and shown last.
 *
 * Last on purpose. Everything above it is the day making demands; this is the
 * one thing on the page that asks for nothing, and putting it at the bottom
 * makes reaching the bottom worth something rather than merely finishing.
 *
 * It carries no buttons and is never counted. A principle you have to answer is
 * a task, and there are enough of those higher up.
 *
 * @param {any} lesson
 */
function lessonNote(lesson) {
  if (lesson === null || lesson === undefined) {
    return '';
  }
  const attribution = [lesson.source, lesson.why].filter((part) => part).join(' · ');
  return `
    <aside class="lesson">
      <p class="eyebrow">One from your library</p>
      <p class="lesson-title">${esc(lesson.title)}</p>
      <p class="lesson-line">${esc(lesson.line)}</p>
      ${attribution ? `<p class="lesson-source">${esc(attribution)}</p>` : ''}
    </aside>`;
}

/**
 * One thing to learn, and the way in to the three minutes behind it.
 *
 * Sits directly above the principle, and is the same size as it. The two belong
 * together at the bottom: one is something already known coming round again, the
 * other is something not known yet, and neither is the day making a demand.
 *
 * It carries one button and is still not counted in "N things need you". A
 * button is not the same thing as a question - this one opens a page and can be
 * ignored forever without anything going stale, which is precisely what the
 * confirm section's buttons cannot claim.
 *
 * The button appears only when there is genuinely a page behind it. `ready`
 * comes from main, which has looked: the renderer has no filesystem, and a
 * "Learn more" that opens nothing is worse than a card with no button at all.
 *
 * @param {any} learn
 * @param {{ ready: boolean, minutes: number | null }} article
 */
function learnCard(learn, article) {
  if (learn === null || learn === undefined) {
    return '';
  }
  const minutes = article.minutes === null ? '' : ` · ${article.minutes} min`;
  return `
    <aside class="learn">
      <p class="eyebrow">One thing to learn</p>
      <p class="learn-title">${esc(learn.title)}</p>
      <p class="learn-line">${esc(learn.line)}</p>
      ${learn.why ? `<p class="learn-why">${esc(learn.why)}</p>` : ''}
      ${
        article.ready
          ? `<button class="learn-more" data-learn="1">Learn more${minutes}</button>`
          : ''
      }
    </aside>`;
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
      <p class="quiet">
        On a machine with the morning task installed it appears on its own.
        On one without, here is the button.
      </p>
      <p><button class="make" data-make="1">Write today's brief</button></p>
    </div>`;
}

/**
 * What a run says while it is going.
 *
 * A fetch and a judgement take a couple of minutes between them, and a button
 * that goes quiet for two minutes is a button people press again.
 *
 * @param {{ stage: string, message: string } | null} progress
 */
function progressNote(progress) {
  if (progress === null) {
    return '';
  }
  return `
    <div class="problems working">
      <span class="model-line">${esc(progress.stage)} — ${esc(progress.message)}</span>
    </div>`;
}

/**
 * When this brief was written, and by what.
 *
 * A quiet statement rather than a warning - the warning above only appears when
 * something is wrong. This one is always there, because "is this fresh" is the
 * first question you have on opening the window and reading the date does not
 * answer it: a brief can carry today's date and have been written at midnight
 * from yesterday's news.
 *
 * @param {any} brief
 */
function writtenLine(brief) {
  const when =
    typeof brief.generatedAt === 'number' && brief.generatedAt > 0
      ? new Date(brief.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : null;

  const models = ['fetch', 'judge']
    .map((job) => {
      const id = brief.provenance?.[job];
      if (typeof id !== 'string' || id === '') {
        return null;
      }
      // The family, not the dated id. Nobody reads a snapshot date.
      return (/(fable|opus|sonnet|haiku)/i.exec(id)?.[1] ?? id).toLowerCase();
    })
    .filter(Boolean);

  const by =
    models.length === 0
      ? 'by hand'
      : models[0] === models[1]
        ? `by ${models[0]}`
        : `by ${models.join(' then ')}`;

  return when === null ? `Written ${by}.` : `Written ${when}, ${by}.`;
}

/** @param {{ section: string, count: number }[]} dropped */
function overflowNote(dropped) {
  if (dropped.length === 0) {
    return '';
  }
  const parts = dropped.map((d) => `${d.count} from ${d.section}`).join(', ');
  return `
    <div class="problems overflow">
      This brief was over its limit and ${parts} did not make it.
      <ul><li>A brief that keeps overflowing has a filter problem, not a length problem.</li></ul>
    </div>`;
}

/**
 * Which model actually produced this, when it is not the one that should have.
 *
 * Silent when everything is as intended - this is not a status readout, it is a
 * warning. Loud when it is wrong, because "the big model did the fetching" is
 * money spent for an answer nobody can tell apart, and nothing else would ever
 * reveal it: the output looks identical either way.
 *
 * @param {{ expected: string, ran: string | null, job: string, short: string | null }[]} models
 */
function modelNote(models) {
  if (models.length === 0) {
    return '';
  }

  /*
   * Short, and it names the remedy.
   *
   * The first version pasted the whole rationale for each tier into the box -
   * two dense paragraphs about where the money belongs - which read as a wall
   * and, worse, read as "your configuration is broken". The usual cause is
   * neither: it is a brief somebody wrote by hand. Say what ran, say what was
   * meant to, and say the one command that does it properly. The reasoning
   * belongs in DECISIONS.md, where it is not in the way.
   */
  const lines = models
    .map((model) => {
      const ran = model.ran === null ? 'Nothing recorded which model made this' : `${esc(model.short)} did the ${esc(model.job)}`;
      return `<div><span class="model-line">${ran}</span><span class="mono">${esc(model.ran ?? '—')} → ${esc(model.expected)}</span></div>`;
    })
    .join('');

  return `
    <div class="problems models">
      ${lines}
      <div class="model-remedy">
        A brief written by hand records whoever wrote it. The morning run uses the
        right model for each half - <span class="mono">npm run morning</span> prints its two commands.
      </div>
    </div>`;
}

/** @param {string[]} problems */
function problemsNote(problems) {
  if (problems.length === 0) {
    return '';
  }
  return `
    <div class="problems unreadable">
      Some of the brief could not be read:
      <ul>${problems.map((problem) => `<li>${esc(problem)}</li>`).join('')}</ul>
    </div>`;
}

/**
 * Things the brief says that do not hold up.
 *
 * Separate from `problemsNote`, and the wording is the whole reason. A problem
 * means the file could not be read. A doubt means it read perfectly and is
 * telling you something suspect - a story citing a source from five months ago.
 * Announcing "some of the brief could not be read" about a story that was read
 * exactly right sends you looking for a parsing bug instead of at the date.
 *
 * @param {string[]} doubts
 */
function doubtsNote(doubts) {
  if (doubts.length === 0) {
    return '';
  }
  const lead = doubts.length === 1 ? 'One thing here is worth checking:' : 'Some things here are worth checking:';
  return `
    <div class="problems doubtful">
      ${lead}
      <ul>${doubts.map((doubt) => `<li>${esc(doubt)}</li>`).join('')}</ul>
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
        <input
          class="topic-term"
          type="text"
          value="${esc(item.term)}"
          data-topic-term="${esc(item.term)}"
          title="The words that go to the search. Edit to reword it."
        />
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
                ? `<p class="section-note">A category name is a filing label. Ticking a category called "Household" sends that one word and nothing else, which a search engine can do nothing with - use the alias field, or leave these alone and rely on the tasks below.</p>`
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
  const [state, verdicts, status, keptSoFar] = await Promise.all([
    brief.invoke('today'),
    brief.invoke('answered'),
    brief.invoke('status'),
    brief.invoke('kept')
  ]);

  const version = document.getElementById('version');
  if (version && status?.version) {
    version.textContent = status.version;
  }

  if (state?.error) {
    page.innerHTML = `<div class="problems failed">${esc(state.error)}</div>`;
    return;
  }

  const { brief: today, dropped, problems, doubts, missing } = state;
  const stale = today.date !== state.today;

  dateline.textContent = missing ? '' : longDate(today.date);
  dateline.className = stale ? 'dateline stale' : 'dateline';
  dateline.title = stale ? 'This brief is not for today.' : '';

  if (missing) {
    page.innerHTML = progressNote(progress) + nothingYet(status);
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
  /*
   * What is owed counts towards the sentence, because it needs you in exactly
   * the sense the sentence means: something is yours to do. It renders in its
   * own section rather than under "The world" - a duty Tend is tracking did not
   * come from the news, and putting it under that heading would be the same
   * class of lie as announcing a readable brief could not be read.
   */
  const behind = today.behind ?? [];
  const needs = world.needsYou.length + behind.length;
  const shape =
    needs === 0
      ? 'Nothing needs you today.'
      : needs === 1
        ? 'One thing needs you.'
        : `${needs} things need you.`;

  page.innerHTML = `
    ${progressNote(progress)}
    ${problemsNote(problems)}
    ${doubtsNote(doubts ?? [])}
    ${modelNote(state.models ?? [])}
    ${overflowNote(dropped)}
    ${
      stale
        ? `<div class="problems stale">
             <span>This is ${esc(longDate(today.date))}'s brief. Today is ${esc(longDate(state.today))}.</span>
             <button class="make inline" data-make="1">Get today's</button>
           </div>`
        : ''
    }

    <header class="masthead">
      <p class="eyebrow">${esc(longDate(today.date))}</p>
      <h1 class="masthead-title">${esc(shape)}</h1>
      <p class="written">${esc(writtenLine(today))}</p>
    </header>

    ${
      behind.length > 0
        ? `<section class="section behind">
             <p class="eyebrow">From Tend, not from the news</p>
             <h2 class="section-heading">Behind</h2>
             <p class="section-note">Commitments past their interval, and people you have not spoken to. Tend holds the detail and keeps counting; this only says you are behind.</p>
             ${behind.map((/** @type {any} */ i) => worldItem(i, true)).join('')}
           </section>`
        : ''
    }

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
      ${
        keptSoFar?.count > 0
          ? `<p class="kept-so-far">
               ${keptSoFar.count} thing${keptSoFar.count === 1 ? '' : 's'} kept so far.
               <button class="inline-action" data-open-kept="1">Open kept.md</button>
             </p>`
          : '<p class="kept-so-far quiet">Nothing kept yet. What you keep is appended to kept.md, which you can open and read.</p>'
      }
    </section>

    ${learnCard(today.learn ?? null, state.article ?? { ready: false, minutes: null })}

    ${lessonNote(today.lesson ?? null)}

    <div class="end">
      <div class="end-rule"></div>
      <p class="end-note">That is the brief.</p>
    </div>`;
}

/* ------------------------------------------------------------- routing -- */

/** Two pages: the brief, and the send list. Not a router. */
let view = 'brief';

/**
 * What a run is doing right now, or null.
 *
 * Held outside render so a redraw does not lose it - the brief arriving
 * mid-run triggers one.
 *
 * @type {{ stage: string, message: string } | null}
 */
let progress = null;

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

  const make = target.closest('[data-make]');
  if (make instanceof HTMLElement) {
    const result = await brief.invoke('makeBrief');
    if (result?.error) {
      progress = { stage: 'failed', message: result.error };
    } else if (result?.ok === false) {
      progress = { stage: 'failed', message: result.reason ?? 'the run did not finish' };
    }
    await draw();
    return;
  }

  const learnMore = target.closest('[data-learn]');
  if (learnMore instanceof HTMLElement) {
    // The failure is worth saying out loud rather than swallowing: a button that
    // does nothing when pressed is the one thing that stops this section being
    // trusted, and the usual cause - the article file never got written - is
    // invisible from the window.
    const result = await brief.invoke('openLearn');
    if (result?.error) {
      progress = { stage: 'learn', message: result.error };
      await draw();
    }
    return;
  }

  const openKept = target.closest('[data-open-kept]');
  if (openKept instanceof HTMLElement) {
    await brief.invoke('openKept');
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
    return;
  }

  // Renaming is its own operation rather than a `setInterest` with a new term:
  // that one creates when it finds no match, which would leave the old interest
  // sitting beside the new one with the same `why`. A refusal comes back as a
  // reason rather than an exception, and the field goes back to what it was -
  // silently keeping a rejected edit on screen is how you think you renamed
  // something that you did not.
  if (target.dataset.topicTerm !== undefined) {
    const from = target.dataset.topicTerm;
    const to = target.value.trim();
    if (to === from) {
      return;
    }
    const result = await brief.invoke('renameInterest', { from, to });
    if (result?.ok === false) {
      target.value = from;
      progress = { stage: 'interests', message: result.reason ?? 'that rename was refused' };
    }
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

// A failure stays on screen until the next draw; a success is cleared by the
// brief arriving, which is a better signal than any message.
brief.onProgress((update) => {
  progress = update;
  if (view === 'brief') {
    void render();
  }
});

void draw();

# Decisions

Newest first. Each entry: the date, what was decided, what else was considered,
and why this won.

## 2026-08-24 — The data directory is a real path, never `userData`

**Decided.** `BRIEF_DATA_DIR` points at `D:\Dropbox\brief`, and the default
`userData` location is treated as unusable rather than as a reasonable fallback.

**Why, and it is not about syncing.** An agent session runs in a sandbox that
redirects writes under `%APPDATA%` into a private per-process overlay. A brief
written to `userData` therefore lands somewhere only that session can see. The
app the user launches reads the true path and correctly reports no brief.

**What makes this expensive is that it is invisible from one side.** The session
can list the file, read it, parse it through the app's own store, watch
`fs.watch` fire on it, launch the development build and watch it render, and
launch the *packaged* binary and watch that render too - because every process
it spawns inherits the same overlay. Five independent confirmations, all worth
nothing. The user's own window reported `missing: true` throughout and was
right every time.

**The diagnostic rule this earns:** when the user's instance and yours disagree
about whether a file exists, the disagreement *is* the finding. Stop gathering
evidence from your own side, because more of it will keep agreeing with itself.
Jot's notes already said this - verify against the user's own app instance,
never one you spawned - and the reason it had to be learned twice is that the
first time it was filed as a fact about corruption claims rather than as a fact
about where data may live.

Files written on `D:` cross the boundary normally. The installer built there
reached the user in the same minutes the brief did not, which was the evidence
sitting in plain sight the whole time.

## 2026-08-23 — Derived locally, sent only on purpose

**Decided.** Brief works out what you are holding by reading your Jot board, and
**none of that is allowed to leave the machine**. What may be sent to a third
party lives in `outbound.json`, opt-in per item, and an empty list makes the
fetch refuse rather than fall back to everything.

**This was very nearly the opposite.** The design that reads best — and the one
written into the original idea — is that relevance is *derived* rather than
configured: your board already says what you are carrying, so use it as the
search filter and there is nothing to keep up to date. The first version did
exactly that, and the dry run printed 51 items headed for Google. Among them:
four internal project codenames from the work side, and from the private side
which books someone is reading and which companies they have applied to.

Nothing was wrong with the derivation. What was wrong was treating "Brief knows
this" and "Brief may send this" as the same fact. They are one line apart in the
code and a long way apart in consequence.

**Considered and rejected: filter by Jot's `domain` field.** Categories are
already tagged `work` or `private`, so sending only the work half is one line.
It is worse, not better: the work half is exactly where the internal codenames
are. A filter that looks principled and leaks the more sensitive half is worse
than no filter, because it stops anyone looking again.

**Considered and rejected: a warning.** Print what is about to be sent, ask for
confirmation, proceed. A default that leaks is not fixed by a warning — it is
fixed by not being the default. The prompt gets acknowledged on the second
morning and read on none of them.

**`as` is what makes the opt-in usable.** An entry can carry a neutral
description to be sent in place of its label. `Kestrel` goes out as
"AI-assisted content pipelines": the search is as good and the codename stays
here. Without it the honest choice would often be to send nothing, and a privacy
control that costs the whole feature gets switched off.

**The generated list arrives switched off**, and re-running the draft after the
board changes keeps every decision already made. A generated file that arrives
ticked is a file nobody reads, and this one exists to be read. A ticked item
that later leaves the board keeps its tick, because deleting a task in Jot is
not a decision about what may be searched for.

## 2026-08-23 — Gemini for the world, Claude for your notes

**Decided.** The world section is fetched with Gemini. Sections two and three —
your week, and the things to confirm — are assembled by Claude and never leave
for another vendor.

**Why Gemini at all.** Reading a lot of source text is the cheap, high-volume
half of this, and the AI Studio free tier covers a brief a day many times over.
Judgement and prose are the expensive half and stay where the rest of the
reasoning is.

**Why the line is where it is, and why it is not about cost.** Sections two and
three come out of Nib notes and the Tend store, and the Tend store holds
assessments of **named colleagues**. Sending that to an additional vendor is a
decision about other people's privacy, made on their behalf, without them. The
world section is public news and carries none of that.

The reason this is written down rather than left as an obvious constraint: it
will look like a cost optimisation to a future session counting quota, and it is
not one. Do not move it.

**A Gemini subscription is not API access.** They are separate products; the
subscription grants nothing here. `GEMINI_API_KEY` is a free AI Studio key.

**Two calls, not one, and that is the API's choice.** Gemini rejects a
`responseSchema` alongside the `google_search` tool — "controlled generation is
not supported with google_search tool". So the fetch searches freely for prose,
then shapes that prose into JSON in a second call with no tools. The shaping
call is told to add nothing, because the obvious failure of a
turn-this-into-JSON step is a model that helpfully invents the source URL a
story was missing.

**Grounding metadata is kept, but not trusted as the durable link.** The URLs it
returns are `vertexaisearch.cloud.google.com` redirects that expire. Both those
and whatever the model wrote inline are stored.

## 2026-08-23 — A brief has a bottom, and the caps are code

**Decided.** Five items that need you, seven worth knowing, six moments, five
things to confirm. Over the cap, the extras are dropped **and the drop is shown**.

**Why not a guideline.** Every reading surface that lost its bottom lost it the
same way: not by deciding to become infinite, but by letting one more item in, a
hundred times. A limit in a document is a limit that loses that argument. A
limit in `clamp()` with a test on it does not.

**Why the overflow is reported rather than trimmed silently.** A brief that
quietly truncates looks like a short day, and the generator never gets
corrected. The overflow is the only signal that says the filter is wrong, and it
belongs on screen.

**`confirm` is the tightest cap and the most valuable section.** A queue of
thirty mediocre suggestions is worse than no queue: people learn to clear it
without reading, and then the two that mattered go with the rest.

**What is deliberately absent:** no unread count, no badge, no infinite scroll,
no refresh button. A button that fetches is the first step towards a feed.

## 2026-08-23 — The app renders, something else writes

**Decided.** Brief has no scrapers, no scheduler and no network code in the app.
A generator writes `brief.json` into the data directory; the main process
watches the directory and tells the window.

**Considered and rejected: fetching in the app.** It would mean a scheduler, a
retry policy, credential storage, and source-specific parsers that rot. All of
that lives better in a session that runs once a morning, and swapping a source
then costs nothing here.

**The directory is watched, not the file.** `brief.json` is replaced by a
rename, and a watch on the file itself stops firing after the first write — the
watcher is still holding the old inode. Debounced, because a rename produces two
events on Windows.

**Answers do not edit the brief.** Accepting or rejecting appends to
`confirmed.jsonl`. The brief is the record of what was *proposed*, and editing an
answered item out of it would destroy the only evidence of what the generator
suggested. Rejections are recorded for the same reason: a generator whose
suggestions are always turned down has a bad filter, and the acceptances alone
never show that.

## 2026-08-23 — Plain DOM, no build step, keel for the shared parts

**Decided.** Same stack as Tend: plain ESM with JSDoc types, `checkJs`, and
electron-builder packing `src/**` directly. `keel/window` for the title bar,
`keel/icon` for the icon.

**Why not React, like Jot and Nib.** Brief is a page of prose with three buttons
on it. One render function and one delegated click handler is the whole
renderer; a component tree and a bundler would be more machinery than product.

**keel is a real `dependency`, not a devDependency.** Jot bundles, so its copy is
inlined at build time. Brief ships its source unbuilt, so the import survives
into the asar and electron-builder has to pack it. A preload that fails to
resolve a bare specifier fails *silently* — the window buttons simply stop doing
anything — so `test:app -- --packaged` clicks maximise and asserts the window
resized.

**The renderer's type for the bridge is derived from keel's declaration**, not
written out again. Restating a shape you do not own is how a compiler starts
lying to you; keel generates its own declarations for exactly that reason.

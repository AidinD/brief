# Decisions

Newest first. Each entry: the date, what was decided, what else was considered,
and why this won.

## 2026-08-25 - Market levels get in. Predictions do not.

**Decided.** Brief reports published market figures - a sentiment gauge, a
commodity at a multi-month extreme, a large move over a stated window - and is
forbidden from carrying any view about where they are going.

**What was asked for.** Whether Brief could "predict" world news in a way that
helps with investing: a nudge when tensions rise so oil is worth a look, or when
crypto sentiment turns.

**Why the prediction half is refused.** No model forecasts markets, and a tool
that appears to would be worse than nothing here: it reads as confident exactly
when it is wrong, and real money is on the other side of it. The line runs
through the middle of the request itself. "Tensions between the US and Iran rose"
is observable. "So look at oil" is the conclusion, and it belongs to the reader.

**What that means concretely.** The fetch prompt now names forecasts, price
targets, analyst ratings and buy/sell recommendations as excluded, and requires a
level to arrive as a number with its unit, window and comparison point - "Gold
2,480 USD, highest close since April 2024" rather than "gold is rallying". A
geopolitical event goes in as the event, never paired with a price conclusion.
`test/assignment.test.mjs` asserts each of those against the built prompt, so a
future rewrite of the surrounding prose cannot quietly drop them.

**Standing gauges are the one exception to the 48-hour rule.** Everything else in
the brief has to be a change from the last two days. A gauge is a state, not an
event, so that rule silently dropped it on every ordinary day - which is why the
Fear & Greed interest was in the list and producing nothing. An interest that
names a gauge now gets today's value whatever it reads, because "normal" is an
answer to "how does it look".

**Always worthKnowing, never needsYou.** A number asks for judgement, not for
action today. Brief's existing rule is that a wrong "needs you" costs more trust
than a missed story; a market figure there would be the app telling somebody to
trade, which is a different and worse failure.

**The portfolio stays out.** The scan is of the market at large, deliberately not
tied to holdings. That was the user's own framing and it is also what keeps the
privacy line intact: holdings live in Jot and Börslabbet, `sendable()` decides
what may leave, and a portfolio is not on that list. A version of this feature
that personalised on holdings would have to send them somewhere.

**Alternative rejected - scoring or ranking the signals.** A "conviction" number
or a sorted list of what looks most interesting is a recommendation wearing a
statistic's clothes. The figures are reported flat, and the reader ranks them.

## 2026-08-24 - The mark is a cup, because the old one was furniture

**Decided.** Brief's mark is a cup: a tapered body and a handle, one stroke
weight, still periwinkle. The three ragged lines and the heavier rule under them
are gone.

**What was wrong with the old one.** Not the argument, which held up. The rule
was wider than the text so it could not read as a hamburger menu, and the gap
above it was nearly twice the line spacing. The picture lost anyway. Set beside
the family at 76px and at 16px, Brief was the only app drawing a piece of
interface rather than an object, and the only one with no curve in it. Jot draws
a tick, Nib a nib, Loom a thread, Nudge a ring and an arrow, PomPom a tomato,
Tend four tally marks, Helm a ship's wheel. A reader who has not read the
generator's header comment sees a list-alignment icon, and the header comment is
not shipped.

**Eleven candidates, and two findings worth more than any of them.**

*Paper collapses at icon size.* A sheet is a rectangle, and every rectangle is
already spoken for: the file glyph, a window, a phone with a home button. A
briefcase read perfectly and was rejected on meaning rather than on drawing, a
folded note came out a window, a sealed dispatch came out a phone, and a rolled
scroll came out a snail.

*A disc plus anything horizontal is a finished glyph you did not choose.* Disc on
a bar is a bowler hat. Disc above a curve is an avatar, head and shoulders. Disc
inside a broken line is a slider handle. That was three attempts at the same
sunrise idea, each landing on a different meaning that was not sunrise, and the
semantics were the best of any candidate.

**Why a cup wins.** The suite's surviving marks all share one structure: a closed
form and one small distinguishing element. Ring and tick, ring and arrow, outline
and slit, body and calyx. A cup is that shape of idea, and it survives 16px
without any part being dropped, which the old mark could not do. The precedent
for the object is PomPom, which draws a tomato rather than a timer: the ritual,
not the mechanics. Brief is what you read once, early, before the day gets loud.

**The known objection**, recorded because it will come back: a cup can be read as
"a coffee app", and it says morning rather than briefing. The alternative that
said briefing was a pilcrow, which is crisp at every size and is also the "show
formatting" button in every word processor, so it fails the same way the old mark
did. Meaning was traded for not being furniture.

**What the handle costs.** Below 32px the body widens, the stroke thickens and
the handle grows, because a handle at full-size proportions has its counter close
up at 16px and a cup with a filled handle is a bucket. Same silhouette either
way. Nib's generator is the warning against going further than that: it once drew
a genuinely different mark for the small frames, and Windows showed one logo in
the taskbar and another in search.

The geometry exists twice, as it did before: `scripts/generate-icon.mjs` and the
inline SVG in `src/renderer/index.html`, which is the SMALL drawing. The arc in
the SVG was checked numerically against the generator rather than by eye: its
large-arc and sweep flags resolve to centre (64, 47.5), r 14.5, running 255 to
105 degrees clockwise, which is `SMALL.handle`.

## 2026-08-24 — One vendor, two models, and the check is on the artefact

**Decided.** Gemini is gone. A Claude session does the whole world half, in two
steps on two different models, and `brief.json` records which model actually ran.

**What killed the Gemini half.** Search grounding on the Gemini API is
**paid-tier only** — $35 per 1000 grounded prompts. It is free in AI Studio's web
interface, which is where the earlier claim of "a few thousand free grounded
prompts a month" came from, and it does not transfer to the API. Measured rather
than argued: plain `generateContent` returned **200** and every call carrying
`google_search` returned **429**, across four models. Without grounding a model
answers about the last 48 hours from training data, which is worse than no answer
because it is confidently stale.

Two smaller findings from the same session, both worth keeping:

- **A retired model still appears in the models listing.** `gemini-2.5-flash`
  answered 404 with "no longer available to new users" while `/models` happily
  listed it. Nothing short of a real call revealed it.
- **Pin nothing by default.** The failure mode of a pinned model is that the
  brief goes silent one morning for a reason unrelated to the brief. An alias
  cannot go stale; the version can still be pinned when you want it pinned.

**Why one vendor is better, not merely cheaper.** The thing that writes the brief
was always going to be a Claude session — it reads Nib and Tend for the other two
sections. Giving it the world half too removes a key, a billing relationship and
a second privacy surface. The line in the previous entry ("Gemini for the world,
Claude for your notes") existed to keep private notes away from an extra vendor;
with no extra vendor it is satisfied trivially rather than carefully.

**Two models, and the split is the point.** The fetch is volume work — read pages,
extract what happened — and belongs on the cheap tier. Judgement and the Swedish
prose are the product and belong on a good one. The expensive mistake is the
easy one to make by accident, because a session inherits whatever model it was
launched with, so the morning run is **two commands with explicit `--model`
flags** rather than one session doing both.

**Configuration is intent; provenance is fact.** A configured model tells you
nothing about what ran — a flag can be lost, a default can move, and the output
looks identical either way. So `brief.json` carries `provenance.fetch` and
`provenance.judge`, the window warns when either is the wrong tier, and **absent
provenance is a failure rather than a pass**. Same principle as everywhere else
here: check the artefact, not the instruction that was supposed to produce it.

The first brief written this way records `claude-opus-5` for both halves and the
window says so, which is correct and is the mechanism working.

**And a filter lesson.** That first brief led with a Roblox Creator Store deadline
as "needs you". Aidin does not publish to Roblox and has no developer account, so
it needed somebody else entirely. An interest in a platform is not evidence that
you ship on it, and inferring a role produces the one failure that costs real
trust. The fetch prompt now says so outright, and the fix at the data level is
the `why` on an interest carrying the constraint.

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

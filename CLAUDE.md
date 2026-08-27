# Brief - project notes

Brief is the morning surface: the world, what you are behind on, your week, the
few things that want confirming, and one principle to carry into the day. It
sits **beside** Jot (`D:\Repo\Tools\jot`), Nib
(`D:\Repo\Tools\nib`) and Tend (`D:\Repo\Tools\tend`), not inside any of them.

## Read these first

- [DECISIONS.md](DECISIONS.md) - what was decided and why, with the alternatives
  that lost. Newest first.
- [docs/format.md](docs/format.md) - the `brief.json` contract. Read before
  writing a generator, and update it if the shape changes.

Keep DECISIONS.md current as work happens, not batched at the end.

## The rule that outranks the others

**A brief has a bottom.** No infinite scroll, no unread count, no badge, no
refresh button. The caps live in `LIMITS` in `src/domain/brief.js` and are
enforced by `clamp()`, with tests. If a change makes the page longer without
somebody deciding it should be, the change is wrong.

Raising a cap is a real decision, not a tweak. Write it in DECISIONS.md.

## A brief you write may be invisible to the app

**The data directory must be a real path, not `userData`.** Point
`BRIEF_DATA_DIR` at something like `D:\Dropbox\brief` and keep it there.

An agent session runs in a sandbox where writes under `%APPDATA%` are
redirected into a private per-process overlay. So a brief written to the default
`userData` directory lands in that overlay: the session can list it, read it,
parse it, and even launch Brief itself and watch it render - because a process
the session spawns inherits the same overlay - while the app the user actually
launched from the Start menu reads the real path and correctly reports that
there is no brief.

Everything looks consistent from inside. This cost a long debugging detour:
the file existed, the store parsed it, `fs.watch` fired, the dev build rendered
it, and the packaged binary rendered it - all from spawned processes. The user's
own window said `missing: true` the whole time, and it was right.

The tell: **the user's instance disagrees with yours about a file.** When that
happens, stop testing from your own side. Jot hit this first and its notes say
the same thing - verify against the user's own app instance, never one you
spawned.

Anything written to `D:` is real and crosses the boundary fine, which is why the
installer reached the user when the brief did not.

## The privacy line, which is easy to erase by accident

**What Brief knows and what Brief may send are different facts.**

`src/service/holdings.js` reads your Jot board to work out what you are holding.
That is local. It is **not** the search filter, however much it reads like one -
a board carries internal project codenames and, on the private side, what
someone is reading and where they have applied.

`src/service/outbound.js` is what may leave: opt-in per item, defaulting to
nothing, refusing rather than falling back. Anything that builds a request body
reads `sendable()`, never `holdings()`. If you find yourself passing holdings
into a fetch, that is the bug.

**There is no second vendor any more.** Gemini used to do the world half; search
grounding on its API turned out to be paid-tier only, so a Claude session does
all three sections. That removes the key, the billing and the second privacy
surface. If you are ever tempted to add a vendor back for the world half, the
line to keep is that Nib notes and the Tend store - which hold assessments of
named colleagues - never go to one.

## Two models, and provenance is how you know

`src/domain/models.js` names the tier per job: the **fetch** is volume work and
belongs on Haiku, the **judge** step writes the prose and belongs on Sonnet.
Never Opus on the fetch; there is a test asserting that.

The morning run is **two commands** (`npm run morning` prints them), not one
session doing both, because a session inherits whatever model it was launched
with and the expensive mistake is the accidental one.

**A configured model is intent. Provenance is fact.** `brief.json` carries
`provenance.fetch` and `provenance.judge`; the window warns when either is the
wrong tier, and **absent provenance is a failure, not a pass** - "there is no way
to tell" is the honest answer and must not read as compliant. Check the artefact,
never the instruction that was supposed to produce it.

## Never infer what the user does for a living

An interest in a platform is not evidence that they ship on it. The first real
brief led with a Roblox publishing deadline as "needs you"; Aidin has no
developer account, so it needed somebody else. A wrong "needs you" costs more
trust than a missed story, and the fetch prompt says so explicitly. When a
constraint like that comes up, it belongs in the `why` on the interest, where the
next fetch will read it.

## Brief reports numbers. It never says what to do with them.

Aidin invests, and asked whether Brief could flag things like a sentiment index
at an extreme or oil moving on Middle East news. It can, but only on one side of
a line that is easy to erase.

**A published figure is a fact. A direction is a guess.** "Fear & Greed 12,
extreme fear, lowest since March" is reportable. "Sentiment is turning" is not,
and neither is any forecast, price target, analyst rating, or buy/sell view. The
fetch prompt bans them by name and `test/assignment.test.mjs` asserts the ban
survives a rewrite. A geopolitical event goes in as the event; the inference
about what it does to a price is the reader's, never the app's.

**Market figures are always `worthKnowing`, never `needsYou`.** A number asks for
judgement, not for action today. A market figure in the needs-you column is the
app telling somebody to trade, which is exactly what it must not do.

**A standing gauge is the one exception to the 48-hour rule.** A reading is a
state, not an event, so a rule written for events drops it on every ordinary day.
An interest that names a gauge gets today's value whatever it says, because
"normal" is an answer.

**The portfolio stays out of it.** The scan is of the market at large and is not
tied to holdings. Holdings live in Jot and Börslabbet and are never the search
filter, for the same reason the board is not: `sendable()` decides what leaves,
and a portfolio is not on it.

## keel

Brief depends on **keel** (`github.com/AidinD/keel`), linked as `file:../keel` -
so it must be checked out at `D:\Repo\Tools\keel`. `npm install` does **not**
fail when it is missing - npm 11 links a missing `file:` dependency to a dangling
symlink and exits 0, and the failure surfaces at the first import instead. Since
keel is imported at runtime here, that looks like window buttons doing nothing.

It is a real `dependency`, not a devDependency: Brief ships its source unbuilt,
so `keel/window` is still an import at runtime and electron-builder has to pack
it into the asar. `npm run test:app -- --packaged` is what proves it did - the
window buttons are the visible symptom of a preload that failed to resolve it,
and they fail silently.

Editing keel changes Brief immediately. It also means a change there can break
the siblings, so run `npm test` in keel and regenerate the icon here before
assuming it is fine.

## Other rules that are easy to get wrong

**Brief renders, something else writes.** No scrapers, no scheduler, no network
code in the app. If you are adding a fetch to `src/`, stop.

**The library belongs to the reader, and the app only quotes it.** The daily
principle is a note in Nib tagged `Principle` - `Books` for the ones from a book,
`Practice` for the ones written straight down. The generator reads every tagged
note whichever category it sits in, picks one, and copies its title and opening sentence
verbatim. It never paraphrases, never writes a new one, and never turns the
`why` into a rebuke - it is the one thing on the page that asks for nothing, and
a principle you have to answer is just another task. No principle at all is a
fine morning; an invented one is not.

**A section that offers an answer must be answerable.** The confirm section has
exactly two answers, keep and reject, and everything in it has to be resolved by
one of them. Tend's overdue duties arrived there on the first run that reached
Tend, and neither answer was true: keeping files a status that is stale within
the month, rejecting says it does not matter when it does. They live in `behind`
now, which carries no buttons because there is nothing to answer. If you are
adding something to `confirm` and the honest response is "yes, and now I have to
go and do something", it belongs somewhere else.

**Answers never edit the brief.** Accepting or rejecting appends to
`confirmed.jsonl`. The brief is the record of what was proposed. Rejections are
recorded too - a generator whose suggestions are always turned down has a bad
filter, and the acceptances alone never show that.

**Watch the directory, not the file.** `brief.json` arrives by rename, and a
watch on the file stops firing after the first one.

**Swedish keeps its å, ä and ö**, including inside code, fixtures and quoted
briefs. Deliverables are otherwise in English.

**The icon's geometry exists twice** - `scripts/generate-icon.mjs` and the
inline SVG in `src/renderer/index.html`. Change one, change the other. The
inline one is the *small* drawing, because at 20px the full one is mush.

## Verifying a change in the running app

```bash
npm run test:app
```

Launches its own Electron instance with `--remote-debugging-port`, drives the
renderer over the Chrome DevTools Protocol, and reads the DOM back. Add `--keep`
to leave it running, `--packaged` to run against `dist/win-unpacked/Brief.exe`.

Do **not** verify by moving the pointer and clicking. It fights whoever is using
the machine, steals focus, and every coordinate is a guess that goes stale the
moment a layout shifts.

- **Never kill processes by name.** Other Electron apps are often running. Kill
  only the PID you started, as the harness does.
- **Always point `BRIEF_DATA_DIR` at a scratch folder** for a test run.

A check that asserts nothing is worse than no check. If a `check()` body is
empty, it is a bug.

## Releases

Versioning follows the sibling apps: **bump the patch on every commit** so any
build traces to an exact commit. Minor and major are deliberate calls - ask
first, never bump them automatically.

A release is: bump, commit, then publish.

```bash
npm run release
```

The script refuses a dirty working tree, refuses a version already on GitHub,
runs tests and the type check, stops any Brief running out of `dist/`, clears
`dist/`, and uploads through electron-builder's own publisher.

That last part is not optional. `latest.yml` references the installer by its
dashed name while the file on disk has spaces; electron-builder renames it on
upload. A hand-rolled `gh release create` uploads the spaced name and
electron-updater then 404s on a release that looks perfectly published.

`releaseType: release` in `electron-builder.yml` is also not optional -
electron-builder defaults to a draft, which electron-updater cannot see at all.

## Style

Plain JavaScript with JSDoc types, checked with `npm run typecheck`. No build
step. Braces and separate lines for every `if`, no one-liners. No em dashes.

# Brief

The morning surface: what the world did that you can actually act on, what your
week was, and the few things that want confirming before they are forgotten.

Personal project. A sibling to [Jot](https://github.com/AidinD/jot),
[Nib](https://github.com/AidinD/nib) and [Tend](https://github.com/AidinD/tend)
rather than part of any of them.

## The idea

Everything else in the suite is about what you produce. Nothing brings the
outside in, and nothing turns the small things worth keeping into something you
actually keep.

Three sections, in this order, once a morning:

1. **The world** — needs you, then worth knowing.
2. **Your week** — what happened, written for you rather than by you.
3. **Confirm this** — candidate decisions, candidate stories, delegations to
   check in on, people who are drifting.

Section three is the one that makes the rest of the suite work. It turns
*remembering* into *reviewing*, which is the same trick as Jot's review column
and the reason that column gets used.

## The one rule

**A brief has a bottom.** You open it, you reach the end, you close it.

No infinite scroll. No unread count. No badge. No refresh button that fetches
more — a button that fetches is the first step towards a feed. The caps are in
the code, not in a style guide, and when a brief goes over one the window says
what was dropped instead of quietly showing less. A brief that keeps overflowing
has a filter problem, and hiding the overflow hides the only signal that says
so.

That is also the icon: a short column of text and the rule that ends it.

## How a brief gets written

Brief does not fetch anything. Something else writes `brief.json` into the data
directory and the window notices. No server, no port, nothing to authenticate
against — the same shape that made Jot useful to agents in the first place.

[docs/format.md](docs/format.md) is the contract.

**Put the data directory on a real path**, not the default `userData` one:

```bash
setx BRIEF_DATA_DIR "D:\Dropbox\brief"
```

Partly for laptop-to-desktop syncing, but mainly because an agent session runs
in a sandbox that redirects writes under `%APPDATA%` into a private overlay. A
brief written to `userData` from such a session is visible to that session and
to nothing else - including the app you actually opened, which will correctly
tell you there is no brief. See DECISIONS.md.

To see the window with something in it:

```bash
npm run sample
```

## What may leave this machine

Relevance is worked out from what you are actually holding — your Jot
categories and the work in progress on them. That is derived rather than
configured, which is right, and it nearly shipped as a privacy bug.

A board is not a list of neutral topic words. It carries internal project names
on the work side, and on the private side it carries what you are reading and
where you have applied. Deriving a search query from it and posting that to
Google would have sent all of it out, once a morning, in exchange for slightly
better news.

So the derivation stays local and the **sending is opt-in, item by item**:

```bash
npm run plan -- --review   # writes outbound.json, everything switched off
npm run plan               # prints exactly what the fetch will be asked, verbatim
```

Nothing without `send: true` reaches a request body, and an empty list makes the
fetch refuse rather than fall back to everything. Set `as` on an entry to send a
neutral description instead of the name itself — `Kestrel` goes out as
`AI-assisted content pipelines`, the search is as good, and the codename stays
here.

## Two models, and how you know which one ran

One vendor. A Claude session writes all three sections — the world half used to
run on Gemini, until search grounding on its API turned out to be paid-tier only
($35 per 1000 grounded prompts; free in AI Studio's web interface, not through
the API). No key, no billing, one fewer privacy surface.

Two **models** though, because the halves are not the same size:

| Step | Model | Why |
| --- | --- | --- |
| fetch | Haiku | Reading pages and extracting what happened is volume work. |
| judge | Sonnet | Needs-you versus worth-knowing, and the prose. This is the product. |

```bash
npm run morning    # prints the two commands, with the model flags
```

Two commands rather than one session doing both, because a session inherits
whatever model it was launched with and putting the big model on the fetch is
the mistake that happens by accident.

**A configured model is intent; provenance is fact.** `brief.json` records which
model produced each half, the window warns when either is the wrong tier, and a
brief that records nothing counts as a failure — "there is no way to tell" is the
honest answer and should not look like compliance.

## Development

Brief depends on [**keel**](https://github.com/AidinD/keel), the shared layer
under the suite, linked from the filesystem — so it has to be checked out **next
to** this repo before `npm install` will work:

```
Tools/
├── brief/
└── keel/
```

```bash
git clone https://github.com/AidinD/keel ../keel
npm install
npm run dev
```

keel is a real dependency here, not a devDependency: Brief ships its source
unbuilt, so `keel/window` is still an import at runtime and electron-builder has
to pack it into the asar.

```bash
npm test            # domain, storage, the outbound rules
npm run typecheck   # plain JS with JSDoc types, checked by tsc
npm run test:app    # drives the real window over the DevTools protocol
npm run icon        # regenerate resources/icon.ico and icon.png
npm run package     # a local installer, nothing uploaded
npm run release     # bump, commit, then this
```

`test:app` launches its own Electron instance against a scratch data directory
and kills only that process. Add `--packaged` to run the same checks against
`dist/win-unpacked/Brief.exe`, which is where a path that works in development
can fail with nothing but a blank window.

## Licence

MIT.

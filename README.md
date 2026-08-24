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
npm run world -- --review    # writes outbound.json, everything switched off
npm run world -- --dry       # prints exactly what would be sent
npm run world                # actually fetches
```

Nothing without `send: true` reaches a request body, and an empty list makes the
fetch refuse rather than fall back to everything. Set `as` on an entry to send a
neutral description instead of the name itself — `Kestrel` goes out as
`AI-assisted content pipelines`, the search is as good, and the codename stays
here.

## Two models, and the line between them

The world half runs on **Gemini**: reading a lot of source text is the cheap,
high-volume part, and the AI Studio free tier covers a brief a day many times
over. Judgement — needs-you versus worth-knowing — and the prose stay with
**Claude**.

The line is not about cost. Sections two and three are assembled from Nib notes
and the Tend store, and those contain assessments of named colleagues. Sending
them to another vendor is a decision about other people's privacy, not a token
optimisation. See [DECISIONS.md](DECISIONS.md), and do not move it to save
quota.

`GEMINI_API_KEY` is a free [AI Studio](https://aistudio.google.com/apikey) key.
It is **not** a Gemini subscription — a subscription gives no API access at all;
they are separate products.

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

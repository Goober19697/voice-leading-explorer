# Voice-Leading Explorer

A piano voice-leading exploration tool. Enter any voicing and see every chord within reach, ranked by total semitone travel across your notes, grouped by emotional feel. Build a chord progression one move at a time and hear it played back on a real sampled grand piano at 93 BPM.

Built with React, Vite, and Tone.js. Fully client-side — no server, no database, no accounts.

## Features

- **Voicing analysis** — type notes like `A3 E4 F4 G4 C5` (octave optional, defaults to 4; sharps `#` and flats `b` both work) and get the chord name plus every reachable destination.
- **Distinct-note voice leading** — a backtracking assignment solver maps each of your notes to its nearest target chord tone while guaranteeing no two voices land on the same pitch. Doublings and omissions follow what a real hand would do.
- **Deduplication** — enharmonic/synonym chords built from identical notes (e.g. C6 vs Am7) collapse into one row with aliases shown.
- **Emotion grouping** — results are organized under four mood cards: Warm & At Rest, Melancholy & Somber, Tension & Pull, Dreamy & Floating. Each row also carries a mood annotation combining the destination quality's character with the root-motion character (chromatic slide, mediant leap, tritone shift...).
- **Progression trail** — "Add it" commits a chord and re-analyzes from it. The breadcrumb trail supports inspecting any chord's note structure, removing individual chords, undoing the last move, rewinding, and clearing.
- **Playback** — single chords, transitions (2 measures per chord), and full-trail playback at 93 BPM with a chord change every 2 measures. Five trail modes: Hold, Hit, Arp, Hold·Arp alternating, Arp·Hold alternating.
- **Sound engine** — loads the Salamander grand piano sample set; falls back to a piano-modeled FM synth when samples are unavailable. Upload your own samples (named by pitch: `C4.wav`, `Fs3.mp3`, `A#2.wav`) to use any instrument — including notes bounced from a DAW plugin.

## Requirements

- Node.js 18+
- npm (comes with Node)

## Setup

```bash
npm install
npm run dev
```

Vite opens the app at `http://localhost:5173`. First playback needs one click (browsers require a user gesture to start audio); piano samples download in the background on load (~5 MB, then cached).

## Build for production

```bash
npm run build      # outputs static files to dist/
npm run preview    # serve the production build locally
```

Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, an S3 bucket). There is no server component.

## Environment variables

None are required. See `.env.example` for the single optional override:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SAMPLE_BASE_URL` | Tone.js Salamander CDN | Base URL for the default piano sample set |

## Database

There is no database. All state (current voicing, progression trail, uploaded samples) lives in browser memory and resets on reload. Uploaded samples are read via object URLs and never leave the machine.

## Project structure

```
voice-leading-explorer/
├── index.html                  # Vite entry page
├── package.json
├── vite.config.js
├── .env.example
├── src/
│   ├── main.jsx                # React mount + env wiring
│   └── VoiceLeadingExplorer.jsx  # the entire app (theory engine, audio, UI)
└── standalone/
    └── voice-leading-explorer.html  # zero-build single-file version
```

### Standalone version

`standalone/voice-leading-explorer.html` is the same app as one self-contained file using CDN scripts (React, Babel standalone, Tone.js). Double-click it to run without Node or a build step — useful for quick use or sharing. The Vite version is the one to develop against.

## How the theory engine works (short version)

- `QUALITIES` defines 26 chord qualities from triads through extended/altered colors.
- For every root × quality, `bestAssignment` finds the minimum-total-movement mapping from your notes onto the chord's pitch classes with all-distinct target notes (small backtracking search, most-constrained-first).
- Results dedupe by exact target note set; the surviving entry keeps alternate analyses as aliases.
- Chords the user explicitly chooses store their chosen name in the trail, so a voicing that omits or doubles tones still displays as the chord that was picked.

## License

Personal project — no license specified.

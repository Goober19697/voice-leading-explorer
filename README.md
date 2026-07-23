# Harmony Discovery Explorer

> **Hear where a voicing can go, uncover alternate harmonic identities,
> and build progressions through guided discovery.**

![React](https://img.shields.io/badge/React-18.2-blue)
![Vite](https://img.shields.io/badge/Vite-Latest-purple)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)
![Tone.js](https://img.shields.io/badge/Tone.js-Audio-green)

> **A React application that turns an entered voicing into an explorable
> neighborhood of chord colors, bass motions, emotional characters, and
> alternate analyses.**

## Live Demo

[Open Harmony Discovery Explorer](http://3.93.162.237)

![Harmony Discovery Explorer Interface](docs/hero3.png)

------------------------------------------------------------------------

# Why I Built This

Most music software starts with chord progressions, scales, or
substitutions.

I wanted to build something different.

Harmony Discovery Explorer starts with the exact voicing a musician is
hearing and asks a different question:

> **"What else can this harmony become, and how does each possibility sound?"**

Instead of prescribing a single theoretically correct path, the application
keeps useful ambiguity visible. It combines bass-direction exploration,
efficient upper-voice movement, chord recognition, interval analysis, and
real-time playback so the ear can participate in the decision.

Beyond solving a musical problem, this project became an opportunity to
design algorithms, organize complex theory into maintainable software
modules, and build a polished React application from the ground up.

------------------------------------------------------------------------

# Features

## Bass-Guided Harmony Discovery

-   Analyze any chord voicing
-   Generate every supported destination chord
-   Prioritize new-root candidates over same-root recolorings
-   Browse candidates by ascending or descending bass movement
-   Place stationary-bass choices after moving-bass choices
-   Use total semitone travel to resolve otherwise equal candidates
-   Distinct-note assignment using constrained backtracking
-   Enharmonic deduplication with alternate analyses preserved

## Rich Chord Recognition

Supports:

-   Triads
-   Seventh chords
-   Extended chords
-   Suspended chords
-   Altered dominants
-   Modern jazz chord qualities
-   Practical rootless and omitted-tone extended voicings
-   Suspended dominant colors such as 7sus
-   Interval-formula fallback labels for unregistered note sets
-   Multiple valid names shown together when a voicing is harmonically ambiguous
-   Naming priority for defining 3rds and 7ths, then complete chord formulas

## Automatic Theoretical Spelling

-   Correct novice enharmonic input automatically (`D G♭ A` → `D F♯ A`)
-   Normalize mixed sharp/flat input without changing pitch, order, or octave
-   Spell generated notes intervalically from the selected chord root
-   Support theoretical spellings such as F♭ and double accidentals
-   Use one conventional key per pitch class: C, G, D, A, E, B, G♭, D♭,
    A♭, E♭, B♭, and F

## Negative Harmony

-   Reflect any voicing around its first note
-   Show the reflected shadow without replacing the current chord
-   Analyze inversions from their harmonic root rather than their lowest note
-   Play the shadow independently
-   Add the shadow directly to the progression trail

## Keyboard Visualization

-   Display current, generated, inspected, and shadow voicings on a piano
-   Mark the first/reference key with a subtle note-and-octave label
-   Use the analyzed chord's key and interval structure for note labels

## Emotion-Based Discovery

Results are grouped into intuitive musical categories:

-   Warm & At Rest
-   Melancholy & Somber
-   Tension & Pull
-   Dreamy & Floating

## Progression Builder

-   Build progressions one discovery at a time
-   Add generated or negative-harmony voicings
-   Undo / rewind / remove
-   Inspect voicings
-   Re-analyze from any point

## Playback Engine

-   Sampled Salamander Grand Piano
-   FM synth fallback
-   Multiple playback modes
-   Full progression playback

------------------------------------------------------------------------

# Technologies

### Frontend

-   React
-   JavaScript (ES6+)
-   Vite

### Audio

-   Tone.js
-   Salamander Piano Samples

### Engineering

-   Git
-   GitHub
-   Docker
-   Node.js
-   npm

### Cloud

-   AWS deployment 

------------------------------------------------------------------------

# Architecture

``` text
User Input
      │
      ▼
Note Parsing
      │
      ▼
Candidate Generation
      │
      ▼
Bass-Motion & Assignment Solver
      │
      ▼
Chord Recognition
      │
      ▼
Negative Harmony Analysis
      │
      ▼
Emotion Classification
      │
      ▼
Ranked Results
      │
      ▼
Playback Engine
```

------------------------------------------------------------------------

# Project Structure

``` text
harmony-discovery-explorer/

src/
├── HarmonyDiscoveryExplorer.jsx
├── candidatePool.js
├── chordPatterns.js
├── negativeHarmony.js
├── noteParsing.js
└── main.jsx

standalone/
└── HarmonyDiscoveryExplorer.html
```

------------------------------------------------------------------------

# How the Theory Engine Works

1.  Parse the notes entered by the user.
2.  Generate every supported root and chord quality.
3.  Compute a distinct-note mapping between the current voicing and each
    candidate.
4.  Guarantee unique destination notes with a constrained backtracking
    search.
5.  Remove duplicate note sets while preserving alternate chord names.
6.  Rank names by harmonic evidence: defining 3rd and 7th, chord
    completeness, and played root/bass evidence.
7.  Put new-root destinations first and order them by the selected ascending
    or descending bass direction.
8.  Use total movement as a later tie-breaker.
9.  Respell every destination from its selected chord root and key.
10. Group the final results by emotional character.

## How Negative Harmony Works

1.  Treat the first note of the current voicing as the fixed pivot.
2.  Reflect every interval above the pivot downward by the same number of
    semitones.
3.  Order the reflected notes from their new lowest note upward for display
    and playback.
4.  Analyze the complete pitch set to find its harmonic root, including
    supported interpretations whose root is not played.
5.  Use conventional enharmonic spelling for the resulting chord and notes.
6.  If no registered chord matches, display the intervals measured from the
    shadow's lowest note instead of an unnamed result.
7.  Let the user audition the shadow or add it to the progression trail.

------------------------------------------------------------------------

# Getting Started

## Requirements

-   Node.js 18+
-   npm

## Install

``` bash
npm install
npm run dev
```

Open:

``` text
http://localhost:5173
```

## Production

``` bash
npm run build
npm run preview
```

Deploy the generated **dist/** directory to any static hosting provider.

------------------------------------------------------------------------

# Roadmap

-   Hero landing page
-   Saved progressions
-   MIDI export
-   Cloud synchronization
-   User accounts
-   Voice Neighborhood Mode
-   Journey Mode
-   Mobile optimization
-   Additional instrument libraries

------------------------------------------------------------------------

# License

This repository is currently shared as a portfolio project. A formal
open-source license has not yet been selected.

------------------------------------------------------------------------

## About This Project

This project represents my ongoing journey into software engineering,
combining algorithm design, React development, user experience, and
music theory into a single application. It serves as both a practical
musical tool and a demonstration of how I approach solving complex
technical problems through thoughtful software design.

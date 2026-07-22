import React, { useState, useMemo, useRef, useEffect } from "react";
import * as Tone from "tone";
import { parseVoicing } from "./noteParsing.js";
import {
  candidateAt,
  candidatesForEmotion,
  compareCandidates,
  nextCandidateIndex,
  previousCandidateIndex,
} from "./candidatePool.js";
import { analyzeVoicing, analyzeVoicingOptions, QUALITIES } from "./chordPatterns.js";

// ---------- music theory helpers ----------

const SHARP_NAMES = ["C","C♯","D","D♯","E","F","F♯","G","G♯","A","A♯","B"];
const FLAT_NAMES  = ["C","D♭","D","E♭","E","F","G♭","G","A♭","A","B♭","B"];

const KEYS = [
  { name: "C",  root: 0,  flats: false },
  { name: "G",  root: 7,  flats: false },
  { name: "D",  root: 2,  flats: false },
  { name: "A",  root: 9,  flats: false },
  { name: "E",  root: 4,  flats: false },
  { name: "B",  root: 11, flats: false },
  { name: "F♯", root: 6,  flats: false },
  { name: "D♭", root: 1,  flats: true },
  { name: "A♭", root: 8,  flats: true },
  { name: "E♭", root: 3,  flats: true },
  { name: "B♭", root: 10, flats: true },
  { name: "F",  root: 5,  flats: true },
];

function toneName(midi) {
  const names = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return names[pc] + oct;
}

function midiToName(midi, flats) {
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return names[pc] + oct;
}

// closest `count` octave-instances of pitch class pc to a given midi note
function nearestPitchOptions(midi, pc, count) {
  const base = Math.floor(midi / 12) * 12 + pc;
  const opts = [];
  for (let k = -2; k <= 2; k++) opts.push(base + 12 * k);
  opts.sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi));
  return opts.slice(0, count);
}

// Assign each original note to a target pitch drawn from the chord's pitch
// classes such that every target MIDI note is distinct (no note doubled at
// the exact same octave), minimizing total semitone movement. Small search
// space (few notes, few candidates each) so plain backtracking is fine.
function bestAssignment(notes, pcs, rootPc) {
  const candidatesPerNote = notes.map((note, noteIndex) => {
    const opts = [];
    for (const pc of pcs) {
      for (const t of nearestPitchOptions(note, pc, 2)) {
        opts.push({ target: t, cost: Math.abs(t - note) });
      }
    }
    const byTarget = new Map();
    for (const o of opts) {
      if (!byTarget.has(o.target) || byTarget.get(o.target) > o.cost) {
        byTarget.set(o.target, o.cost);
      }
    }
    let list = [...byTarget.entries()].map(([target, cost]) => ({ target, cost }));
    // A named chord should be voiced from its own root, rather than retaining
    // the previous chord's bass simply because that voice can stay still.
    // The parser preserves the user's bass as notes[0].
    if (noteIndex === 0) {
      list = list.filter(({ target }) => ((target % 12) + 12) % 12 === rootPc);
    }
    list.sort((a, b) => a.cost - b.cost);
    return list.slice(0, 8);
  });

  // most-constrained-first ordering helps pruning
  const order = notes.map((_, i) => i).sort(
    (a, b) => candidatesPerNote[a].length - candidatesPerNote[b].length
  );

  let bestAssigned = null;
  let bestCost = Infinity;
  const assigned = new Array(notes.length);

  function dfs(idx, used, cost) {
    if (cost >= bestCost) return;
    if (idx === order.length) {
      bestCost = cost;
      bestAssigned = assigned.slice();
      return;
    }
    const noteIdx = order[idx];
    for (const c of candidatesPerNote[noteIdx]) {
      if (used.has(c.target)) continue;
      used.add(c.target);
      assigned[noteIdx] = { from: notes[noteIdx], to: c.target, dist: c.cost };
      dfs(idx + 1, used, cost + c.cost);
      used.delete(c.target);
    }
  }
  dfs(0, new Set(), 0);
  return bestAssigned;
}

function movementColor(dist) {
  if (dist === 0) return "var(--sage)";
  if (dist <= 2) return "var(--brass)";
  return "var(--rust)";
}

function labelForNotes(midis, flats) {
  const a = analyzeVoicing(midis);
  if (!a) return null;
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  return names[a.rootPc] + a.suffix + (a.rootless ? " (rootless)" : "");
}

function labelsForNotes(midis, flats) {
  const names = flats ? FLAT_NAMES : SHARP_NAMES;
  return analyzeVoicingOptions(midis).map(a =>
    names[a.rootPc] + a.suffix + (a.rootless ? " (rootless)" : "")
  );
}

function detectChord(midis) {
  const a = analyzeVoicing(midis);
  return a ? { rootPc: a.rootPc, suffix: a.suffix } : null;
}

// emotion categories for grouping results
const EMOTION_CATEGORIES = [
  { id: "warm",    label: "Warm & At Rest",       blurb: "settled, consonant, home-like" },
  { id: "sad",     label: "Melancholy & Somber",  blurb: "minor colors, inward, wistful" },
  { id: "tense",   label: "Tension & Pull",       blurb: "dominants and diminished — wants to move" },
  { id: "dreamy",  label: "Dreamy & Floating",    blurb: "suspended, lydian, unresolved air" },
];

const SUFFIX_CATEGORY = {
  "":         "warm",
  "6":        "warm",
  "maj7":     "warm",
  "6/9":      "warm",
  "add9":     "warm",
  "maj9":     "warm",
  "maj13":    "warm",
  "m":        "sad",
  "m7":       "sad",
  "m9":       "sad",
  "m11":      "sad",
  "m13":      "sad",
  "m add9":   "sad",
  "m6":       "sad",
  "m6/9":     "sad",
  "7":        "tense",
  "9":        "tense",
  "13":       "tense",
  "7b5":      "tense",
  "7#5":      "tense",
  "7b9":      "tense",
  "7#9":      "tense",
  "7b5b9":    "tense",
  "7b5#9":    "tense",
  "7#5b9":    "tense",
  "7#5#9":    "tense",
  "dim":      "tense",
  "dim7":     "tense",
  "m7b5":     "tense",
  "maj13♯11": "dreamy",
  "6/9♯11":   "dreamy",
  "sus2":     "dreamy",
  "sus4":     "dreamy",
  "aug":      "dreamy",
  "aug maj7": "dreamy",
  "maj7♯11":  "dreamy",
  "7♯11":     "dreamy",
  "m(maj7)":  "dreamy",
  "m(maj7)b5":"dreamy",
};

// emotional character of each chord quality
const QUALITY_MOOD = {
  "":         "open, settled",
  "m":        "somber, inward",
  "dim":      "unstable, on edge",
  "aug":      "dreamlike, hovering",
  "sus4":     "floating, unresolved",
  "sus2":     "airy, neutral",
  "add9":     "fresh, hopeful",
  "m add9":   "bittersweet",
  "6":        "vintage warmth",
  "m6":       "noir, wistful",
  "maj7":     "warm, at rest",
  "7":        "restless, pulling to resolve",
  "m7":       "mellow, conversational",
  "m7b5":     "anxious, searching",
  "dim7":     "coiled tension",
  "m(maj7)":  "uneasy beauty, noir",
  "m(maj7)b5":"uneasy beauty, noir",
  "aug maj7": "surreal shimmer",
  "6/9":      "plush, contented",
  "6/9♯11":   "luminous, open-ended",
  "m6/9":     "smoky, after-hours",
  "maj9":     "lush, expansive",
  "maj13":    "radiant, richly at rest",
  "maj13♯11": "radiant, limitless wonder",
  "9":        "confident swagger",
  "m9":       "melancholy velvet",
  "m11":      "deep, contemplative",
  "m13":      "soulful, spacious melancholy",
  "13":       "rich, soulful momentum",
  "7b5":      "lean, unsettled pull",
  "7#5":      "restless, augmented pull",
  "7b9":      "dark urgency",
  "7#9":      "gritty, defiant",
  "7b5b9":    "dark urgency",
  "7b5#9":    "gritty, unstable pull",
  "7#5b9":    "dark, augmented urgency",
  "7#5#9":    "gritty, defiant",
  "maj7♯11":  "bright wonder, lifted",
  "7♯11":     "sly, iridescent",
};

// emotional character of the root motion from the current chord
function motionMood(fromRootPc, toRootPc) {
  if (fromRootPc == null) return null;
  const iv = ((toRootPc - fromRootPc) + 12) % 12;
  switch (iv) {
    case 0:  return "recolors in place";
    case 1:
    case 11: return "chromatic slide — cinematic drift";
    case 2:
    case 10: return "step motion — smooth, narrative";
    case 3:
    case 4:
    case 8:
    case 9:  return "mediant leap — filmic, unexpected lift";
    case 5:  return "plagal drift — gentle, hymn-like";
    case 6:  return "tritone shift — dark, slippery";
    case 7:  return "fifth motion — propulsive, classic";
    default: return null;
  }
}

// ---------- piano keyboard visual ----------

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
// black key horizontal offset (in white-key units) within an octave, keyed by pc
const BLACK_OFFSETS = { 1: 1, 3: 2, 6: 4, 8: 5, 10: 6 };

function PianoKeys({ midis }) {
  if (!midis || midis.length === 0) return null;
  const pressed = new Set(midis);
  // range: full octaves spanning the voicing, minimum two octaves for looks
  let startC = Math.floor(Math.min(...midis) / 12) * 12;
  let endB = Math.floor(Math.max(...midis) / 12) * 12 + 11;
  while (endB - startC < 23) { endB += 12; }

  const WK_W = 24, WK_H = 92, BK_W = 14, BK_H = 58;
  const whites = [];
  const blacks = [];
  let wIndex = 0;
  for (let m = startC; m <= endB; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (WHITE_PCS.includes(pc)) {
      whites.push({ m, x: wIndex * WK_W });
      wIndex++;
    } else {
      const octStartWhiteIndex = whites.length - WHITE_PCS.filter(p => p <= pc).length;
      blacks.push({ m, x: (wIndex - 1) * WK_W + WK_W - BK_W / 2 });
    }
  }
  const width = wIndex * WK_W;

  return (
    <svg
      className="vl-piano"
      viewBox={`0 0 ${width} ${WK_H}`}
      width="100%"
      style={{ maxWidth: width, display: "block" }}
      role="img"
      aria-label="Piano keyboard showing the current voicing"
    >
      {whites.map(k => (
        <rect
          key={k.m}
          x={k.x} y={0} width={WK_W - 1} height={WK_H}
          rx={2.5}
          fill={pressed.has(k.m) ? "#C98A3A" : "#EDE6D6"}
          stroke="#1B1D2A" strokeWidth="1"
        />
      ))}
      {blacks.map(k => (
        <rect
          key={k.m}
          x={k.x} y={0} width={BK_W} height={BK_H}
          rx={2}
          fill={pressed.has(k.m) ? "#C98A3A" : "#2A2D4A"}
          stroke="#1B1D2A" strokeWidth="1"
        />
      ))}
    </svg>
  );
}

// ---------- component ----------

export default function VoiceLeadingExplorer() {
  const [rawText, setRawText] = useState("");
  const [history, setHistory] = useState([{ text: "", label: null }]); // trail of committed voicings
  const [useFlats, setUseFlats] = useState(false); // spelling preference
  const [error, setError] = useState(null);
  const [playingKey, setPlayingKey] = useState(null);
  const [audioError, setAudioError] = useState(null);
  const [volume, setVolume] = useState(100); // 0-100
  const synthRef = useRef(null);
  const committedText = history[history.length - 1].text;

  function volumeToDb(pct) {
    if (pct <= 0) return -Infinity;
    return -40 + (pct / 100) * 40; // -40dB (quiet) .. 0dB (full)
  }

  function makeFallbackSynth() {
    // Piano-modeled synth: percussive strike, exponential decay, no organ-like
    // sustain. FM with harmonicity 1 and a fast-decaying bright modulator
    // mimics a hammer striking a string; lowpass + reverb add body and air.
    const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.18 }).toDestination();
    const filter = new Tone.Filter({ frequency: 3200, type: "lowpass", rolloff: -12 }).connect(reverb);
    const synth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 9,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.002, decay: 2.6, sustain: 0.02, release: 1.1, decayCurve: "exponential" },
      modulationEnvelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.25 },
    }).connect(filter);
    synth.maxPolyphony = 12;
    return synth;
  }

  async function ensureSynth() {
    if (synthRef.current) return synthRef.current;
    // try real piano samples first (Salamander grand, Tone.js official CDN)
    try {
      const sampler = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("sample load timeout")), 8000);
        const s = new Tone.Sampler({
          urls: {
            A1: "A1.mp3", A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3",
            C2: "C2.mp3", C3: "C3.mp3", C4: "C4.mp3", C5: "C5.mp3", C6: "C6.mp3",
            "D#2": "Ds2.mp3", "D#3": "Ds3.mp3", "D#4": "Ds4.mp3", "D#5": "Ds5.mp3",
            "F#2": "Fs2.mp3", "F#3": "Fs3.mp3", "F#4": "Fs4.mp3", "F#5": "Fs5.mp3",
          },
          release: 1.2,
          baseUrl:
            (typeof window !== "undefined" && window.SAMPLE_BASE_URL) ||
            "https://tonejs.github.io/audio/salamander/",
          onload: () => { clearTimeout(timeout); resolve(s); },
          onerror: (e) => { clearTimeout(timeout); reject(e); },
        }).toDestination();
      });
      synthRef.current = sampler;
    } catch (e) {
      console.warn("Piano samples unavailable, using fallback synth", e);
      try {
        synthRef.current = makeFallbackSynth();
      } catch (e2) {
        console.warn("Fallback synth failed too; audio disabled", e2);
        // silent no-op instrument: the UI must keep working even with no audio
        synthRef.current = {
          triggerAttackRelease() {}, releaseAll() {}, dispose() {},
          volume: { value: 0 },
        };
      }
    }
    synthRef.current.volume.value = volumeToDb(volume);
    return synthRef.current;
  }

  useEffect(() => { ensureSynth().catch(() => {}); }, []); // preload piano samples in the background

  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = volumeToDb(volume);
    }
  }, [volume]);

  async function unlockAudio() {
    // Some browsers create the context in "suspended" state until a real
    // user gesture explicitly resumes it — start() alone doesn't always
    // do it, so resume the raw context too, inside the click handler.
    await Tone.start();
    const ctx = Tone.getContext().rawContext;
    if (ctx.state !== "running") {
      await ctx.resume();
    }
  }

  function freq(midi) {
    return Tone.Frequency(midi, "midi").toFrequency();
  }

  // global timing: adjustable BPM (70–180, default 180), chords last 2 measures (8 beats)
  const [bpm, setBpm] = useState(180);
  const BEAT_MS = (60 / bpm) * 1000;
  const CHORD_MS = BEAT_MS * 8; // 2 measures of 4/4

  async function playChord(midis, rowKey) {
    try {
      await unlockAudio();
      const synth = await ensureSynth();
      synth.releaseAll();
      setAudioError(null);
      setPlayingKey(rowKey);
      synth.triggerAttackRelease(midis.map(freq), (CHORD_MS / 1000) * 0.97);
      setTimeout(() => setPlayingKey(k => (k === rowKey ? null : k)), CHORD_MS);
    } catch (err) {
      console.error(err);
      setAudioError("Audio couldn't start. Tap the play button again, or check your device isn't muted.");
    }
  }

  async function playTransition(fromMidis, toMidis, rowKey) {
    try {
      await unlockAudio();
      const synth = await ensureSynth();
      synth.releaseAll();
      setAudioError(null);
      setPlayingKey(rowKey);
      synth.triggerAttackRelease(fromMidis.map(freq), (CHORD_MS / 1000) * 0.97);
      const t = setTimeout(() => {
        synth.releaseAll();
        synth.triggerAttackRelease(toMidis.map(freq), (CHORD_MS / 1000) * 0.97);
      }, CHORD_MS);
      setTimeout(() => setPlayingKey(k => (k === rowKey ? null : k)), CHORD_MS * 2);
    } catch (err) {
      console.error(err);
      setAudioError("Audio couldn't start. Tap the play button again, or check your device isn't muted.");
    }
  }

  const parsed = useMemo(() => parseVoicing(committedText), [committedText]);
  const currentNotes = parsed && parsed.midis.length ? parsed.midis : null;
  const key = useMemo(() => ({ flats: useFlats }), [useFlats]);

  // --- progression (trail) playback ---
  const [trailPlayingIdx, setTrailPlayingIdx] = useState(null); // which chip is sounding
  const trailTimeoutsRef = useRef([]);

  function stopTrail() {
    trailTimeoutsRef.current.forEach(clearTimeout);
    trailTimeoutsRef.current = [];
    if (synthRef.current) synthRef.current.releaseAll();
    setTrailPlayingIdx(null);
  }

  const [trailMode, setTrailMode] = useState("hold"); // 'hold' | 'hit' | 'arp'

  async function playTrail() {
    if (trailPlayingIdx !== null) { stopTrail(); return; }
    try {
      await unlockAudio();
      const synth = await ensureSynth();
      synth.releaseAll();
      setAudioError(null);
      const chords = history
        .map(entry => parseVoicing(entry.text).midis)
        .filter(m => m.length > 0);
      if (chords.length === 0) return;
      const STEP_MS = CHORD_MS; // one chord per 2 measures (8 beats) at 93 BPM
      chords.forEach((midis, i) => {
        const barStart = i * STEP_MS;
        const id = setTimeout(() => setTrailPlayingIdx(i), barStart);
        trailTimeoutsRef.current.push(id);
        // resolve this bar's style: mixed modes alternate hold/arp per chord
        let style = trailMode;
        if (trailMode === "mix-ha") style = i % 2 === 0 ? "hold" : "arp";
        if (trailMode === "mix-ah") style = i % 2 === 0 ? "arp" : "hold";
        if (style === "hold") {
          // whole notes: one strike per measure, each held a full 4 beats
          const MEASURE_MS = BEAT_MS * 4;
          for (let bar = 0; bar < 2; bar++) {
            const t = setTimeout(() => {
              synth.releaseAll();
              synth.triggerAttackRelease(midis.map(freq), (MEASURE_MS / 1000) * 0.97);
            }, barStart + bar * MEASURE_MS);
            trailTimeoutsRef.current.push(t);
          }
        } else if (style === "hit") {
          // one short strike on the downbeat, then space for the rest of the bar
          const t = setTimeout(() => {
            synth.releaseAll();
            synth.triggerAttackRelease(midis.map(freq), (BEAT_MS / 1000) * 0.9);
          }, barStart);
          trailTimeoutsRef.current.push(t);
        } else if (style === "arp") {
          // notes rolled low-to-high on quarter-note beats at the current BPM,
          // each ringing to the end of the chord window
          const sorted = [...midis].sort((a, b) => a - b);
          sorted.forEach((m, j) => {
            const offset = barStart + j * BEAT_MS;
            if (j * BEAT_MS >= STEP_MS) return; // more notes than beats: drop overflow
            const ringMs = Math.max(STEP_MS - j * BEAT_MS, BEAT_MS);
            const t = setTimeout(() => {
              if (j === 0) synth.releaseAll(); // clear previous bar on the downbeat only
              synth.triggerAttackRelease(freq(m), (ringMs / 1000) * 0.95);
            }, offset);
            trailTimeoutsRef.current.push(t);
          });
        }
      });
      const endId = setTimeout(() => {
        synth.releaseAll(); // cut the last chord at the end of its bar
        setTrailPlayingIdx(null);
        trailTimeoutsRef.current = [];
      }, chords.length * STEP_MS);
      trailTimeoutsRef.current.push(endId);
    } catch (err) {
      console.error(err);
      setAudioError("Audio couldn't start. Tap the play button again, or check your device isn't muted.");
    }
  }

  useEffect(() => { stopTrail(); }, [history]); // trail changed: cancel stale playback
  useEffect(() => stopTrail, []); // clean up timers on unmount

  function handleSubmit() {
    const result = parseVoicing(rawText);
    if (result.mixedOctaves) {
      setError("Please choose one input mode:\n\n• Exact Voicing\n  Example: A3 C4 E4\n\n• Default Middle Voicing\n  Example: A C E\n\nUse one mode consistently for all notes.");
      return;
    }
    if (result.midis.length === 0) {
      setError("No valid notes found — try letters A–G, optional # or b, e.g. \"A E F# Bb\" or \"A3 E4 F#4 Bb4\".");
      return;
    }
    const messages = [];
    if (result.invalidTokens.length) {
      messages.push("Skipped " + result.invalidTokens.map(t => `"${t}"`).join(", ") + " — not a note I recognize.");
    }
    setError(messages.length ? messages.join(" ") : null);
    setHistory(h => [...h.slice(0, -1), { text: rawText, label: null }]); // replace current position — only "Add to" grows the trail
  }

  function handleInputKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  }

  const [inspectedIdx, setInspectedIdx] = useState(null); // which trail chip's notes are shown

  function removeFromTrail(index) {
    if (history.length <= 1) return; // always keep at least the current voicing
    const next = history.filter((_, i) => i !== index);
    setHistory(next);
    setRawText(next[next.length - 1].text); // keep input in sync with the new current chord
    setError(null);
    setInspectedIdx(null);
  }

  const currentLabel = useMemo(
    () => history[history.length - 1].label || labelForNotes(currentNotes, key.flats),
    [history, currentNotes, key]
  );
  const currentOptionalLabels = useMemo(() => {
    return labelsForNotes(currentNotes, key.flats).filter(label => label !== currentLabel);
  }, [currentNotes, currentLabel, key]);

  const historyLabels = useMemo(() => {
    return history.map(entry => {
      if (entry.label) return entry.label; // the chord name the user actually chose
      const p = parseVoicing(entry.text);
      return labelForNotes(p.midis, key.flats) || "custom";
    });
  }, [history, key]);

  const results = useMemo(() => {
    if (!currentNotes) return [];
    const fromChord = detectChord(currentNotes);
    const names = key.flats ? FLAT_NAMES : SHARP_NAMES;
    const byNoteSet = new Map(); // sorted target midis -> entry
    for (let root = 0; root < 12; root++) {
      for (const [suffix, intervals] of QUALITIES) {
        const pcs = intervals.map(iv => (root + iv) % 12);
        const targets = bestAssignment(currentNotes, pcs, root);
        if (!targets) continue; // no feasible distinct-note assignment found
        const total = targets.reduce((s, t) => s + t.dist, 0);
        if (total === 0) continue; // identical to current voicing
        const setKey = targets.map(t => t.to).sort((a, b) => a - b).join(",");
        const chordName = names[root] + (suffix || "");
        const existing = byNoteSet.get(setKey);
        if (existing) {
          // same physical notes, different analysis — keep as alias
          if (!existing.aliases.includes(chordName) && existing.name !== chordName) {
            existing.aliases.push(chordName);
          }
          continue;
        }
        const qualityMood = QUALITY_MOOD[suffix] || null;
        const motion = motionMood(fromChord ? fromChord.rootPc : null, root);
        byNoteSet.set(setKey, {
          key: setKey,
          name: chordName,
          rootPc: root,
          rootChanged: fromChord ? root !== fromChord.rootPc : false,
          aliases: [],
          totalCost: total,
          commonCount: targets.filter(t => t.dist === 0).length,
          targets,
          mood: [qualityMood, motion].filter(Boolean).join(" · "),
          category: SUFFIX_CATEGORY[suffix] || "warm",
        });
      }
    }
    const out = [...byNoteSet.values()];
    out.sort(compareCandidates);
    return out;
  }, [currentNotes, key]);

  const grouped = useMemo(() => {
    return EMOTION_CATEGORIES.map(cat => ({
      ...cat,
      items: results.filter(r => r.category === cat.id),
    }));
  }, [results]);

  const [selectedMood, setSelectedMood] = useState("warm");
  const activeGroup = grouped.find(g => g.id === selectedMood) || grouped[0];
  const candidates = useMemo(
    () => candidatesForEmotion(results, selectedMood),
    [results, selectedMood]
  );
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const selectedCandidate = candidateAt(candidates, selectedCandidateIndex);

  useEffect(() => {
    setSelectedCandidateIndex(0);
  }, [committedText, selectedMood, useFlats]);

  function selectMood(mood) {
    setSelectedMood(mood);
    setSelectedCandidateIndex(0);
  }

  function showNextCandidate() {
    setSelectedCandidateIndex(index => nextCandidateIndex(index, candidates.length));
  }

  function showPreviousCandidate() {
    setSelectedCandidateIndex(index => previousCandidateIndex(index));
  }

  function applyResult(r) {
    const names = r.targets.map(t => midiToName(t.to, key.flats));
    const text = names.join(" ");
    setRawText(text);
    setHistory(h => [...h, { text, label: r.name }]);
    setError(null);
  }

  return (
    <div className="vl-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .vl-root {
          --bg: #1B1D2A;
          --panel: #232640;
          --panel2: #2A2D4A;
          --ink: #EDE6D6;
          --ink-dim: #9C97AE;
          --brass: #C98A3A;
          --sage: #6FA98C;
          --rust: #C9634A;
          --hair: rgba(237,230,214,0.10);
          background: var(--bg);
          color: var(--ink);
          font-family: 'Inter', sans-serif;
          min-height: 100vh;
          padding: 32px 20px 60px;
          box-sizing: border-box;
        }
        .vl-wrap { max-width: 760px; margin: 0 auto; }
        .vl-eyebrow {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--brass);
          margin-bottom: 6px;
        }
        .vl-title {
          font-family: 'Fraunces', serif;
          font-optical-sizing: auto;
          font-weight: 600;
          font-size: 34px;
          margin: 0 0 4px;
          letter-spacing: -0.01em;
        }
        .vl-sub {
          color: var(--ink-dim);
          font-size: 14px;
          margin: 0 0 28px;
          max-width: 52ch;
          line-height: 1.5;
        }
        .vl-panel {
          background: var(--panel);
          border: 1px solid var(--hair);
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .vl-form { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
        .vl-field { display: flex; flex-direction: column; gap: 6px; }
        .vl-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-dim);
        }
        .vl-input, .vl-select {
          background: var(--bg);
          border: 1px solid var(--hair);
          color: var(--ink);
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          padding: 9px 10px;
          border-radius: 6px;
          outline: none;
        }
        .vl-input { flex: 1; min-width: 220px; }
        .vl-input:focus, .vl-select:focus { border-color: var(--brass); }
        .vl-input-help {
          color: var(--ink-dim);
          font-size: 11.5px;
          line-height: 1.5;
          margin-top: 1px;
        }
        .vl-btn {
          background: var(--brass);
          color: #1B1D2A;
          border: none;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 13.5px;
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
        }
        .vl-btn:hover { filter: brightness(1.08); }
        .vl-btn:focus-visible, .vl-select:focus-visible, .vl-input:focus-visible {
          outline: 2px solid var(--brass); outline-offset: 2px;
        }
        .vl-error {
          color: var(--rust);
          font-size: 13px;
          margin-top: 10px;
          background: rgba(201,99,74,0.12);
          border: 1px solid rgba(201,99,74,0.35);
          border-radius: 6px;
          padding: 8px 10px;
          line-height: 1.4;
          white-space: pre-line;
        }
        .vl-current-row {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-top: 4px;
        }
        .vl-current-name {
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 20px; color: var(--ink);
        }
        .vl-current-aliases { margin-top: 3px; color: var(--ink-dim); font-size: 12px; }
        .vl-current-notes {
          font-family: 'JetBrains Mono', monospace; font-size: 12.5px; color: var(--ink-dim);
        }
        .vl-piano-wrap {
          margin-top: 12px;
          padding: 10px;
          background: var(--bg);
          border: 1px solid var(--hair);
          border-radius: 8px;
          overflow-x: auto;
        }
        .vl-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11.5px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--hair);
          background: transparent;
          color: var(--ink-dim);
          cursor: pointer;
        }
        .vl-chip.active { background: var(--panel2); color: var(--ink); border-color: var(--brass); }
        .vl-volume {
          display: flex; align-items: center; gap: 8px;
        }
        .vl-volume-icon { font-size: 13px; line-height: 1; }
        .vl-bpm-label {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          color: var(--ink-dim);
        }
        .vl-volume-value {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-dim);
          width: 24px;
        }
        .vl-volume-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 110px;
          height: 4px;
          border-radius: 2px;
          background: rgba(237,230,214,0.15);
          outline: none;
          cursor: pointer;
        }
        .vl-volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 13px; height: 13px;
          border-radius: 50%;
          background: var(--brass);
          cursor: pointer;
          border: none;
        }
        .vl-volume-slider::-moz-range-thumb {
          width: 13px; height: 13px;
          border-radius: 50%;
          background: var(--brass);
          cursor: pointer;
          border: none;
        }
        .vl-volume-slider::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: rgba(237,230,214,0.15);
        }
        .vl-list {
          display: flex; flex-direction: column; gap: 8px;
        }
        .vl-mood-picker {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 8px;
          margin-bottom: 18px;
        }
        .vl-mood-btn {
          position: relative;
          text-align: left;
          background: var(--panel);
          border: 1px solid var(--hair);
          border-radius: 10px;
          padding: 12px 14px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .vl-mood-btn:hover { border-color: rgba(201,138,58,0.5); }
        .vl-mood-btn.active {
          background: var(--panel2);
          border-color: var(--brass);
        }
        .vl-mood-btn-label {
          font-family: 'Fraunces', serif;
          font-weight: 600;
          font-size: 15px;
          color: var(--ink);
        }
        .vl-mood-btn.active .vl-mood-btn-label { color: var(--brass); }
        .vl-mood-btn-blurb {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px;
          color: var(--ink-dim);
          line-height: 1.4;
        }
        .vl-row {
          background: var(--panel);
          border: 1px solid var(--hair);
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .vl-row-name { width: 148px; flex-shrink: 0; }
        .vl-row-chord {
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 16px;
        }
        .vl-row-alias {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 400;
          font-size: 11px;
          color: var(--ink-dim);
        }
        .vl-row-mood {
          font-family: 'Fraunces', serif;
          font-style: italic;
          font-size: 11.5px;
          color: var(--brass);
          margin-top: 3px;
          line-height: 1.35;
          opacity: 0.85;
        }
        .vl-lanes { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .vl-lane { display: flex; align-items: center; gap: 8px; }
        .vl-lane-note {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-dim);
          width: 34px; text-align: right;
        }
        .vl-lane-to {
          font-family: 'JetBrains Mono', monospace; font-size: 11px; width: 34px;
        }
        .vl-row-apply {
          flex-shrink: 0; background: transparent; border: 1px solid var(--hair);
          color: var(--ink-dim); font-family: 'JetBrains Mono', monospace; font-size: 11px;
          padding: 7px 10px; border-radius: 6px; cursor: pointer;
        }
        .vl-row-apply:hover { border-color: var(--brass); color: var(--ink); }
        .vl-row-apply:disabled { opacity: 0.4; cursor: not-allowed; border-color: var(--hair); color: var(--ink-dim); }
        .vl-play-btn {
          flex-shrink: 0;
          width: 30px; height: 30px;
          border-radius: 50%;
          border: 1px solid var(--hair);
          background: transparent;
          color: var(--brass);
          font-size: 12px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          padding: 0;
        }
        .vl-play-btn:hover { border-color: var(--brass); background: rgba(201,138,58,0.12); }
        .vl-play-group {
          flex-shrink: 0;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }
        .vl-play-label {
          color: var(--ink-dim);
          font-family: 'Inter', sans-serif;
          font-size: 9px;
          line-height: 1;
        }
        .vl-trail {
          display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
          margin-bottom: 16px;
        }
        .vl-trail-arrow { color: var(--ink-dim); font-size: 12px; }
        .vl-trail-chip {
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          padding: 5px 11px;
          border-radius: 999px;
          border: 1px solid var(--hair);
          background: var(--panel);
          color: var(--ink-dim);
          cursor: pointer;
        }
        .vl-trail-chip.active {
          background: var(--panel2); color: var(--brass); border-color: var(--brass);
          font-weight: 600;
        }
        .vl-trail-chip:hover { color: var(--ink); }
        .vl-trail-chip.sounding {
          background: rgba(201,138,58,0.2);
          border-color: var(--brass);
          color: var(--ink);
          box-shadow: 0 0 0 2px rgba(201,138,58,0.25);
        }
        .vl-trail-play {
          border-color: var(--brass);
        }
        .vl-trail > .vl-play-group { margin-right: 4px; }
        .vl-trail-play.playing {
          background: rgba(201,138,58,0.18);
        }
        .vl-mode-toggle {
          display: inline-flex;
          border: 1px solid var(--hair);
          border-radius: 999px;
          overflow: hidden;
          margin-right: 6px;
        }
        .vl-mode-btn {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          padding: 5px 10px;
          background: transparent;
          border: none;
          color: var(--ink-dim);
          cursor: pointer;
        }
        .vl-mode-btn + .vl-mode-btn { border-left: 1px solid var(--hair); }
        .vl-mode-btn.active {
          background: var(--panel2);
          color: var(--brass);
        }
        .vl-trail-chip.inspected {
          border-color: var(--sage);
          color: var(--ink);
        }
        .vl-inspect {
          background: var(--panel);
          border: 1px solid var(--sage);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 18px;
        }
        .vl-inspect-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 10px;
        }
        .vl-inspect-name {
          font-family: 'Fraunces', serif; font-weight: 600; font-size: 18px;
        }
        .vl-inspect-pos {
          font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: var(--ink-dim);
        }
        .vl-inspect-notes {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;
        }
        .vl-inspect-note {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          background: var(--bg);
          border: 1px solid var(--hair);
          border-radius: 6px;
          padding: 5px 10px;
          color: var(--ink);
        }
        .vl-inspect-actions {
          display: flex; align-items: center; gap: 10px;
        }
        .vl-remove { color: var(--rust); border-color: rgba(201,99,74,0.4); }
        .vl-remove:hover { border-color: var(--rust); color: var(--rust); }
        .vl-trail-clear {
          margin-left: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--ink-dim);
          background: none;
          border: none;
          text-decoration: underline;
          cursor: pointer;
          padding: 4px 2px;
        }
        .vl-trail-clear:hover { color: var(--rust); }
        .vl-legend {
          display: flex; gap: 16px; margin-top: 18px; font-size: 11.5px; color: var(--ink-dim);
          font-family: 'JetBrains Mono', monospace;
        }
        .vl-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; }
        @media (max-width: 560px) {
          .vl-row { flex-wrap: wrap; }
          .vl-row-name { width: auto; }
          .vl-lanes { width: 100%; order: 3; }
        }
      `}</style>

      <div className="vl-wrap">
        <div className="vl-eyebrow">Voicing → Voicing</div>
        <h1 className="vl-title">Voice-Leading Explorer</h1>
        <p className="vl-sub">
          Enter a voicing. Explore new-root chords first, ordered by total semitone
          travel across all your notes — with the emotional character of each move.
        </p>

        <div className="vl-panel vl-form">
          <div className="vl-field" style={{ flex: 1 }}>
            <label className="vl-label" htmlFor="notes">Current voicing</label>
            <input
              id="notes"
              className="vl-input"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Enter notes here."
              aria-describedby="notes-help"
            />
            <div className="vl-input-help" id="notes-help">
              <div>Examples:</div>
              <div>• Exact Voicing: A3 C4 E4</div>
              <div>• Default Middle Voicing: A C E</div>
            </div>
          </div>
          <div className="vl-field">
            <label className="vl-label" htmlFor="spelling">Spelling</label>
            <select
              id="spelling"
              className="vl-select"
              value={useFlats ? "flats" : "sharps"}
              onChange={e => setUseFlats(e.target.value === "flats")}
            >
              <option value="sharps">Sharps (♯)</option>
              <option value="flats">Flats (♭)</option>
            </select>
          </div>
          <button className="vl-btn" type="button" onClick={handleSubmit}>Analyze</button>
          {error && <div className="vl-error" style={{ width: "100%" }}>{error}</div>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: -10, marginBottom: 20, flexWrap: "wrap" }}>
          <div className="vl-volume">
            <span className="vl-volume-icon">{volume === 0 ? "🔇" : volume < 50 ? "🔉" : "🔊"}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              className="vl-volume-slider"
              aria-label="Volume"
            />
            <span className="vl-volume-value">{volume}</span>
          </div>
          <div className="vl-volume">
            <span className="vl-bpm-label">BPM</span>
            <input
              type="range"
              min="70"
              max="180"
              value={bpm}
              onChange={e => { setBpm(Number(e.target.value)); if (trailPlayingIdx !== null) stopTrail(); }}
              className="vl-volume-slider"
              aria-label="Tempo in BPM"
            />
            <span className="vl-volume-value" style={{ width: 30 }}>{bpm}</span>
          </div>
          {audioError && <span className="vl-error" style={{ margin: 0 }}>{audioError}</span>}
        </div>

        {history.length > 1 && (
          <div className="vl-trail">
            <div className="vl-play-group">
              <button
                type="button"
                className={"vl-play-btn vl-trail-play" + (trailPlayingIdx !== null ? " playing" : "")}
                onClick={playTrail}
                aria-label={trailPlayingIdx !== null ? "Stop progression" : "Play progression"}
                title={trailPlayingIdx !== null ? "Stop progression" : "Play progression"}
              >
                {trailPlayingIdx !== null ? "■" : "▶"}
              </button>
              <span className="vl-play-label">Tap</span>
            </div>
            <div className="vl-mode-toggle">
              {[["hold","Hold"],["hit","Hit"],["arp","Arp"],["mix-ha","Hold·Arp"],["mix-ah","Arp·Hold"]].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className={"vl-mode-btn" + (trailMode === v ? " active" : "")}
                  onClick={() => { setTrailMode(v); if (trailPlayingIdx !== null) stopTrail(); }}
                >
                  {l}
                </button>
              ))}
            </div>
            {history.map((entry, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="vl-trail-arrow">→</span>}
                <button
                  type="button"
                  className={
                    "vl-trail-chip" +
                    (i === history.length - 1 ? " active" : "") +
                    (i === trailPlayingIdx ? " sounding" : "") +
                    (i === inspectedIdx ? " inspected" : "")
                  }
                  onClick={() => setInspectedIdx(idx => (idx === i ? null : i))}
                  title={entry.text}
                >
                  {historyLabels[i]}
                </button>
              </React.Fragment>
            ))}
            <button
              type="button"
              className="vl-trail-clear"
              onClick={() => removeFromTrail(history.length - 1)}
              title="Remove the last chord"
            >
              undo last
            </button>
            <button
              type="button"
              className="vl-trail-clear"
              onClick={() => { setHistory(h => [h[h.length - 1]]); setInspectedIdx(null); }}
            >
              clear trail
            </button>
          </div>
        )}

        {inspectedIdx !== null && history[inspectedIdx] !== undefined && (() => {
          const notes = parseVoicing(history[inspectedIdx].text).midis;
          return (
            <div className="vl-inspect">
              <div className="vl-inspect-head">
                <span className="vl-inspect-name">{historyLabels[inspectedIdx]}</span>
                <span className="vl-inspect-pos">chord {inspectedIdx + 1} of {history.length}</span>
              </div>
              <div className="vl-inspect-notes">
                {notes.map((m, index) => (
                  <span className="vl-inspect-note" key={`${m}-${index}`}>{midiToName(m, key.flats)}</span>
                ))}
              </div>
              <div className="vl-piano-wrap">
                <PianoKeys midis={notes} />
              </div>
              <div className="vl-inspect-actions">
                <div className="vl-play-group">
                  <button
                    type="button"
                    className="vl-play-btn"
                    onClick={() => playChord(notes, "inspect-" + inspectedIdx)}
                    aria-label="Play this chord"
                  >
                    {playingKey === "inspect-" + inspectedIdx ? "■" : "▶"}
                  </button>
                  <span className="vl-play-label">Tap</span>
                </div>
                {history.length > 1 && (
                  <button
                    type="button"
                    className="vl-row-apply vl-remove"
                    onClick={() => removeFromTrail(inspectedIdx)}
                  >
                    ✕ Remove this chord
                  </button>
                )}
                <button
                  type="button"
                  className="vl-trail-clear"
                  onClick={() => setInspectedIdx(null)}
                  style={{ marginLeft: "auto" }}
                >
                  close
                </button>
              </div>
            </div>
          );
        })()}

        {currentNotes && (
          <>
            <div className="vl-panel" style={{ paddingBottom: 16 }}>
              <div className="vl-current-row">
                <div>
                  <div className="vl-current-name">{currentLabel || "Custom voicing"}</div>
                  {currentOptionalLabels.length > 0 && (
                    <div className="vl-current-aliases">
                      Also: {currentOptionalLabels.join(" / ")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="vl-current-notes">
                    {currentNotes.map(m => midiToName(m, key.flats)).join(" · ")}
                  </span>
                  <div className="vl-play-group">
                    <button
                      className="vl-play-btn"
                      onClick={() => playChord(currentNotes, "current")}
                      aria-label="Play current voicing"
                      type="button"
                    >
                      {playingKey === "current" ? "■" : "▶"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="vl-piano-wrap">
                <PianoKeys midis={currentNotes} />
              </div>
            </div>

            <div className="vl-mood-picker">
              {grouped.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={"vl-mood-btn" + (activeGroup && g.id === activeGroup.id ? " active" : "")}
                  onClick={() => selectMood(g.id)}
                >
                  <span className="vl-mood-btn-label">{g.label}</span>
                  <span className="vl-mood-btn-blurb">{g.blurb}</span>
                </button>
              ))}
            </div>

            {selectedCandidate && (() => {
              const r = selectedCandidate;
              const selectedNotes = r.targets.map(t => t.to);
              return (
                <div className="vl-list">
                    <div className="vl-row" key={r.key}>
                      <div className="vl-row-name">
                        <div className="vl-row-chord">
                          {r.name}
                          {r.aliases.length > 0 && (
                            <span className="vl-row-alias"> / {r.aliases.join(" / ")}</span>
                          )}
                        </div>
                        {r.mood && <div className="vl-row-mood">{r.mood}</div>}
                      </div>
                      <div className="vl-lanes">
                        {r.targets.map((t, i) => {
                          const color = movementColor(t.dist);
                          return (
                            <div className="vl-lane" key={i}>
                              <span className="vl-lane-note">{midiToName(t.from, key.flats)}</span>
                              <span aria-hidden="true" style={{ color }}>→</span>
                              <span className="vl-lane-to" style={{ color }}>
                                {midiToName(t.to, key.flats)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="vl-play-group">
                        <button
                          className="vl-play-btn"
                          onClick={() => playTransition(currentNotes, selectedNotes, r.key)}
                          aria-label={"Play move to " + r.name}
                          type="button"
                        >
                          {playingKey === r.key ? "■" : "▶"}
                        </button>
                        <span className="vl-play-label">Tap</span>
                      </div>
                      <button
                        className="vl-row-apply"
                        type="button"
                        onClick={showPreviousCandidate}
                        disabled={selectedCandidateIndex === 0}
                        aria-label="Show the previous voicing"
                      >
                        Back
                      </button>
                      <button
                        className="vl-row-apply"
                        type="button"
                        onClick={showNextCandidate}
                        disabled={selectedCandidateIndex >= candidates.length - 1}
                        aria-label="Show the next closest voicing"
                      >
                        Next
                      </button>
                      <button className="vl-row-apply" onClick={() => applyResult(r)}>
                        Add it →
                      </button>
                    </div>
                    <div className="vl-piano-wrap">
                      <PianoKeys midis={selectedNotes} />
                    </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

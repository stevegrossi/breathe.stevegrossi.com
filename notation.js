// notation.js
// Parsing and building for exercise strings, e.g. "8m8s45h8m8s60h8m8s75h".
//
// Grammar: a sequence of <number><letter> atoms, no separators needed
// because a letter always terminates a digit run.
//
//   Ns / Nm / Nl        N breaths, symmetric, inhale = exhale = 1 / 2 / 4
//                        beats each, no in-breath pause. (shorthand)
//   Nx <phases>          N breaths, each following <phases> (longhand, for
//                        anything shorthand doesn't cover: custom beat
//                        counts, asymmetric inhale/exhale, or a pause
//                        inside the breath itself - e.g. box breathing).
//     <phases> is, in order: Ni (inhale, required), an optional Np
//     (pause, beats), Ne (exhale, required), an optional trailing Np.
//     e.g. box breathing = "4i4p4e4p", 4-7-8 = "4i7p8e".
//   Nh                   hold/retention for N seconds (top-level only,
//                        real time rather than beats - this is the
//                        longer breath-retention between rounds, not
//                        the short in-breath pause above).
//
// A beat's duration comes from bpm elsewhere: one beat = 60/bpm seconds.
// Each phase atom (i/p/e) is the length of THAT phase alone - an inhale
// of "Ni" and an exhale of "Ne" are each N beats long, not N beats total
// split between them.
//
// Deliberately has no notion of "nasal" vs "mouth" breathing yet, but
// nothing here blocks adding it later: a new atom letter attached to a
// breaths step would just be one more case in the tokenizer, and
// existing exercise strings would keep parsing exactly as they do today.

const SHORTHAND_BEATS = { s: 1, m: 2, l: 4 };
const PHASE_LETTERS = new Set(['i', 'p', 'e']);

/**
 * Parse a flat exercise string into steps.
 * Returns: Array<
 *   { type: 'breaths', count, phases: Array<{ type: 'inhale'|'pause'|'exhale', beats }> }
 *   | { type: 'hold', seconds }
 * >
 * Throws on malformed input (stray phase letter, incomplete group, unknown
 * atom, empty string).
 */
export function parseExercise(str) {
  if (!str || !str.trim()) {
    throw new Error('Exercise string is empty');
  }

  const atoms = [...str.matchAll(/(\d+)([a-z])/g)].map((m) => [Number(m[1]), m[2]]);
  if (atoms.length === 0) {
    throw new Error(`Couldn't find any valid <number><letter> atoms in "${str}"`);
  }

  const steps = [];
  // Phase-spec state machine for the group currently being built (if any):
  //   0: have nothing yet, expecting 'i'
  //   1: have inhale, expecting 'p' or 'e'
  //   2: have inhale+pause, expecting 'e'
  //   3: have exhale, expecting optional trailing 'p' or end of group
  //   4: have trailing pause, expecting end of group (no more phase atoms)
  let group = null; // { count, phases: [], state }

  function finalizeGroup() {
    if (group.state < 3) {
      throw new Error(`Breath group of ${group.count} is incomplete: needs at least an inhale and an exhale`);
    }
    steps.push({ type: 'breaths', count: group.count, phases: group.phases });
    group = null;
  }

  for (const [num, letter] of atoms) {
    if (num <= 0) {
      throw new Error(`"${num}${letter}" must be a positive number`);
    }

    if (group) {
      const s = group.state;
      if (letter === 'i' && s === 0) {
        group.phases.push({ type: 'inhale', beats: num });
        group.state = 1;
        continue;
      }
      if (letter === 'p' && s === 1) {
        group.phases.push({ type: 'pause', beats: num });
        group.state = 2;
        continue;
      }
      if (letter === 'e' && (s === 1 || s === 2)) {
        group.phases.push({ type: 'exhale', beats: num });
        group.state = 3;
        continue;
      }
      if (letter === 'p' && s === 3) {
        group.phases.push({ type: 'pause', beats: num });
        group.state = 4;
        continue;
      }
      // This atom doesn't extend the group's phase spec - close the group
      // out (validating it's at least inhale+exhale) and fall through to
      // handle the atom as a fresh top-level atom below.
      finalizeGroup();
    }

    if (letter === 'x') {
      group = { count: num, phases: [], state: 0 };
    } else if (letter in SHORTHAND_BEATS) {
      const beats = SHORTHAND_BEATS[letter];
      steps.push({
        type: 'breaths',
        count: num,
        phases: [
          { type: 'inhale', beats },
          { type: 'exhale', beats },
        ],
      });
    } else if (letter === 'h') {
      steps.push({ type: 'hold', seconds: num });
    } else if (PHASE_LETTERS.has(letter)) {
      throw new Error(`"${num}${letter}" must appear right after an "x" group, e.g. "8x${num}${letter}..."`);
    } else {
      throw new Error(`Unknown atom "${num}${letter}"`);
    }
  }

  if (group) finalizeGroup();

  return steps;
}

/**
 * Build a canonical exercise string from steps.
 * Each breaths step decides shorthand vs longhand independently: a step
 * gets shorthand (s/m/l) if it's symmetric (inhale === exhale, no pause)
 * with a beat length of 1, 2, or 4; otherwise it's written longhand. One
 * step needing longhand (e.g. an asymmetric transition breath) has no
 * effect on any other step in the same exercise.
 */
export function buildExercise(steps) {
  if (!steps || steps.length === 0) {
    throw new Error('No steps to build an exercise from');
  }

  const letterForBeats = Object.fromEntries(
    Object.entries(SHORTHAND_BEATS).map(([letter, beats]) => [beats, letter])
  );
  const phaseLetter = { inhale: 'i', pause: 'p', exhale: 'e' };

  const shorthandLetter = (step) => {
    if (step.phases.length !== 2) return null;
    const [a, b] = step.phases;
    if (a.type !== 'inhale' || b.type !== 'exhale' || a.beats !== b.beats) return null;
    return letterForBeats[a.beats] || null;
  };

  return steps
    .map((step) => {
      if (step.type === 'hold') return `${step.seconds}h`;
      const letter = shorthandLetter(step);
      if (letter) return `${step.count}${letter}`;
      const phasesStr = step.phases.map((p) => `${p.beats}${phaseLetter[p.type]}`).join('');
      return `${step.count}x${phasesStr}`;
    })
    .join('');
}

/** Seconds for a single phase of the given beat length, at the given bpm. */
export function breathSeconds(beats, bpm) {
  return beats * (60 / bpm);
}

/**
 * Expand parsed steps into a flat playback timeline.
 * Each entry: { phase: 'inhale'|'exhale'|'hold', seconds,
 *               breathIndex, breathsInGroup,   // only for inhale/exhale/in-breath pause
 *               roundIndex, totalRounds }      // a "round" ends at each top-level
 *                                               // hold; exercises with no hold are one round
 */
export function buildTimeline(steps, bpm) {
  const totalRounds = Math.max(steps.filter((s) => s.type === 'hold').length, 1);
  const timeline = [];
  let roundIndex = 1;
  const phaseName = { inhale: 'inhale', exhale: 'exhale', pause: 'hold' };

  for (const step of steps) {
    if (step.type === 'breaths') {
      for (let i = 0; i < step.count; i++) {
        for (const phaseSpec of step.phases) {
          timeline.push({
            phase: phaseName[phaseSpec.type],
            seconds: breathSeconds(phaseSpec.beats, bpm),
            breathIndex: i,
            breathsInGroup: step.count,
            roundIndex,
            totalRounds,
          });
        }
      }
    } else {
      timeline.push({ phase: 'hold', seconds: step.seconds, roundIndex, totalRounds });
      roundIndex++;
    }
  }

  return timeline;
}

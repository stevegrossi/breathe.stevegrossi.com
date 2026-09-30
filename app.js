import { parseExercise, buildExercise, buildTimeline } from './notation.js';

const app = document.getElementById('app');
const params = new URLSearchParams(location.search);
const exParam = params.get('ex');

if (exParam) {
  renderPlayer(exParam, params.get('bpm'));
} else {
  renderGenerator();
}

/* ----------------------------- shared UI bits ---------------------------- */

function el(tag, className, children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children || []) node.append(child);
  return node;
}

function numberInput(value, min, max) {
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.value = value;
  input.min = min;
  input.max = max;
  return input;
}

function labeled(text, field) {
  const label = document.createElement('label');
  label.append(el('span', 'field-label', [document.createTextNode(text)]), field);
  return label;
}

function button(text, onClick, variant) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  btn.className = variant ? `btn btn-${variant}` : 'btn';
  btn.addEventListener('click', onClick);
  return btn;
}

/* -------------------------------- generator ------------------------------- */

function renderGenerator() {
  app.innerHTML = '';
  app.className = 'view view-generator';

  app.append(el('h1', 'title', [document.createTextNode('Build a breathing exercise')]));
  app.append(
    el('p', 'hint', [
      document.createTextNode(
        'Add breath groups and holds in order. "Generate link" turns them into a shareable URL.'
      ),
    ])
  );

  const rowsEl = el('div', 'rows', []);
  app.append(rowsEl);
  const rows = [];

  function addBreathsRow(defaults) {
    const { count = 8, length = 'm', phases: seedPhases } = defaults || {};
    const countInput = numberInput(count, 1, 200);

    const lengthSelect = document.createElement('select');
    [
      ['s', 'short — 1 beat in, 1 out'],
      ['m', 'medium — 2 beats in, 2 out'],
      ['l', 'long — 4 beats in, 4 out'],
      ['custom', 'custom — set each phase'],
    ].forEach(([value, text]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      lengthSelect.appendChild(opt);
    });
    lengthSelect.value = seedPhases ? 'custom' : length;

    // Custom phase fields: inhale and exhale are required; the two pause
    // fields default to 0, meaning "no pause there" (e.g. leave the
    // pause-after-exhale at 0 for 4-7-8 breathing; set both pauses for
    // box breathing). If seeded from explicit phases (e.g. a transition
    // breath around a hold), pre-fill from those instead of the defaults.
    const seedInhale = seedPhases?.find((p) => p.type === 'inhale')?.beats;
    const seedExhale = seedPhases?.find((p) => p.type === 'exhale')?.beats;
    const seedPauses = seedPhases?.filter((p) => p.type === 'pause') ?? [];
    const inhaleInput = numberInput(seedInhale ?? 4, 1, 60);
    const pauseInInput = numberInput(seedPauses[0]?.beats ?? 0, 0, 60);
    const exhaleInput = numberInput(seedExhale ?? 4, 1, 60);
    const pauseOutInput = numberInput(seedPauses[1]?.beats ?? 0, 0, 60);
    const customFields = el('div', 'custom-phase-fields', [
      labeled('Inhale', inhaleInput),
      labeled('Hold', pauseInInput),
      labeled('Exhale', exhaleInput),
      labeled('Hold', pauseOutInput),
    ]);
    customFields.hidden = lengthSelect.value !== 'custom';
    lengthSelect.addEventListener('change', () => {
      customFields.hidden = lengthSelect.value !== 'custom';
    });

    const row = el('div', 'row', [
      labeled('Breaths', countInput),
      labeled('Length', lengthSelect),
      customFields,
      button('Remove', () => removeRow(entry), 'remove'),
    ]);
    rowsEl.append(row);

    const entry = {
      el: row,
      get step() {
        const count = Number(countInput.value);
        if (lengthSelect.value !== 'custom') {
          const beats = { s: 1, m: 2, l: 4 }[lengthSelect.value];
          return {
            type: 'breaths',
            count,
            phases: [
              { type: 'inhale', beats },
              { type: 'exhale', beats },
            ],
          };
        }
        const phases = [{ type: 'inhale', beats: Number(inhaleInput.value) }];
        if (Number(pauseInInput.value) > 0) phases.push({ type: 'pause', beats: Number(pauseInInput.value) });
        phases.push({ type: 'exhale', beats: Number(exhaleInput.value) });
        if (Number(pauseOutInput.value) > 0) phases.push({ type: 'pause', beats: Number(pauseOutInput.value) });
        return { type: 'breaths', count, phases };
      },
    };
    rows.push(entry);
  }

  function addHoldRow(defaults) {
    const { seconds = 45 } = defaults || {};
    const secondsInput = numberInput(seconds, 1, 900);
    const row = el('div', 'row', [
      labeled('Hold, seconds', secondsInput),
      button('Remove', () => removeRow(entry), 'remove'),
    ]);
    rowsEl.append(row);

    const entry = {
      el: row,
      get step() {
        return { type: 'hold', seconds: Number(secondsInput.value) };
      },
    };
    rows.push(entry);
  }

  function removeRow(entry) {
    const idx = rows.indexOf(entry);
    if (idx !== -1) rows.splice(idx, 1);
    entry.el.remove();
  }

  app.append(
    el('div', 'add-buttons', [
      button('+ Breaths', () => addBreathsRow()),
      button('+ Hold', () => addHoldRow()),
    ])
  );

  const bpmInput = numberInput(50, 20, 240);
  app.append(el('div', 'row row-bpm', [labeled('Beats per minute', bpmInput)]));

  const resultEl = el('div', 'result', []);

  app.append(
    button(
      'Generate link',
      () => {
        resultEl.innerHTML = '';
        try {
          const steps = rows.map((r) => r.step);
          const exStr = buildExercise(steps);
          const url = new URL(location.href);
          url.search = '';
          url.searchParams.set('ex', exStr);
          url.searchParams.set('bpm', bpmInput.value);
          const urlStr = url.toString();

          const link = document.createElement('a');
          link.href = urlStr;
          link.textContent = urlStr;
          link.className = 'link';

          const copyBtn = button('Copy link', async () => {
            await navigator.clipboard.writeText(urlStr);
            copyBtn.textContent = 'Copied';
            setTimeout(() => (copyBtn.textContent = 'Copy link'), 1200);
          });

          resultEl.append(link, copyBtn);
        } catch (err) {
          resultEl.append(el('p', 'error', [document.createTextNode(err.message)]));
        }
      },
      'primary'
    )
  );

  app.append(resultEl);

  // Seed the form with the reference exercise so it isn't empty on first
  // load: 8 medium + 8 short breaths, an inhale-then-exhale-to-empty
  // before each hold, and an inhale/exhale recovery breath after every
  // hold (including the last).
  const bigInhaleEmptyExhale = [
    { type: 'inhale', beats: 8 },
    { type: 'exhale', beats: 4 },
  ];
  const recoveryBreath = [
    { type: 'inhale', beats: 8 },
    { type: 'exhale', beats: 8 },
  ];
  const holdSeconds = [45, 60, 75];
  for (const seconds of holdSeconds) {
    addBreathsRow({ count: 8, length: 'm' });
    addBreathsRow({ count: 8, length: 's' });
    addBreathsRow({ count: 1, phases: bigInhaleEmptyExhale });
    addHoldRow({ seconds });
    addBreathsRow({ count: 1, phases: recoveryBreath });
  }
}

/* --------------------------------- player --------------------------------- */

function renderPlayer(exStr, bpmParam) {
  app.innerHTML = '';
  app.className = 'view view-player';

  const bpm = Number(bpmParam) || 60;
  let timeline;
  try {
    timeline = buildTimeline(parseExercise(exStr), bpm);
  } catch (err) {
    app.append(
      el('p', 'error', [document.createTextNode(`Couldn't read this exercise: ${err.message}`)])
    );
    return;
  }

  const circleWrap = el('div', 'circle-wrap', []);
  circleWrap.innerHTML = `
    <svg viewBox="0 0 200 200" class="circle-svg" aria-hidden="true">
      <circle class="circle-bg" cx="100" cy="100" r="90"></circle>
      <circle class="circle-main" cx="100" cy="100" r="60"></circle>
    </svg>
    <div class="circle-text">
      <div class="phase-label">Ready</div>
      <div class="count-label"></div>
    </div>
  `;
  const circleMain = circleWrap.querySelector('.circle-main');
  const phaseLabelEl = circleWrap.querySelector('.phase-label');
  const countLabelEl = circleWrap.querySelector('.count-label');
  circleMain.style.transform = 'scale(0.55)';

  const roundLabel = el('div', 'round-label', []);
  const progressFill = el('div', 'progress-fill', []);
  const progressBar = el('div', 'progress-bar', [progressFill]);

  const startBtn = button('Start', start, 'primary');
  app.append(circleWrap, roundLabel, progressBar, el('div', 'controls', [startBtn]));

  const totalSeconds = timeline.reduce((sum, p) => sum + p.seconds, 0);

  let audioCtx = null;
  let wakeLock = null;
  let index = 0;
  let elapsedBefore = 0; // seconds completed in prior phases
  let phaseStartTime = 0; // performance.now() timestamp, adjusted across pauses
  let pausedElapsedMs = 0; // ms into the current phase when paused
  let hasBegun = false;
  let running = false;
  let rafId = null;

  async function start() {
    if (running) return;
    running = true;
    startBtn.textContent = 'Pause';
    startBtn.onclick = pause;

    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    requestWakeLock();

    phaseStartTime = performance.now() - pausedElapsedMs;
    pausedElapsedMs = 0;

    if (!hasBegun) {
      hasBegun = true;
      playPhase(timeline[index]);
    }

    rafId = requestAnimationFrame(tick);
  }

  function pause() {
    running = false;
    startBtn.textContent = 'Resume';
    startBtn.onclick = start;
    releaseWakeLock();
    cancelAnimationFrame(rafId);
    pausedElapsedMs = performance.now() - phaseStartTime;
  }

  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      // Not critical to the exercise itself; fail silently.
    }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release().catch(() => {});
      wakeLock = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (running && document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
  });

  function playPhase(phase) {
    phaseLabelEl.textContent = { inhale: 'In', exhale: 'Out', hold: 'Hold' }[phase.phase];
    countLabelEl.textContent = phase.phase === 'hold' ? '' : `Breath ${phase.breathIndex + 1} / ${phase.breathsInGroup}`;
    roundLabel.textContent = `Round ${phase.roundIndex} / ${phase.totalRounds}`;
    circleWrap.classList.toggle('holding', phase.phase === 'hold');
    beep(phase.phase);
  }

  function tick(now) {
    if (!running) return;
    const phase = timeline[index];
    const elapsed = (now - phaseStartTime) / 1000;
    const frac = Math.min(elapsed / phase.seconds, 1);

    if (phase.phase === 'inhale') {
      circleMain.style.transform = `scale(${0.55 + 0.45 * frac})`;
    } else if (phase.phase === 'exhale') {
      circleMain.style.transform = `scale(${1 - 0.45 * frac})`;
    } else {
      countLabelEl.textContent = `${Math.max(Math.ceil(phase.seconds - elapsed), 0)}s`;
    }

    progressFill.style.width = `${Math.min(((elapsedBefore + elapsed) / totalSeconds) * 100, 100)}%`;

    if (frac >= 1) {
      elapsedBefore += phase.seconds;
      index++;
      if (index >= timeline.length) {
        finish();
        return;
      }
      phaseStartTime = now;
      playPhase(timeline[index]);
    }

    rafId = requestAnimationFrame(tick);
  }

  function finish() {
    running = false;
    releaseWakeLock();
    circleWrap.classList.remove('holding');
    phaseLabelEl.textContent = 'Done';
    countLabelEl.textContent = '';
    roundLabel.textContent = '';
    progressFill.style.width = '100%';
    startBtn.textContent = 'Restart';
    startBtn.onclick = () => location.reload();
  }

  function beep(phaseName) {
    if (!audioCtx) return;
    const freq = { inhale: 523.25, exhale: 392.0, hold: 659.25 }[phaseName];
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.26);
  }
}

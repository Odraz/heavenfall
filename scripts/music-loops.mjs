// Finds a seamless loop region for each looping music track (M8 §9.2) and prints it for
// src/data/music.ts. Usage: node scripts/music-loops.mjs [track ...]
//
// Each MP3 is decoded in headless Chromium (Web Audio), then analyzed there:
// 1. Spectral features every 1024 samples: log energy in 24 bands (2048-sample FFT).
// 2. Tempo from the autocorrelation of the onset strength (spectral flux), near the prompt's BPM;
//    then the beat phase that lines the beats up with the onsets. A bar is 4 beats.
// 3. Every bar-aligned (start, end) pair 45–150 s apart, after the intro and clear of the fade-out,
//    is scored by how alike the 4 s around the start and around the end are (mean cosine similarity
//    of the features). The best wins: there, the end flows into the start. A track always starts
//    from its beginning, so the opening plays each time the track starts, and then the loop repeats.
// 4. The end is refined to the sample by cross-correlating the waveforms at the seam.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BPM = { calm: 70, 'arena-1': 120, 'arena-2': 135, 'arena-3': 150, boss: 165 };
const tracks = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BPM);

/** Runs in the page: decodes and analyzes one track. */
async function analyze({ b64, bpm }) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buf = await ctx.decodeAudioData(bytes.buffer);
  const sr = buf.sampleRate;
  const n = buf.length;
  const x = new Float32Array(n);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) x[i] += d[i] / buf.numberOfChannels;
  }

  // --- 1. Features.
  const N = 2048;
  const HOP = 1024;
  const frames = Math.floor((n - N) / HOP);
  const BANDS = 24;
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  const edges = Array.from({ length: BANDS + 1 }, (_, b) => Math.round((40 * Math.pow(16000 / 40, b / BANDS) * N) / sr));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  function fft() {
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const a = (-2 * Math.PI) / len;
      for (let i = 0; i < N; i += len) {
        for (let k = 0; k < len / 2; k++) {
          const wr = Math.cos(a * k);
          const wi = Math.sin(a * k);
          const ur = re[i + k];
          const ui = im[i + k];
          const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
          const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
          re[i + k] = ur + vr;
          im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr;
          im[i + k + len / 2] = ui - vi;
        }
      }
    }
  }
  const feat = new Float32Array(frames * BANDS);
  const rms = new Float32Array(frames);
  const flux = new Float32Array(frames);
  const prevMag = new Float32Array(N / 2);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = x[f * HOP + i];
      e += v * v;
      re[i] = v * win[i];
      im[i] = 0;
    }
    rms[f] = Math.sqrt(e / N);
    fft();
    let fl = 0;
    for (let k = 0; k < N / 2; k++) {
      const m = Math.hypot(re[k], im[k]);
      fl += Math.max(0, m - prevMag[k]);
      prevMag[k] = m;
    }
    flux[f] = fl;
    for (let b = 0; b < BANDS; b++) {
      let s = 0;
      for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) s += re[k] * re[k] + im[k] * im[k];
      feat[f * BANDS + b] = Math.log(1e-6 + s);
    }
  }
  const fps = sr / HOP;

  // --- 2. Tempo and beat phase.
  const mean = flux.reduce((a, b) => a + b, 0) / frames;
  const on = flux.map((v) => Math.max(0, v - mean));
  let bestLag = 0;
  let bestScore = -Infinity;
  for (let lag = Math.floor((fps * 60) / 200); lag <= Math.ceil((fps * 60) / 55); lag++) {
    let s = 0;
    for (let f = 0; f + lag < frames; f++) s += on[f] * on[f + lag];
    const tempo = (60 * fps) / lag;
    // Favor the prompt's tempo (and its double and half) a little.
    const prior = Math.max(...[bpm, bpm * 2, bpm / 2].map((t) => Math.exp(-((Math.log(tempo / t) / 0.08) ** 2) / 2)));
    const score = s * (0.6 + 0.4 * prior);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  // Refine the period to a fraction of a frame over the whole track.
  let period = bestLag;
  let periodScore = -Infinity;
  for (let p = bestLag - 1; p <= bestLag + 1; p += 0.01) {
    let s = 0;
    for (let k = 0; k * p + p < frames; k++) {
      const f = Math.round(k * p);
      s += on[f] * on[Math.round(f + p)];
    }
    if (s > periodScore) {
      periodScore = s;
      period = p;
    }
  }
  let phase = 0;
  let phaseScore = -Infinity;
  for (let ph = 0; ph < period; ph += 0.25) {
    let s = 0;
    for (let t = ph; t < frames; t += period) s += on[Math.round(t)] ?? 0;
    if (s > phaseScore) {
      phaseScore = s;
      phase = ph;
    }
  }
  const tempo = (60 * fps) / period;
  // Bars: 4 beats; which beat starts a bar is chosen by the strongest onsets on every 4th beat.
  let barOffset = 0;
  let barScore = -Infinity;
  for (let o = 0; o < 4; o++) {
    let s = 0;
    for (let t = phase + o * period; t < frames; t += 4 * period) s += on[Math.round(t)] ?? 0;
    if (s > barScore) {
      barScore = s;
      barOffset = o;
    }
  }
  const bars = [];
  for (let t = phase + barOffset * period; t < frames; t += 4 * period) bars.push(t);

  // --- 3. The best bar-aligned loop.
  const W = Math.round(2 * fps);
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const median = sorted[Math.floor(frames / 2)];
  function sim(a, b) {
    let total = 0;
    let count = 0;
    for (let d = -W; d <= W; d++) {
      const fa = Math.round(a) + d;
      const fb = Math.round(b) + d;
      if (fa < 0 || fb < 0 || fa >= frames || fb >= frames) continue;
      let dot = 0;
      let na = 0;
      let nb = 0;
      // Mean-removed log spectra, so loudness alone doesn't make frames alike.
      let ma = 0;
      let mb = 0;
      for (let k = 0; k < BANDS; k++) {
        ma += feat[fa * BANDS + k];
        mb += feat[fb * BANDS + k];
      }
      ma /= BANDS;
      mb /= BANDS;
      for (let k = 0; k < BANDS; k++) {
        const u = feat[fa * BANDS + k] - ma;
        const v = feat[fb * BANDS + k] - mb;
        dot += u * v;
        na += u * u;
        nb += v * v;
      }
      const loud = Math.min(rms[fa], rms[fb]) / Math.max(1e-6, Math.max(rms[fa], rms[fb]));
      total += (dot / Math.sqrt(na * nb + 1e-9)) * (0.5 + 0.5 * loud);
      count++;
    }
    return total / Math.max(1, count);
  }
  // Away from the intro (first 8 s) and the ending (last 15 s), and only where it's not quiet.
  const lo = 8 * fps;
  const hi = frames - 15 * fps;
  let best = null;
  for (let i = 0; i < bars.length; i++) {
    const s = bars[i];
    if (s < lo || rms[Math.round(s)] < 0.35 * median) continue;
    for (let j = i + 1; j < bars.length; j++) {
      const e = bars[j];
      const len = (e - s) / fps;
      if (len < 45) continue;
      if (len > 150 || e > hi) break;
      if (rms[Math.round(e)] < 0.35 * median) continue;
      // Prefer longer loops slightly, so the music repeats less.
      const score = sim(s, e) + 0.0006 * len;
      if (!best || score > best.score) best = { s, e, score, similarity: sim(s, e) };
    }
  }
  if (!best) return { error: 'no loop found', tempo, duration: n / sr };

  // --- 4. Sample-accurate end: cross-correlate the waveforms at the seam.
  const s0 = Math.round(best.s * HOP + N / 2);
  let e0 = Math.round(best.e * HOP + N / 2);
  const C = 2048;
  const range = Math.round(sr * 0.012);
  let bestOff = 0;
  let bestCorr = -Infinity;
  for (let off = -range; off <= range; off++) {
    let c = 0;
    let na = 0;
    let nb = 0;
    for (let i = -C; i < C; i++) {
      const a = x[s0 + i];
      const b = x[e0 + off + i];
      c += a * b;
      na += a * a;
      nb += b * b;
    }
    const corr = c / Math.sqrt(na * nb + 1e-12);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOff = off;
    }
  }
  e0 += bestOff;
  return {
    duration: n / sr,
    sampleRate: sr,
    tempo,
    loopStart: s0 / sr,
    loopEnd: e0 / sr,
    length: (e0 - s0) / sr,
    similarity: best.similarity,
    seamCorrelation: bestCorr,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
for (const t of tracks) {
  const b64 = readFileSync(resolve('assets/music', `${t}.mp3`)).toString('base64');
  const r = await page.evaluate(analyze, { b64, bpm: BPM[t] ?? 120 });
  console.log(t, JSON.stringify(r, (k, v) => (typeof v === 'number' ? Math.round(v * 10000) / 10000 : v)));
}
await browser.close();

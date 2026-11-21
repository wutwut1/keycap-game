// =============================================================
//  sound.js : เสียงทั้งหมดในเกม
//  สร้างเสียงด้วยโค้ด (Web Audio) ไม่ต้องใช้ไฟล์เสียง
//
//  tone()  = เสียงโทนเดียว (เหมือนเสียงดนตรี) ไล่ความถี่จาก freq ไป freqEnd
//  noise() = เสียงซ่า กรองให้เหลือบางช่วง (ใช้ทำเสียงพลาสติกกระทบกัน)
//  ปรับ vol (ความดัง) หรือ freq (เสียงสูง/ต่ำ) ได้ตามใจ
// =============================================================

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;
let lastDropTime = 0;
const MASTER_VOLUME = 0.7;

// เบราว์เซอร์อนุญาตให้เปิดเสียงได้หลังผู้เล่นแตะจอครั้งแรกเท่านั้น
export function init() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);

    // เตรียมเสียงซ่า (white noise) ยาวครึ่งวินาทีไว้ใช้ซ้ำ
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
  return muted;
}

function tone(freq, freqEnd, dur, vol, type = 'sine', delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol, filterType, freq, q = 1, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(vol, 0.0002), t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random() * 0.35);
  src.stop(t + dur + 0.02);
}

// เสียงคีย์แคปตกกระทบ (strength 0 ถึง 1 = แรงกระแทก)
export function drop(strength) {
  if (!ctx) return;
  const now = ctx.currentTime;
  if (now - lastDropTime < 0.03) return; // กันเสียงซ้อนกันเยอะเกินไป
  lastDropTime = now;
  const vol = 0.06 + 0.32 * strength;
  noise(0.045, vol, 'bandpass', 2500 + Math.random() * 2500, 2.5);
  tone(1300 + Math.random() * 700, 600, 0.04, vol * 0.45, 'triangle');
}

// เสียงกดคีย์แคปลงบนคีย์บอร์ด "ต๊อก!"
export function snap() {
  tone(260, 110, 0.13, 0.55, 'sine');
  noise(0.06, 0.35, 'lowpass', 1600, 1);
  noise(0.02, 0.22, 'highpass', 4500, 1);
  tone(1800, 1200, 0.03, 0.1, 'triangle', 0.01);
  tone(1046, 1568, 0.12, 0.07, 'sine', 0.06); // ประกายเสียงเล็กๆ
}

export function pick()  { tone(520, 880, 0.09, 0.15, 'sine'); }
export function tick()  { tone(1500, 1400, 0.04, 0.06, 'square'); }
export function shake() { noise(0.35, 0.25, 'bandpass', 1200, 0.7); }
export function start() {
  tone(660, 990, 0.12, 0.18, 'sine');
  tone(990, 1320, 0.14, 0.15, 'sine', 0.1);
}
export function wrong() {
  tone(330, 220, 0.12, 0.2, 'triangle');
  tone(260, 170, 0.16, 0.2, 'triangle', 0.12);
}
export function win() {
  [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f * 1.01, 0.28, 0.22, 'triangle', i * 0.09));
}
export function lose() {
  [440, 370, 311, 262].forEach((f, i) => tone(f, f * 0.97, 0.3, 0.2, 'triangle', i * 0.16));
}

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Audio ──────────────────────────────────────────────────────────────────────
function beep(freq: number, dur: number, vol = 0.12, type: OscillatorType = 'square') {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
    osc.onended = () => ctx.close();
  } catch { /* ignore */ }
}
function jumpSound() { beep(520, 0.07); }
function collectSound() { beep(880, 0.05); beep(1100, 0.06); }
function hitSound() { beep(300, 0.3, 0.18, 'sawtooth'); }
function gameOverSound() {
  try {
    const ctx = new AudioContext();
    [440, 330, 220, 110].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.11);
      gain.gain.setValueAtTime(0.14, ctx.currentTime + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.11 + 0.14);
      osc.start(ctx.currentTime + i * 0.11);
      osc.stop(ctx.currentTime + i * 0.11 + 0.14);
      if (i === 3) osc.onended = () => ctx.close();
    });
  } catch { /* ignore */ }
}

// ── Constants ──────────────────────────────────────────────────────────────────
const CW = 380;
const CH = 220;
const GROUND_Y = 182;
const CHAR_X = 62;
const CHAR_W = 40;
const CHAR_H = 26;
const CHAR_BASE = GROUND_Y - CHAR_H; // = 156
const DUCK_H = 13;
// Drone drawn at y=150, h=18 → spans 150–168
// Standing char top = CHAR_BASE+4 = 160 → HIT; ducking char top = CHAR_BASE+(CHAR_H-DUCK_H)+4=173 → MISS
const DRONE_Y = 150;
const DRONE_H = 18;
const GRAVITY = 0.6;
const JUMP_VY = -12.5;
const INIT_SPEED = 5;
const MAX_SPEED = 15;

// ── Types ──────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'running' | 'paused' | 'dead';
type ObsType = 'folder' | 'firewall' | 'corrupted' | 'drone';
type PUType = 'shield' | 'slowmo' | 'diamond';

interface Obstacle { id: number; x: number; type: ObsType; w: number; h: number; phase: number; }
interface PowerUp { id: number; x: number; y: number; type: PUType; done: boolean; floatPhase: number; }
interface Particle { id: number; x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; }
interface FloatText { id: number; x: number; y: number; text: string; life: number; color: string; }
interface Star { x: number; y: number; r: number; }
interface BgCloud { x: number; y: number; w: number; h: number; }

interface GS {
  phase: Phase;
  charY: number; charVY: number; jumpCount: number; isDucking: boolean;
  bobFrame: number; scaleY: number;
  invincible: number; flashRed: number;
  shieldTime: number; slowmoTime: number;
  lives: number; score: number; hiScore: number; newHi: boolean; dispScore: number;
  speed: number; gameTime: number;
  obstacles: Obstacle[]; powerUps: PowerUp[]; particles: Particle[]; floatTexts: FloatText[];
  l1: number; l2: number; l3: number;
  obsTimer: number; obsInterval: number;
  puTimer: number; puInterval: number;
  uid: number;
  stars: Star[]; bgClouds: BgCloud[];
}

function mkState(hs: number): GS {
  const stars: Star[] = Array.from({ length: 45 }, () => ({
    x: Math.random() * CW, y: 8 + Math.random() * (GROUND_Y - 50), r: Math.random() * 1.4 + 0.3,
  }));
  const bgClouds: BgCloud[] = Array.from({ length: 9 }, (_, i) => ({
    x: i * (CW / 8) + Math.random() * 20,
    y: 15 + Math.random() * 55,
    w: 38 + Math.random() * 28, h: 14 + Math.random() * 10,
  }));
  return {
    phase: 'idle', charY: CHAR_BASE, charVY: 0, jumpCount: 0, isDucking: false,
    bobFrame: 0, scaleY: 1, invincible: 0, flashRed: 0, shieldTime: 0, slowmoTime: 0,
    lives: 3, score: 0, hiScore: hs, newHi: false, dispScore: 0,
    speed: INIT_SPEED, gameTime: 0,
    obstacles: [], powerUps: [], particles: [], floatTexts: [],
    l1: 0, l2: 0, l3: 0,
    obsTimer: 0, obsInterval: 85,
    puTimer: 0, puInterval: 420,
    uid: 1, stars, bgClouds,
  };
}

// ── Background color (day/night cycle) ────────────────────────────────────────
function bgColor(score: number): string {
  const t = Math.min(score / 600, 1);
  return `rgb(${Math.round(0x1a + (0x0f - 0x1a) * t)},${Math.round(0x1a + (0x34 - 0x1a) * t)},${Math.round(0x2e + (0x60 - 0x2e) * t)})`;
}

// ── Draw: parallax background ─────────────────────────────────────────────────
function drawBg(ctx: CanvasRenderingContext2D, gs: GS, frame: number) {
  ctx.fillStyle = bgColor(gs.dispScore);
  ctx.fillRect(0, 0, CW, CH);

  // Layer 1: stars (20% speed)
  const s1 = gs.l1 % CW;
  for (const st of gs.stars) {
    const sx = ((st.x - s1) % CW + CW) % CW;
    ctx.globalAlpha = 0.35 + Math.sin(frame * 0.025 + st.x) * 0.2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(sx, st.y, st.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Layer 2: cloud shapes (50% speed)
  const s2 = gs.l2;
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  for (const c of gs.bgClouds) {
    const cx = ((c.x - s2 % (CW + c.w)) % (CW + c.w) + CW + c.w) % (CW + c.w) - c.w;
    ctx.beginPath(); ctx.ellipse(cx + c.w / 2, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Ground fill
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, GROUND_Y, CW, CH - GROUND_Y);

  // Ground line
  ctx.strokeStyle = '#4F46E5';
  ctx.lineWidth = 1.5; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(CW, GROUND_Y); ctx.stroke();

  // Layer 3: ground tick marks (100% speed)
  const s3 = gs.l3 % 20;
  ctx.strokeStyle = 'rgba(99,102,241,0.22)'; ctx.lineWidth = 1;
  for (let x = -s3; x < CW; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y + 4); ctx.stroke();
  }
}

// ── Draw: character ───────────────────────────────────────────────────────────
function drawChar(ctx: CanvasRenderingContext2D, gs: GS) {
  const h = gs.isDucking ? DUCK_H : CHAR_H;
  const baseY = gs.isDucking ? CHAR_BASE + (CHAR_H - DUCK_H) : gs.charY;
  const bob = (gs.isDucking || gs.charY < CHAR_BASE - 2) ? 0 : Math.sin(gs.bobFrame * 0.09) * 2;
  const drawY = baseY + bob;
  const cx = CHAR_X + CHAR_W / 2;
  const red = gs.flashRed > 0;

  ctx.globalAlpha = gs.invincible > 0 ? (Math.floor(gs.invincible / 5) % 2 === 0 ? 0.25 : 1) : 1;

  ctx.save();
  ctx.translate(cx, drawY + h);
  ctx.scale(1, gs.scaleY);
  ctx.translate(-cx, -(drawY + h));

  // Shield ring
  if (gs.shieldTime > 0) {
    const a = 0.5 + Math.sin(gs.bobFrame * 0.22) * 0.3;
    ctx.strokeStyle = `rgba(59,130,246,${a})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, drawY + h / 2, CHAR_W / 2 + 9, h / 2 + 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(147,197,253,${a * 0.5})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, drawY + h / 2, CHAR_W / 2 + 5, h / 2 + 5, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // Cloud body (rounded rect + puffs)
  ctx.fillStyle = red ? '#EF4444' : '#E8E8F2';
  ctx.strokeStyle = red ? '#DC2626' : '#9CA3AF';
  ctx.lineWidth = 1.5;

  // Main body rect
  ctx.beginPath();
  ctx.roundRect(CHAR_X + 2, drawY + h * 0.38, CHAR_W - 4, h * 0.62, 7);
  ctx.fill(); ctx.stroke();

  // Top puffs
  ctx.beginPath(); ctx.ellipse(CHAR_X + CHAR_W * 0.34, drawY + h * 0.38, CHAR_W * 0.22, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(CHAR_X + CHAR_W * 0.62, drawY + h * 0.32, CHAR_W * 0.18, h * 0.26, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Eyes (only when not fully squished)
  if (!gs.isDucking && h > 10) {
    ctx.fillStyle = red ? '#fff' : '#1F2937';
    ctx.beginPath(); ctx.arc(CHAR_X + CHAR_W * 0.37, drawY + h * 0.58, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CHAR_X + CHAR_W * 0.63, drawY + h * 0.58, 2.5, 0, Math.PI * 2); ctx.fill();
    if (!red) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(CHAR_X + CHAR_W * 0.38, drawY + h * 0.57, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(CHAR_X + CHAR_W * 0.64, drawY + h * 0.57, 1, 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── Draw: obstacles ───────────────────────────────────────────────────────────
function drawObs(ctx: CanvasRenderingContext2D, gs: GS, frame: number) {
  for (const o of gs.obstacles) {
    const oy = o.type === 'drone' ? DRONE_Y : GROUND_Y - o.h;

    if (o.type === 'folder') {
      for (let s = 0; s < 2; s++) {
        const sy = oy + s * o.h * 0.46;
        const sh = o.h * 0.6;
        ctx.fillStyle = '#F59E0B'; ctx.strokeStyle = '#92400E'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(o.x + 2, sy, o.w * 0.5, sh * 0.15, 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = s === 0 ? '#FBBF24' : '#F59E0B';
        ctx.beginPath(); ctx.roundRect(o.x, sy + sh * 0.13, o.w, sh * 0.87, 3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#FDE68A'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(o.x + 3, sy + sh * 0.5); ctx.lineTo(o.x + o.w - 3, sy + sh * 0.5); ctx.stroke();
      }

    } else if (o.type === 'firewall') {
      const grd = ctx.createLinearGradient(o.x, oy, o.x + o.w, oy);
      grd.addColorStop(0, '#DC2626'); grd.addColorStop(0.5, '#EF4444'); grd.addColorStop(1, '#DC2626');
      ctx.fillStyle = grd; ctx.strokeStyle = '#FCA5A5'; ctx.lineWidth = 1.5;
      ctx.shadowColor = '#EF4444'; ctx.shadowBlur = 6 + Math.sin(frame * 0.17) * 4;
      ctx.beginPath(); ctx.roundRect(o.x, oy, o.w, o.h, 3); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FEE2E2'; ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(o.x + o.w / 2, oy + o.h / 2); ctx.rotate(-Math.PI / 2);
      ctx.fillText('FIREWALL', 0, 2); ctx.restore();

    } else if (o.type === 'corrupted') {
      const g = Math.sin(frame * 0.32 + o.phase);
      const colors = ['#7C3AED', '#A855F7', '#EC4899', '#6D28D9'];
      ctx.fillStyle = colors[Math.floor(((g + 1) / 2) * 4) % 4];
      ctx.strokeStyle = '#C084FC'; ctx.lineWidth = 1;
      const gx = o.x + (g > 0.5 ? 3 : g < -0.5 ? -2 : 0);
      ctx.beginPath(); ctx.roundRect(gx, oy, o.w, o.h, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(gx + 2, oy + o.h * 0.3, o.w - 4, 2);
      ctx.fillRect(gx + 2, oy + o.h * 0.62, o.w - 4, 1);

    } else if (o.type === 'drone') {
      const hov = Math.sin(frame * 0.13 + o.phase) * 2;
      const dy = oy + hov;
      ctx.fillStyle = '#6B7280'; ctx.strokeStyle = '#9CA3AF'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(o.x, dy, o.w, DRONE_H, 3); ctx.fill(); ctx.stroke();
      // Struts + spinning props
      ctx.strokeStyle = '#D1D5DB'; ctx.lineWidth = 1.5;
      [0.28, 0.72].forEach(frac => {
        const px = o.x + o.w * frac;
        ctx.beginPath(); ctx.moveTo(px, dy); ctx.lineTo(px, dy - 5); ctx.stroke();
        const spin = Math.abs(Math.sin(frame * 0.6)) * 6;
        ctx.strokeStyle = 'rgba(209,213,219,0.55)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(px, dy - 5, spin, 1.5, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#D1D5DB'; ctx.lineWidth = 1.5;
      });
      // Blink light
      ctx.fillStyle = `rgba(239,68,68,${0.5 + Math.sin(frame * 0.2) * 0.5})`;
      ctx.beginPath(); ctx.arc(o.x + o.w / 2, dy + DRONE_H / 2, 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.textAlign = 'left'; ctx.shadowBlur = 0;
}

// ── Draw: power-ups ───────────────────────────────────────────────────────────
function drawPUs(ctx: CanvasRenderingContext2D, gs: GS, frame: number) {
  for (const pu of gs.powerUps) {
    if (pu.done) continue;
    const bob = Math.sin(frame * 0.09 + pu.floatPhase) * 4;
    const y = pu.y + bob;
    const colors: Record<PUType, string> = { shield: '#3B82F6', slowmo: '#F59E0B', diamond: '#06B6D4' };
    const emojis: Record<PUType, string> = { shield: '☁️', slowmo: '⚡', diamond: '💎' };
    ctx.shadowColor = colors[pu.type]; ctx.shadowBlur = 10;
    ctx.strokeStyle = colors[pu.type]; ctx.lineWidth = 2;
    ctx.fillStyle = `${colors[pu.type]}22`;
    ctx.beginPath(); ctx.arc(pu.x + 11, y + 11, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '15px serif'; ctx.textAlign = 'center';
    ctx.fillText(emojis[pu.type], pu.x + 11, y + 16);
  }
  ctx.textAlign = 'left'; ctx.shadowBlur = 0;
}

// ── Draw: particles ───────────────────────────────────────────────────────────
function drawParticles(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const p of gs.particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.max), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Draw: floating score texts ─────────────────────────────────────────────────
function drawFloats(ctx: CanvasRenderingContext2D, gs: GS) {
  for (const ft of gs.floatTexts) {
    ctx.globalAlpha = ft.life / 60;
    ctx.fillStyle = ft.color;
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

// ── Draw: HUD ─────────────────────────────────────────────────────────────────
function drawHUD(ctx: CanvasRenderingContext2D, gs: GS) {
  if (gs.slowmoTime > 0) {
    ctx.fillStyle = 'rgba(251,191,36,0.05)'; ctx.fillRect(0, 0, CW, CH);
  }
  // Hearts
  ctx.font = '13px serif';
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < gs.lives ? 1 : 0.22;
    ctx.fillText('❤️', 6 + i * 18, 17);
  }
  ctx.globalAlpha = 1;
  // Score
  ctx.fillStyle = '#22C55E'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`${gs.dispScore}`, CW - 8, 16);
  ctx.fillStyle = '#6B7280'; ctx.font = '9px monospace';
  ctx.fillText(`HI ${gs.hiScore}`, CW - 8, 27);
  ctx.textAlign = 'left';
  // Power-up bars
  let by = 36;
  if (gs.shieldTime > 0) {
    const p = gs.shieldTime / (60 * 3);
    ctx.fillStyle = 'rgba(59,130,246,0.25)'; ctx.fillRect(CW - 40, by, 32, 4);
    ctx.fillStyle = '#3B82F6'; ctx.fillRect(CW - 40, by, 32 * p, 4);
    ctx.font = '9px serif'; ctx.textAlign = 'right';
    ctx.fillText('🛡', CW - 42, by + 5);
    ctx.textAlign = 'left'; by += 8;
  }
  if (gs.slowmoTime > 0) {
    const p = gs.slowmoTime / (60 * 5);
    ctx.fillStyle = 'rgba(245,158,11,0.25)'; ctx.fillRect(CW - 40, by, 32, 4);
    ctx.fillStyle = '#F59E0B'; ctx.fillRect(CW - 40, by, 32 * p, 4);
  }
}

// ── Particle helpers ──────────────────────────────────────────────────────────
function spawnJump(gs: GS) {
  const bx = CHAR_X + CHAR_W / 2;
  const by = CHAR_BASE + CHAR_H;
  for (let i = 0; i < 5; i++) {
    gs.particles.push({ id: gs.uid++, x: bx + (Math.random() - 0.5) * 14, y: by,
      vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2 - 1,
      life: 22, max: 22, color: '#E8E8F2', size: 3 });
  }
}
function spawnHit(gs: GS) {
  const bx = CHAR_X + CHAR_W / 2; const by = gs.charY + CHAR_H / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    gs.particles.push({ id: gs.uid++, x: bx, y: by,
      vx: Math.cos(a) * (2 + Math.random() * 2.5), vy: Math.sin(a) * (2 + Math.random() * 2.5),
      life: 30, max: 30, color: ['#F97316','#EF4444','#FCD34D'][Math.floor(Math.random()*3)], size: 4 });
  }
}
function spawnDiamond(gs: GS, x: number, y: number) {
  const palette = ['#06B6D4','#67E8F9','#A78BFA','#F472B6','#34D399'];
  for (let i = 0; i < 10; i++) {
    gs.particles.push({ id: gs.uid++, x, y,
      vx: (Math.random() - 0.5) * 4.5, vy: -Math.random() * 4 - 1,
      life: 38, max: 38, color: palette[Math.floor(Math.random() * palette.length)], size: 3 });
  }
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function DinoGame() {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [uiPhase, setUiPhase] = useState<Phase>('idle');
  const [newHigh, setNewHigh] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<GS>(mkState(0));
  const rafRef = useRef(0);
  const duckRef = useRef(false);
  const frameRef = useRef(0);
  const dragging = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const getHS = () => parseInt(localStorage.getItem('cloudrunner-hs3') ?? '0', 10);
  const saveHS = (s: number) => localStorage.setItem('cloudrunner-hs3', String(s));

  const doJump = useCallback(() => {
    const gs = gsRef.current;
    if (gs.phase === 'idle') { gs.phase = 'running'; setUiPhase('running'); }
    if (gs.phase !== 'running') return;
    if (gs.jumpCount < 2) {
      gs.charVY = JUMP_VY; gs.jumpCount++;
      if (gs.jumpCount === 1) spawnJump(gs);
      jumpSound();
    }
  }, []);

  const doPause = useCallback(() => {
    const gs = gsRef.current;
    if (gs.phase === 'running') { gs.phase = 'paused'; setUiPhase('paused'); }
    else if (gs.phase === 'paused') { gs.phase = 'running'; setUiPhase('running'); }
  }, []);

  const restart = useCallback(() => {
    const ns = mkState(getHS());
    ns.phase = 'running';
    gsRef.current = ns;
    setUiPhase('running'); setNewHigh(false); duckRef.current = false;
  }, []);

  // Keyboard
  useEffect(() => {
    if (!open) return;
    const dn = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); doJump(); }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); duckRef.current = true; }
      if (e.code === 'KeyP') { e.preventDefault(); doPause(); }
      if (e.code === 'KeyR' && gsRef.current.phase === 'dead') restart();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') duckRef.current = false;
    };
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, [open, doJump, doPause, restart]);

  // Game loop
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const tick = () => {
      frameRef.current++;
      const frame = frameRef.current;
      const gs = gsRef.current;
      const slo = gs.slowmoTime > 0 ? 0.5 : 1;

      if (gs.phase === 'running') {
        gs.bobFrame++; gs.gameTime++;
        gs.isDucking = duckRef.current;

        // Speed ramp: +0.5 every 10 s (600 frames)
        gs.speed = Math.min(INIT_SPEED + Math.floor(gs.gameTime / 600) * 0.5, MAX_SPEED);
        const spd = gs.speed * slo;

        gs.l1 += spd * 0.2; gs.l2 += spd * 0.5; gs.l3 += spd;

        // Physics
        gs.charVY += GRAVITY * slo;
        gs.charY += gs.charVY * slo;
        if (gs.charY >= CHAR_BASE) {
          gs.charY = CHAR_BASE; gs.charVY = 0; gs.jumpCount = 0;
        }
        // Vertical squish/stretch
        if (gs.charVY < -3) gs.scaleY = 1.3;
        else if (gs.charVY > 3) gs.scaleY = 0.7;
        else if (gs.isDucking) gs.scaleY = 0.5;
        else gs.scaleY = 1;

        if (gs.invincible > 0) gs.invincible--;
        if (gs.flashRed > 0) gs.flashRed--;
        if (gs.shieldTime > 0) gs.shieldTime -= slo;
        if (gs.slowmoTime > 0) gs.slowmoTime--;

        gs.score++; gs.dispScore = Math.floor(gs.score / 5);

        // Spawn obstacles
        gs.obsTimer++;
        if (gs.obsTimer >= gs.obsInterval) {
          gs.obsTimer = 0;
          gs.obsInterval = Math.max(48, 88 - Math.floor(gs.dispScore / 25)) + Math.floor(Math.random() * 42);
          const types: ObsType[] = ['folder', 'firewall', 'corrupted', 'drone'];
          const t = types[Math.floor(Math.random() * types.length)];
          gs.obstacles.push({
            id: gs.uid++, x: CW + 12, type: t, phase: Math.random() * Math.PI * 2,
            w: t === 'drone' ? 32 : 16 + Math.floor(Math.random() * 9),
            h: t === 'drone' ? DRONE_H : 26 + Math.floor(Math.random() * 22),
          });
        }

        // Spawn power-ups
        gs.puTimer++;
        if (gs.puTimer >= gs.puInterval) {
          gs.puTimer = 0; gs.puInterval = 360 + Math.floor(Math.random() * 220);
          const pts: PUType[] = ['shield', 'slowmo', 'diamond'];
          gs.powerUps.push({
            id: gs.uid++, x: CW + 12, y: CHAR_BASE - 28,
            type: pts[Math.floor(Math.random() * 3)],
            done: false, floatPhase: Math.random() * Math.PI * 2,
          });
        }

        gs.obstacles = gs.obstacles.map(o => ({ ...o, x: o.x - spd })).filter(o => o.x > -70);
        gs.powerUps = gs.powerUps.map(p => ({ ...p, x: p.x - spd })).filter(p => p.x > -44);

        // Char hitbox
        const ch = gs.isDucking ? DUCK_H : CHAR_H;
        const cTopY = gs.isDucking ? CHAR_BASE + (CHAR_H - DUCK_H) : gs.charY;
        const cL = CHAR_X + 5; const cR = CHAR_X + CHAR_W - 5;
        const cT = cTopY + 4; const cB = cTopY + ch - 3;

        // Obstacle collision
        for (const o of gs.obstacles) {
          const ot = o.type === 'drone' ? DRONE_Y : GROUND_Y - o.h;
          const ob = o.type === 'drone' ? DRONE_Y + DRONE_H : GROUND_Y;
          if (cR > o.x + 3 && cL < o.x + o.w - 3 && cB > ot + 3 && cT < ob - 3 && gs.invincible === 0) {
            if (gs.shieldTime > 0) {
              gs.shieldTime = 0; spawnHit(gs); hitSound();
            } else {
              gs.lives--; spawnHit(gs); hitSound();
              gs.invincible = 120; gs.flashRed = 30;
              if (gs.lives <= 0) {
                gs.phase = 'dead'; setUiPhase('dead'); gameOverSound();
                if (gs.dispScore > gs.hiScore) {
                  gs.hiScore = gs.dispScore; gs.newHi = true;
                  saveHS(gs.hiScore); setNewHigh(true);
                }
              }
            }
            break;
          }
        }

        // Power-up collision
        for (const pu of gs.powerUps) {
          if (pu.done) continue;
          const bob = Math.sin(frame * 0.09 + pu.floatPhase) * 4;
          const py = pu.y + bob;
          if (cR > pu.x && cL < pu.x + 22 && cB > py && cT < py + 22) {
            pu.done = true; collectSound();
            if (pu.type === 'shield') gs.shieldTime = 60 * 3;
            else if (pu.type === 'slowmo') gs.slowmoTime = 60 * 5;
            else {
              gs.score += 250;
              spawnDiamond(gs, pu.x + 11, pu.y);
              gs.floatTexts.push({ id: gs.uid++, x: pu.x + 11, y: pu.y - 8, text: '+50', life: 60, color: '#06B6D4' });
            }
          }
        }

        // Update particles & float texts
        gs.particles = gs.particles.map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.12, life: p.life - 1 })).filter(p => p.life > 0);
        gs.floatTexts = gs.floatTexts.map(ft => ({ ...ft, y: ft.y - 0.7, life: ft.life - 1 })).filter(ft => ft.life > 0);
      } else {
        gs.bobFrame++;
      }

      // ── Draw ───────────────────────────────────────────────────────────────
      drawBg(ctx, gs, frame);
      drawObs(ctx, gs, frame);
      drawPUs(ctx, gs, frame);
      drawChar(ctx, gs);
      drawParticles(ctx, gs);
      drawFloats(ctx, gs);
      drawHUD(ctx, gs);

      if (gs.phase === 'idle') {
        ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = '#F0F0FF'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
        ctx.fillText('CloudRunner 🎮', CW / 2, CH / 2 - 16);
        ctx.fillStyle = 'rgba(255,255,255,0.52)'; ctx.font = '10px monospace';
        ctx.fillText('SPACE/↑ jump  ↓/S duck  P pause', CW / 2, CH / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillText('Click or tap to start', CW / 2, CH / 2 + 16);
        ctx.textAlign = 'left';
      }

      if (gs.phase === 'paused') {
        ctx.fillStyle = 'rgba(0,0,0,0.52)'; ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = '#F0F0FF'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('⏸ PAUSED', CW / 2, CH / 2);
        ctx.fillStyle = 'rgba(255,255,255,0.42)'; ctx.font = '10px monospace';
        ctx.fillText('P to resume', CW / 2, CH / 2 + 16);
        ctx.textAlign = 'left';
      }

      if (gs.phase === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.62)'; ctx.fillRect(0, 0, CW, CH);
        ctx.fillStyle = '#EF4444'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', CW / 2, CH / 2 - 24);
        ctx.fillStyle = '#D1D5DB'; ctx.font = '10px monospace';
        ctx.fillText(`Score: ${gs.dispScore}   Best: ${gs.hiScore}`, CW / 2, CH / 2 - 8);
        if (gs.newHi) {
          ctx.fillStyle = '#22C55E'; ctx.font = 'bold 10px monospace';
          ctx.fillText('🏆 NEW HIGH SCORE!', CW / 2, CH / 2 + 8);
        }
        ctx.fillStyle = '#6366f1'; ctx.font = 'bold 11px monospace';
        ctx.fillText('Click / R to restart', CW / 2, CH / 2 + (gs.newHi ? 24 : 12));
        ctx.textAlign = 'left';
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [open]);

  // Draggable title bar
  const onTitleDown = (e: React.MouseEvent) => {
    dragging.current = { sx: e.clientX, sy: e.clientY, ox: panelPos.x, oy: panelPos.y };
    const mv = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPanelPos({ x: dragging.current.ox + (ev.clientX - dragging.current.sx), y: dragging.current.oy + (ev.clientY - dragging.current.sy) });
    };
    const up = () => { dragging.current = null; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
  };

  const onCanvasClick = () => {
    if (gsRef.current.phase === 'dead') restart(); else doJump();
  };

  const handleOpen = () => {
    if (!open) {
      gsRef.current = mkState(getHS());
      setUiPhase('idle'); setNewHigh(false); frameRef.current = 0; duckRef.current = false;
    }
    setOpen(v => !v);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 9999 }}
        className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#0A0A0A] border border-[#2A2A2A] text-white text-xs font-medium shadow-lg hover:border-[#4A4A4A] transition-all"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
        Play
      </button>

      {/* Game panel */}
      {open && (
        <div
          style={{ position: 'fixed', left: 20 + panelPos.x, bottom: 80 - panelPos.y, width: CW, zIndex: 9998 }}
          className="rounded-xl overflow-hidden shadow-2xl border border-[#2A2A2A]"
        >
          {/* Title bar */}
          <div
            onMouseDown={onTitleDown}
            className="flex items-center justify-between px-3 py-1.5 bg-[#141414] border-b border-[#2A2A2A] cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              <span className="text-xs font-semibold text-[#F5F5F5] font-mono">CloudRunner 🎮</span>
              {newHigh && uiPhase === 'dead' && (
                <span className="text-[10px] text-[#22C55E] font-bold animate-pulse">NEW HIGH!</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={doPause}
                title="Pause (P)"
                className="w-5 h-5 rounded bg-[#252525] hover:bg-[#333] text-[#888] hover:text-white transition-colors flex items-center justify-center text-[10px] leading-none"
              >
                {uiPhase === 'paused' ? '▶' : '⏸'}
              </button>
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => setOpen(false)}
                className="w-5 h-5 rounded-full bg-[#252525] hover:bg-[#EF4444] text-[#888] hover:text-white transition-colors flex items-center justify-center text-[10px] leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={CW}
            height={CH}
            onClick={onCanvasClick}
            className="block cursor-pointer"
            style={{ display: 'block', width: CW, height: CH }}
          />
        </div>
      )}
    </>
  );
}

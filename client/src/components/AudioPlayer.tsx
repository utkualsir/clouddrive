import { useEffect, useRef, useState, useCallback } from 'react';
import { Music } from 'lucide-react';

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const BAR_COUNT = 40;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface AudioPlayerProps {
  src: string;
  mimeType: string;
  fileName: string;
}

export default function AudioPlayer({ src, mimeType, fileName }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const sourceCreated = useRef(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [bars, setBars] = useState<number[]>(Array(BAR_COUNT).fill(4));
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Set up Web Audio API analyser on first play
  const initAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a || sourceCreated.current) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(a);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      sourceCreated.current = true;
    } catch { /* ignore — may be cross-origin restricted */ }
  }, []);

  const animate = useCallback(() => {
    const analyser = analyserRef.current;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const step = Math.floor(data.length / BAR_COUNT);
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const val = data[i * step] ?? 0;
        return Math.max(4, (val / 255) * 60);
      });
      setBars(next);
    } else {
      // Idle animation when analyser not available
      setBars(prev => prev.map((_, i) => 4 + Math.abs(Math.sin(Date.now() * 0.003 + i * 0.3)) * 12));
    }
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);

  const stopAnimate = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setBars(Array(BAR_COUNT).fill(4));
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    initAudio();
    if (a.paused) { a.play().catch(() => {}); } else { a.pause(); }
  }, [initAudio]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    const el = progressRef.current;
    if (!a || !el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = pct * a.duration;
  }, []);

  const changeVolume = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    const el = volumeRef.current;
    if (!a || !el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.volume = pct;
    setVolume(pct);
    if (pct === 0) { a.muted = true; setMuted(true); }
    else { a.muted = false; setMuted(false); }
  }, []);

  const toggleMute = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = !a.muted;
    setMuted(a.muted);
  }, []);

  const changeSpeed = useCallback((s: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  }, []);

  const toggleLoop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.loop = !a.loop;
    setLoop(a.loop);
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => { setPlaying(true); animate(); };
    const onPause = () => { setPlaying(false); stopAnimate(); };
    const onEnded = () => { setPlaying(false); stopAnimate(); };
    const onTime = () => setCurrentTime(a.currentTime);
    const onDur = () => setDuration(a.duration);

    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onDur);

    return () => {
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('durationchange', onDur);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [animate, stopAnimate]);

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumePct = muted ? 0 : volume * 100;
  const displayName = fileName.replace(/\.[^.]+$/, '');

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-5 py-6 px-2">
      {/* Hidden audio element */}
      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous">
        <source src={src} type={mimeType} />
      </audio>

      {/* Album art + waveform */}
      <div className="relative w-48 h-48 rounded-2xl overflow-hidden shrink-0">
        {/* Album art placeholder */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#4F46E5] via-[#7C3AED] to-[#EC4899] flex items-center justify-center">
          <Music className="w-16 h-16 text-white/40" strokeWidth={1} />
        </div>

        {/* Waveform overlay (bottom strip) */}
        <div className="absolute inset-x-0 bottom-0 h-16 flex items-end justify-center gap-px px-2 pb-2 bg-gradient-to-t from-black/60 to-transparent">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-all duration-75"
              style={{
                height: `${h}px`,
                backgroundColor: playing
                  ? `hsl(${240 + i * 3}, 80%, 75%)`
                  : 'rgba(255,255,255,0.35)',
              }}
            />
          ))}
        </div>

        {/* Play/Pause overlay button */}
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center group"
        >
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 transition-colors border border-white/30">
            {playing ? (
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z" /></svg>
            )}
          </div>
        </button>
      </div>

      {/* Track info */}
      <div className="text-center">
        <p className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] truncate max-w-xs">{displayName}</p>
        <p className="text-[11px] text-[#6B7280] dark:text-[#555555] mt-0.5">Audio Track</p>
      </div>

      {/* Progress bar */}
      <div className="w-full space-y-1">
        <div
          ref={progressRef}
          className="relative h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] cursor-pointer group/prog"
          onClick={seek}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[#4F46E5]"
            style={{ width: `${playedPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#4F46E5] shadow opacity-0 group-hover/prog:opacity-100 transition-opacity -ml-1.5"
            style={{ left: `${playedPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-[#AAAAAA] dark:text-[#555555] font-mono tabular-nums">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Previous (disabled placeholder) */}
        <button disabled className="w-8 h-8 flex items-center justify-center opacity-30 text-[#6B7280] dark:text-[#555555]">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
        </button>

        {/* Play/Pause (large) */}
        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-[#4F46E5] hover:bg-[#4338CA] flex items-center justify-center transition-colors shadow-md"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>

        {/* Next (disabled placeholder) */}
        <button disabled className="w-8 h-8 flex items-center justify-center opacity-30 text-[#6B7280] dark:text-[#555555]">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" /></svg>
        </button>
      </div>

      {/* Bottom controls */}
      <div className="w-full flex items-center gap-3">
        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <button onClick={toggleMute} className="text-[#6B7280] dark:text-[#555555] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] transition-colors">
            {volumePct === 0 ? (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
            )}
          </button>
          <div
            ref={volumeRef}
            className="w-16 h-1 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] cursor-pointer relative"
            onClick={changeVolume}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#4F46E5]" style={{ width: `${volumePct}%` }} />
          </div>
        </div>

        <div className="flex-1" />

        {/* Loop */}
        <button
          onClick={toggleLoop}
          title="Loop"
          className={`text-xs px-2 py-0.5 rounded transition-colors font-mono ${loop ? 'text-[#4F46E5] bg-[#EEF2FF] dark:bg-[#1e1b4b]/30' : 'text-[#AAAAAA] dark:text-[#555555] hover:text-[#6B7280]'}`}
        >
          ↻
        </button>

        {/* Speed */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedMenu(v => !v)}
            className="text-[11px] text-[#6B7280] dark:text-[#555555] hover:text-[#0A0A0A] dark:hover:text-[#F5F5F5] font-mono px-1.5 py-0.5 rounded hover:bg-[#F0F0F0] dark:hover:bg-[#252525] transition-colors"
          >
            {speed}x
          </button>
          {showSpeedMenu && (
            <div className="absolute bottom-full right-0 mb-1 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-lg py-1 z-10 min-w-[60px] shadow-lg">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  className={`w-full text-xs px-3 py-1.5 text-left hover:bg-[#F8F8F8] dark:hover:bg-[#252525] transition-colors ${s === speed ? 'text-[#4F46E5] font-medium' : 'text-[#0A0A0A] dark:text-[#F5F5F5]'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

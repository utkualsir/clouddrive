import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';

function fmt(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

interface VideoPlayerProps {
  src: string;
  mimeType: string;
  onDownload?: () => void;
}

export default function VideoPlayer({ src, mimeType, onDownload }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number>(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isPip, setIsPip] = useState(false);

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const showCtrl = useCallback(() => {
    setShowControls(true);
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2000);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const el = progressRef.current;
    if (!v || !el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
  }, []);

  const changeVolume = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const el = volumeRef.current;
    if (!v || !el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.volume = pct;
    setVolume(pct);
    setMuted(pct === 0);
    v.muted = pct === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const changeSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeedMenu(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch { /* unsupported */ }
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onTime = () => { setCurrentTime(v.currentTime); };
    const onDur = () => setDuration(v.duration);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onError = () => { setError(true); setLoading(false); };
    const onProg = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onPipEnter = () => setIsPip(true);
    const onPipLeave = () => setIsPip(false);

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('error', onError);
    v.addEventListener('progress', onProg);
    v.addEventListener('enterpictureinpicture', onPipEnter);
    v.addEventListener('leavepictureinpicture', onPipLeave);

    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('error', onError);
      v.removeEventListener('progress', onProg);
      v.removeEventListener('enterpictureinpicture', onPipEnter);
      v.removeEventListener('leavepictureinpicture', onPipLeave);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') { if (videoRef.current) videoRef.current.currentTime -= 5; }
      if (e.code === 'ArrowRight') { if (videoRef.current) videoRef.current.currentTime += 5; }
      if (e.code === 'KeyM') toggleMute();
      if (e.code === 'KeyF') toggleFullscreen();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, toggleMute, toggleFullscreen]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 w-full">
        <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <p className="text-sm text-[#6B6B6B] dark:text-[#888888]">Video cannot be played</p>
        {onDownload && (
          <button onClick={onDownload} className="flex items-center gap-2 h-8 px-4 text-xs font-medium bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" strokeWidth={1.5} /> Download
          </button>
        )}
      </div>
    );
  }

  const playedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const volumePct = muted ? 0 : volume * 100;

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-lg overflow-hidden group"
      style={{ maxHeight: '55vh' }}
      onMouseMove={showCtrl}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full max-h-[55vh] cursor-pointer"
        preload="metadata"
        onClick={togglePlay}
        style={{ display: 'block' }}
      >
        <source src={src} type={mimeType} />
      </video>

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-white/70 animate-spin" strokeWidth={1.5} />
        </div>
      )}

      {/* PiP indicator */}
      {isPip && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <p className="text-white text-sm font-medium">Playing in Picture-in-Picture</p>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${showControls || !playing ? 'opacity-100' : 'opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-3 pb-3 pt-8 space-y-2">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="relative h-1.5 rounded-full bg-white/20 cursor-pointer group/prog"
            onClick={seek}
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#6366f1]" style={{ width: `${playedPct}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover/prog:opacity-100 transition-opacity -ml-1.5"
              style={{ left: `${playedPct}%` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white">
              {playing ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>

            {/* Time */}
            <span className="text-[11px] text-white/80 font-mono tabular-nums whitespace-nowrap">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-1.5">
              <button onClick={toggleMute} className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white transition-colors">
                {volumePct === 0 ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                ) : volumePct < 50 ? (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                )}
              </button>
              <div
                ref={volumeRef}
                className="w-16 h-1 rounded-full bg-white/20 cursor-pointer relative"
                onClick={changeVolume}
              >
                <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${volumePct}%` }} />
              </div>
            </div>

            {/* Speed */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(v => !v)}
                className="text-[11px] text-white/80 hover:text-white font-mono px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
              >
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-1 bg-[#141414] border border-[#2A2A2A] rounded-lg py-1 z-10 min-w-[60px]">
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`w-full text-xs px-3 py-1.5 text-left hover:bg-[#252525] transition-colors ${s === speed ? 'text-[#6366f1] font-medium' : 'text-[#F5F5F5]'}`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP */}
            {'pictureInPictureEnabled' in document && (
              <button onClick={togglePip} title="Picture-in-Picture" className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white transition-colors">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z" /></svg>
              </button>
            )}

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="w-6 h-6 flex items-center justify-center text-white/80 hover:text-white transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

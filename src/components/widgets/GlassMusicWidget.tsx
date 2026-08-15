import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  GripHorizontal,
  Maximize2,
  ListMusic,
  Disc,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { WidgetProps } from "./types";

interface Track {
  id: string;
  title: string;
  artist: string;
  durationSeconds: number;
  initialTimeSeconds: number;
  genre: string;
  codec: string;
  chords: number[][]; // Frequency sets for acoustic/rhodes synthesis
  chordNames: string[];
  imageAlt: string;
}

const PLAYLIST: Track[] = [
  {
    id: "glass-demo",
    title: "玻璃 demo",
    artist: "Gareth.T",
    durationSeconds: 185, // 03:05
    initialTimeSeconds: 20, // 00:20
    genre: "Acoustic / R&B Demo",
    codec: "DEMO TAPE · 48kHz",
    chords: [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
    ],
    chordNames: ["Fmaj7", "Em7", "Dm7", "Cmaj7"],
    imageAlt: "Gareth.T vintage black & white studio silhouette",
  },
  {
    id: "romance-warm",
    title: "劲浪漫 超温馨",
    artist: "Gareth.T",
    durationSeconds: 198, // 03:18
    initialTimeSeconds: 45,
    genre: "Indie Soul / Pop",
    codec: "ANALOG MASTER · 96kHz",
    chords: [
      [196.0, 246.94, 293.66, 369.99], // Gmaj7
      [185.0, 220.0, 277.18, 329.63], // F#m7
      [164.81, 196.0, 246.94, 293.66], // Em7
      [146.83, 185.0, 220.0, 277.18], // Dmaj7
    ],
    chordNames: ["Gmaj7", "F#m7", "Em7", "Dmaj7"],
    imageAlt: "Gareth.T urban night scene",
  },
  {
    id: "honest",
    title: "Honest",
    artist: "Gareth.T",
    durationSeconds: 212, // 03:32
    initialTimeSeconds: 15,
    genre: "Lo-Fi R&B",
    codec: "CASSETTE TAPE · 44.1kHz",
    chords: [
      [130.81, 155.56, 196.0, 233.08], // Cm7
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [174.61, 207.65, 261.63, 311.13], // Fm7
      [196.0, 233.08, 293.66, 349.23], // Gm7
    ],
    chordNames: ["Cm7", "Dm7", "Fm7", "Gm7"],
    imageAlt: "Gareth.T tape camera visual",
  },
  {
    id: "lofi-focus",
    title: "Anki Focus Beats (Lofi)",
    artist: "Reasonix Chill",
    durationSeconds: 240, // 04:00
    initialTimeSeconds: 60,
    genre: "Study Beats",
    codec: "HI-RES LOSSLESS · 24-bit",
    chords: [
      [174.61, 220.0, 261.63, 311.13], // F7
      [164.81, 207.65, 246.94, 311.13], // E7#9
      [146.83, 174.61, 220.0, 261.63], // Dm7
      [130.81, 164.81, 196.0, 246.94], // Cmaj7
    ],
    chordNames: ["F7", "E7#9", "Dm7", "Cmaj7"],
    imageAlt: "Study desk ambient scene",
  },
];

interface GlassMusicWidgetProps extends WidgetProps {
  onExpand?: () => void;
}

export const GlassMusicWidget: React.FC<GlassMusicWidgetProps> = ({
  className = "",
  enableDrag = true,
  enableResize = true,
  onExpand,
}) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const track = PLAYLIST[currentTrackIndex];

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(track.initialTimeSeconds);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Equalizer visualizer heights state (5 dynamic frequency bars)
  const [eqHeights, setEqHeights] = useState<number[]>([10, 16, 22, 15, 10]);

  // Scrubber interactive states (Hover preview & drag scrub)
  const [isDraggingThumb, setIsDraggingThumb] = useState(false);
  const [hoverScrubPercent, setHoverScrubPercent] = useState<number | null>(null);
  const [hoverScrubTime, setHoverScrubTime] = useState<number | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Resizing state (Default width: 380, height: 142)
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 380,
    height: 142,
  });
  const [isResizing, setIsResizing] = useState(false);
  const startPos = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 380,
    height: 142,
  });

  // Web Audio Context & Oscillator Nodes for warm Lo-Fi acoustic demo synthesis
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isPlayingRef = useRef(false);
  isPlayingRef.current = isPlaying;
  const synthTimerRef = useRef<any>(null);
  const chordStepRef = useRef(0);
  const [currentChordName, setCurrentChordName] = useState<string>(track.chordNames[0] || "");

  // Format seconds to mm:ss with fixed width
  const formatTime = (totalSeconds: number) => {
    const safeSec = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(safeSec / 60);
    const secs = safeSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Start / stop Web Audio Synthesizer for demo playback
  const startSynthPlayback = () => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }

      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const chordProgression = track.chords;

      const playChord = () => {
        if (!isPlayingRef.current || !audioCtxRef.current) return;
        const currentCtx = audioCtxRef.current;
        const chordIdx = chordStepRef.current % chordProgression.length;
        const chord = chordProgression[chordIdx];
        setCurrentChordName(track.chordNames[chordIdx] || "");
        chordStepRef.current++;

        const now = currentCtx.currentTime;
        const masterGain = currentCtx.createGain();
        const effectiveVol = isMuted ? 0 : volume * 0.16;
        masterGain.gain.setValueAtTime(effectiveVol, now);
        masterGain.connect(currentCtx.destination);

        // Play each note in the chord with delicate arpeggiation & gentle envelope
        chord.forEach((freq, idx) => {
          const osc = currentCtx.createOscillator();
          const noteGain = currentCtx.createGain();

          // Warm harmonic overtone
          osc.type = idx === 0 ? "triangle" : "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);

          // Gentle acoustic attack and long lingering decay
          noteGain.gain.setValueAtTime(0, now + idx * 0.07);
          noteGain.gain.linearRampToValueAtTime(0.35, now + idx * 0.07 + 0.04);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 1.9);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 1.95);
        });
      };

      playChord();
      clearInterval(synthTimerRef.current);
      synthTimerRef.current = setInterval(playChord, 1850);
    } catch (e) {
      console.warn("Audio Context notice:", e);
    }
  };

  const stopSynthPlayback = () => {
    clearInterval(synthTimerRef.current);
  };

  // Play / Pause toggle
  const togglePlay = () => {
    if (!isPlaying) {
      setIsPlaying(true);
      startSynthPlayback();
    } else {
      setIsPlaying(false);
      stopSynthPlayback();
    }
  };

  // Playback timer & equalizer animation
  useEffect(() => {
    let timer: any = null;
    let eqTimer: any = null;

    if (isPlaying && !isDraggingThumb) {
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= track.durationSeconds) {
            if (isLooping) {
              return 0;
            } else {
              setIsPlaying(false);
              stopSynthPlayback();
              return prev;
            }
          }
          return prev + 1;
        });
      }, 1000);

      // Realistic dancing equalizer bars with rhythm weighting
      eqTimer = setInterval(() => {
        setEqHeights([
          Math.floor(Math.random() * 12) + 8, // Sub-bass
          Math.floor(Math.random() * 16) + 10, // Bass
          Math.floor(Math.random() * 20) + 12, // Mid (lead)
          Math.floor(Math.random() * 15) + 9, // High-mid
          Math.floor(Math.random() * 11) + 7, // Air / Treble
        ]);
      }, 130);
    } else {
      // Resting signature heights (Exact proportion from screenshot)
      setEqHeights([10, 16, 22, 15, 10]);
    }

    return () => {
      clearInterval(timer);
      clearInterval(eqTimer);
    };
  }, [isPlaying, isDraggingThumb, track.durationSeconds, isLooping]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      clearInterval(synthTimerRef.current);
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
    };
  }, []);

  // Handle timeline scrubber drag / click & hover
  const calculateScrubTimeFromEvent = (clientX: number) => {
    if (!progressBarRef.current) return 0;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    return Math.round(percentage * track.durationSeconds);
  };

  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const newTime = calculateScrubTimeFromEvent(e.clientX);
    setCurrentTime(newTime);
  };

  const handleScrubPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingThumb(true);
    const newTime = calculateScrubTimeFromEvent(e.clientX);
    setCurrentTime(newTime);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const scrubbedTime = calculateScrubTimeFromEvent(moveEvent.clientX);
      setCurrentTime(scrubbedTime);
    };

    const onPointerUp = () => {
      setIsDraggingThumb(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, hoverX / rect.width));
    setHoverScrubPercent(pct * 100);
    setHoverScrubTime(Math.round(pct * track.durationSeconds));
  };

  const handleProgressBarMouseLeave = () => {
    setHoverScrubPercent(null);
    setHoverScrubTime(null);
  };

  // Switch Track
  const handleSelectTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(PLAYLIST[index].initialTimeSeconds);
    setShowPlaylistMenu(false);
    chordStepRef.current = 0;
    setCurrentChordName(PLAYLIST[index].chordNames[0] || "");
    if (isPlaying) {
      stopSynthPlayback();
      startSynthPlayback();
    }
  };

  const handleNextTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (currentTrackIndex + 1) % PLAYLIST.length;
    handleSelectTrack(next);
  };

  const handlePrevTrack = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = (currentTrackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
    handleSelectTrack(prev);
  };

  // Resize handler
  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    startPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startPos.current.x;
      const deltaY = moveEvent.clientY - startPos.current.y;

      const newWidth = Math.max(270, Math.min(600, startPos.current.width + deltaX));
      const newHeight = Math.max(115, Math.min(270, startPos.current.height + deltaY));

      setSize({ width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const progressPercent = Math.min(
    100,
    Math.max(0, (currentTime / track.durationSeconds) * 100)
  );

  // Responsive tier metrics
  const isNarrow = size.width < 330;
  const isWide = size.width >= 450;
  const isShort = size.height < 130;
  const isTall = size.height >= 175;

  // Dynamic responsive scaling
  const heightRatio = size.height / 142;
  const widthRatio = size.width / 380;
  const scale = Math.min(widthRatio, heightRatio);

  const albumSize = Math.max(
    54,
    Math.min(108, Math.round(80 * Math.max(0.72, Math.min(1.35, scale))))
  );

  return (
    <motion.div
      drag={enableDrag && !isResizing}
      dragSnapToOrigin={false}
      dragElastic={0.12}
      whileHover={isResizing ? undefined : { scale: 1.01 }}
      whileDrag={{
        scale: 1.025,
        zIndex: 50,
        boxShadow:
          "0 30px 60px -12px rgba(0,0,0,0.65), 0 0 1px 1px rgba(255,255,255,0.15)",
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowPlaylistMenu(false);
        setShowVolumeSlider(false);
      }}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
      }}
      className={`relative rounded-[26px] sm:rounded-[28px] bg-gradient-to-b from-[#1c1d20] to-[#141517] text-white ${
        isNarrow ? "p-2.5 gap-2.5" : "p-3.5 gap-3.5"
      } flex items-center shadow-[0_20px_45px_-8px_rgba(0,0,0,0.55),_0_0_0_1px_rgba(255,255,255,0.07)] select-none overflow-hidden cursor-grab active:cursor-grabbing group transition-all ${className}`}
    >
      {/* 1. Left side border indicator pill (Exact match with ambient glow) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-20">
        <div
          className={`w-[4.5px] bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.6)] transition-all duration-300 ${
            isPlaying
              ? "h-9 bg-white shadow-[0_0_14px_rgba(255,255,255,0.9)]"
              : "h-7 opacity-85"
          }`}
        />
      </div>

      {/* 2. Top-Right Coral Pink Equalizer Waveform (5 vertical bouncing bars with fluid ease) */}
      <div
        onClick={togglePlay}
        title={isPlaying ? "点击暂停伴奏" : "点击播放伴奏"}
        className={`absolute ${
          isNarrow ? "top-2.5 right-3" : "top-3.5 right-3.5"
        } flex items-end gap-[3px] h-7 cursor-pointer z-20 px-1.5 py-1 rounded-full bg-black/20 hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/10 transition-all group/eq`}
      >
        {eqHeights.map((h, idx) => {
          // Scale eq bar heights proportionally with widget height
          const scaledH = Math.max(
            5,
            Math.min(
              24,
              Math.round(h * Math.max(0.75, Math.min(1.2, heightRatio)))
            )
          );
          return (
            <span
              key={`eq_${idx}`}
              style={{
                height: `${scaledH}px`,
                backgroundColor: "#FF5376", // Coral Pink signature color
              }}
              className={`w-[3px] rounded-full transition-all duration-120 ease-out inline-block ${
                isPlaying
                  ? "shadow-[0_0_8px_rgba(255,83,118,0.5)]"
                  : "opacity-75"
              }`}
            />
          );
        })}
      </div>

      {/* 3. Left Section: Circular ambient spotlight glow + Album artwork + Bottom Shelf */}
      <div className="relative shrink-0 flex flex-col items-center justify-center pl-0.5">
        {/* Soft circular spotlight glow behind album (Pulsating when playing) */}
        <motion.div
          animate={
            isPlaying
              ? {
                  scale: [1, 1.08, 1],
                  opacity: [0.22, 0.35, 0.22],
                }
              : { scale: 1, opacity: 0.15 }
          }
          transition={{
            duration: 3.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            width: `${albumSize + 20}px`,
            height: `${albumSize + 20}px`,
            background:
              "radial-gradient(circle at center, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0.06) 55%, transparent 75%)",
          }}
          className="absolute rounded-full pointer-events-none -z-0 blur-[3px]"
        />

        {/* Album Artwork Squircle Frame */}
        <div
          onClick={togglePlay}
          style={{
            width: `${albumSize}px`,
            height: `${albumSize}px`,
          }}
          className="relative rounded-[18px] sm:rounded-[22px] overflow-hidden bg-[#242528] border border-white/12 shadow-[0_8px_20px_rgba(0,0,0,0.45)] cursor-pointer group/art flex items-center justify-center z-10 transition-all"
        >
          {/* Black & White Artistic Grain Visual (Gareth.T Vintage Portrait recreation) */}
          <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center overflow-hidden">
            {/* Ambient shadow gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-neutral-800 to-neutral-700 opacity-90" />

            {/* Stylized B&W Silhouette & Architecture Lighting */}
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full object-cover filter grayscale contrast-125 brightness-95"
            >
              {/* Back wall / corridor lines */}
              <rect x="0" y="0" width="100" height="100" fill="#181818" />
              <path
                d="M 0 0 L 35 30 L 35 100 L 0 100 Z"
                fill="#2b2b2b"
                opacity="0.8"
              />
              <path
                d="M 35 30 L 100 0 L 100 100 L 35 100 Z"
                fill="#1f1f1f"
                opacity="0.9"
              />
              {/* Vertical wall frames */}
              <line
                x1="12"
                y1="10"
                x2="12"
                y2="90"
                stroke="#555"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <line
                x1="24"
                y1="20"
                x2="24"
                y2="90"
                stroke="#444"
                strokeWidth="1.5"
                opacity="0.6"
              />
              {/* Light shaft on floor */}
              <polygon
                points="10,95 45,65 75,70 40,100"
                fill="#888888"
                opacity="0.45"
              />
              {/* Figure standing in corridor */}
              <circle cx="52" cy="40" r="6" fill="#e5e5e5" />
              <path
                d="M 48 46 L 56 46 L 60 70 L 44 70 Z"
                fill="#d4d4d4"
                opacity="0.9"
              />
              <path
                d="M 46 70 L 48 92 L 51 92 L 50 70 Z"
                fill="#999999"
              />
              <path
                d="M 54 70 L 56 92 L 59 92 L 58 70 Z"
                fill="#aaaaaa"
              />
              {/* Figure shadow */}
              <ellipse
                cx="58"
                cy="92"
                rx="14"
                ry="3.5"
                fill="#0a0a0a"
                opacity="0.8"
              />
            </svg>

            {/* Grain & vinyl texture overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

            {/* Playing vinyl ring animation overlay */}
            {isPlaying && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 opacity-15 pointer-events-none border-[3px] border-dashed border-white rounded-full m-1"
              />
            )}
          </div>

          {/* Hover Play/Pause Overlay button */}
          <div
            className={`absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center transition-all duration-200 ${
              isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <motion.div
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.92 }}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5 fill-black" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-black translate-x-0.5" />
              )}
            </motion.div>
          </div>
        </div>

        {/* Subtle shelf bar underneath the album */}
        {!isShort && (
          <div
            className={`h-[3px] bg-white/25 rounded-full mt-1.5 shrink-0 shadow-xs transition-all ${
              isNarrow ? "w-7" : "w-9"
            }`}
          />
        )}
      </div>

      {/* 4. Middle / Right Section: Darker nested plate with Song Info + Scrubber */}
      <div
        className={`flex-1 min-w-0 h-full bg-[#222428] rounded-[18px] sm:rounded-[22px] ${
          isNarrow ? "p-2" : "p-3"
        } flex flex-col justify-between border border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),_0_4px_12px_rgba(0,0,0,0.25)] relative z-10`}
      >
        {/* Title & Artist & Codec Spec (With reserved right margin for Coral Pink EQ) */}
        <div className="pr-16 space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className={`font-bold text-white/95 tracking-tight leading-tight truncate ${
                isNarrow
                  ? "text-[14px]"
                  : isWide
                  ? "text-[18px]"
                  : "text-[16px]"
              }`}
            >
              {track.title}
            </h3>
            {isPlaying && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5376] shadow-[0_0_8px_#FF5376] animate-pulse shrink-0 inline-block" />
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <p
              className={`font-medium text-[#9CA3AF] leading-tight truncate ${
                isNarrow ? "text-[12px]" : "text-[13px]"
              }`}
            >
              {track.artist}
            </p>
            {!isNarrow && (
              <span className="text-[9px] font-mono tracking-wider px-1.5 py-0.2 rounded-sm bg-white/[0.06] text-white/40 uppercase hidden sm:inline-block shrink-0">
                {track.codec.split("·")[0].trim()}
              </span>
            )}
          </div>
        </div>

        {/* Tall Height Mode Enrichment: Ambient Chord & Harmony readout */}
        {isTall && (
          <div className="py-1 flex items-center justify-between text-[10px] text-white/40 border-t border-b border-white/[0.04]">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-[#FF5376]/80" />
              <span>432Hz Demo Mode</span>
            </span>
            <span className="font-mono font-bold text-[#FF5376]/90 bg-[#FF5376]/10 px-1.5 py-0.5 rounded">
              {currentChordName || "Acoustic"}
            </span>
          </div>
        )}

        {/* Timeline Scrubber Row (00:20 ────●─────── 03:05) with Hover Time Preview */}
        <div className="flex items-center gap-2 pt-0.5 relative">
          {/* Current elapsed time */}
          <span
            className={`font-bold text-white/90 font-mono tabular-nums shrink-0 tracking-tight ${
              isNarrow ? "text-xs" : "text-[13px]"
            }`}
          >
            {formatTime(currentTime)}
          </span>

          {/* Progress Slider Rail */}
          <div
            ref={progressBarRef}
            onClick={handleScrubClick}
            onPointerDown={handleScrubPointerDown}
            onMouseMove={handleProgressBarMouseMove}
            onMouseLeave={handleProgressBarMouseLeave}
            className="flex-1 h-4 flex items-center relative cursor-pointer group/slider py-1 touch-none"
          >
            {/* Background unplayed rail */}
            <div
              className={`w-full ${
                isNarrow ? "h-[5px]" : "h-[6px]"
              } bg-[#36383E] rounded-full overflow-hidden relative shadow-inner`}
            >
              {/* Played active rail in Coral Pink */}
              <div
                style={{ width: `${progressPercent}%` }}
                className="h-full bg-gradient-to-r from-[#FF6B8B] to-[#FF5376] rounded-full transition-all duration-75 shadow-[0_0_8px_rgba(255,83,118,0.4)]"
              />
            </div>

            {/* Hover ghost scrubber preview line */}
            {hoverScrubPercent !== null && !isDraggingThumb && (
              <div
                style={{ left: `${hoverScrubPercent}%` }}
                className="absolute top-1/2 -translate-y-1/2 w-[2px] h-3 bg-white/50 pointer-events-none rounded-full"
              />
            )}

            {/* Vertical White Capsule Thumb Knob (Dragging physics) */}
            <motion.div
              animate={{
                scaleY: isDraggingThumb ? 1.15 : 1,
                scaleX: isDraggingThumb ? 1.1 : 1,
              }}
              style={{
                left: `calc(${progressPercent}% - ${isNarrow ? 4 : 5}px)`,
              }}
              className={`absolute top-1/2 -translate-y-1/2 ${
                isNarrow ? "w-[8px] h-[18px]" : "w-[10px] h-[22px]"
              } bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.6),_0_0_4px_rgba(255,255,255,0.4)] transition-shadow duration-100 group-hover/slider:shadow-[0_2px_12px_rgba(0,0,0,0.7),_0_0_8px_rgba(255,255,255,0.8)] cursor-pointer pointer-events-none ${
                isDraggingThumb ? "ring-2 ring-[#FF5376]" : ""
              }`}
            />

            {/* Hover / Drag Floating Time Indicator Tooltip */}
            <AnimatePresence>
              {(hoverScrubTime !== null || isDraggingThumb) && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.9 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    left: `${
                      isDraggingThumb ? progressPercent : hoverScrubPercent
                    }%`,
                  }}
                  className="absolute -top-7 -translate-x-1/2 bg-[#121315] text-[#FF5376] border border-white/10 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-tight shadow-lg pointer-events-none z-30"
                >
                  {formatTime(
                    isDraggingThumb ? currentTime : hoverScrubTime || 0
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Total duration time */}
          <span
            className={`font-bold text-white/90 font-mono tabular-nums shrink-0 tracking-tight ${
              isNarrow ? "text-xs" : "text-[13px]"
            }`}
          >
            {formatTime(track.durationSeconds)}
          </span>
        </div>

        {/* 
          NON-OVERLAPPING RESPONSIVE CONTROL BAR:
          Positioned horizontally centered at the top (-top-3.5 left-1/2 -translate-x-1/2)
          This leaves BOTH the Left Album and the Right Coral Pink Equalizer 100% unobstructed!
        */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.94 }}
              transition={{ duration: 0.15 }}
              className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#141518]/95 backdrop-blur-xl border border-white/15 rounded-full px-2 py-0.5 flex items-center gap-1 shadow-[0_10px_25px_rgba(0,0,0,0.65)] z-30"
            >
              <button
                type="button"
                onClick={handlePrevTrack}
                className="p-1 hover:text-[#FF5376] text-white/75 transition-colors rounded-full hover:bg-white/10"
                title="上一首"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                className="p-1 text-white hover:text-[#FF5376] transition-colors rounded-full hover:bg-white/10"
                title={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleNextTrack}
                className="p-1 hover:text-[#FF5376] text-white/75 transition-colors rounded-full hover:bg-white/10"
                title="下一首"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>

              {/* Volume Button with Hover popover slider */}
              <div
                className="relative"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  className="p-1 hover:text-[#FF5376] text-white/75 transition-colors rounded-full hover:bg-white/10"
                  title={isMuted ? "取消静音" : "静音"}
                >
                  {isMuted ? (
                    <VolumeX className="h-3.5 w-3.5 text-red-400" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>

                {/* Volume Slider Flyout */}
                <AnimatePresence>
                  {showVolumeSlider && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 5 }}
                      className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-[#1C1D21] border border-white/15 rounded-xl p-2 shadow-2xl flex flex-col items-center gap-1.5 z-50 w-24 backdrop-blur-xl"
                    >
                      <span className="text-[10px] font-mono text-white/70">
                        {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                          setVolume(parseFloat(e.target.value));
                          if (isMuted) setIsMuted(false);
                        }}
                        className="w-20 h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-[#FF5376]"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!isNarrow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLooping(!isLooping);
                  }}
                  className={`p-1 transition-colors rounded-full hover:bg-white/10 ${
                    isLooping
                      ? "text-[#FF5376]"
                      : "text-white/40 hover:text-white/75"
                  }`}
                  title={isLooping ? "循环播放开启" : "单次播放"}
                >
                  <Repeat className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylistMenu(!showPlaylistMenu);
                }}
                className={`p-1 transition-colors rounded-full hover:bg-white/10 ${
                  showPlaylistMenu
                    ? "text-[#FF5376] bg-white/10"
                    : "text-white/75 hover:text-[#FF5376]"
                }`}
                title="曲目列表"
              >
                <ListMusic className="h-3.5 w-3.5" />
              </button>

              {onExpand && !isNarrow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpand();
                  }}
                  className="p-1 hover:text-[#FF5376] text-white/75 transition-colors rounded-full hover:bg-white/10"
                  title="全屏沉浸模式"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Playlist Popup Menu (Refined Card Drawer with codec info) */}
        <AnimatePresence>
          {showPlaylistMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              className="absolute left-0 right-0 top-full mt-2 bg-[#1A1B1E] border border-white/12 rounded-2xl p-2 shadow-[0_20px_50px_rgba(0,0,0,0.75)] z-40 space-y-1 backdrop-blur-2xl max-h-56 overflow-y-auto"
            >
              <div className="text-[11px] font-mono text-white/50 px-2.5 py-1 flex justify-between items-center border-b border-white/[0.06] mb-1">
                <span className="flex items-center gap-1.5">
                  <Disc className="h-3 w-3 text-[#FF5376]" />
                  播放列表 ({PLAYLIST.length})
                </span>
                <span className="text-[#FF5376] font-bold">Lofi Demo</span>
              </div>
              {PLAYLIST.map((t, idx) => (
                <div
                  key={`playlist_track_${t.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectTrack(idx);
                  }}
                  className={`px-2.5 py-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all ${
                    idx === currentTrackIndex
                      ? "bg-[#FF5376]/15 text-[#FF5376] font-bold border border-[#FF5376]/30 shadow-xs"
                      : "hover:bg-white/5 text-white/80 border border-transparent"
                  }`}
                >
                  <div className="truncate pr-2">
                    <span className="mr-1.5 opacity-50 font-mono">
                      0{idx + 1}.
                    </span>
                    <span className="font-semibold">{t.title}</span>
                    <span className="text-[10px] text-white/40 ml-2 font-normal">
                      · {t.genre}
                    </span>
                  </div>
                  <span className="text-[10px] opacity-60 font-mono tabular-nums shrink-0">
                    {formatTime(t.durationSeconds)}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. Drag/Resize Handle */}
      {enableResize && (
        <div
          onPointerDown={handleResizeStart}
          className="absolute bottom-1.5 right-1.5 p-1 text-white/20 hover:text-white/70 active:text-[#FF5376] cursor-se-resize transition-colors z-30 touch-none"
          title="拖拽调节小组件尺寸"
        >
          <GripHorizontal className="h-3.5 w-3.5 rotate-45" />
        </div>
      )}
    </motion.div>
  );
};

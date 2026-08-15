import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  Award,
  Gem,
  Zap,
  X,
  Sparkles,
  Trophy,
} from "lucide-react";
import { AchievementBadge } from "./types";

interface AchievementUnlockModalProps {
  badge: AchievementBadge | null;
  onClose: () => void;
  onClaim: (badgeId: string) => void;
  currentTotalGems?: number;
  currentTotalXp?: number;
}

export function AchievementUnlockModal({
  badge,
  onClose,
  onClaim,
  currentTotalGems = 1250,
  currentTotalXp = 4850,
}: AchievementUnlockModalProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  // Animated Counters
  const [displayGems, setDisplayGems] = useState(0);
  const [displayXp, setDisplayXp] = useState(0);
  const [gemVaultCount, setGemVaultCount] = useState(currentTotalGems);

  // XP & Level calculations
  const LEVEL_XP_STEP = 1500;
  const prevLevel = Math.floor(currentTotalXp / LEVEL_XP_STEP) + 1;
  const prevLevelXp = currentTotalXp % LEVEL_XP_STEP;
  const prevPercent = Math.min(100, Math.round((prevLevelXp / LEVEL_XP_STEP) * 100));

  const newTotalXp = currentTotalXp + (badge?.rewardXp || 0);
  const newLevel = Math.floor(newTotalXp / LEVEL_XP_STEP) + 1;
  const newLevelXp = newTotalXp % LEVEL_XP_STEP;
  const newPercent = Math.min(100, Math.round((newLevelXp / LEVEL_XP_STEP) * 100));
  const isLevelUp = newLevel > prevLevel;

  const [displayXpProgress, setDisplayXpProgress] = useState(prevPercent);
  const [displayLevel, setDisplayLevel] = useState(prevLevel);
  const [flyingGems, setFlyingGems] = useState<
    { id: number; startX: number; startY: number; targetX: number; targetY: number; delay: number }[]
  >([]);

  // Sound generator
  const playSoundEffect = (type: "victory" | "gem" | "levelup") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === "victory") {
        // Bright cheerful major fanfare
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.4);
        });
      } else if (type === "gem") {
        // Crisp Duolingo-style crystal pop
        const frequencies = [1318.51, 1760.0, 2093.0];
        frequencies.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0, now + idx * 0.05);
          gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.05 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.35);
        });
      } else if (type === "levelup") {
        [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0, now + idx * 0.05);
          gain.gain.linearRampToValueAtTime(0.16, now + idx * 0.05 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.55);
        });
      }
    } catch {
      // Audio context may be restricted
    }
  };

  useEffect(() => {
    if (!badge) return;

    setClaimed(Boolean(badge.claimedReward));
    playSoundEffect("victory");

    // Animate numbers smoothly counting up
    const targetGems = badge.rewardGems || 400;
    const targetXp = badge.rewardXp || 2000;
    const duration = 1000;
    let startTime: number | null = null;

    const animateRoll = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      setDisplayGems(Math.round(targetGems * ease));
      setDisplayXp(Math.round(targetXp * ease));

      if (progress < 1) {
        requestAnimationFrame(animateRoll);
      }
    };

    const animId = requestAnimationFrame(animateRoll);
    return () => cancelAnimationFrame(animId);
  }, [badge]);

  if (!badge) return null;

  const IconComp = typeof badge.icon === "function" ? badge.icon : Award;

  // Duolingo-style clean color palette
  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case "mythic":
        return {
          label: "神话成就",
          pillBg: "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-2 border-purple-300 dark:border-purple-700",
          badgeBorder: "border-purple-500 bg-gradient-to-b from-purple-400 to-purple-600",
          shadowColor: "shadow-purple-200 dark:shadow-none",
        };
      case "legendary":
        return {
          label: "传说成就",
          pillBg: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-2 border-amber-300 dark:border-amber-700",
          badgeBorder: "border-amber-500 bg-gradient-to-b from-amber-400 to-amber-500",
          shadowColor: "shadow-amber-200 dark:shadow-none",
        };
      case "epic":
        return {
          label: "史诗成就",
          pillBg: "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-2 border-blue-300 dark:border-blue-700",
          badgeBorder: "border-blue-500 bg-gradient-to-b from-blue-400 to-blue-600",
          shadowColor: "shadow-blue-200 dark:shadow-none",
        };
      case "rare":
        return {
          label: "稀有成就",
          pillBg: "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-2 border-cyan-300 dark:border-cyan-700",
          badgeBorder: "border-cyan-500 bg-gradient-to-b from-cyan-400 to-cyan-600",
          shadowColor: "shadow-cyan-200 dark:shadow-none",
        };
      default:
        return {
          label: "进阶成就",
          pillBg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-2 border-emerald-300 dark:border-emerald-700",
          badgeBorder: "border-emerald-500 bg-gradient-to-b from-emerald-400 to-emerald-600",
          shadowColor: "shadow-emerald-200 dark:shadow-none",
        };
    }
  };

  const rarityMeta = getRarityBadge(badge.rarity);

  const handleClaimRewardSequence = () => {
    if (isClaiming || claimed) return;
    setIsClaiming(true);
    playSoundEffect("gem");

    // Spawn cheerful gem icons popping
    const gemsArray = Array.from({ length: 8 }).map((_, idx) => ({
      id: idx,
      startX: (Math.random() - 0.5) * 60,
      startY: 20 + (Math.random() - 0.5) * 20,
      targetX: (Math.random() - 0.5) * 260,
      targetY: -180 - Math.random() * 60,
      delay: idx * 0.04,
    }));
    setFlyingGems(gemsArray);

    setTimeout(() => {
      setDisplayXpProgress(newPercent);
      if (isLevelUp) {
        setDisplayLevel(newLevel);
        playSoundEffect("levelup");
      }
      setGemVaultCount((prev) => prev + (badge.rewardGems || 400));
    }, 350);

    setTimeout(() => {
      onClaim(badge.id);
      setClaimed(true);
      setIsClaiming(false);
    }, 1000);
  };

  // Clean flat confetti colors for Duolingo vibe
  const confettiColors = [
    "#58CC02", // Duolingo green
    "#FFC800", // Duolingo yellow
    "#1CB0F6", // Duolingo cyan
    "#FF4B4B", // Duolingo red
    "#CE82FF", // Duolingo purple
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-hidden">
        {/* Crisp Flat Confetti Particles (No blurry dark blobs) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          {Array.from({ length: 28 }).map((_, i) => {
            const color = confettiColors[i % confettiColors.length];
            return (
              <motion.div
                key={`confetti_particle_${i}`}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  scale: Math.random() * 0.6 + 0.7,
                }}
                animate={{
                  x: (Math.random() - 0.5) * 550,
                  y: (Math.random() - 0.5) * 550,
                  opacity: [1, 1, 0],
                  rotate: Math.random() * 360,
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  delay: Math.random() * 0.4,
                }}
                className="absolute w-2.5 h-3.5 rounded-xs"
                style={{ backgroundColor: color }}
              />
            );
          })}
        </div>

        {/* Clean Duolingo Styled Modal Card */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: "spring", damping: 24, stiffness: 350 }}
          className="relative w-full max-w-md bg-white dark:bg-[#18191c] border-2 border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 overflow-hidden"
        >
          {/* Top Status Header Bar */}
          <div className="flex items-center justify-between px-3.5 py-1.5 rounded-2xl bg-slate-100 dark:bg-neutral-800/80 border border-slate-200 dark:border-neutral-700 text-xs font-bold">
            {/* Gems */}
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Gem className="h-4 w-4 fill-amber-400 text-amber-500" />
              <span>宝石:</span>
              <span className="font-extrabold font-mono text-amber-700 dark:text-amber-300">
                {gemVaultCount.toLocaleString()}
              </span>
            </div>

            {/* Level */}
            <div className="flex items-center gap-1.5 text-[#1cb0f6]">
              <Zap className="h-4 w-4 fill-[#1cb0f6] text-[#1cb0f6]" />
              <span>等级:</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1cb0f6]/15 font-extrabold text-[#0099e0] dark:text-[#38bdf8]">
                Lv.{displayLevel}
              </span>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer z-20"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Duolingo Headline */}
          <div className="space-y-1 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
              <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 fill-amber-400" />
              <span>成就达成！</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              太棒了！解锁新勋章
            </h2>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              坚持复习让知识牢不可破，快来领取属于你的丰厚奖励吧！
            </p>
          </div>

          {/* Badge Visual Showcase */}
          <div className="relative py-2 flex flex-col items-center justify-center">
            {/* Duolingo 3D Tactile Medal Badge Container */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="relative"
            >
              <div
                className={`w-24 h-24 rounded-3xl p-1 shadow-lg border-b-4 ${rarityMeta.badgeBorder} flex items-center justify-center`}
              >
                <div className="w-full h-full bg-white/20 dark:bg-black/20 rounded-2xl flex items-center justify-center">
                  <IconComp className="h-12 w-12 text-white drop-shadow" />
                </div>
              </div>

              {/* Sparkle badge star */}
              <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-yellow-400 border-2 border-white dark:border-neutral-900 shadow flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-amber-900 fill-amber-300" />
              </div>
            </motion.div>

            {/* Badge Title & Rarity Tag */}
            <h3 className="text-lg font-black text-slate-800 dark:text-white mt-2.5">
              {badge.title}
            </h3>
            <p className="text-xs font-bold text-slate-400 dark:text-neutral-500 font-sans">
              {badge.titleEn}
            </p>

            <span
              className={`mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${rarityMeta.pillBg}`}
            >
              {rarityMeta.label}
            </span>
          </div>

          {/* DUAL REWARD CARDS (Duolingo Tactile 3D Cards) */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-left relative">
              {/* Flying Gem Particles when clicking claim */}
              <AnimatePresence>
                {flyingGems.map((gem) => (
                  <motion.div
                    key={`fly_gem_${gem.id}`}
                    initial={{
                      opacity: 1,
                      scale: 0.8,
                      x: gem.startX,
                      y: gem.startY,
                    }}
                    animate={{
                      opacity: [1, 1, 0],
                      scale: [0.8, 1.4, 0.4],
                      x: gem.targetX,
                      y: gem.targetY,
                      rotate: 180,
                    }}
                    transition={{
                      duration: 0.8,
                      delay: gem.delay,
                      ease: "easeOut",
                    }}
                    className="absolute z-40 pointer-events-none text-amber-500"
                  >
                    <Gem className="h-6 w-6 fill-amber-400" />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* DUO GEM CARD */}
              <div className="relative rounded-2xl p-3 bg-amber-50 dark:bg-amber-950/25 border-2 border-amber-200 dark:border-amber-800/60 border-b-4 border-b-amber-300 dark:border-b-amber-700 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-400 border-b-2 border-amber-600 flex items-center justify-center shrink-0 shadow-xs">
                  <Gem className="h-6 w-6 text-white fill-amber-100" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                    奖励宝石
                  </div>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-300 font-mono leading-none mt-0.5">
                    +{displayGems}
                  </div>
                </div>
              </div>

              {/* DUO XP CARD */}
              <div className="relative rounded-2xl p-3 bg-blue-50 dark:bg-blue-950/25 border-2 border-blue-200 dark:border-blue-800/60 border-b-4 border-b-blue-300 dark:border-b-blue-700 flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#1cb0f6] border-b-2 border-[#0099e0] flex items-center justify-center shrink-0 shadow-xs">
                  <Zap className="h-6 w-6 text-white fill-blue-100" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-[#0099e0] dark:text-[#38bdf8]">
                    升级经验
                  </div>
                  <div className="text-xl font-black text-[#1cb0f6] dark:text-[#38bdf8] font-mono leading-none mt-0.5">
                    +{displayXp} XP
                  </div>
                </div>
              </div>
            </div>

            {/* DUOLINGO STYLE XP PROGRESS BAR */}
            <div className="rounded-2xl p-3.5 bg-slate-50 dark:bg-neutral-800/60 border-2 border-slate-200 dark:border-neutral-700 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-neutral-300">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-[#1cb0f6] text-white text-[11px] font-black">
                    Lv.{displayLevel}
                  </span>
                  <span>学者进度</span>
                </div>
                <span className="font-mono text-slate-500 dark:text-neutral-400 text-[11px]">
                  {newLevelXp} / {LEVEL_XP_STEP} XP ({displayXpProgress}%)
                </span>
              </div>

              {/* Tactile Progress Pill */}
              <div className="relative w-full h-4 bg-slate-200 dark:bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-neutral-700">
                <motion.div
                  initial={{ width: `${prevPercent}%` }}
                  animate={{ width: `${displayXpProgress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-[#58CC02] rounded-full relative"
                >
                  {/* Top highlight gloss */}
                  <div className="absolute top-0.5 left-1 right-1 h-1 bg-white/40 rounded-full" />
                </motion.div>
              </div>
            </div>
          </div>

          {/* Badge Story Description */}
          <div className="bg-slate-50 dark:bg-neutral-800/40 border border-slate-200 dark:border-neutral-800 rounded-2xl p-3 text-left text-xs text-slate-600 dark:text-neutral-400 leading-relaxed">
            {badge.description}
          </div>

          {/* DUOLINGO SIGNATURE 3D ACTION BUTTON */}
          <div className="pt-1">
            {!claimed ? (
              <button
                disabled={isClaiming}
                onClick={handleClaimRewardSequence}
                className="w-full py-3.5 px-4 bg-[#58CC02] hover:bg-[#46a302] text-white font-black text-base rounded-2xl border-b-4 border-[#3c8c01] active:border-b-0 active:translate-y-1 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {isClaiming ? (
                  <>
                    <Sparkles className="h-5 w-5 animate-spin" />
                    <span>领取中...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 stroke-[3]" />
                    <span>领取奖励 · 放入金库</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onClose}
                className="w-full py-3.5 px-4 bg-slate-200 hover:bg-slate-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-slate-800 dark:text-white font-black text-base rounded-2xl border-b-4 border-slate-300 dark:border-neutral-800 active:border-b-0 active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Check className="h-5 w-5 stroke-[3]" />
                <span>完成</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

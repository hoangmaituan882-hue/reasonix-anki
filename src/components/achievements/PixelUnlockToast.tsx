import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Gem, X, Award, Zap, Trophy } from "lucide-react";
import { AchievementBadge } from "./types";

interface PixelUnlockToastProps {
  badge: AchievementBadge | null;
  prevGems?: number;
  newGems?: number;
  prevProgressPercent?: number;
  newProgressPercent?: number;
  onClose: () => void;
}

export function PixelUnlockToast({
  badge,
  prevGems = 0,
  newGems = 0,
  prevProgressPercent = 0,
  newProgressPercent = 0,
  onClose,
}: PixelUnlockToastProps) {
  const [displayRewardGems, setDisplayRewardGems] = useState(0);
  const [displayRewardXp, setDisplayRewardXp] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(prevProgressPercent);

  useEffect(() => {
    if (!badge) return;

    const rewardGemsTarget = badge.rewardGems || 400;
    const rewardXpTarget = badge.rewardXp || 2000;
    const progressStart = prevProgressPercent;
    const progressEnd = newProgressPercent > 0 ? newProgressPercent : prevProgressPercent + 5;

    let startTime: number | null = null;
    const duration = 1000;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      setDisplayRewardGems(Math.round(rewardGemsTarget * ease));
      setDisplayRewardXp(Math.round(rewardXpTarget * ease));
      setDisplayProgress(Math.min(100, Math.round(progressStart + (progressEnd - progressStart) * ease)));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const animId = requestAnimationFrame(animate);

    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(timer);
    };
  }, [badge, prevGems, newGems, prevProgressPercent, newProgressPercent, onClose]);

  if (!badge) return null;

  const IconComp = typeof badge.icon === "function" ? badge.icon : Award;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 380, damping: 24 }}
        className="fixed bottom-5 right-5 z-50 max-w-sm w-full mx-auto p-1 pointer-events-auto"
      >
        {/* Duolingo style clean card container */}
        <div className="relative bg-white dark:bg-[#1e2024] border-2 border-slate-200 dark:border-neutral-700 border-b-4 border-b-slate-300 dark:border-b-neutral-800 rounded-2xl p-3.5 shadow-xl text-slate-800 dark:text-white overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-[#58cc02] text-xs font-black">
              <Trophy className="h-4 w-4 fill-[#58cc02]" />
              <span>解锁新成就！</span>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Badge & Title Info */}
          <div className="flex items-center gap-3">
            {/* Duolingo 3D Badge icon */}
            <div className="w-12 h-12 rounded-2xl p-0.5 bg-amber-400 border-b-2 border-amber-600 shadow-xs shrink-0 flex items-center justify-center">
              <IconComp className="h-6 w-6 text-white drop-shadow-xs" />
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {badge.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-neutral-400 truncate mt-0.5">
                {badge.description}
              </p>
            </div>
          </div>

          {/* Rewards Pill Row */}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-neutral-800 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300">
                <Gem className="h-4 w-4 fill-amber-400 text-amber-500" />
                <span>+{displayRewardGems} 宝石</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 text-[#0099e0] dark:text-[#38bdf8]">
                <Zap className="h-4 w-4 fill-[#1cb0f6] text-[#1cb0f6]" />
                <span>+{displayRewardXp} XP</span>
              </div>
            </div>

            {/* Duolingo Green Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-neutral-800 h-2.5 rounded-full border border-slate-200 dark:border-neutral-700 p-0.5 overflow-hidden">
              <motion.div
                initial={{ width: `${prevProgressPercent}%` }}
                animate={{ width: `${displayProgress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full bg-[#58CC02] rounded-full"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

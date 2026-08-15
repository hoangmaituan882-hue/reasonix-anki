import { motion } from "motion/react";
import { Lock, Award, Sparkles, Check, Gem } from "lucide-react";
import { AchievementBadge } from "./types";
import { cn } from "@reasonix/ui";

interface AchievementCardProps {
  badge: AchievementBadge;
  onSelect: (badge: AchievementBadge) => void;
  onClaim?: (badgeId: string) => void;
  isEquipped?: boolean;
  compact?: boolean;
}

export function AchievementCard({
  badge,
  onSelect,
  onClaim,
  isEquipped = false,
  compact = false,
}: AchievementCardProps) {
  const IconComp = typeof badge.icon === "function" ? badge.icon : Award;

  const percent = Math.min(
    100,
    Math.round((badge.currentProgress / badge.targetProgress) * 100)
  );

  const canUnlock = !badge.unlocked && percent >= 100;

  const getRarityStyle = (rarity: string) => {
    switch (rarity) {
      case "mythic":
        return {
          border: "border-amber-400/50 shadow-amber-500/20",
          tagBg: "bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600 text-white font-bold",
          label: "神话",
        };
      case "legendary":
        return {
          border: "border-amber-500/40 shadow-amber-500/15",
          tagBg: "bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30",
          label: "传说",
        };
      case "epic":
        return {
          border: "border-purple-500/40 shadow-purple-500/15",
          tagBg: "bg-purple-500/20 text-purple-400 font-bold border border-purple-500/30",
          label: "史诗",
        };
      case "rare":
        return {
          border: "border-sky-500/40 shadow-sky-500/15",
          tagBg: "bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30",
          label: "稀有",
        };
      default:
        return {
          border: "border-emerald-500/30 shadow-emerald-500/10",
          tagBg: "bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30",
          label: "普通",
        };
    }
  };

  const rarityStyle = getRarityStyle(badge.rarity);

  if (compact) {
    return (
      <motion.div
        whileHover={{ y: -1, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(badge)}
        className={cn(
          "relative rounded-xl p-2 border transition-all cursor-pointer select-none flex items-center gap-2.5 overflow-hidden group",
          badge.unlocked
            ? `bg-[var(--rx-bg-elev)] border-[var(--rx-border-soft)] hover:border-amber-500/40 shadow-2xs`
            : canUnlock
            ? "bg-amber-500/10 border-amber-500/60 shadow-xs shadow-amber-500/20 animate-pulse"
            : "bg-[var(--rx-bg-elev)]/50 border-[var(--rx-border-soft)] opacity-80 hover:opacity-100"
        )}
      >
        {/* Avatar / Icon */}
        <div
          className={cn(
            "w-9 h-9 rounded-lg p-0.5 flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover:scale-105 duration-200 relative",
            badge.unlocked || canUnlock
              ? `bg-gradient-to-tr ${badge.iconBgColor}`
              : "bg-neutral-800 text-neutral-500"
          )}
        >
          <div className="w-full h-full bg-black/20 rounded-[7px] flex items-center justify-center overflow-hidden">
            {badge.unlocked ? (
              <IconComp className="h-5 w-5 text-white drop-shadow-2xs" />
            ) : canUnlock ? (
              <Sparkles className="h-5 w-5 text-amber-300 animate-spin" />
            ) : (
              <Lock className="h-4 w-4 text-neutral-400" />
            )}
          </div>
        </div>

        {/* Title & Progress info */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[14px] font-bold text-[var(--rx-fg)] truncate">
              {badge.title}
            </span>
            {isEquipped && (
              <span className="bg-amber-500/20 text-amber-500 font-bold text-[10px] px-1.5 py-0.2 rounded border border-amber-500/30 shrink-0">
                佩戴中
              </span>
            )}
          </div>

          {/* Progress bar and text */}
          {badge.unlocked ? (
            <div className="flex items-center justify-between text-[12px] font-mono">
              <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                <Check className="h-3 w-3" /> 已解封
              </span>
              <span className="text-amber-500 font-bold">+{badge.rewardGems}💎</span>
            </div>
          ) : canUnlock ? (
            <div className="flex items-center justify-between text-[12px] text-amber-500 font-bold">
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 animate-bounce" /> 可解锁
              </span>
              <span>+{badge.rewardGems}💎</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              <div className="flex justify-between items-center text-[11px] text-[var(--rx-fg-dim)] font-mono">
                <span>{badge.currentProgress}/{badge.targetProgress}</span>
                <span>{percent}%</span>
              </div>
              <div className="w-full bg-[var(--rx-bg-soft)] h-1 rounded-full overflow-hidden border border-[var(--rx-border-soft)]">
                <div
                  style={{ width: `${percent}%` }}
                  className="h-full bg-[var(--rx-accent)] rounded-full transition-all duration-300"
                />
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(badge)}
      className={cn(
        "relative rounded-2xl p-3.5 border transition-all cursor-pointer select-none flex flex-col justify-between overflow-hidden group",
        badge.unlocked
          ? `bg-[var(--rx-bg-elev)] ${rarityStyle.border} shadow-md`
          : canUnlock
          ? "bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/20 animate-pulse"
          : "bg-[var(--rx-bg-elev)]/50 border-[var(--rx-border-soft)] opacity-75 hover:opacity-100"
      )}
    >
      {/* Equipped Badge Tag */}
      {isEquipped && (
        <div className="absolute top-2 right-2 bg-amber-500 text-amber-950 font-bold text-[9px] px-1.5 py-0.5 rounded-md shadow-sm z-10 flex items-center gap-0.5">
          <Check className="h-2.5 w-2.5" /> 已佩戴
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {/* Badge Icon container */}
          <div
            className={cn(
              "w-11 h-11 rounded-xl p-0.5 flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 duration-300 relative",
              badge.unlocked || canUnlock
                ? `bg-gradient-to-tr ${badge.iconBgColor}`
                : "bg-neutral-800 text-neutral-500"
            )}
          >
            <div className="w-full h-full bg-black/20 rounded-[10px] flex items-center justify-center relative overflow-hidden">
              {badge.unlocked ? (
                <IconComp className="h-6 w-6 text-white drop-shadow-sm" />
              ) : canUnlock ? (
                <Sparkles className="h-6 w-6 text-amber-300 animate-spin" />
              ) : (
                <Lock className="h-5 w-5 text-neutral-400" />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[16px] font-bold leading-snug text-[var(--rx-fg)] line-clamp-1">
                {badge.title}
              </span>
            </div>
            <span className="text-[12px] text-[var(--rx-fg-dim)] font-mono">
              {badge.code}
            </span>
          </div>
        </div>

        {/* Rarity Pill */}
        <span
          className={cn(
            "text-[12px] px-2 py-0.5 rounded-md shrink-0 font-mono font-semibold",
            rarityStyle.tagBg
          )}
        >
          {rarityStyle.label}
        </span>
      </div>

      {/* Middle Description */}
      <p className="text-[14px] leading-[1.5] text-[var(--rx-fg-dim)] mt-2 line-clamp-2">
        {badge.description}
      </p>

      {/* Bottom Progress or Claim Button */}
      <div className="mt-3 pt-2.5 border-t border-[var(--rx-border-soft)] space-y-1.5">
        {badge.unlocked ? (
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> 已解封 ({badge.unlockedAt || "已解封"})
            </span>
            <div className="flex items-center gap-1 text-amber-500 font-mono font-bold">
              <Gem className="h-3.5 w-3.5" />+{badge.rewardGems}
            </div>
          </div>
        ) : canUnlock ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onClaim) onClaim(badge.id);
            }}
            className="w-full py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-amber-950 font-bold text-[14px] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border-b-2 border-amber-700 active:translate-y-0.5"
          >
            <Sparkles className="h-4 w-4 animate-bounce" />
            <span>点击解锁 & 领取 💎{badge.rewardGems}</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[12px] text-[var(--rx-fg-dim)] font-mono">
              <span>进度: {badge.currentProgress}/{badge.targetProgress} {badge.unit}</span>
              <span>{percent}%</span>
            </div>
            <div className="w-full bg-[var(--rx-bg-soft)] h-1.5 rounded-full overflow-hidden border border-[var(--rx-border-soft)]">
              <div
                style={{ width: `${percent}%` }}
                className="h-full bg-[var(--rx-accent)] rounded-full transition-all duration-500"
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

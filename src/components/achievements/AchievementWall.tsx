import { useState, useEffect } from "react";
import {
  Trophy,
  Award,
  Crown,
  Sparkles,
  Flame,
  Search,
  Gem,
  Zap,
} from "lucide-react";
import { cn } from "@reasonix/ui";
import {
  MotionTabs,
  MotionTabsList,
  MotionTabsTrigger,
} from "../MotionTabs";
import { AchievementBadge, AchievementCategory } from "./types";
import {
  loadAchievementsFromStorage,
  saveAchievementsToStorage,
} from "./achievementsData";
import { AchievementCard } from "./AchievementCard";
import { AchievementUnlockModal } from "./AchievementUnlockModal";
import { PixelUnlockToast } from "./PixelUnlockToast";

const CATEGORIES_META: { id: AchievementCategory; label: string; icon: any }[] = [
  { id: "all", label: "全部勋章", icon: Award },
  { id: "streak", label: "连胜狂人", icon: Flame },
  { id: "memory", label: "记忆挑战", icon: Trophy },
  { id: "focus", label: "专注时间", icon: Zap },
  { id: "fun", label: "游戏探索", icon: Sparkles },
  { id: "special", label: "神话传奇", icon: Crown },
];

interface AchievementWallProps {
  className?: string;
  onBadgeEquipped?: (badge: AchievementBadge) => void;
  compact?: boolean;
}

export function AchievementWall({
  className = "",
  onBadgeEquipped,
  compact = false,
}: AchievementWallProps) {
  const [badges, setBadges] = useState<AchievementBadge[]>(() =>
    loadAchievementsFromStorage()
  );
  const [activeCategory, setActiveCategory] = useState<AchievementCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [unlockModalBadge, setUnlockModalBadge] = useState<AchievementBadge | null>(null);
  const [pixelToastBadge, setPixelToastBadge] = useState<AchievementBadge | null>(null);
  const [toastPrevGems, setToastPrevGems] = useState(0);
  const [toastNewGems, setToastNewGems] = useState(0);
  const [toastPrevPercent, setToastPrevPercent] = useState(0);
  const [toastNewPercent, setToastNewPercent] = useState(0);
  const [equippedBadgeId, setEquippedBadgeId] = useState<string>("badge-pearl-league-champ");

  // Sync state to storage whenever badges change
  useEffect(() => {
    saveAchievementsToStorage(badges);
  }, [badges]);

  // Handle claim reward
  const handleClaimReward = (badgeId: string) => {
    const currentGems = badges
      .filter((b) => b.unlocked && b.claimedReward)
      .reduce((sum, b) => sum + b.rewardGems, 0);
    const currentUnlockedCount = badges.filter((b) => b.unlocked).length;
    const currentPercent = Math.round((currentUnlockedCount / badges.length) * 100);

    let updatedBadge: AchievementBadge | null = null;

    setBadges((prev) =>
      prev.map((b) => {
        if (b.id === badgeId) {
          updatedBadge = {
            ...b,
            unlocked: true,
            claimedReward: true,
            unlockedAt: b.unlockedAt || new Date().toISOString().split("T")[0],
          };
          setUnlockModalBadge(updatedBadge);
          return updatedBadge;
        }
        return b;
      })
    );

    if (updatedBadge) {
      const addedGems = (updatedBadge as AchievementBadge).rewardGems || 50;
      setToastPrevGems(currentGems);
      setToastNewGems(currentGems + addedGems);
      setToastPrevPercent(currentPercent);
      const newPercent = Math.min(100, Math.round(((currentUnlockedCount + 1) / badges.length) * 100));
      setToastNewPercent(newPercent);
      setPixelToastBadge(updatedBadge);
    }
  };

  // Simulate progress boost for demo/testing
  const handleSimulateUnlock = () => {
    const currentGems = badges
      .filter((b) => b.unlocked && b.claimedReward)
      .reduce((sum, b) => sum + b.rewardGems, 0);
    const currentUnlockedCount = badges.filter((b) => b.unlocked).length;
    const currentPercent = Math.round((currentUnlockedCount / badges.length) * 100);

    let updatedBadge: AchievementBadge | null = null;

    setBadges((prev) => {
      // Find the first locked badge
      const targetIndex = prev.findIndex((b) => !b.unlocked);
      if (targetIndex === -1) return prev;

      const next = [...prev];
      const target = next[targetIndex];
      updatedBadge = {
        ...target,
        currentProgress: target.targetProgress,
        unlocked: true,
        claimedReward: true,
        unlockedAt: new Date().toISOString().split("T")[0],
      };
      next[targetIndex] = updatedBadge;

      // Trigger modal ceremony
      setUnlockModalBadge(updatedBadge);
      return next;
    });

    if (updatedBadge) {
      const addedGems = (updatedBadge as AchievementBadge).rewardGems || 50;
      setToastPrevGems(currentGems);
      setToastNewGems(currentGems + addedGems);
      setToastPrevPercent(currentPercent);
      const newPercent = Math.min(100, Math.round(((currentUnlockedCount + 1) / badges.length) * 100));
      setToastNewPercent(newPercent);
      setPixelToastBadge(updatedBadge);
    }
  };

  // Stats calculation
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const totalCount = badges.length;
  const completionPercentage = Math.round((unlockedCount / totalCount) * 100);
  const totalGems = badges
    .filter((b) => b.unlocked && b.claimedReward)
    .reduce((sum, b) => sum + b.rewardGems, 0);
  const totalXp = badges
    .filter((b) => b.unlocked && b.claimedReward)
    .reduce((sum, b) => sum + b.rewardXp, 0);

  // Filtered badges
  const filteredBadges = badges.filter((b) => {
    const matchesCategory =
      activeCategory === "all" || b.category === activeCategory;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const equippedBadge = badges.find((b) => b.id === equippedBadgeId);

  return (
    <div className={cn("space-y-3 max-w-5xl mx-auto pb-2", className)}>
      {/* Header Summary Bar */}
      {compact ? (
        <div className="bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[12px] font-mono font-bold">
            <span className="text-[var(--rx-fg)]">
              解封: <span className="text-amber-500">{unlockedCount}/{totalCount} ({completionPercentage}%)</span>
            </span>
            <div className="flex items-center gap-2 text-[var(--rx-fg-dim)]">
              <span className="text-amber-500 flex items-center gap-0.5"><Gem className="h-3 w-3" />{totalGems}</span>
              <span className="text-purple-400 flex items-center gap-0.5"><Zap className="h-3 w-3" />{totalXp}</span>
            </div>
          </div>

          <button
            onClick={handleSimulateUnlock}
            className="w-full py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 font-bold text-[12px] flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>模拟测试解封下一个</span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl p-4 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[18px] sm:text-[24px] font-bold text-[var(--rx-fg)] tracking-tight leading-tight">
                  成就解封与勋章墙
                </h2>
              </div>
            </div>

            {/* Quick Simulate Button */}
            <button
              onClick={handleSimulateUnlock}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold text-[14px] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer border-b-2 border-amber-700 active:translate-y-0.5 shrink-0"
            >
              <Sparkles className="h-4 w-4" />
              <span>模拟测试解封下一个</span>
            </button>
          </div>

          {/* Stats Grid Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl p-2 text-center">
              <span className="text-[12px] text-[var(--rx-fg-dim)] block">解封进度</span>
              <div className="text-[16px] font-bold text-amber-500 font-mono mt-0.5">
                {unlockedCount} / {totalCount} ({completionPercentage}%)
              </div>
            </div>

            <div className="bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl p-2 text-center">
              <span className="text-[12px] text-[var(--rx-fg-dim)] block">已领宝石</span>
              <div className="text-[16px] font-bold text-amber-500 font-mono flex items-center justify-center gap-1 mt-0.5">
                <Gem className="h-3.5 w-3.5" />
                <span>{totalGems.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl p-2 text-center">
              <span className="text-[12px] text-[var(--rx-fg-dim)] block">累积 XP</span>
              <div className="text-[16px] font-bold text-purple-400 font-mono flex items-center justify-center gap-1 mt-0.5">
                <Zap className="h-3.5 w-3.5" />
                <span>{totalXp.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl p-2 text-center min-w-0">
              <span className="text-[12px] text-[var(--rx-fg-dim)] block">当前佩戴</span>
              <div className="text-[14px] font-bold text-emerald-500 truncate mt-0.5">
                {equippedBadge ? equippedBadge.title : "暂未佩戴"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-[var(--rx-bg-elev)] p-2 border border-[var(--rx-border-soft)] rounded-xl shadow-2xs">
        {/* Category Tabs */}
        <MotionTabs
          value={activeCategory}
          onValueChange={(v) => setActiveCategory(v as AchievementCategory)}
          variant="pill"
          className="overflow-x-auto no-scrollbar py-0.5"
        >
          <MotionTabsList className="bg-transparent border-0 p-0 gap-1">
            {CATEGORIES_META.map((cat, cIdx) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const count =
                cat.id === "all"
                  ? badges.length
                  : badges.filter((b) => b.category === cat.id).length;

              return (
                <MotionTabsTrigger
                  key={`badge_cat_${cat.id}_${cIdx}`}
                  value={cat.id}
                  className="px-2.5 py-1 text-[12px] gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{cat.label}</span>
                  <span
                    className={cn(
                      "px-1 py-0.2 text-[10px] rounded-full font-mono transition-colors",
                      isActive ? "bg-white/20 text-white" : "bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)]"
                    )}
                  >
                    {count}
                  </span>
                </MotionTabsTrigger>
              );
            })}
          </MotionTabsList>
        </MotionTabs>

        {/* Search input */}
        {!compact && (
          <div className="relative shrink-0 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--rx-fg-dim)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索勋章..."
              className="w-full pl-8 pr-3 py-1.5 text-[14px] rounded-xl bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)] focus:outline-none focus:border-[var(--rx-accent)] transition-colors"
            />
          </div>
        )}
      </div>

      {/* Badges Grid */}
      <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3")}>
        {filteredBadges.map((badge, bIdx) => (
          <AchievementCard
            key={`badge_card_${badge.id}_${bIdx}`}
            badge={badge}
            compact={compact}
            onSelect={(b) => setUnlockModalBadge(b)}
            onClaim={(id) => handleClaimReward(id)}
            isEquipped={badge.id === equippedBadgeId}
          />
        ))}
      </div>

      {filteredBadges.length === 0 && (
        <div className="text-center py-12 space-y-2 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl">
          <Award className="h-10 w-10 text-[var(--rx-fg-dim)] mx-auto opacity-40" />
          <p className="text-xs font-bold text-[var(--rx-fg-dim)]">
            未找到匹配的勋章内容
          </p>
        </div>
      )}

      {/* Unlock Ceremony Modal */}
      <AchievementUnlockModal
        badge={unlockModalBadge}
        currentTotalGems={totalGems}
        currentTotalXp={totalXp}
        onClose={() => setUnlockModalBadge(null)}
        onClaim={(id) => {
          handleClaimReward(id);
          setEquippedBadgeId(id);
          if (onBadgeEquipped) {
            const b = badges.find((item) => item.id === id);
            if (b) onBadgeEquipped(b);
          }
        }}
      />

      {/* Pixel Style Lightweight Unlock Feedback Toast */}
      <PixelUnlockToast
        badge={pixelToastBadge}
        prevGems={toastPrevGems}
        newGems={toastNewGems}
        prevProgressPercent={toastPrevPercent}
        newProgressPercent={toastNewPercent}
        onClose={() => setPixelToastBadge(null)}
      />
    </div>
  );
}

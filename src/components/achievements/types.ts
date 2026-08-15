import React from "react";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type AchievementCategory = "all" | "streak" | "memory" | "focus" | "fun" | "special";

export interface AchievementBadge {
  id: string;
  code: string; // 勋章代号如 BADGE-001
  title: string;
  titleEn: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  description: string;
  unlockCondition: string;
  currentProgress: number;
  targetProgress: number;
  unit: string;
  unlocked: boolean;
  unlockedAt?: string;
  rewardGems: number;
  rewardXp: number;
  rewardTitle?: string; // 奖励称号
  icon: string | React.ComponentType<{ className?: string }>;
  iconBgColor?: string;
  pixelArtStyle?: string;
  claimedReward?: boolean;
}

export interface AchievementStats {
  totalBadges: number;
  unlockedCount: number;
  totalGemsEarned: number;
  totalXpEarned: number;
  completionPercentage: number;
  activeTitle?: string;
  equippedBadgeId?: string;
}

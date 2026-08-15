import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  BookOpen,
  Cpu,
  CloudSun,
  CloudRain,
  CloudSnow,
  Sun,
  Cloud,
  RefreshCw,
  Edit2,
  Calendar,
  CheckCircle,
  X,
  Volume2,
  Brain,
  Clock,
  Check,
  Flame,
  Search,
  Plus,
  Sparkles,
  Zap,
  Trophy,
  Award,
  Crown,
  Gift,
  Star,
  Target,
  ShoppingBag,
  TrendingUp,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Settings,
  GripVertical,
  Gamepad2,
  ChevronDown,
  ChevronUp,
  Swords,
  HelpCircle,
  LayoutGrid,
} from "lucide-react";
import {
  MotionTabs,
  MotionTabsList,
  MotionTabsTrigger,
} from "../MotionTabs";
import { ADHDVocabArcade } from "./game/ADHDVocabArcade";
import { DesktopWidgetsDialog, GlassWeatherWidget, MeetingReminderWidget } from "../widgets";
import { AchievementWall, AchievementWallDialog } from "../achievements";
import {
  Button,
  Separator,
  Input,
  cn,
} from "@reasonix/ui";
import { useDeckTree } from "../../lib/anki/query";
import { anki } from "../../lib/anki/actions";
import { type CardInfo } from "../../lib/anki/schemas";
import { resolveMediaUrl, isLocalMediaSrc } from "../../lib/media";

interface VocabCompanionPanelProps {
  onClose: () => void;
}

function RichFieldRenderer({
  card,
  fieldName,
  className,
}: {
  card: CardInfo;
  fieldName: string;
  className?: string;
}) {
  const [processedHtml, setProcessedHtml] = useState("");

  useEffect(() => {
    let alive = true;
    const rawVal = card?.fields?.[fieldName]?.value || "";

    const filesToResolve = new Set<string>();

    const soundMatches = rawVal.matchAll(/\[sound:([^\]]+)\]/gi);
    for (const match of soundMatches) {
      filesToResolve.add(match[1].trim());
    }

    const imgMatches = rawVal.matchAll(/<img[^>]+src=["']?([^"' >]+)["']?/gi);
    for (const match of imgMatches) {
      const src = match[1].trim();
      if (isLocalMediaSrc(src)) {
        filesToResolve.add(decodeURIComponent(src));
      }
    }

    const audioMatches = rawVal.matchAll(/<audio[^>]+src=["']?([^"' >]+)["']?/gi);
    for (const match of audioMatches) {
      const src = match[1].trim();
      if (isLocalMediaSrc(src)) {
        filesToResolve.add(decodeURIComponent(src));
      }
    }

    const urlMap = new Map<string, string>();
    const resolveAll = async () => {
      await Promise.all(
        Array.from(filesToResolve).map(async (file) => {
          try {
            const url = await resolveMediaUrl(file);
            if (url) {
              urlMap.set(file, url);
            }
          } catch (e) {
            console.error("Failed to resolve companion media:", file, e);
          }
        })
      );

      if (!alive) return;

      let out = rawVal;

      out = out.replace(/\[sound:([^\]]+)\]/gi, (_, file) => {
        const key = file.trim();
        const url = urlMap.get(key);
        if (url) {
          return `<audio class="rx-audio-mini mt-1.5 w-full max-w-[220px] h-8 mx-auto block" controls src="${url}"></audio>`;
        }
        return `<span class="text-[10px] text-[var(--rx-fg-dim)] block text-center">🔇 音频: ${key}</span>`;
      });

      out = out.replace(/(<img[^>]+src=["']?)([^"' >]+)(["']?)/gi, (full, before, src, after) => {
        const key = decodeURIComponent(src.trim());
        if (isLocalMediaSrc(key)) {
          const url = urlMap.get(key);
          if (url) {
            return `${before}${url}${after}`;
          }
        }
        return full;
      });

      out = out.replace(/(<audio[^>]+src=["']?)([^"' >]+)(["']?)/gi, (full, before, src, after) => {
        const key = decodeURIComponent(src.trim());
        if (isLocalMediaSrc(key)) {
          const url = urlMap.get(key);
          if (url) {
            return `${before}${url}${after}`;
          }
        }
        return full;
      });

      setProcessedHtml(out);
    };

    void resolveAll();

    return () => {
      alive = false;
    };
  }, [card, fieldName]);

  if (!processedHtml) {
    const rawVal = card?.fields?.[fieldName]?.value || "";
    return <span className={className}>{rawVal.replace(/<[^>]*>/g, "")}</span>;
  }

  return (
    <div
      className={cn(
        "rich-field-renderer break-words space-y-1.5 text-center w-full max-w-full overflow-x-hidden",
        "[&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-[140px] [&_img]:object-contain [&_img]:rounded-lg [&_img]:mx-auto [&_img]:shadow-sm [&_img]:mt-2",
        "[&_audio]:mx-auto [&_audio]:block [&_audio]:mt-2 [&_audio]:h-8 [&_audio]:w-[220px]",
        className
      )}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
}

type TabType = "vocab" | "game" | "achieve" | "weather" | "system";

export interface QuestItem {
  id: string;
  title: string;
  desc: string;
  rewardGems: number;
  rewardXp: number;
  current: number;
  target: number;
  claimed: boolean;
}

export interface BadgeItem {
  id: string;
  title: string;
  subtitle: string;
  level: number;
  maxLevel: number;
  currentValue: number;
  targetValues: number[];
  unlocked: boolean;
  theme: "amber" | "emerald" | "sky" | "purple" | "rose";
  description: string;
  rewardText: string;
}

interface TabSetting {
  id: TabType;
  visible: boolean;
}

const DEFAULT_TAB_SETTINGS: TabSetting[] = [
  { id: "vocab", visible: true },
  { id: "game", visible: true },
  { id: "achieve", visible: true },
  { id: "weather", visible: true },
  { id: "system", visible: true },
];

const ALL_TABS_META: Record<TabType, { label: string; icon: typeof BookOpen }> = {
  vocab: { label: "背单词", icon: BookOpen },
  game: { label: "游戏", icon: Gamepad2 },
  achieve: { label: "成就站", icon: Trophy },
  weather: { label: "天气", icon: CloudSun },
  system: { label: "数据", icon: Cpu },
};

export function VocabCompanionPanel({ onClose }: VocabCompanionPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>("vocab");
  const [currentTime, setCurrentTime] = useState("");
  const [showWidgetsDialog, setShowWidgetsDialog] = useState(false);
  const [showAchievementDialog, setShowAchievementDialog] = useState(false);

  // Tab Settings State with LocalStorage persistence
  const [tabSettings, setTabSettings] = useState<TabSetting[]>(() => {
    try {
      const saved = localStorage.getItem("ra.companionTabConfig");
      if (saved) {
        const parsed: TabSetting[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seen = new Set<string>();
          const uniqueParsed: TabSetting[] = [];
          for (const item of parsed) {
            if (item && item.id && !seen.has(item.id)) {
              seen.add(item.id);
              uniqueParsed.push(item);
            }
          }
          const missing = DEFAULT_TAB_SETTINGS.filter((t) => !seen.has(t.id));
          return [...uniqueParsed, ...missing];
        }
      }
    } catch (e) {
      console.error("Failed to parse companionTabConfig:", e);
    }
    return DEFAULT_TAB_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("ra.companionTabConfig", JSON.stringify(tabSettings));
    } catch (e) {
      console.error("Failed to save companionTabConfig:", e);
    }
  }, [tabSettings]);

  // Ensure activeTab is a visible tab
  useEffect(() => {
    const visibleTabs = tabSettings.filter((t) => t.visible);
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0].id);
    }
  }, [tabSettings, activeTab]);

  const isSystemHidden = !tabSettings.find((t) => t.id === "system")?.visible;

  const toggleTabVisibility = (id: TabType) => {
    setTabSettings((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;
      const currentlyVisibleCount = prev.filter((t) => t.visible).length;
      if (target.visible && currentlyVisibleCount <= 1) {
        setGamifyToast("⚠️ 至少需要保留一个可见标签页！");
        setTimeout(() => setGamifyToast(null), 2500);
        return prev;
      }

      const next = prev.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t));
      if (target.visible && activeTab === id) {
        const remainingVisible = next.find((t) => t.visible);
        if (remainingVisible) {
          setActiveTab(remainingVisible.id);
        }
      }
      return next;
    });
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setTabSettings((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(draggedIndex, 1);
      copy.splice(targetIndex, 0, removed);
      return copy;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const moveTab = (index: number, direction: "up" | "down") => {
    setTabSettings((prev) => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[newIndex];
      copy[newIndex] = temp;
      return copy;
    });
  };

  const resetTabs = () => {
    setTabSettings(DEFAULT_TAB_SETTINGS);
    setGamifyToast("已重置标签页排序与显示设置");
    setTimeout(() => setGamifyToast(null), 2000);
  };

  // Live deck and stats
  const { data: deckTree, refetch: refetchDecks } = useDeckTree();
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [todayReviewed, setTodayReviewed] = useState(0);
  const [isEditingDeck, setIsEditingDeck] = useState(false);

  // Gamification States
  const [userXp, setUserXp] = useState(410);
  const [userGems, setUserGems] = useState(140);
  const streakDays = 7;
  const leagueRank = 3;
  const [selectedBadge, setSelectedBadge] = useState<BadgeItem | null>(null);
  const [gamifyToast, setGamifyToast] = useState<string | null>(null);

  // Achieve Sub-tab & Shop items state
  const [achieveSubTab, setAchieveSubTab] = useState<"quests" | "leaderboard" | "shop">("quests");
  const [streakFreezes, setStreakFreezes] = useState(1);
  const [doubleXpActive, setDoubleXpActive] = useState(false);
  const [hoveredPlayerRank, setHoveredPlayerRank] = useState<number | null>(null);
  const [expandedPlayerRank, setExpandedPlayerRank] = useState<number | null>(null);
  const [showTabTipPopover, setShowTabTipPopover] = useState(false);

  const playVictorySound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.12, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.22);
      });
    } catch {
      // ignore
    }
  };

  const [quests, setQuests] = useState<QuestItem[]>([
    {
      id: "q1",
      title: "初露锋芒",
      desc: "今日背诵 20 张单词卡",
      rewardGems: 15,
      rewardXp: 20,
      current: 16,
      target: 20,
      claimed: false,
    },
    {
      id: "q2",
      title: "闪电记忆",
      desc: "积累 200 点经验值 (XP)",
      rewardGems: 20,
      rewardXp: 30,
      current: 180,
      target: 200,
      claimed: false,
    },
    {
      id: "q3",
      title: "词海猎手",
      desc: "使用 AI 快速查词并收录 2 个生词",
      rewardGems: 10,
      rewardXp: 15,
      current: 1,
      target: 2,
      claimed: false,
    },
  ]);

  // Vocab Review State
  const [reviewCards, setReviewCards] = useState<CardInfo[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [cardSwipeDirection, setCardSwipeDirection] = useState<"left" | "right" | null>(null);

  // Dict Lookup / Quick Add Card State
  const [lookupWord, setLookupWord] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<{
    word: string;
    phonetic: string;
    definition: string;
    example: string;
  } | null>(null);
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Stats Sub-tabs
  const [dailyForecastTab, setDailyForecastTab] = useState<"cards" | "retention" | "duration">("cards");
  const [hourlyForecastTab, setHourlyForecastTab] = useState<"brain" | "activity">("brain");

  // System status
  const [pingTime, setPingTime] = useState<number | null>(null);

  // Initialize time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch today's reviewed count
  const fetchTodayStats = async () => {
    try {
      const start = performance.now();
      const count = await anki.getNumCardsReviewedToday();
      const end = performance.now();
      setTodayReviewed(count);
      setPingTime(Math.round(end - start));
    } catch (e) {
      console.error("Failed to fetch today stats:", e);
    }
  };

  useEffect(() => {
    void fetchTodayStats();
    const timer = setInterval(() => void fetchTodayStats(), 10000);
    return () => clearInterval(timer);
  }, []);

  // Set default selected deck once deck tree loads
  useEffect(() => {
    if (deckTree && Object.keys(deckTree.decks).length > 0 && !selectedDeck) {
      const firstDeck = Object.keys(deckTree.decks)[0];
      setSelectedDeck(firstDeck);
    }
  }, [deckTree, selectedDeck]);

  // Load cards for vocab tab
  const loadVocabCards = useCallback(async (deckName: string) => {
    if (!deckName) return;
    setVocabLoading(true);
    try {
      const queryStr = `deck:"${deckName}" (is:due or is:new)`;
      const cardIds = await anki.findCards(queryStr);
      if (cardIds.length > 0) {
        const slice = cardIds.slice(0, 10);
        const cardsInfo = await anki.cardsInfo(slice);
        setReviewCards(cardsInfo);
        setCurrentCardIndex(0);
        setShowAnswer(false);
      } else {
        const fallbackIds = await anki.findCards(`deck:"${deckName}"`);
        if (fallbackIds.length > 0) {
          const slice = fallbackIds.slice(0, 10);
          const cardsInfo = await anki.cardsInfo(slice);
          setReviewCards(cardsInfo);
          setCurrentCardIndex(0);
          setShowAnswer(false);
        } else {
          setReviewCards([]);
        }
      }
    } catch (err) {
      console.error("Error loading vocab cards:", err);
      setReviewCards([]);
    } finally {
      setVocabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "vocab" && selectedDeck) {
      void loadVocabCards(selectedDeck);
    }
  }, [activeTab, selectedDeck, loadVocabCards]);

  const speakText = (text: string) => {
    if (!text) return;
    setIsPlayingAudio(true);
    try {
      const cleaned = text.replace(/<[^>]*>/g, "").replace(/\[sound:[^\]]+\]/g, "").trim();
      if ('speechSynthesis' in window && cleaned) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(cleaned);
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(cleaned);
        utterance.lang = hasJapanese ? "ja-JP" : "en-US";
        utterance.rate = 0.9;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
      }
    } catch {
      setIsPlayingAudio(false);
    }
  };

  const triggerToast = (msg: string) => {
    setGamifyToast(msg);
    setTimeout(() => setGamifyToast(null), 2500);
  };

  const claimQuestReward = (questId: string) => {
    setQuests((prev) =>
      prev.map((q) => {
        if (q.id === questId && !q.claimed && q.current >= q.target) {
          setUserGems((g) => g + q.rewardGems);
          setUserXp((x) => x + q.rewardXp);
          triggerToast(`🎉 成功领取【${q.title}】！+${q.rewardGems}💎 +${q.rewardXp}XP`);
          playVictorySound();
          return { ...q, claimed: true };
        }
        return q;
      })
    );
  };

  const claimAllRewards = () => {
    let totalGems = 0;
    let totalXp = 0;
    let count = 0;
    setQuests((prev) =>
      prev.map((q) => {
        if (!q.claimed && q.current >= q.target) {
          totalGems += q.rewardGems;
          totalXp += q.rewardXp;
          count++;
          return { ...q, claimed: true };
        }
        return q;
      })
    );
    if (count > 0) {
      setUserGems((g) => g + totalGems);
      setUserXp((x) => x + totalXp);
      triggerToast(`🔥 一键连领！已完成 ${count} 项挑战，获 +${totalGems}💎 +${totalXp}XP`);
      playVictorySound();
    }
  };

  const buyShopItem = (itemType: "freeze" | "doubleXp" | "box", cost: number) => {
    if (userGems < cost) {
      triggerToast(`❌ 宝石不足 (需 ${cost}💎，你有 ${userGems}💎)`);
      return;
    }
    setUserGems((g) => g - cost);
    playVictorySound();

    if (itemType === "freeze") {
      setStreakFreezes((f) => f + 1);
      triggerToast(`🧊 购买成功！连胜保命卡 +1 (当前持有 ${streakFreezes + 1} 张)`);
    } else if (itemType === "doubleXp") {
      setDoubleXpActive(true);
      triggerToast(`⚡ 双倍 XP 狂暴模式已开启！接下来刷词获得 2x 经验！`);
    } else if (itemType === "box") {
      setUserXp((x) => x + 200);
      triggerToast(`🎁 开启词霸秘宝箱！获得 +200 XP 大额冲榜积分！`);
    }
  };

  const handleRateCard = async (ease: number) => {
    if (reviewCards.length === 0) return;
    const currentCard = reviewCards[currentCardIndex];
    setCardSwipeDirection(ease === 1 ? "left" : "right");

    try {
      await anki.answerCards([{ cardId: currentCard.cardId, ease }]);
      void fetchTodayStats();

      // Gamification Reward: +15 XP (or +30 XP if 2x active) & Quest update
      const earnedXp = doubleXpActive ? 30 : 15;
      setUserXp((prev) => prev + earnedXp);
      setQuests((prev) =>
        prev.map((q) => {
          if (q.id === "q1") return { ...q, current: Math.min(q.target, q.current + 1) };
          if (q.id === "q2") return { ...q, current: Math.min(q.target, q.current + earnedXp) };
          return q;
        })
      );

      setTimeout(() => {
        setCardSwipeDirection(null);
        if (currentCardIndex < reviewCards.length - 1) {
          setCurrentCardIndex((prev) => prev + 1);
          setShowAnswer(false);
        } else {
          void loadVocabCards(selectedDeck);
        }
      }, 150);
    } catch (e) {
      console.error("Failed to answer card:", e);
      setCardSwipeDirection(null);
    }
  };

  // Keyboard shortcut handler for Vocab Tab
  useEffect(() => {
    if (activeTab !== "vocab" || reviewCards.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user typing in input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (!showAnswer) {
          setShowAnswer(true);
        }
      } else if (showAnswer) {
        if (e.key === "1") {
          e.preventDefault();
          void handleRateCard(1);
        } else if (e.key === "2") {
          e.preventDefault();
          void handleRateCard(2);
        } else if (e.key === "3") {
          e.preventDefault();
          void handleRateCard(3);
        } else if (e.key === "4") {
          e.preventDefault();
          void handleRateCard(4);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, showAnswer, reviewCards, currentCardIndex]);

  // Dictionary Lookup Handler
  const handleSearchWord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!lookupWord.trim()) return;

    setSearchLoading(true);
    setAddedSuccess(false);

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(lookupWord.trim().toLowerCase())}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data[0];
        const phonetic = entry.phonetic || (entry.phonetics?.[0]?.text) || "";
        const meaning = entry.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition || "暂无定义描述";
        const ex = meaning?.definitions?.[0]?.example || `I noticed the term ${entry.word} in my daily study.`;

        setLookupResult({
          word: entry.word,
          phonetic,
          definition: `${meaning?.partOfSpeech ? `[${meaning.partOfSpeech}] ` : ""}${def}`,
          example: ex,
        });
      } else {
        // Fallback generator for terms not in free API
        const word = lookupWord.trim();
        setLookupResult({
          word,
          phonetic: `/${word.toLowerCase()}/`,
          definition: "自定义核心词汇 / 表达",
          example: `Example sentence featuring "${word}".`,
        });
      }
    } catch {
      const word = lookupWord.trim();
      setLookupResult({
        word,
        phonetic: `/${word.toLowerCase()}/`,
        definition: "词汇或短语（网络连接提示）",
        example: `Context: ${word}`,
      });
    } finally {
      setSearchLoading(false);
    }
  };

  // Add lookup result directly to Anki deck
  const handleQuickAddNote = async () => {
    if (!lookupResult || !selectedDeck) return;

    try {
      await anki.addNote({
        deckName: selectedDeck,
        modelName: "普通笔记本 (Basic)",
        fields: {
          "正面 (Front)": lookupResult.word,
          "背面 (Back)": `<div style="text-align: center;"><h2 style="font-size: 1.5rem; font-weight: bold; color: var(--rx-accent); margin-bottom: 0.25rem;">${lookupResult.word}</h2><div style="color: var(--rx-fg-dim); font-size: 0.9rem; margin-bottom: 0.75rem;">${lookupResult.phonetic}</div><div style="font-weight: 600; margin-bottom: 0.5rem;">${lookupResult.definition}</div><div style="font-style: italic; color: var(--rx-fg-dim); font-size: 0.95rem;">"${lookupResult.example}"</div></div>`,
        },
        tags: ["quick-add", "companion"],
      });

      setAddedSuccess(true);
      setUserXp((prev) => prev + 10);
      setQuests((prev) =>
        prev.map((q) => {
          if (q.id === "q3") return { ...q, current: Math.min(q.target, q.current + 1) };
          return q;
        })
      );
      triggerToast("🌟 成功加入生词本！获得 +10 XP");
      void refetchDecks();
      void loadVocabCards(selectedDeck);
      setTimeout(() => setAddedSuccess(false), 2500);
    } catch (e) {
      console.error("Quick add failed:", e);
    }
  };

  const getWeatherInfo = (reviewed: number) => {
    if (reviewed === 0) {
      return {
        temp: "2°",
        weather: "冷冬大寒 · 大雪",
        desc: "大雪封山，正适合生火背词温故知新。",
        icon: CloudSnow,
        colorFrom: "from-[#2A3439] to-[#4F5D65]",
        feel: "冷酷 (0m)",
        highLow: "目标 50 / 剩余 50",
        type: "snow",
      };
    } else if (reviewed <= 15) {
      return {
        temp: "18°",
        weather: "微雨润心 · 小雨",
        desc: "微雨润物，正适宜温故知新。",
        icon: CloudRain,
        colorFrom: "from-[#4B5E6B] to-[#6C8091]",
        feel: "温润 (12m)",
        highLow: "目标 50 / 剩余 35+",
        type: "rain",
      };
    } else if (reviewed <= 35) {
      return {
        temp: "24°",
        weather: "细雨清晨 · Drizzle",
        desc: "空山新雨，专注力正悄然攀升。",
        icon: CloudRain,
        colorFrom: "from-[#5E7A8E] to-[#7EA1B8]",
        feel: "舒心 (25m)",
        highLow: "目标 50 / 剩余 15+",
        type: "drizzle",
      };
    } else if (reviewed <= 60) {
      return {
        temp: "28°",
        weather: "春风和煦 · 多云",
        desc: "和风拂面，记忆力正在阳光下舒展。",
        icon: CloudSun,
        colorFrom: "from-[#7FA9C7] to-[#A3CBE6]",
        feel: "惬意 (45m)",
        highLow: "目标 50 / 剩余 0",
        type: "cloudy",
      };
    } else {
      return {
        temp: "32°",
        weather: "金秋骄阳 · 晴朗",
        desc: "骄阳当空，今日已达神级专注状态！",
        icon: Sun,
        colorFrom: "from-[#E3A857] to-[#F1C40F]",
        feel: "狂热 (80m)",
        highLow: "超额 50+ / 剩余 0",
        type: "sunny",
      };
    }
  };

  const weather = getWeatherInfo(todayReviewed);
  const WeatherIcon = weather.icon;

  const currentCard = reviewCards[currentCardIndex];
  const firstFieldName = currentCard?.fields ? Object.keys(currentCard.fields)[0] || "" : "";
  const secondFieldName = currentCard?.fields ? Object.keys(currentCard.fields)[1] || Object.keys(currentCard.fields)[0] || "" : "";

  return (
    <motion.aside
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="relative flex h-full w-[360px] shrink-0 flex-col border-l border-[var(--rx-border-soft)] bg-[var(--rx-sidebar)] text-[var(--rx-fg)] overflow-hidden z-20 shadow-xl"
    >
      {/* Top Header & Tab Switcher */}
      <div className="flex items-center justify-between px-3 pt-3.5 pb-2 border-b border-[var(--rx-border-soft)] bg-[var(--rx-sidebar)]">
        <MotionTabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabType)}
          variant="segment"
          className="flex-1 mr-2 min-w-0"
        >
          <MotionTabsList className="w-full p-0.5 bg-[var(--rx-bg-soft)] rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)]">
            {tabSettings
              .filter((tab) => tab.visible)
              .map((tab, idx) => {
                const meta = ALL_TABS_META[tab.id];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <MotionTabsTrigger
                    key={`top_tab_${tab.id}_${idx}`}
                    value={tab.id}
                    className="flex-1 px-2 py-1 text-[11px] gap-1.5"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </MotionTabsTrigger>
                );
              })}
          </MotionTabsList>
        </MotionTabs>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowWidgetsDialog(true)}
            className="rounded-full p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 transition-all active:scale-90 flex items-center justify-center cursor-pointer"
            title="打开桌面小组件库"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-[var(--rx-sidebar-hover)] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] transition-colors active:scale-90 cursor-pointer"
            title="关闭右侧边栏"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Duolingo-style Gamification Header Counter Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--rx-bg-soft)]/80 border-b border-[var(--rx-border-soft)] text-xs font-bold font-mono">
        <div
          onClick={() => setActiveTab("achieve")}
          className="flex items-center gap-1 text-amber-500 hover:scale-105 transition-transform cursor-pointer"
          title="连续打卡天数"
        >
          <Flame className="h-4 w-4 fill-amber-500 text-amber-500 animate-bounce" />
          <span>{streakDays} 天</span>
        </div>
        <div
          onClick={() => setActiveTab("achieve")}
          className="flex items-center gap-1 text-sky-500 hover:scale-105 transition-transform cursor-pointer"
          title="宝石"
        >
          <Gift className="h-4 w-4 text-sky-500" />
          <span>{userGems}</span>
        </div>
        <div
          onClick={() => setActiveTab("achieve")}
          className="flex items-center gap-1 text-amber-400 hover:scale-105 transition-transform cursor-pointer"
          title="累计经验值 (XP)"
        >
          <Zap className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span>{userXp} XP</span>
        </div>
        <div
          onClick={() => setActiveTab("achieve")}
          className="flex items-center gap-1 text-purple-500 hover:scale-105 transition-transform cursor-pointer"
          title="珍珠联赛排名"
        >
          <Crown className="h-4 w-4 text-purple-500" />
          <span>#{leagueRank}</span>
        </div>
      </div>

      {/* Floating Gamification Notification Toast (Restricted to Right Sidebar) */}
      <AnimatePresence>
        {gamifyToast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            className="absolute top-24 left-3 right-3 z-50 bg-amber-500 text-white font-bold text-xs p-2.5 rounded-xl shadow-xl border border-amber-300 flex items-center justify-between gap-2 pointer-events-none leading-snug break-words max-w-[336px] mx-auto"
          >
            <span className="flex-1">{gamifyToast}</span>
            <Sparkles className="h-4 w-4 animate-spin shrink-0 text-amber-100" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
        <AnimatePresence mode="wait">
          {/* TAB 1: 背单词 (IMMERSIVE MINI STUDY & DICTIONARY) */}
          {activeTab === "vocab" && (
            <motion.div
              key="vocab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Header Deck Selector & Progress */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="h-2 w-2 rounded-full bg-[var(--rx-accent)] shrink-0 animate-pulse" />
                    {isEditingDeck ? (
                      <select
                        value={selectedDeck}
                        onChange={(e) => {
                          setSelectedDeck(e.target.value);
                          setIsEditingDeck(false);
                        }}
                        onBlur={() => setIsEditingDeck(false)}
                        className="bg-[var(--rx-bg-soft)] text-[var(--rx-fg)] rounded px-2 py-0.5 text-xs font-medium focus:outline-none border border-[var(--rx-border-soft)]"
                        autoFocus
                      >
                        {deckTree &&
                          Object.keys(deckTree.decks).map((name, idx) => (
                            <option key={`companion_deck_opt_${name}_${idx}`} value={name}>
                              {name}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <span className="text-xs font-semibold truncate max-w-[180px]">
                        {selectedDeck || "未选牌组"}
                      </span>
                    )}
                    <button
                      onClick={() => setIsEditingDeck(!isEditingDeck)}
                      className="p-1 hover:bg-[var(--rx-bg-soft)] rounded text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] transition-colors"
                      title="切换背词牌组"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] px-2 py-0.5 rounded-full border border-[var(--rx-border-soft)]">
                    <Flame className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span>
                      {reviewCards.length > 0 ? `${currentCardIndex + 1}/${reviewCards.length}` : "0/0"}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                {reviewCards.length > 0 && (
                  <div className="w-full bg-[var(--rx-bg-soft)] h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-[var(--rx-accent)] h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${((currentCardIndex + 1) / reviewCards.length) * 100}%`,
                      }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  </div>
                )}
              </div>

              {/* Main Card Study Container */}
              {vocabLoading ? (
                <div className="h-56 rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-[var(--rx-accent)]" />
                    <span className="text-xs opacity-75 font-medium">正在获取到期闪卡...</span>
                  </div>
                </div>
              ) : reviewCards.length === 0 ? (
                <div className="rounded-[var(--rx-r-l)] border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] p-6 text-center space-y-3 shadow-sm">
                  <div className="inline-flex p-3 rounded-full bg-emerald-500/10 text-emerald-500">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">该牌组卡片已全数完成！</h3>
                    <p className="text-[11px] text-[var(--rx-fg-dim)] mt-1 leading-relaxed">
                      太棒了！今日该牌组已无待背卡片。您可以在上方切换其他牌组，或使用下方【快速查词】录入新词。
                    </p>
                  </div>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`vocab_anim_card_${currentCard?.cardId ?? currentCardIndex}`}
                    initial={{ scale: 0.96, opacity: 0, y: 10 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                      y: 0,
                      x: cardSwipeDirection === "left" ? -40 : cardSwipeDirection === "right" ? 40 : 0,
                    }}
                    exit={{ scale: 0.94, opacity: 0, x: cardSwipeDirection === "left" ? -100 : 100 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className="min-h-[230px] rounded-[var(--rx-r-l)] bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] p-5 shadow-md flex flex-col justify-between relative overflow-hidden group"
                  >
                    {/* Top action row */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono tracking-wider opacity-40 uppercase font-semibold">
                        {currentCard?.modelName || "Basic Note"}
                      </span>

                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-full bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] transition-all",
                          isPlayingAudio ? "text-[var(--rx-accent)] scale-110" : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]"
                        )}
                        onClick={() => {
                          const textToSpeak = currentCard?.fields[firstFieldName]?.value || "";
                          speakText(textToSpeak);
                        }}
                        title="朗读发音 (TTS)"
                      >
                        <Volume2 className={cn("h-3.5 w-3.5", isPlayingAudio && "animate-pulse")} />
                      </Button>
                    </div>

                    {/* Question / Front */}
                    <div className="my-4 flex flex-col items-center justify-center text-center px-1">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--rx-fg-faint)] mb-1 font-semibold">
                        {firstFieldName || "正面"}
                      </span>
                      <RichFieldRenderer
                        card={currentCard}
                        fieldName={firstFieldName}
                        className="text-base font-bold text-[var(--rx-fg)] leading-snug"
                      />

                      {/* Answer reveal section */}
                      <AnimatePresence>
                        {showAnswer && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, y: 12 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className="mt-4 pt-3.5 border-t border-[var(--rx-border-soft)] w-full text-center"
                          >
                            <span className="text-[10px] uppercase tracking-wider text-[var(--rx-fg-faint)] block mb-1 font-semibold">
                              {secondFieldName || "背面"}
                            </span>
                            <RichFieldRenderer
                              card={currentCard}
                              fieldName={secondFieldName}
                              className="text-sm font-semibold text-[var(--rx-accent)]"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Controls & Rating */}
                    <div className="pt-2">
                      {!showAnswer ? (
                        <Button
                          onClick={() => setShowAnswer(true)}
                          className="w-full bg-[var(--rx-accent)] hover:opacity-90 text-[var(--rx-accent-fg)] py-2 h-9 rounded-[var(--rx-r-m)] text-xs font-semibold tracking-wide shadow-sm transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <span>揭晓答案</span>
                          <span className="text-[10px] opacity-75 font-mono">(Space)</span>
                        </Button>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              onClick={() => void handleRateCard(1)}
                              className="bg-rose-500/90 text-white hover:bg-rose-600 py-1.5 text-[11px] font-semibold rounded-[var(--rx-r-m)] shadow-sm transition-transform active:scale-95 flex flex-col items-center justify-center"
                            >
                              <span>重来</span>
                              <span className="text-[8px] opacity-75 font-mono">1</span>
                            </button>
                            <button
                              onClick={() => void handleRateCard(2)}
                              className="bg-amber-500/90 text-white hover:bg-amber-600 py-1.5 text-[11px] font-semibold rounded-[var(--rx-r-m)] shadow-sm transition-transform active:scale-95 flex flex-col items-center justify-center"
                            >
                              <span>困难</span>
                              <span className="text-[8px] opacity-75 font-mono">2</span>
                            </button>
                            <button
                              onClick={() => void handleRateCard(3)}
                              className="bg-emerald-600/90 text-white hover:bg-emerald-700 py-1.5 text-[11px] font-semibold rounded-[var(--rx-r-m)] shadow-sm transition-transform active:scale-95 flex flex-col items-center justify-center"
                            >
                              <span>良好</span>
                              <span className="text-[8px] opacity-75 font-mono">3</span>
                            </button>
                            <button
                              onClick={() => void handleRateCard(4)}
                              className="bg-blue-600/90 text-white hover:bg-blue-700 py-1.5 text-[11px] font-semibold rounded-[var(--rx-r-m)] shadow-sm transition-transform active:scale-95 flex flex-col items-center justify-center"
                            >
                              <span>简单</span>
                              <span className="text-[8px] opacity-75 font-mono">4</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Quick AI Dictionary & One-Click Card Creation */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-fg)] leading-snug">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    <span>即时查词与加卡</span>
                  </span>
                  <span className="text-xs text-[var(--rx-fg-dim)]">AI 词典助手</span>
                </div>

                <form onSubmit={handleSearchWord} className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-[var(--rx-fg-dim)]" />
                    <Input
                      type="text"
                      placeholder="输入单词 (如 resilient)..."
                      value={lookupWord}
                      onChange={(e) => setLookupWord(e.target.value)}
                      className="pl-8 h-8 text-xs bg-[var(--rx-bg-soft)] border-[var(--rx-border-soft)] focus-visible:ring-1"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={searchLoading || !lookupWord.trim()}
                    className="h-8 px-3 text-xs font-semibold bg-[var(--rx-accent)] hover:opacity-90 text-[var(--rx-accent-fg)]"
                  >
                    {searchLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "查询"}
                  </Button>
                </form>

                {lookupResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] p-3 rounded-[var(--rx-r-m)] space-y-2 text-xs"
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-lg text-[var(--rx-accent)] leading-snug">{lookupResult.word}</span>
                        <span className="text-xs text-[var(--rx-fg-dim)] font-mono">{lookupResult.phonetic}</span>
                      </div>
                      <button
                        onClick={() => speakText(lookupResult.word)}
                        className="p-1 hover:bg-[var(--rx-bg-elev)] rounded text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]"
                        title="发音"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <p className="font-medium text-sm text-[var(--rx-fg)] leading-relaxed">{lookupResult.definition}</p>
                    <p className="text-xs text-[var(--rx-fg-dim)] italic border-l-2 border-[var(--rx-border-soft)] pl-2 leading-relaxed">
                      &quot;{lookupResult.example}&quot;
                    </p>

                    <div className="pt-1 flex justify-end">
                      <Button
                        onClick={() => void handleQuickAddNote()}
                        disabled={addedSuccess || !selectedDeck}
                        className={cn(
                          "h-7 px-2.5 text-[11px] font-semibold flex items-center gap-1 rounded-md transition-all",
                          addedSuccess
                            ? "bg-emerald-600 text-white"
                            : "bg-[var(--rx-bg-elev)] hover:bg-[var(--rx-sidebar-hover)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)]"
                        )}
                      >
                        {addedSuccess ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>已存入 {selectedDeck}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3 text-[var(--rx-accent)]" />
                            <span>一键加入 {selectedDeck || "牌组"}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: 游戏 (ADHD HIGH-DOPAMINE VOCAB GAMES) */}
          {activeTab === "game" && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <ADHDVocabArcade
                selectedDeckName={selectedDeck}
                onRewardXpGems={(xp, gems, toastMsg) => {
                  setUserXp((prev) => prev + xp);
                  setUserGems((prev) => prev + gems);
                  playVictorySound();
                  setGamifyToast(toastMsg);
                  setTimeout(() => setGamifyToast(null), 3000);
                }}
              />
            </motion.div>
          )}

          {/* TAB 3: 成就站 (GAMIFICATION & BADGES - DUOLINGO STYLE) */}
          {activeTab === "achieve" && (
            <motion.div
              key="achieve"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3.5"
            >
              {/* Achievement Sub-Navigation Pills */}
              <div className="flex items-center p-1 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-xl text-xs font-semibold gap-1">
                {[
                  { id: "quests", label: "任务与勋章", icon: Award },
                  { id: "leaderboard", label: "珍珠联赛", icon: Crown },
                  { id: "shop", label: "宝石道具", icon: ShoppingBag },
                ].map((sub, sIdx) => {
                  const SubIcon = sub.icon;
                  const isSubActive = achieveSubTab === sub.id;
                  return (
                    <button
                      key={`achieve_sub_${sub.id}_${sIdx}`}
                      onClick={() => setAchieveSubTab(sub.id as any)}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-[11px] cursor-pointer",
                        isSubActive
                          ? "bg-[var(--rx-accent)] text-white font-bold shadow-sm"
                          : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] hover:bg-[var(--rx-sidebar-hover)]"
                      )}
                    >
                      <SubIcon className="h-3.5 w-3.5 shrink-0" />
                      <span>{sub.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* SUB-VIEW 1: Quests & Badges */}
              {achieveSubTab === "quests" && (
                <div className="space-y-3.5">
                  {/* League Status Banner */}
              <div className="rounded-[20px] p-4 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-white shadow-lg relative overflow-hidden space-y-2.5 border border-purple-400/30">
                <div className="absolute -right-4 -bottom-4 opacity-15 pointer-events-none">
                  <Crown className="w-32 h-32" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm shadow-inner">
                      <Crown className="h-5 w-5 text-amber-300" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold tracking-wide leading-snug">珍珠联赛 (Pearl League)</h3>
                      <p className="text-xs opacity-80 mt-0.5">每周日 24:00 结算排行榜</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAchieveSubTab("leaderboard")}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-amber-400 text-purple-950 font-bold flex items-center gap-1 cursor-pointer hover:bg-amber-300 transition-all shadow-sm"
                  >
                    <span>前 5 晋级</span>
                    <TrendingUp className="h-3 w-3" />
                  </button>
                </div>

                <div className="bg-black/20 backdrop-blur-md rounded-xl p-2.5 space-y-1.5 border border-white/10 text-xs">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-amber-200 flex items-center gap-1">
                      <Trophy className="h-3.5 w-3.5" /> 当前排名：第 #{leagueRank} 名
                    </span>
                    <span className="text-[10px] opacity-80 font-mono">胜出线：280 XP</span>
                  </div>
                  <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: "85%" }}
                      transition={{ duration: 0.8 }}
                      className="bg-gradient-to-r from-amber-300 to-amber-500 h-full rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Daily Quests Section */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-fg)] leading-snug">
                    <Target className="h-4 w-4 text-emerald-500" />
                    <span>每日三大挑战任务</span>
                  </span>

                  {/* Claim All Button if available */}
                  {quests.some((q) => !q.claimed && q.current >= q.target) ? (
                    <button
                      onClick={claimAllRewards}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] rounded-lg shadow-md transition-all flex items-center gap-1 animate-pulse cursor-pointer"
                    >
                      <Gift className="h-3 w-3" /> 一键全领
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-[var(--rx-fg-dim)]">00:00 重置</span>
                  )}
                </div>

                <div className="space-y-2">
                  {quests.map((q, qIdx) => {
                    const isDone = q.current >= q.target;
                    const percent = Math.min(100, Math.round((q.current / q.target) * 100));

                    return (
                      <div
                        key={`quest_item_${q.id}_${qIdx}`}
                        className={cn(
                          "p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 text-xs",
                          q.claimed
                            ? "bg-[var(--rx-bg-soft)] border-[var(--rx-border-soft)] opacity-70"
                            : isDone
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-[var(--rx-bg-soft)]/50 border-[var(--rx-border-soft)]"
                        )}
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold truncate text-[var(--rx-fg)]">{q.title}</span>
                            <span className="text-[10px] font-mono font-semibold text-[var(--rx-fg-dim)]">
                              {q.current}/{q.target}
                            </span>
                          </div>
                          <p className="text-[10px] opacity-75 truncate">{q.desc}</p>

                          {/* Progress bar */}
                          <div className="w-full bg-[var(--rx-bg-elev)] h-1.5 rounded-full overflow-hidden border border-[var(--rx-border-soft)]">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              className={cn(
                                "h-full rounded-full",
                                isDone ? "bg-emerald-500" : "bg-[var(--rx-accent)]"
                              )}
                            />
                          </div>
                        </div>

                        {/* Claim Button - Duolingo 3D style */}
                        {q.claimed ? (
                          <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold px-2 py-1 bg-emerald-500/10 rounded-lg shrink-0">
                            <Check className="h-3 w-3" /> 已领
                          </div>
                        ) : isDone ? (
                          <button
                            onClick={() => claimQuestReward(q.id)}
                            className="shrink-0 px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:translate-y-0.5 border-b-2 border-emerald-700 text-white font-bold text-[10px] rounded-xl shadow-md transition-all flex items-center gap-1 animate-pulse cursor-pointer"
                          >
                            <Gift className="h-3 w-3" /> 领 {q.rewardGems}💎
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 shrink-0 bg-amber-500/10 px-2 py-1 rounded-lg">
                            <span>+{q.rewardGems}💎</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reasonix Achievement Wall Component Integration */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-fg)] leading-snug">
                    <Award className="h-4 w-4 text-amber-500" />
                    <span>像素微光成就勋章墙 (20+ 款)</span>
                  </span>
                  <button
                    onClick={() => setShowAchievementDialog(true)}
                    className="text-[10px] font-mono px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <span>全屏成就殿堂</span>
                    <Trophy className="h-3 w-3" />
                  </button>
                </div>

                {/* Main Achievement Wall (Compact mode for 360px sidebar) */}
                <AchievementWall compact={true} />
              </div>
            </div>
          )}

              {/* SUB-VIEW 2: Leaderboard */}
              {achieveSubTab === "leaderboard" && (
                <div className="space-y-3">
                  <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--rx-border-soft)] pb-2.5">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        <span className="text-base font-bold text-[var(--rx-fg)] leading-snug">珍珠联赛周度积分榜</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--rx-fg-dim)]">剩余 2 天 14 小时</span>
                    </div>

                    <div className="space-y-2">
                      {[
                        {
                          rank: 1,
                          name: "Duo 提督 🦉",
                          xp: 480,
                          isUser: false,
                          avatarBg: "bg-amber-500 text-white font-bold",
                          title: "🏆 珍珠联赛常胜霸王",
                          studyTime: "6.8 小时",
                          wordsLearned: 560,
                          streakDays: 30,
                          accuracy: "98%",
                          favoriteDeck: "🌸 日本美学与四字熟语",
                          specialty: "⚡ 连连看 40s 配对极限",
                          motto: "“🦉 咕咕！每日保持复习，谁也无法超越本提督！”",
                        },
                        {
                          rank: 2,
                          name: "Alex 词霸",
                          xp: 450,
                          isUser: false,
                          avatarBg: "bg-slate-400 text-white font-bold",
                          title: "⚡ 极速闪爆刷词大师",
                          studyTime: "5.4 小时",
                          wordsLearned: 480,
                          streakDays: 21,
                          accuracy: "95%",
                          favoriteDeck: "🎌 JLPT N3 常用交际",
                          specialty: "🎯 极速释义选 10 轮连胜",
                          motto: "“单词量就是力量，这周必须冲上第一！”",
                        },
                        {
                          rank: 3,
                          name: "你 (Current User)",
                          xp: userXp,
                          isUser: true,
                          avatarBg: "bg-amber-400 text-purple-950 font-bold",
                          title: "🌟 核心高能学员 (你)",
                          studyTime: "4.2 小时",
                          wordsLearned: 390,
                          streakDays: streakDays,
                          accuracy: "93%",
                          favoriteDeck: "🌸 日本美学 & Anki 真实牌组",
                          specialty: "🔥 日汉真假辨 3s 连击",
                          motto: "“持之以恒，小水滴也能穿石，目标榜首！”",
                        },
                        {
                          rank: 4,
                          name: "Sarah 记忆大师",
                          xp: 390,
                          isUser: false,
                          avatarBg: "bg-amber-700 text-white font-bold",
                          title: "🔥 打卡连胜守护者",
                          studyTime: "3.8 小时",
                          wordsLearned: 340,
                          streakDays: 14,
                          accuracy: "91%",
                          favoriteDeck: "⚡ 动漫高频台词",
                          specialty: "⌨️ 假名打字狂飙",
                          motto: "“为了无字幕看日剧，每天都在坚持！”",
                        },
                        {
                          rank: 5,
                          name: "Chen 刷词人",
                          xp: 360,
                          isUser: false,
                          avatarBg: "bg-indigo-500 text-white font-bold",
                          title: "📚 词库深耕狂人",
                          studyTime: "3.2 小时",
                          wordsLearned: 290,
                          streakDays: 9,
                          accuracy: "89%",
                          favoriteDeck: "💼 商务职场敬语",
                          specialty: "⚡ 连连看暴击",
                          motto: "“职场日语无压力，复习就是王道！”",
                        },
                        {
                          rank: 6,
                          name: "Emma 学霸",
                          xp: 320,
                          isUser: false,
                          avatarBg: "bg-gray-500 text-white font-bold",
                          title: "✨ 潜心学霸新星",
                          studyTime: "2.6 小时",
                          wordsLearned: 240,
                          streakDays: 5,
                          accuracy: "86%",
                          favoriteDeck: "🔰 JLPT N5 基础",
                          specialty: "🎯 释义直觉秒杀",
                          motto: "“一步一个脚印，每天进步一点点！”",
                        },
                        {
                          rank: 7,
                          name: "Lucas",
                          xp: 290,
                          isUser: false,
                          avatarBg: "bg-gray-500 text-white font-bold",
                          title: "🌱 新晋答题达人",
                          studyTime: "2.1 小时",
                          wordsLearned: 190,
                          streakDays: 3,
                          accuracy: "83%",
                          favoriteDeck: "🔰 JLPT N5 基础",
                          specialty: "⚡ 游戏街机闯关",
                          motto: "“刚加入珍珠联赛，请多指教！”",
                        },
                      ].map((player, pIdx) => {
                        const isHovered = hoveredPlayerRank === player.rank;
                        const isExpanded = expandedPlayerRank === player.rank || isHovered;

                        return (
                          <div
                            key={`player_item_${player.rank}_${pIdx}`}
                            onMouseEnter={() => setHoveredPlayerRank(player.rank)}
                            onMouseLeave={() => setHoveredPlayerRank(null)}
                            className="space-y-1.5"
                          >
                            <div
                              onClick={() =>
                                setExpandedPlayerRank((prev) => (prev === player.rank ? null : player.rank))
                              }
                              className={cn(
                                "p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer select-none group relative overflow-hidden",
                                player.isUser
                                  ? "bg-amber-500/15 border-amber-500/50 font-bold shadow-sm ring-1 ring-amber-400/30"
                                  : player.rank <= 5
                                  ? "bg-[var(--rx-bg-soft)]/70 border-[var(--rx-border-soft)] hover:border-amber-500/40 hover:bg-[var(--rx-bg-soft)]"
                                  : "bg-[var(--rx-bg-soft)]/30 border-[var(--rx-border-soft)] opacity-80 hover:opacity-100 hover:border-amber-500/40",
                                isExpanded && "border-amber-500/80 ring-2 ring-amber-400/20 shadow-md bg-[var(--rx-bg-soft)]"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={cn(
                                    "w-5 text-center font-mono font-extrabold text-xs shrink-0",
                                    player.rank === 1 && "text-amber-500 text-sm",
                                    player.rank === 2 && "text-gray-400",
                                    player.rank === 3 && "text-amber-600",
                                    player.rank > 3 && "text-[var(--rx-fg-dim)]"
                                  )}
                                >
                                  #{player.rank}
                                </span>
                                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] shrink-0 shadow-xs", player.avatarBg)}>
                                  {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : player.name[0]}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("truncate max-w-[100px] font-bold", player.isUser ? "text-amber-500 font-extrabold" : "text-[var(--rx-fg)]")}>
                                      {player.name}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono font-medium truncate max-w-[90px] hidden sm:inline-block">
                                      {player.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-[var(--rx-fg-dim)] mt-0.5 font-mono">
                                    <span>⏱️ {player.studyTime}</span>
                                    <span>·</span>
                                    <span>📚 {player.wordsLearned}词</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1 font-mono font-bold text-amber-500 text-[11px]">
                                  <Zap className="h-3 w-3 fill-current" />
                                  <span>{player.xp} XP</span>
                                </div>
                                <div className="text-[10px] text-[var(--rx-fg-dim)] group-hover:text-amber-500 transition-colors">
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5 opacity-60" />}
                                </div>
                              </div>
                            </div>

                            {/* Expanded Hover/Click Overlay Panel */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0, scale: 0.98 }}
                                  animate={{ opacity: 1, height: "auto", scale: 1 }}
                                  exit={{ opacity: 0, height: 0, scale: 0.98 }}
                                  transition={{ duration: 0.2, ease: "easeOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--rx-bg-soft)] to-[var(--rx-bg-elev)] space-y-2.5 text-xs shadow-inner relative">
                                    <div className="flex items-center justify-between border-b border-[var(--rx-border-soft)] pb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs", player.avatarBg)}>
                                          {player.rank === 1 ? "🥇" : player.rank === 2 ? "🥈" : player.rank === 3 ? "🥉" : player.name[0]}
                                        </div>
                                        <div>
                                          <h5 className="font-extrabold text-[var(--rx-fg)] text-xs flex items-center gap-1.5">
                                            <span>{player.name}</span>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold">
                                              #{player.rank} 珍珠榜
                                            </span>
                                          </h5>
                                          <p className="text-[10px] text-amber-500 font-medium">{player.title}</p>
                                        </div>
                                      </div>
                                      <div className="text-right font-mono">
                                        <span className="text-[10px] text-[var(--rx-fg-dim)]">周度积分</span>
                                        <p className="text-xs font-black text-amber-500 flex items-center justify-end gap-0.5">
                                          <Zap className="h-3 w-3 fill-current" />
                                          {player.xp} XP
                                        </p>
                                      </div>
                                    </div>

                                    {/* Data Grid Stats */}
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                      <div className="p-2 rounded-lg bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] space-y-0.5">
                                        <div className="text-[10px] text-[var(--rx-fg-dim)] flex items-center gap-1 font-semibold">
                                          <Clock className="h-3 w-3 text-sky-400" />
                                          <span>本周背词时间</span>
                                        </div>
                                        <p className="font-mono font-bold text-[var(--rx-fg)] text-xs">{player.studyTime}</p>
                                      </div>

                                      <div className="p-2 rounded-lg bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] space-y-0.5">
                                        <div className="text-[10px] text-[var(--rx-fg-dim)] flex items-center gap-1 font-semibold">
                                          <BookOpen className="h-3 w-3 text-emerald-400" />
                                          <span>掌握背词总数</span>
                                        </div>
                                        <p className="font-mono font-bold text-emerald-500 text-xs">{player.wordsLearned} 词</p>
                                      </div>

                                      <div className="p-2 rounded-lg bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] space-y-0.5">
                                        <div className="text-[10px] text-[var(--rx-fg-dim)] flex items-center gap-1 font-semibold">
                                          <Flame className="h-3 w-3 text-amber-400 fill-amber-400" />
                                          <span>连续打卡天数</span>
                                        </div>
                                        <p className="font-mono font-bold text-amber-500 text-xs">{player.streakDays} 天连胜</p>
                                      </div>

                                      <div className="p-2 rounded-lg bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] space-y-0.5">
                                        <div className="text-[10px] text-[var(--rx-fg-dim)] flex items-center gap-1 font-semibold">
                                          <Target className="h-3 w-3 text-rose-400" />
                                          <span>答题记忆正确率</span>
                                        </div>
                                        <p className="font-mono font-bold text-rose-400 text-xs">{player.accuracy}</p>
                                      </div>
                                    </div>

                                    {/* Specialty & Favorite Deck */}
                                    <div className="p-2 rounded-lg bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[10px] space-y-1">
                                      <div className="flex items-center justify-between text-[var(--rx-fg-dim)]">
                                        <span className="font-semibold">🌸 主攻词库:</span>
                                        <span className="font-bold text-[var(--rx-fg)]">{player.favoriteDeck}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-[var(--rx-fg-dim)]">
                                        <span className="font-semibold">⚡ 核心专长:</span>
                                        <span className="font-bold text-amber-500">{player.specialty}</span>
                                      </div>
                                    </div>

                                    {/* Motto / Mascot Encouragement */}
                                    <p className="text-[10px] italic text-[var(--rx-fg-dim)] bg-[var(--rx-bg-elev)]/50 p-2 rounded-lg border border-[var(--rx-border-soft)]">
                                      {player.motto}
                                    </p>

                                    {/* Quick Challenge / Encouragement Button */}
                                    <div className="pt-0.5">
                                      {player.isUser ? (
                                        <button
                                          onClick={() => {
                                            setActiveTab("game");
                                            setGamifyToast("🚀 已切换到 Arcade 游戏街机，开启 XP 狂飙！");
                                            setTimeout(() => setGamifyToast(null), 2500);
                                          }}
                                          className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-purple-950 font-bold text-[10px] rounded-lg shadow-2xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <Zap className="h-3 w-3 fill-current" /> 去游戏街机再抓 50 XP 冲刺榜首
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setGamifyToast(`⚔️ 已向 ${player.name} 发起 XP 积分冲刺挑战！复习 3 张卡片即可进行打榜！`);
                                            setTimeout(() => setGamifyToast(null), 3000);
                                          }}
                                          className="w-full py-1.5 bg-[var(--rx-bg-elev)] hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 font-bold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                          <Swords className="h-3 w-3" /> 向 {player.name.split(" ")[0]} 发起周度 XP 对决
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-400 flex items-center gap-2 font-medium">
                      <Sparkles className="h-4 w-4 shrink-0 text-amber-400 animate-spin" />
                      <span>你距离第 2 名 Alex 仅差 40 XP，复习 3 张词卡即可实现反超！</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: Gem Power-Up Shop */}
              {achieveSubTab === "shop" && (
                <div className="space-y-3">
                  {/* Gem Balance & Status Summary */}
                  <div className="p-3 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-sky-500 font-extrabold">
                      <Gift className="h-4 w-4" />
                      <span>宝石储备: {userGems} 💎</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-500 text-[10px] font-bold">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>保命卡: {streakFreezes} 张</span>
                    </div>
                  </div>

                  <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--rx-border-soft)] pb-2">
                      <span className="text-base font-bold text-[var(--rx-fg)] leading-snug flex items-center gap-1.5">
                        <ShoppingBag className="h-4 w-4 text-amber-500" />
                        <span>多邻国道具特惠商城</span>
                      </span>
                      <span className="text-[10px] text-[var(--rx-fg-dim)]">每日刷新</span>
                    </div>

                    <div className="space-y-2.5">
                      {/* Item 1: Streak Freeze */}
                      <div className="p-3 rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-500 border border-sky-500/30 flex items-center justify-center font-bold text-lg shadow-inner">
                            🧊
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[var(--rx-fg)]">连胜保命卡 (Streak Freeze)</h4>
                            <p className="text-[10px] text-[var(--rx-fg-dim)] mt-0.5">自动保护 1 天漏答中断，保住打卡天数</p>
                          </div>
                        </div>
                        <button
                          onClick={() => buyShopItem("freeze", 50)}
                          className="shrink-0 px-2.5 py-1.5 bg-sky-500 hover:bg-sky-600 border-b-2 border-sky-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-sm active:translate-y-0.5"
                        >
                          50 💎 兑换
                        </button>
                      </div>

                      {/* Item 2: Double XP Boost */}
                      <div className="p-3 rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold text-lg shadow-inner">
                            ⚡
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[var(--rx-fg)] flex items-center gap-1">
                              <span>双倍 XP 狂暴倍率卡</span>
                              {doubleXpActive && <span className="text-[9px] px-1 bg-emerald-500 text-white rounded">已生效</span>}
                            </h4>
                            <p className="text-[10px] text-[var(--rx-fg-dim)] mt-0.5">刷词获得 2x 经验，加速冲刺珍珠联赛榜首</p>
                          </div>
                        </div>
                        <button
                          onClick={() => buyShopItem("doubleXp", 80)}
                          className={cn(
                            "shrink-0 px-2.5 py-1.5 border-b-2 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-sm active:translate-y-0.5",
                            doubleXpActive ? "bg-emerald-600 border-emerald-800" : "bg-amber-500 hover:bg-amber-600 border-amber-700"
                          )}
                        >
                          {doubleXpActive ? "已在生效" : "80 💎 开启"}
                        </button>
                      </div>

                      {/* Item 3: XP Chest */}
                      <div className="p-3 rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-500 border border-purple-500/30 flex items-center justify-center font-bold text-lg shadow-inner">
                            🎁
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[var(--rx-fg)]">词霸秘宝大礼包</h4>
                            <p className="text-[10px] text-[var(--rx-fg-dim)] mt-0.5">瞬间爆出 200 点巨额 XP 积分注入</p>
                          </div>
                        </div>
                        <button
                          onClick={() => buyShopItem("box", 150)}
                          className="shrink-0 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 border-b-2 border-purple-900 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-sm active:translate-y-0.5"
                        >
                          150 💎 开启
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Badge Detail Modal Dialog */}
              <AnimatePresence>
                {selectedBadge && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setSelectedBadge(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.85, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.85, opacity: 0, y: 20 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      className="bg-[var(--rx-bg-elev)] border-2 border-[var(--rx-border-soft)] rounded-3xl p-5 max-w-xs w-full shadow-2xl text-center space-y-4 relative overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setSelectedBadge(null)}
                        className="absolute top-3 right-3 p-1.5 rounded-full bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] transition-colors cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      {/* Giant 3D Badge Icon */}
                      <div className="inline-flex p-4 rounded-full bg-amber-500/20 text-amber-500 border-4 border-amber-400/40 shadow-xl my-2">
                        {selectedBadge.id === "wildfire" && <Flame className="h-12 w-12 fill-current" />}
                        {selectedBadge.id === "sage" && <Zap className="h-12 w-12 fill-current" />}
                        {selectedBadge.id === "scholar" && <BookOpen className="h-12 w-12" />}
                        {selectedBadge.id === "bullseye" && <Target className="h-12 w-12" />}
                        {selectedBadge.id === "nightowl" && <Star className="h-12 w-12 fill-current" />}
                        {selectedBadge.id === "gemmaster" && <Gift className="h-12 w-12" />}
                      </div>

                      <div>
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {Array.from({ length: selectedBadge.maxLevel }).map((_, idx) => (
                            <Star
                              key={`badge_star_${selectedBadge.id}_${idx}`}
                              className={cn(
                                "h-3.5 w-3.5",
                                idx < selectedBadge.level
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-[var(--rx-fg-dim)] opacity-30"
                              )}
                            />
                          ))}
                        </div>
                        <h3 className="text-base font-bold text-[var(--rx-fg)]">{selectedBadge.title}</h3>
                        <p className="text-xs text-[var(--rx-fg-dim)] mt-1">{selectedBadge.subtitle}</p>
                      </div>

                      <div className="bg-[var(--rx-bg-soft)] p-3 rounded-xl border border-[var(--rx-border-soft)] text-xs text-left space-y-2">
                        <p className="opacity-90 leading-relaxed">{selectedBadge.description}</p>
                        <Separator className="bg-[var(--rx-border-soft)]" />
                        <div className="flex justify-between items-center text-[11px] font-semibold text-amber-500">
                          <span>解锁奖励:</span>
                          <span>{selectedBadge.rewardText}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedBadge(null)}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 border-b-4 border-amber-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all active:translate-y-1 cursor-pointer"
                      >
                        知道啦！继续刷词
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* TAB 2: 学海天气 (WEATHER & STATISTICS VIEW) */}
          {activeTab === "weather" && (
            <motion.div
              key="weather"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* 1:1 Widgets Banner Section */}
              <div className="grid grid-cols-1 gap-3 pt-1 items-center justify-items-center">
                <MeetingReminderWidget className="w-full max-w-[320px]" />
                <GlassWeatherWidget className="w-full max-w-[340px]" />
              </div>

              {/* Weather Header Card */}
              <div
                className={cn(
                  "rounded-[20px] p-4 shadow-sm text-white relative overflow-hidden transition-all bg-gradient-to-b duration-700",
                  weather.colorFrom
                )}
              >
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-semibold tracking-wider opacity-90 truncate max-w-[150px]">
                      {selectedDeck || "默认牌组"}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      void fetchTodayStats();
                      void refetchDecks();
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-transform active:scale-95"
                    title="刷新统计"
                  >
                    <RefreshCw className="h-3 w-3 opacity-75 hover:opacity-100" />
                  </button>
                </div>

                <div className="text-[10px] opacity-75 mt-1 relative z-10">
                  更新于 今天 {currentTime}
                </div>

                {/* Weather Main Value Container */}
                <div className="mt-3 mb-2 flex items-center justify-between relative z-10">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium tracking-wide opacity-80">
                      {weather.weather}
                    </span>
                    <span className="text-2xl font-bold tracking-tight mt-0.5 tabular-nums">
                      {weather.temp}
                    </span>
                  </div>
                  <WeatherIcon className="h-14 w-14 text-white drop-shadow-md animate-[pulse_3s_infinite_ease-in-out]" />
                </div>

                {/* Bottom statistics strip */}
                <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10 mt-2 text-xs relative z-10">
                  <div className="flex flex-col">
                    <span className="opacity-75 text-[10px]">体感专注 / 耗时</span>
                    <span className="font-semibold mt-0.5">{weather.feel}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="opacity-75 text-[10px]">复习气候指标</span>
                    <span className="font-semibold mt-0.5">{weather.highLow}</span>
                  </div>
                </div>

                <div className="text-[11px] mt-2.5 bg-white/10 rounded-xl px-3 py-1.5 relative z-10 leading-snug">
                  {weather.desc}
                </div>
              </div>

              {/* Card 2: 每日预报 (Daily Forecast Card) */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-fg)] leading-snug">
                    <Calendar className="h-4 w-4 text-[var(--rx-accent)]" /> 每日学海预报
                  </span>
                  <div className="flex gap-0.5 bg-[var(--rx-bg-soft)] rounded-md p-0.5">
                    {(["cards", "retention", "duration"] as const).map((t, tIdx) => (
                      <button
                        key={`daily_fc_tab_${t}_${tIdx}`}
                        onClick={() => setDailyForecastTab(t)}
                        className={cn(
                          "text-[9px] px-2 py-0.5 rounded transition-all",
                          dailyForecastTab === t
                            ? "bg-[var(--rx-accent)] text-white font-medium shadow-sm"
                            : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]"
                        )}
                      >
                        {t === "cards" ? "卡数" : t === "retention" ? "保持" : "时长"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bar Chart rendering */}
                <div className="h-36 flex items-end justify-between px-1 pt-2">
                  {[
                    { day: "周二", cards: 121, retention: 91, duration: 25 },
                    { day: "周三", cards: 136, retention: 88, duration: 42 },
                    { day: "周四", cards: 99, retention: 95, duration: 30 },
                    { day: "周五", cards: 124, retention: 92, duration: 38 },
                    { day: "周六", cards: 126, retention: 89, duration: 33 },
                    { day: "今天", cards: todayReviewed || 102, retention: 94, duration: todayReviewed ? Math.round(todayReviewed * 0.4) : 28 },
                  ].map((item, idx) => {
                    let val = 0;
                    let maxVal = 150;
                    let unit = "";
                    if (dailyForecastTab === "cards") {
                      val = item.cards;
                      maxVal = 160;
                      } else if (dailyForecastTab === "retention") {
                      val = item.retention;
                      maxVal = 100;
                      unit = "%";
                    } else {
                      val = item.duration;
                      maxVal = 60;
                      unit = "m";
                    }
                    const percent = Math.min(100, Math.round((val / maxVal) * 100));

                    return (
                      <div key={`daily_bar_${item.day}_${idx}`} className="flex flex-col items-center flex-1 h-full justify-end group relative">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] text-[var(--rx-fg)] text-[9px] px-1.5 py-0.5 rounded absolute -top-6 pointer-events-none z-10 font-mono shadow">
                          {val}{unit}
                        </span>
                        <div className="w-3.5 bg-[var(--rx-bg-soft)] rounded-full h-[95px] flex items-end overflow-hidden">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${percent}%` }}
                            transition={{ type: "spring", stiffness: 200, damping: 20, delay: idx * 0.04 }}
                            className={cn(
                              "w-full rounded-full transition-colors",
                              idx === 5 ? "bg-rose-500" : "bg-[var(--rx-accent)]"
                            )}
                          />
                        </div>
                        <span className="text-[9px] mt-1.5 font-medium opacity-80">{item.day}</span>
                        <span className="text-[9px] font-semibold font-mono opacity-90">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: 逐小时预报 (Hourly Forecast Card) */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-fg)] leading-snug">
                    <Clock className="h-4 w-4 text-[var(--rx-accent)]" /> 逐小时状态
                  </span>
                  <div className="flex gap-0.5 bg-[var(--rx-bg-soft)] rounded-md p-0.5">
                    {(["brain", "activity"] as const).map((t, tIdx) => (
                      <button
                        key={`hourly_fc_tab_${t}_${tIdx}`}
                        onClick={() => setHourlyForecastTab(t)}
                        className={cn(
                          "text-[9px] px-2 py-0.5 rounded transition-all",
                          hourlyForecastTab === t
                            ? "bg-[var(--rx-accent)] text-white font-medium shadow-sm"
                            : "text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]"
                        )}
                      >
                        {t === "brain" ? "脑力值" : "活跃度"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1 text-center relative z-10">
                  {[
                    { time: "09:00", brain: 85, activity: 10, weatherIcon: Sun },
                    { time: "11:00", brain: 95, activity: 30, weatherIcon: Sun },
                    { time: "13:00", brain: 65, activity: 5, weatherIcon: Cloud },
                    { time: "15:00", brain: 75, activity: 15, weatherIcon: CloudSun },
                    { time: "17:00", brain: 88, activity: 25, weatherIcon: Sun },
                    { time: "19:00", brain: 92, activity: 40, weatherIcon: Sun },
                  ].map((item, idx) => {
                    const WeatherComp = item.weatherIcon;
                    const value = hourlyForecastTab === "brain" ? item.brain : item.activity;
                    const formattedValue = hourlyForecastTab === "brain" ? `${value}%` : `${value}卡`;

                    return (
                      <div key={`hourly_col_${item.time}_${idx}`} className="flex flex-col items-center">
                        <span className="text-[9px] opacity-75">{item.time}</span>
                        <WeatherComp className="h-3.5 w-3.5 my-1 text-[var(--rx-fg-dim)]" />
                        <span className="text-[9px] font-mono font-semibold">{formattedValue}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Embedded System / Data Station when 'system' tab is hidden */}
              {isSystemHidden && (
                <div className="bg-[var(--rx-bg-elev)] border border-purple-500/30 rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                      <Cpu className="h-3.5 w-3.5" />
                      <span>运行数据站 (已嵌入天气页)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-600 dark:text-purple-300 font-mono border border-purple-500/20">
                        数据页已隐藏
                      </span>
                      <button
                        onClick={() => toggleTabVisibility("system")}
                        className="text-[10px] px-2 py-0.5 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                        title="把数据站重新显示到顶栏"
                      >
                        <Eye className="h-3 w-3" />
                        <span>恢复顶栏</span>
                      </button>
                    </div>
                  </div>

                  {/* System runtime diagnostics list */}
                  <div className="bg-[var(--rx-bg-soft)] rounded-xl p-3 space-y-2 text-xs border border-[var(--rx-border-soft)]">
                    <div className="flex justify-between items-center">
                      <span className="opacity-75">连接状态 (AnkiConnect)</span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        已连接 ({pingTime !== null ? `${pingTime}ms` : "OK"})
                      </span>
                    </div>
                    <Separator className="bg-[var(--rx-border-soft)]" />
                    <div className="flex justify-between items-center">
                      <span className="opacity-75">今日复习统计</span>
                      <span className="font-mono font-semibold text-[var(--rx-accent)]">{todayReviewed} 卡</span>
                    </div>
                    <Separator className="bg-[var(--rx-border-soft)]" />
                    <div className="flex justify-between items-center">
                      <span className="opacity-75">记忆保持留存率</span>
                      <span className="font-semibold text-emerald-500">92.5%</span>
                    </div>
                    <Separator className="bg-[var(--rx-border-soft)]" />
                    <div className="flex justify-between items-center">
                      <span className="opacity-75">SQLite 水位线</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> 同步就绪
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: 数据站 (DIAGNOSTICS & SYSTEM STATUS) */}
          {activeTab === "system" && (
            <motion.div
              key="system"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-fg)] leading-snug">
                <Cpu className="h-4 w-4 text-[var(--rx-accent)]" /> 运行状态及连接监测
              </div>

              {/* Diagnostic list */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="opacity-75">连接状态 (AnkiConnect)</span>
                  <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    已连接
                  </span>
                </div>
                <Separator className="bg-[var(--rx-border-soft)]" />
                <div className="flex justify-between items-center">
                  <span className="opacity-75">心跳延迟 (Ping)</span>
                  <span className="font-mono font-semibold text-[var(--rx-accent)]">
                    {pingTime !== null ? `${pingTime}ms` : "计算中..."}
                  </span>
                </div>
                <Separator className="bg-[var(--rx-border-soft)]" />
                <div className="flex justify-between items-center">
                  <span className="opacity-75">今日复习统计 (Total)</span>
                  <span className="font-mono font-semibold">{todayReviewed} 卡</span>
                </div>
                <Separator className="bg-[var(--rx-border-soft)]" />
                <div className="flex justify-between items-center">
                  <span className="opacity-75">SQLite 水位线状态</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> 同步就绪
                  </span>
                </div>
                <Separator className="bg-[var(--rx-border-soft)]" />
                <div className="flex justify-between items-center">
                  <span className="opacity-75">系统模式</span>
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] text-[10px]">
                    Vite Proxy 通道
                  </span>
                </div>
              </div>

              {/* Sub informational widget inside stats */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-2.5">
                <div className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-accent)] leading-snug">
                  <Brain className="h-4 w-4" /> 记忆保持率 (Forgetting Curve)
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed">
                  根据您的每日复习表现，当前平均记忆留存率为 <b>92.5%</b>，接近黄金学术标准 (85% - 90%)。
                </p>
                <div className="w-full bg-[var(--rx-bg-soft)] h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "92.5%" }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="bg-emerald-500 h-full rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[10px] opacity-75 font-mono">
                  <span>临界线 (80%)</span>
                  <span>当前留存 (92.5%)</span>
                </div>
              </div>

              {/* Tab Management & Custom Ordering Settings */}
              <div className="bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-[var(--rx-r-l)] p-3.5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-base font-bold flex items-center gap-1.5 text-[var(--rx-fg)] leading-snug relative">
                    <Settings className="h-4 w-4 text-[var(--rx-accent)]" />
                    <span>标签页管理与拖拽排序</span>
                    
                    {/* Floating Info Popover Button */}
                    <div className="relative inline-block">
                      <button
                        onClick={() => setShowTabTipPopover(!showTabTipPopover)}
                        onMouseEnter={() => setShowTabTipPopover(true)}
                        className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--rx-accent)]/15 text-[var(--rx-accent)] hover:bg-[var(--rx-accent)]/25 font-mono font-bold flex items-center gap-0.5 cursor-pointer transition-colors"
                        title="点击或悬停查看排版与拖拽指引"
                      >
                        <HelpCircle className="h-3 w-3" />
                        <span>指引</span>
                      </button>

                      <AnimatePresence>
                        {showTabTipPopover && (
                          <motion.div
                            initial={{ opacity: 0, y: 4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.95 }}
                            onMouseLeave={() => setShowTabTipPopover(false)}
                            className="absolute left-0 top-6 z-50 w-64 p-3 rounded-2xl bg-[var(--rx-bg-elev)] border border-[var(--rx-accent)]/40 shadow-xl backdrop-blur-md text-[11px] space-y-1.5 text-[var(--rx-fg)] pointer-events-auto"
                          >
                            <div className="flex items-center justify-between font-bold text-[var(--rx-accent)] border-b border-[var(--rx-border-soft)] pb-1">
                              <span className="flex items-center gap-1">💡 标签页拖拽与显示技巧</span>
                              <button onClick={() => setShowTabTipPopover(false)} className="text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)]">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <p className="text-[10px] text-[var(--rx-fg-dim)] leading-relaxed">
                              按住 <GripVertical className="inline h-3 w-3 text-[var(--rx-accent)]" /> 拖拽手柄可自定义调整各模块上下显示顺序；点击右侧眼睛按钮可灵活控制特定功能的开启与隐藏。
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <button
                    onClick={resetTabs}
                    className="text-[10px] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-[var(--rx-bg-soft)] transition-colors cursor-pointer"
                    title="重置为默认排序与显示"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>恢复默认</span>
                  </button>
                </div>

                <div className="space-y-1.5 pt-1">
                  {tabSettings.map((tab, idx) => {
                    const meta = ALL_TABS_META[tab.id];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    const isFirst = idx === 0;
                    const isLast = idx === tabSettings.length - 1;
                    const isDragging = draggedIndex === idx;
                    const isOver = dragOverIndex === idx;

                    return (
                      <div
                        key={`settings_tab_${tab.id}_${idx}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all select-none",
                          isDragging && "opacity-40 border-dashed border-[var(--rx-accent)] scale-98 bg-[var(--rx-accent)]/10",
                          isOver && !isDragging && "border-2 border-[var(--rx-accent)] bg-[var(--rx-accent)]/10 ring-2 ring-[var(--rx-accent)]/20 shadow-md",
                          !isDragging && !isOver && (tab.visible
                            ? "bg-[var(--rx-bg-soft)] border-[var(--rx-border-soft)] hover:border-[var(--rx-accent)]/40"
                            : "bg-[var(--rx-bg-soft)]/40 border-[var(--rx-border-soft)]/50 opacity-60")
                        )}
                      >
                        <div className="flex items-center gap-2">
                          {/* Drag Handle */}
                          <div
                            className="p-1 text-[var(--rx-fg-dim)] hover:text-[var(--rx-accent)] cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                            title="按住拖拽排序"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>

                          <div
                            className={cn(
                              "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs",
                              tab.visible
                                ? "bg-[var(--rx-accent)]/15 text-[var(--rx-accent)] font-bold"
                                : "bg-gray-500/10 text-gray-400"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--rx-fg)] flex items-center gap-1.5">
                              <span>{meta.label}</span>
                              {tab.id === "system" && (
                                <span className="text-[9px] px-1 py-0.2 bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded font-normal">
                                  数据站
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-[var(--rx-fg-dim)] font-mono">
                              ID: {tab.id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Reorder Up / Down fallback */}
                          <div className="flex items-center bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-lg p-0.5 mr-1">
                            <button
                              disabled={isFirst}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveTab(idx, "up");
                              }}
                              className="p-1 rounded hover:bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="上移"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              disabled={isLast}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveTab(idx, "down");
                              }}
                              className="p-1 rounded hover:bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] disabled:opacity-20 disabled:pointer-events-none transition-colors cursor-pointer"
                              title="下移"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>

                          {/* Visibility Toggle */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTabVisibility(tab.id);
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold cursor-pointer shadow-sm active:scale-95 select-none",
                              tab.visible
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                                : "bg-gray-500/15 text-gray-400 border border-gray-500/30 hover:bg-gray-500/25"
                            )}
                            title={tab.visible ? "点击隐藏此标签页" : "点击显示此标签页"}
                          >
                            {tab.visible ? (
                              <>
                                <Eye className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                <span>显示中</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                <span>已隐藏</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* System tips */}
              <div className="bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] p-3 rounded-[var(--rx-r-m)] flex items-start gap-2 text-[11px] leading-relaxed text-[var(--rx-fg)]">
                <Zap className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                <div className="space-y-0.5">
                  <span className="font-semibold">实时双向工作台模式：</span>
                  <p className="opacity-80">
                    侧边栏背词与词典评分将实时无缝同步回 Anki 主界面与 SQLite 本地数据库。
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Widgets Showcase Modal */}
      <DesktopWidgetsDialog
        isOpen={showWidgetsDialog}
        onClose={() => setShowWidgetsDialog(false)}
      />

      {/* Achievement Wall Dialog */}
      <AchievementWallDialog
        isOpen={showAchievementDialog}
        onClose={() => setShowAchievementDialog(false)}
      />
    </motion.aside>
  );
}

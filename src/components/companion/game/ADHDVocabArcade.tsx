import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Gamepad2,
  Zap,
  Trophy,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Timer,
  Flame,
  Volume2,
  VolumeX,
  Target,
  BookOpen,
  Sparkles,
  Keyboard,
  Settings,
  X,
  Check,
  Sliders,
  EyeOff,
  HelpCircle,
} from "lucide-react";
import { Button, cn, Progress } from "@reasonix/ui";
import { anki } from "../../../lib/anki/actions";
import { useDeckTree } from "../../../lib/anki/query";

export interface WordPair {
  id: string;
  word: string; // 日文汉字或词汇, e.g. "木漏れ日"
  meaning: string; // 中文释义, e.g. "树叶缝隙透过的阳光"
  reading?: string; // 假名读音, e.g. "こもれび"
  jlpt?: string; // JLPT 等级或分类
  phonetic?: string;
}

const KANA_ROMAJI_MAP: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo", ん: "n",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so",
  タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
  ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
  ヤ: "ya", ユ: "yu", ヨ: "yo",
  ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
  ワ: "wa", ヲ: "wo", ン: "n",
  ガ: "ga", ギ: "gi", グ: "gu", ゲ: "ge", ゴ: "go",
  ザ: "za", ジ: "ji", ズ: "zu", ゼ: "ze", ゾ: "zo",
  ダ: "da", ヂ: "ji", ヅ: "zu", デ: "de", ド: "do",
  バ: "ba", ビ: "bi", ブ: "bu", ベ: "be", ボ: "bo",
  パ: "pa", ピ: "pi", プ: "pu", ペ: "pe", ポ: "po",
};

const CONTRACTED_KANA: Record<string, string> = {
  きゃ: "kya", きゅ: "kyu", きょ: "kyo",
  しゃ: "sha", しゅ: "shu", しょ: "sho",
  ちゃ: "cha", ちゅ: "chu", ちょ: "cho",
  にゃ: "nya", にゅ: "nyu", にょ: "nyo",
  ひゃ: "hya", ひゅ: "hyu", ひょ: "hyo",
  みゃ: "mya", みゅ: "myu", みょ: "myo",
  りゃ: "rya", りゅ: "ryu", りょ: "ryo",
  ぎゃ: "gya", ぎゅ: "gyu", ぎょ: "gyo",
  じゃ: "ja", じゅ: "ju", じょ: "jo",
  びゃ: "bya", びゅ: "byu", びょ: "byo",
  ぴゃ: "pya", ぴゅ: "pyu", ぴょ: "pya",
};

export function convertKanaToRomaji(input: string): string {
  if (!input) return "";
  const str = input.trim();
  let result = "";
  let i = 0;

  while (i < str.length) {
    if (i + 1 < str.length) {
      const pair = str.slice(i, i + 2);
      if (CONTRACTED_KANA[pair]) {
        result += CONTRACTED_KANA[pair];
        i += 2;
        continue;
      }
    }

    const char = str[i];
    if (char === "っ" || char === "ッ") {
      if (i + 1 < str.length) {
        const nextChar = str[i + 1];
        const nextRomaji = KANA_ROMAJI_MAP[nextChar];
        if (nextRomaji && nextRomaji.length > 0) {
          result += nextRomaji[0];
          i++;
          continue;
        }
      }
    }

    if (KANA_ROMAJI_MAP[char]) {
      result += KANA_ROMAJI_MAP[char];
    } else if (/[a-zA-Z0-9]/.test(char)) {
      result += char.toLowerCase();
    }
    i++;
  }

  const cleaned = result || str.toLowerCase().replace(/[^a-z]/g, "");
  return cleaned || "sakura";
}

export interface PresetDeck {
  id: string;
  name: string;
  badge: string;
  desc: string;
  cards: WordPair[];
}

export const PRESET_JAPANESE_DECKS: PresetDeck[] = [
  {
    id: "preset_aesthetics",
    name: "🌸 日本美学与四字熟语 (JLPT N1/N2)",
    badge: "美学词汇",
    desc: "充满东方诗意与意境美的日语经典词汇与四字成语",
    cards: [
      { id: "a1", word: "木漏れ日", reading: "こもれび", meaning: "树叶缝隙透过的阳光", jlpt: "N2 表达" },
      { id: "a2", word: "一期一会", reading: "いちごいちえ", meaning: "一期一会，珍视当下的相遇", jlpt: "四字熟语" },
      { id: "a3", word: "黄昏", reading: "たそがれ", meaning: "黄昏、傍晚、暮光", jlpt: "N2 词汇" },
      { id: "a4", word: "絆", reading: "きずな", meaning: "羁绊、纽带、情谊", jlpt: "N2 词汇" },
      { id: "a5", word: "憧れ", reading: "あこがれ", meaning: "憧憬、向往、仰慕", jlpt: "N2 词汇" },
      { id: "a6", word: "浮世", reading: "うきよ", meaning: "浮世、人世间、红尘", jlpt: "文化表达" },
      { id: "a7", word: "茜空", reading: "あかねぞら", meaning: "晚霞天空、茜色晚霞", jlpt: "美学表达" },
      { id: "a8", word: "切ない", reading: "せつない", meaning: "难过的、令人揪心的", jlpt: "N1 词汇" },
      { id: "a9", word: "初恋", reading: "はつこい", meaning: "初恋", jlpt: "N4 词汇" },
      { id: "a10", word: "木枯らし", reading: "こがらし", meaning: "初冬冷风、秋末寒风", jlpt: "N1 词汇" },
      { id: "a11", word: "星空", reading: "ほしぞら", meaning: "星空、满天繁星", jlpt: "N4 词汇" },
      { id: "a12", word: "旅人", reading: "たびびと", meaning: "旅人、旅行者、行者", jlpt: "N3 词汇" },
      { id: "a13", word: "桜", reading: "さくら", meaning: "樱花", jlpt: "N5 词汇" },
      { id: "a14", word: "木漏れ月", reading: "こもれづき", meaning: "树隙透出的月光", jlpt: "美学表达" },
      { id: "a15", word: "儚い", reading: "はかない", meaning: "虚幻的、短暂的、无常的", jlpt: "N1 词汇" },
      { id: "a16", word: "希望", reading: "きぼう", meaning: "希望、愿望", jlpt: "N3 词汇" },
      { id: "a17", word: "幽玄", reading: "ゆうげん", meaning: "深邃优雅、沉静高远之美", jlpt: "文化表达" },
      { id: "a18", word: "故郷", reading: "ふるさと", meaning: "故乡、家乡", jlpt: "N3 词汇" },
    ],
  },
  {
    id: "preset_jlpt_n5",
    name: "🔰 JLPT N5 必备核心词汇 (初级入门)",
    badge: "JLPT N5",
    desc: "适合初学者的日汉高频基础名词、动词与日常表达",
    cards: [
      { id: "n5_1", word: "猫", reading: "ねこ", meaning: "猫咪", jlpt: "N5 词汇" },
      { id: "n5_2", word: "犬", reading: "いぬ", meaning: "狗狗", jlpt: "N5 词汇" },
      { id: "n5_3", word: "富士山", reading: "ふじさん", meaning: "富士山", jlpt: "N5 名词" },
      { id: "n5_4", word: "友達", reading: "ともだち", meaning: "朋友", jlpt: "N5 词汇" },
      { id: "n5_5", word: "食べる", reading: "たべる", meaning: "吃", jlpt: "N5 动词" },
      { id: "n5_6", word: "飲む", reading: "のむ", meaning: "喝", jlpt: "N5 动词" },
      { id: "n5_7", word: "先生", reading: "せんせい", meaning: "老师、医生", jlpt: "N5 词汇" },
      { id: "n5_8", word: "勉強", reading: "べんきょう", meaning: "学习、念书", jlpt: "N5 动词" },
      { id: "n5_9", word: "家族", reading: "かぞく", meaning: "家人、家属", jlpt: "N5 词汇" },
      { id: "n5_10", word: "幸せ", reading: "しあわせ", meaning: "幸福、开心", jlpt: "N5 形容词" },
      { id: "n5_11", word: "雨", reading: "あめ", meaning: "下雨、雨水", jlpt: "N5 名词" },
      { id: "n5_12", word: "海", reading: "うみ", meaning: "大海、海洋", jlpt: "N5 名词" },
      { id: "n5_13", word: "空", reading: "そら", meaning: "天空", jlpt: "N5 名词" },
      { id: "n5_14", word: "言葉", reading: "ことば", meaning: "语言、词语", jlpt: "N5 词汇" },
      { id: "n5_15", word: "心", reading: "こころ", meaning: "内心、心意", jlpt: "N5 词汇" },
      { id: "n5_16", word: "車", reading: "くるま", meaning: "汽车", jlpt: "N5 名词" },
    ],
  },
  {
    id: "preset_jlpt_n4n3",
    name: "🎌 JLPT N4/N3 常用生活与交际词汇",
    badge: "JLPT N3",
    desc: "日常生活、出行旅游与日常问候交流必备高频词",
    cards: [
      { id: "n3_1", word: "乾杯", reading: "かんぱい", meaning: "干杯", jlpt: "N4 词汇" },
      { id: "n3_2", word: "挨拶", reading: "あいさつ", meaning: "寒暄、打招呼", jlpt: "N3 词汇" },
      { id: "n3_3", word: "約束", reading: "やくそく", meaning: "约定、诺言", jlpt: "N4 词汇" },
      { id: "n3_4", word: "案内", reading: "あんない", meaning: "向导、引导、带路", jlpt: "N3 词汇" },
      { id: "n3_5", word: "遠慮", reading: "えんりょ", meaning: "客气、谦让、谢绝", jlpt: "N3 词汇" },
      { id: "n3_6", word: "感謝", reading: "かんしゃ", meaning: "感谢、感激", jlpt: "N3 词汇" },
      { id: "n3_7", word: "笑顔", reading: "えがお", meaning: "笑脸、微笑", jlpt: "N3 词汇" },
      { id: "n3_8", word: "応援", reading: "おうえん", meaning: "加油、应援、支持", jlpt: "N3 词汇" },
      { id: "n3_9", word: "卒業", reading: "そつぎょう", meaning: "毕业", jlpt: "N3 词汇" },
      { id: "n3_10", word: "伝統", reading: "でんとう", meaning: "传统", jlpt: "N3 词汇" },
      { id: "n3_11", word: "景色", reading: "けしき", meaning: "景色、风光", jlpt: "N4 词汇" },
      { id: "n3_12", word: "仲間", reading: "なかま", meaning: "伙伴、同伴", jlpt: "N3 词汇" },
      { id: "n3_13", word: "未来", reading: "みらい", meaning: "未来", jlpt: "N3 词汇" },
      { id: "n3_14", word: "奇跡", reading: "きせき", meaning: "奇迹", jlpt: "N3 词汇" },
      { id: "n3_15", word: "理由", reading: "りゆう", meaning: "理由、原因", jlpt: "N4 词汇" },
      { id: "n3_16", word: "努力", reading: "どりょく", meaning: "努力、奋发", jlpt: "N3 词汇" },
    ],
  },
  {
    id: "preset_anime",
    name: "⚡ 动漫高频台词与日常感情词汇",
    badge: "动漫台词",
    desc: "看动漫听日剧最常出现的台词与情感表达高频词",
    cards: [
      { id: "an_1", word: "大丈夫", reading: "だいじょうぶ", meaning: "没关系、没问题", jlpt: "日常台词" },
      { id: "an_2", word: "嘘でしょ", reading: "うそでしょ", meaning: "不会吧、真的假的", jlpt: "日常台词" },
      { id: "an_3", word: "最高", reading: "さいこう", meaning: "棒极了、最高", jlpt: "日常台词" },
      { id: "an_4", word: "秘密", reading: "ひみつ", meaning: "秘密", jlpt: "高频词" },
      { id: "an_5", word: "勇気", reading: "ゆうき", meaning: "勇气", jlpt: "高频词" },
      { id: "an_6", word: "絶望", reading: "ぜつぼう", meaning: "绝望", jlpt: "高频词" },
      { id: "an_7", word: "奇跡", reading: "きせき", meaning: "奇迹", jlpt: "高频词" },
      { id: "an_8", word: "絆", reading: "きずな", meaning: "羁绊", jlpt: "高频词" },
      { id: "an_9", word: "仲間", reading: "なかま", meaning: "同伴、伙伴", jlpt: "高频词" },
      { id: "an_10", word: "誓い", reading: "ちかい", meaning: "誓言、誓约", jlpt: "高频词" },
      { id: "an_11", word: "運命", reading: "うんめい", meaning: "命运", jlpt: "高频词" },
      { id: "an_12", word: "祝福", reading: "しゅくふく", meaning: "祝福", jlpt: "高频词" },
      { id: "an_13", word: "復活", reading: "ふっかつ", meaning: "复活", jlpt: "高频词" },
      { id: "an_14", word: "正義", reading: "せいぎ", meaning: "正义", jlpt: "高频词" },
      { id: "an_15", word: "覚悟", reading: "かくご", meaning: "心理准备、觉悟", jlpt: "高频词" },
      { id: "an_16", word: "英雄", reading: "えいゆう", meaning: "英雄", jlpt: "高频词" },
    ],
  },
  {
    id: "preset_business",
    name: "💼 职场商务敬语与正式表达 (JLPT N2/N1)",
    badge: "商务高阶",
    desc: "日本职场工作、商务邮件与敬语高频表达词汇",
    cards: [
      { id: "bs_1", word: "確認", reading: "かくにん", meaning: "确认、核对", jlpt: "商务常用" },
      { id: "bs_2", word: "連絡", reading: "れんらく", meaning: "联系、通知", jlpt: "商务常用" },
      { id: "bs_3", word: "相談", reading: "そうだん", meaning: "商量、咨询", jlpt: "商务常用" },
      { id: "bs_4", word: "遠慮", reading: "えんりょ", meaning: "推辞、客气", jlpt: "商务常用" },
      { id: "bs_5", word: "承知", reading: "しょうち", meaning: "得知、晓得、同意", jlpt: "敬语词汇" },
      { id: "bs_6", word: "検討", reading: "けんとう", meaning: "讨论、研究考虑", jlpt: "商务常用" },
      { id: "bs_7", word: "担当", reading: "たんとう", meaning: "负责、担当", jlpt: "商务常用" },
      { id: "bs_8", word: "協力", reading: "きょうりょく", meaning: "配合、协助", jlpt: "商务常用" },
      { id: "bs_9", word: "報告", reading: "ほうこく", meaning: "汇报、报告", jlpt: "商务常用" },
      { id: "bs_10", word: "依頼", reading: "いらい", meaning: "委托、请求", jlpt: "商务常用" },
      { id: "bs_11", word: "提出", reading: "ていしゅつ", meaning: "提交、提出", jlpt: "商务常用" },
      { id: "bs_12", word: "完了", reading: "かんりょう", meaning: "完成、结束", jlpt: "商务常用" },
      { id: "bs_13", word: "了解", reading: "りょうかい", meaning: "明白、理解", jlpt: "商务常用" },
      { id: "bs_14", word: "辞退", reading: "じたい", meaning: "谢绝、辞退", jlpt: "商务常用" },
      { id: "bs_15", word: "調整", reading: "ちょうせい", meaning: "协调、调整", jlpt: "商务常用" },
      { id: "bs_16", word: "承認", reading: "しょうにん", meaning: "批准、同意", jlpt: "商务常用" },
    ],
  },
];

export type GameMode = "menu" | "match" | "blast" | "blitz" | "unscramble";

interface ADHDVocabArcadeProps {
  selectedDeckName?: string;
  onRewardXpGems: (xp: number, gems: number, toastMsg: string) => void;
}

// Japanese Voice Synthesizer
function speakJapanese(text: string, rate: number = 1.0) {
  if (!("speechSynthesis" in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const clean = text.replace(/\[[^\]]+\]/g, "").replace(/<[^>]+>/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "ja-JP";
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore
  }
}

// Sound Synthesizer via Web Audio API
function playArcadeSound(type: "correct" | "wrong" | "combo" | "win" | "click" | "countdown") {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    if (type === "click") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === "correct") {
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.1, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.15);
      });
    } else if (type === "combo") {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.12, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.2);
      });
    } else if (type === "wrong") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.2);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "win") {
      [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.15, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.3);
      });
    }
  } catch {
    // AudioContext blocked or unsupported
  }
}

export function ADHDVocabArcade({
  selectedDeckName,
  onRewardXpGems,
}: ADHDVocabArcadeProps) {
  const [mode, setMode] = useState<GameMode>("menu");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Fetch Anki decks if available
  const { data: deckTreeData } = useDeckTree();
  const ankiDecks = deckTreeData?.decks ? Object.keys(deckTreeData.decks) : [];

  // Currently active deck selection (defaults to first Japanese preset deck)
  const [activeDeckId, setActiveDeckId] = useState<string>(() => {
    if (selectedDeckName) return `anki_${selectedDeckName}`;
    return PRESET_JAPANESE_DECKS[0].id;
  });

  // Loaded cards converted to WordPair
  const [vocabList, setVocabList] = useState<WordPair[]>(
    PRESET_JAPANESE_DECKS[0].cards
  );

  // Sync prop selectedDeckName change
  useEffect(() => {
    if (selectedDeckName) {
      setActiveDeckId(`anki_${selectedDeckName}`);
    }
  }, [selectedDeckName]);

  // Common Game States
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(45);
  const [gameActive, setGameActive] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [floatingEffects, setFloatingEffects] = useState<
    { id: number; text: string; color: string; x: number; y: number }[]
  >([]);

  // Settings & Customization States
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoSpeechOnCorrect, setAutoSpeechOnCorrect] = useState(true);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [matchPairCount, setMatchPairCount] = useState<number>(6); // 4, 6, 8
  const [blastTimerSeconds, setBlastTimerSeconds] = useState<number>(5); // 3, 5, 8
  const [maskBlastOptions, setMaskBlastOptions] = useState<boolean>(false); // 极速释义选：蒙版模式
  const [blitzTimerSeconds, setBlitzTimerSeconds] = useState<number>(3); // 2, 3, 5
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState<boolean>(true);
  const [showGameTipPopover, setShowGameTipPopover] = useState<boolean>(false);

  // Reset settings function
  const resetSettings = () => {
    setSoundEnabled(true);
    setAutoSpeechOnCorrect(true);
    setSpeechSpeed(1.0);
    setMatchPairCount(6);
    setBlastTimerSeconds(5);
    setMaskBlastOptions(false);
    setBlitzTimerSeconds(3);
    setShowVirtualKeyboard(true);
    if (soundEnabled) playArcadeSound("click");
  };

  // Load cards when activeDeckId changes
  useEffect(() => {
    let active = true;

    // 1. Check if it's a preset Japanese deck
    const matchedPreset = PRESET_JAPANESE_DECKS.find(
      (p) => p.id === activeDeckId
    );
    if (matchedPreset) {
      setVocabList(matchedPreset.cards);
      return;
    }

    // 2. Fetch from Anki deck if prefixed with "anki_"
    if (activeDeckId.startsWith("anki_")) {
      const deckName = activeDeckId.replace("anki_", "");
      const fetchCards = async () => {
        try {
          const cardIds = await anki.findCards(`deck:"${deckName}"`);
          if (cardIds.length > 0) {
            const sliceIds = cardIds.slice(0, 35);
            const infos = await anki.cardsInfo(sliceIds);
            if (active && infos.length > 0) {
              const parsed: WordPair[] = infos
                .map((c, idx) => {
                  const fieldsArr = Object.values(c.fields || {});
                  const raw0 = fieldsArr[0]?.value || "";
                  const raw1 = fieldsArr[1]?.value || fieldsArr[0]?.value || "";

                  const clean0 = raw0
                    .replace(/<[^>]*>/g, "")
                    .replace(/\[sound:[^\]]+\]/g, "")
                    .trim();
                  const clean1 = raw1
                    .replace(/<[^>]*>/g, "")
                    .replace(/\[sound:[^\]]+\]/g, "")
                    .trim();

                  let word = clean0;
                  let reading = "";

                  // Check furigana format: Kanji[Furigana] e.g. 猫[ねこ]
                  const matchBrackets = clean0.match(/^([^\[]+)\[([^\]]+)\]/);
                  if (matchBrackets) {
                    word = matchBrackets[1].trim();
                    reading = matchBrackets[2].trim();
                  } else if (
                    /[\u3040-\u309F\u30A0-\u30FF]/.test(clean1) &&
                    clean1.length < 15
                  ) {
                    reading = clean1;
                  }

                  if (!word) return null;
                  return {
                    id: `card_${c.cardId || idx}`,
                    word,
                    reading: reading || word,
                    meaning:
                      clean1.replace(/\[[^\]]+\]/g, "").trim() || "未知释义",
                  };
                })
                .filter(Boolean) as WordPair[];

              if (parsed.length >= 4) {
                setVocabList(parsed);
              }
            }
          }
        } catch {
          if (active) {
            setVocabList(PRESET_JAPANESE_DECKS[0].cards);
          }
        }
      };
      fetchCards();
    }

    return () => {
      active = false;
    };
  }, [activeDeckId]);

  const triggerFloatEffect = (text: string, color: string = "text-amber-400") => {
    const id = Date.now() + Math.random();
    const x = Math.random() * 40 - 20;
    const y = Math.random() * 20 - 10;
    setFloatingEffects((prev) => [...prev, { id, text, color, x, y }]);
    setTimeout(() => {
      setFloatingEffects((prev) => prev.filter((item) => item.id !== id));
    }, 1200);
  };

  const handleCorrectAnswer = (earnedScore = 100) => {
    const nextCombo = combo + 1;
    setCombo(nextCombo);
    if (nextCombo > maxCombo) setMaxCombo(nextCombo);

    const comboBonus = Math.floor(nextCombo * 15);
    const totalAdded = earnedScore + comboBonus;
    setScore((prev) => prev + totalAdded);

    if (soundEnabled) {
      if (nextCombo >= 3) playArcadeSound("combo");
      else playArcadeSound("correct");
    }

    triggerFloatEffect(
      nextCombo >= 3 ? `🔥 COMBO x${nextCombo} +${totalAdded}` : `+${totalAdded}`,
      nextCombo >= 3 ? "text-amber-400 font-extrabold scale-110" : "text-emerald-400 font-bold"
    );
  };

  const handleWrongAnswer = () => {
    setCombo(0);
    if (soundEnabled) playArcadeSound("wrong");
    triggerFloatEffect("MISS! 连击中断", "text-rose-400 font-bold");
  };

  const finishGame = useCallback(() => {
    setGameActive(false);
    setGameFinished(true);

    const earnedXp = Math.max(15, Math.floor(score / 10));
    const earnedGems = Math.max(5, Math.floor(score / 50) + (maxCombo >= 5 ? 10 : 0));

    if (soundEnabled) playArcadeSound("win");
    onRewardXpGems(
      earnedXp,
      earnedGems,
      `🎉 游戏结算成功！获得 +${earnedXp} XP，+${earnedGems} 宝石！`
    );
  }, [score, maxCombo, soundEnabled, onRewardXpGems]);

  // ================= MODE 1: SPEED MATCH (闪电连连看) =================
  const [matchPairs, setMatchPairs] = useState<WordPair[]>([]);
  const [matchWordTiles, setMatchWordTiles] = useState<{ id: string; word: string; pairId: string }[]>([]);
  const [matchMeaningTiles, setMatchMeaningTiles] = useState<{ id: string; meaning: string; pairId: string }[]>([]);
  const [selectedWordTile, setSelectedWordTile] = useState<string | null>(null);
  const [selectedMeaningTile, setSelectedMeaningTile] = useState<string | null>(null);
  const [clearedPairIds, setClearedPairIds] = useState<Set<string>>(new Set());
  const [hoveredTargetTileId, setHoveredTargetTileId] = useState<string | null>(null);

  const startMatchGame = () => {
    if (soundEnabled) playArcadeSound("click");
    setMode("match");
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTimerSeconds(40);
    setGameActive(true);
    setGameFinished(false);
    setClearedPairIds(new Set());
    setSelectedWordTile(null);
    setSelectedMeaningTile(null);
    setHoveredTargetTileId(null);

    // Pick matchPairCount random pairs
    const shuffled = [...vocabList].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, matchPairCount);
    setMatchPairs(chosen);

    const wTiles = chosen.map((p) => ({ id: `w_${p.id}`, word: p.word, pairId: p.id })).sort(() => Math.random() - 0.5);
    const mTiles = chosen.map((p) => ({ id: `m_${p.id}`, meaning: p.meaning, pairId: p.id })).sort(() => Math.random() - 0.5);

    setMatchWordTiles(wTiles);
    setMatchMeaningTiles(mTiles);
  };

  // Timer loop for Match game
  useEffect(() => {
    if (mode === "match" && gameActive) {
      if (timerSeconds <= 0) {
        finishGame();
        return;
      }
      const t = setInterval(() => setTimerSeconds((prev) => prev - 1), 1000);
      return () => clearInterval(t);
    }
  }, [mode, gameActive, timerSeconds, finishGame]);

  const triggerPairMatch = (pairId: string, isDrag: boolean = false) => {
    const pairObj = matchPairs.find((p) => p.id === pairId);
    if (pairObj && autoSpeechOnCorrect) speakJapanese(pairObj.word, speechSpeed);

    const points = isDrag ? 150 : 120;
    handleCorrectAnswer(points);

    if (isDrag) {
      triggerFloatEffect("💥 碰一碰消消乐! +150", "text-amber-400 font-black scale-125");
    }

    setClearedPairIds((prev) => {
      const next = new Set(prev);
      next.add(pairId);
      if (next.size >= matchPairs.length) {
        setTimeout(() => {
          const nextShuffled = [...vocabList].sort(() => Math.random() - 0.5).slice(0, matchPairCount);
          setMatchPairs(nextShuffled);
          setMatchWordTiles(
            nextShuffled.map((p) => ({ id: `w_${p.id}`, word: p.word, pairId: p.id })).sort(() => Math.random() - 0.5)
          );
          setMatchMeaningTiles(
            nextShuffled.map((p) => ({ id: `m_${p.id}`, meaning: p.meaning, pairId: p.id })).sort(() => Math.random() - 0.5)
          );
          setClearedPairIds(new Set());
        }, 400);
      }
      return next;
    });

    setSelectedWordTile(null);
    setSelectedMeaningTile(null);
  };

  const handleDragTile = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { point: { x: number; y: number } },
    sourceType: "word" | "meaning"
  ) => {
    const elements = document.elementsFromPoint(info.point.x, info.point.y);
    const targetBtn = elements.find((el) => {
      const tType = el.getAttribute("data-tile-type");
      const tId = el.getAttribute("data-tile-id");
      return tType && tType !== sourceType && tId;
    }) as HTMLElement | undefined;

    if (targetBtn) {
      const tId = targetBtn.getAttribute("data-tile-id");
      setHoveredTargetTileId(tId);
    } else {
      setHoveredTargetTileId(null);
    }
  };

  const handleDragTileEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { point: { x: number; y: number } },
    sourceType: "word" | "meaning",
    sourcePairId: string
  ) => {
    setHoveredTargetTileId(null);
    const elements = document.elementsFromPoint(info.point.x, info.point.y);
    const targetBtn = elements.find((el) => {
      const tType = el.getAttribute("data-tile-type");
      const tId = el.getAttribute("data-tile-id");
      return tType && tType !== sourceType && tId;
    }) as HTMLElement | undefined;

    if (!targetBtn) return;

    const targetPairId = targetBtn.getAttribute("data-pair-id");
    if (targetPairId === sourcePairId) {
      triggerPairMatch(sourcePairId, true);
    } else {
      handleWrongAnswer();
      triggerFloatEffect("❌ 碰错啦", "text-rose-400 font-bold");
    }
  };

  const handleTileClick = (type: "word" | "meaning", id: string, pairId: string) => {
    if (!gameActive || clearedPairIds.has(pairId)) return;
    if (soundEnabled) playArcadeSound("click");

    const pairObj = matchPairs.find((p) => p.id === pairId);

    if (type === "word") {
      if (selectedWordTile === id) {
        setSelectedWordTile(null);
        return;
      }
      setSelectedWordTile(id);
      if (pairObj) speakJapanese(pairObj.word);

      if (selectedMeaningTile) {
        const mPairId = matchMeaningTiles.find((t) => t.id === selectedMeaningTile)?.pairId;
        if (mPairId === pairId) {
          triggerPairMatch(pairId, false);
        } else {
          handleWrongAnswer();
          setSelectedWordTile(null);
          setSelectedMeaningTile(null);
        }
      }
    } else {
      if (selectedMeaningTile === id) {
        setSelectedMeaningTile(null);
        return;
      }
      setSelectedMeaningTile(id);

      if (selectedWordTile) {
        const wPairId = matchWordTiles.find((t) => t.id === selectedWordTile)?.pairId;
        if (wPairId === pairId) {
          triggerPairMatch(pairId, false);
        } else {
          handleWrongAnswer();
          setSelectedWordTile(null);
          setSelectedMeaningTile(null);
        }
      }
    }
  };

  // ================= MODE 2: MEANING BLAST (闪爆极速选) =================
  const [blastCurrentWord, setBlastCurrentWord] = useState<WordPair | null>(null);
  const [blastOptions, setBlastOptions] = useState<string[]>([]);
  const [blastRound, setBlastRound] = useState(1);
  const [blastTimeLeft, setBlastTimeLeft] = useState(5);
  const [isBlastOptionsRevealed, setIsBlastOptionsRevealed] = useState<boolean>(true);

  const startBlastGame = () => {
    if (soundEnabled) playArcadeSound("click");
    setMode("blast");
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setBlastRound(1);
    setGameActive(true);
    setGameFinished(false);
    nextBlastRound();
  };

  const nextBlastRound = useCallback(() => {
    const chosen = vocabList[Math.floor(Math.random() * vocabList.length)];
    setBlastCurrentWord(chosen);

    // Pick 3 wrong options
    const otherMeanings = vocabList
      .filter((v) => v.id !== chosen.id)
      .map((v) => v.meaning)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const allOpts = [...otherMeanings, chosen.meaning].sort(() => Math.random() - 0.5);
    setBlastOptions(allOpts);
    setBlastTimeLeft(blastTimerSeconds);
    setIsBlastOptionsRevealed(!maskBlastOptions);
  }, [vocabList, blastTimerSeconds, maskBlastOptions]);

  useEffect(() => {
    if (mode === "blast" && gameActive) {
      if (blastTimeLeft <= 0) {
        handleWrongAnswer();
        if (blastRound >= 10) {
          finishGame();
        } else {
          setBlastRound((r) => r + 1);
          nextBlastRound();
        }
        return;
      }
      const t = setInterval(() => setBlastTimeLeft((prev) => prev - 1), 1000);
      return () => clearInterval(t);
    }
  }, [mode, gameActive, blastTimeLeft, blastRound, nextBlastRound, finishGame]);

  const handleBlastOptionSelect = (option: string) => {
    if (!gameActive || !blastCurrentWord) return;
    if (option === blastCurrentWord.meaning) {
      handleCorrectAnswer(100 + blastTimeLeft * 20);
      if (autoSpeechOnCorrect) speakJapanese(blastCurrentWord.word, speechSpeed);
    } else {
      handleWrongAnswer();
    }

    if (blastRound >= 10) {
      finishGame();
    } else {
      setBlastRound((r) => r + 1);
      nextBlastRound();
    }
  };

  // ================= MODE 3: TRUE OR FALSE BLITZ (真假快辨) =================
  const [blitzCard, setBlitzCard] = useState<{ word: string; shownMeaning: string; isTrue: boolean } | null>(null);
  const [blitzRound, setBlitzRound] = useState(1);
  const [blitzTimer, setBlitzTimer] = useState(4);

  const startBlitzGame = () => {
    if (soundEnabled) playArcadeSound("click");
    setMode("blitz");
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setBlitzRound(1);
    setGameActive(true);
    setGameFinished(false);
    nextBlitzRound();
  };

  const nextBlitzRound = useCallback(() => {
    const wordObj = vocabList[Math.floor(Math.random() * vocabList.length)];
    const isTrue = Math.random() > 0.45;

    let shownMeaning = wordObj.meaning;
    if (!isTrue) {
      const wrongObj = vocabList.find((v) => v.id !== wordObj.id);
      if (wrongObj) shownMeaning = wrongObj.meaning;
    }

    setBlitzCard({ word: wordObj.word, shownMeaning, isTrue });
    setBlitzTimer(blitzTimerSeconds);
  }, [vocabList, blitzTimerSeconds]);

  useEffect(() => {
    if (mode === "blitz" && gameActive) {
      if (blitzTimer <= 0) {
        handleWrongAnswer();
        if (blitzRound >= 12) {
          finishGame();
        } else {
          setBlitzRound((r) => r + 1);
          nextBlitzRound();
        }
        return;
      }
      const t = setInterval(() => setBlitzTimer((prev) => prev - 1), 1000);
      return () => clearInterval(t);
    }
  }, [mode, gameActive, blitzTimer, blitzRound, nextBlitzRound, finishGame]);

  const handleBlitzChoice = (userChoiceTrue: boolean) => {
    if (!gameActive || !blitzCard) return;
    if (userChoiceTrue === blitzCard.isTrue) {
      handleCorrectAnswer(80 + blitzTimer * 15);
      if (autoSpeechOnCorrect) speakJapanese(blitzCard.word, speechSpeed);
    } else {
      handleWrongAnswer();
    }

    if (blitzRound >= 12) {
      finishGame();
    } else {
      setBlitzRound((r) => r + 1);
      nextBlitzRound();
    }
  };

  // ================= MODE 4: JAPANESE TYPING GAME (日语打字狂飙) =================
  const [scrambleTarget, setScrambleTarget] = useState<WordPair | null>(null);
  const [targetRomaji, setTargetRomaji] = useState("");
  const [typedIndex, setTypedIndex] = useState(0);
  const [scrambleRound, setScrambleRound] = useState(1);
  const [activeVirtualKey, setActiveVirtualKey] = useState<string | null>(null);
  const [typingErrorFlash, setTypingErrorFlash] = useState(false);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState(0);

  const startUnscrambleGame = () => {
    if (soundEnabled) playArcadeSound("click");
    setMode("unscramble");
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setScrambleRound(1);
    setTotalKeystrokes(0);
    setCorrectKeystrokes(0);
    setGameActive(true);
    setGameFinished(false);
    nextUnscrambleRound();
  };

  const nextUnscrambleRound = useCallback(() => {
    const target = vocabList[Math.floor(Math.random() * vocabList.length)];
    setScrambleTarget(target);
    setTypedIndex(0);

    const romajiStr = convertKanaToRomaji(target.reading || target.word);
    setTargetRomaji(romajiStr);
  }, [vocabList]);

  const processTypingKey = useCallback((key: string) => {
    if (!scrambleTarget || !targetRomaji || typedIndex >= targetRomaji.length || !gameActive) return;

    setTotalKeystrokes((prev) => prev + 1);
    setActiveVirtualKey(key);
    setTimeout(() => setActiveVirtualKey(null), 180);

    const expectedKey = targetRomaji[typedIndex].toLowerCase();

    if (key === expectedKey) {
      // Correct keystroke!
      setCorrectKeystrokes((prev) => prev + 1);
      if (soundEnabled) playArcadeSound("click");

      const nextIndex = typedIndex + 1;
      setTypedIndex(nextIndex);

      if (nextIndex === targetRomaji.length) {
        // Round completed!
        handleCorrectAnswer(180);
        if (autoSpeechOnCorrect) speakJapanese(scrambleTarget.word, speechSpeed);
        triggerFloatEffect("⚡ 打字击破! +180", "text-emerald-400 font-extrabold");

        setTimeout(() => {
          if (scrambleRound >= 8) {
            finishGame();
          } else {
            setScrambleRound((r) => r + 1);
            nextUnscrambleRound();
          }
        }, 500);
      }
    } else {
      // Wrong key!
      handleWrongAnswer();
      setTypingErrorFlash(true);
      setTimeout(() => setTypingErrorFlash(false), 300);
      triggerFloatEffect(`❌ 拼错: ${key.toUpperCase()}`, "text-rose-400 font-bold");
    }
  }, [scrambleTarget, targetRomaji, typedIndex, gameActive, soundEnabled, scrambleRound, finishGame, nextUnscrambleRound, handleCorrectAnswer, handleWrongAnswer, triggerFloatEffect]);

  // Global physical keyboard listener for typing game
  useEffect(() => {
    if (mode !== "unscramble" || !gameActive || gameFinished) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key.length === 1 && /[a-z]/.test(key)) {
        e.preventDefault();
        processTypingKey(key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, gameActive, gameFinished, processTypingKey]);

  const currentDeckDisplayName = activeDeckId.startsWith("anki_")
    ? `Anki 牌组: ${activeDeckId.replace("anki_", "")}`
    : PRESET_JAPANESE_DECKS.find((p) => p.id === activeDeckId)?.name || "精选日语词库";

  return (
    <div className="relative space-y-3.5">
      {/* Top Arcade Header Bar */}
      <div className="flex items-center justify-between bg-[var(--rx-bg-elev)] p-2.5 rounded-xl border border-[var(--rx-border-soft)] shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
            <Gamepad2 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-[var(--rx-fg)]">
                互动小游戏背词
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-mono">
                {vocabList.length} 词
              </span>
            </div>
            <p className="text-[10px] text-[var(--rx-fg-dim)] font-medium truncate max-w-[180px]">
              {currentDeckDisplayName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
              soundEnabled
                ? "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20"
                : "bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)]"
            )}
            title={soundEnabled ? "关闭音效" : "开启音效"}
          >
            {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => {
              if (soundEnabled) playArcadeSound("click");
              setSettingsOpen(true);
            }}
            className="p-1.5 rounded-lg border border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] hover:text-amber-500 hover:border-amber-500/30 transition-all cursor-pointer"
            title="游戏小工具参数设置"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>

          {mode !== "menu" && (
            <button
              onClick={() => {
                setGameActive(false);
                setMode("menu");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] text-[11px] text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] transition-all cursor-pointer font-medium"
            >
              返回大厅
            </button>
          )}
        </div>
      </div>

      {/* Floating combo effects layer */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none z-30">
        <AnimatePresence>
          {floatingEffects.map((effect) => (
            <motion.div
              key={effect.id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -45, scale: 1.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className={cn("text-sm font-black whitespace-nowrap shadow-sm", effect.color)}
              style={{ transform: `translate(${effect.x}px, ${effect.y}px)` }}
            >
              {effect.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ARCADE MENU MODE */}
      {mode === "menu" && (
        <div className="space-y-3">
          {/* Vocabulary Deck Switcher Card */}
          <div className="p-3 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-xl space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-amber-500">
                <BookOpen className="h-4 w-4" />
                切换训练词库 / 牌组
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {vocabList.length} 词载入
              </span>
            </div>

            <div className="relative">
              <select
                value={activeDeckId}
                onChange={(e) => {
                  const val = e.target.value;
                  setActiveDeckId(val);
                  if (soundEnabled) playArcadeSound("click");
                }}
                className="w-full bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] text-xs text-[var(--rx-fg)] rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 transition-all font-semibold cursor-pointer appearance-none pr-8 shadow-2xs"
              >
                <optgroup label="✨ 精选预置日语词库 (即开即玩)">
                  {PRESET_JAPANESE_DECKS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.cards.length} 词)
                    </option>
                  ))}
                </optgroup>
                {ankiDecks.length > 0 && (
                  <optgroup label="🗂️ Anki 本地真实牌组">
                    {ankiDecks.map((deckName, idx) => (
                      <option key={`anki_${deckName}_${idx}`} value={`anki_${deckName}`}>
                        Anki 牌组: {deckName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--rx-fg-dim)] text-[10px]">
                ▼
              </div>
            </div>

            {/* Quick preset deck tags for one-click switching */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] no-scrollbar">
              <span className="text-[10px] text-[var(--rx-fg-dim)] shrink-0 font-medium flex items-center gap-0.5">
                <Sparkles className="h-3 w-3 text-amber-500" />
                快速分类:
              </span>
              {PRESET_JAPANESE_DECKS.map((p) => {
                const isSelected = activeDeckId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveDeckId(p.id);
                      if (soundEnabled) playArcadeSound("click");
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0",
                      isSelected
                        ? "bg-amber-500 text-white border-amber-600 shadow-2xs"
                        : "bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)] hover:border-amber-500/30"
                    )}
                  >
                    {p.badge}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-3 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-xl space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-amber-500 font-bold">
                <Zap className="h-3.5 w-3.5" />
                专注微训练 · 游戏背词法
              </span>
              <span className="text-[10px] text-[var(--rx-fg-dim)] font-mono bg-[var(--rx-bg-soft)] px-2 py-0.5 rounded-md border border-[var(--rx-border-soft)]">
                当前可用词库: {vocabList.length} 词
              </span>
            </div>
            <p className="text-[11px] text-[var(--rx-fg-dim)] leading-relaxed">
              利用碎片时间快速复习！结合节奏控速、连击奖励与音效反馈，全面提升记忆留存率与复习专注度。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Game 1: Speed Match */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startMatchGame}
              className="p-3.5 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent text-left space-y-2 hover:border-amber-500/50 transition-all cursor-pointer shadow-sm relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold">
                  40 秒限时
                </span>
              </div>
              <div>
                <h4 className="font-bold text-xs text-[var(--rx-fg)] group-hover:text-amber-500 transition-colors">
                  ⚡ 日汉连连看
                </h4>
                <p className="text-[10px] text-[var(--rx-fg-dim)] mt-0.5">
                  日文单词与中文释义气泡两两配对配对消除！
                </p>
              </div>
            </motion.button>

            {/* Game 2: Meaning Blast */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startBlastGame}
              className="p-3.5 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent text-left space-y-2 hover:border-purple-500/50 transition-all cursor-pointer shadow-sm relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center">
                  <Target className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold">
                  10 轮闪爆
                </span>
              </div>
              <div>
                <h4 className="font-bold text-xs text-[var(--rx-fg)] group-hover:text-purple-500 transition-colors">
                  🎯 极速释义选
                </h4>
                <p className="text-[10px] text-[var(--rx-fg-dim)] mt-0.5">
                  5 秒强力逼近，瞬间选出正确日汉释义！
                </p>
              </div>
            </motion.button>

            {/* Game 3: True False Blitz */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startBlitzGame}
              className="p-3.5 rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent text-left space-y-2 hover:border-rose-500/50 transition-all cursor-pointer shadow-sm relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center">
                  <Flame className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-300 font-bold">
                  3秒直觉
                </span>
              </div>
              <div>
                <h4 className="font-bold text-xs text-[var(--rx-fg)] group-hover:text-rose-500 transition-colors">
                  🔥 日汉真假辨
                </h4>
                <p className="text-[10px] text-[var(--rx-fg-dim)] mt-0.5">
                  释义对错即时辨别，激发直觉记忆！
                </p>
              </div>
            </motion.button>

            {/* Game 4: Japanese Typing Game */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startUnscrambleGame}
              className="p-3.5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent text-left space-y-2 hover:border-emerald-500/50 transition-all cursor-pointer shadow-sm relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                  <Keyboard className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold">
                  打字学日语
                </span>
              </div>
              <div>
                <h4 className="font-bold text-xs text-[var(--rx-fg)] group-hover:text-emerald-500 transition-colors">
                  ⌨️ 日语打字狂飙
                </h4>
                <p className="text-[10px] text-[var(--rx-fg-dim)] mt-0.5">
                  敲击键盘/屏幕按键练习日语罗马字打字！手速盲打强化假名记忆！
                </p>
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {/* GAME RUNNING STATUS BAR */}
      {mode !== "menu" && gameActive && (
        <div className="grid grid-cols-3 items-center px-3 py-2 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-xl text-xs">
          {/* Left: Score & Combo */}
          <div className="flex items-center gap-2.5 justify-start">
            <div className="flex items-center gap-1 font-mono font-bold text-amber-500">
              <Trophy className="h-3.5 w-3.5" />
              <span>{score}</span>
            </div>
            {combo > 1 && (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1.05 }}
                className="flex items-center gap-0.5 text-[11px] font-black text-amber-400 bg-amber-400/15 px-2 py-0.2 rounded-full border border-amber-400/30 shrink-0"
              >
                <Flame className="h-3 w-3 fill-amber-400" />
                <span>COMBO x{combo}</span>
              </motion.div>
            )}
          </div>

          {/* Center: Perfectly Centered Game Mode Tip Popover Button */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <button
                onClick={() => setShowGameTipPopover(!showGameTipPopover)}
                onMouseEnter={() => setShowGameTipPopover(true)}
                className="px-2.5 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-2xs group"
                title="点击/悬停查看玩法技巧与指南"
              >
                <HelpCircle className="h-3 w-3 text-amber-500 group-hover:scale-110 transition-transform" />
                <span className="truncate max-w-[120px] hidden sm:inline-block">
                  {mode === "match" ? "💡 拖动碰一碰 / 连线" : mode === "blast" ? "💡 极速释义技巧" : mode === "blitz" ? "💡 秒杀判定规则" : "💡 盲打狂飙指引"}
                </span>
                <span className="sm:hidden">💡 玩法</span>
              </button>

              <AnimatePresence>
                {showGameTipPopover && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    onMouseLeave={() => setShowGameTipPopover(false)}
                    className="absolute left-1/2 -translate-x-1/2 top-8 z-50 w-72 p-3.5 rounded-2xl bg-[var(--rx-bg-elev)] border border-amber-500/40 shadow-2xl backdrop-blur-md text-xs space-y-2 pointer-events-auto"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--rx-border-soft)] pb-1.5 font-extrabold text-amber-500">
                      <span className="flex items-center gap-1">
                        💡 {mode === "match" ? "极速连连看·玩法指南" : mode === "blast" ? "极速释义选·答题指南" : mode === "blitz" ? "日汉真假辨·秒杀法则" : "日语打字狂飙·输入技巧"}
                      </span>
                      <button onClick={() => setShowGameTipPopover(false)} className="text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {mode === "match" && (
                      <div className="space-y-1.5 text-[11px] text-[var(--rx-fg-dim)] leading-relaxed">
                        <p>✨ <strong>拖动碰一碰：</strong>按住左侧单词气泡，拖拽并碰触右侧对应的释义气泡配对消除！</p>
                        <p>🎯 <strong>点击连连看：</strong>也可分别点击左侧单词与右侧释义快速连线！</p>
                        <p>🔥 <strong>连击加成：</strong>连续快速消除可激活 COMBO 翻倍加分与爆特效音！</p>
                      </div>
                    )}

                    {mode === "blast" && (
                      <div className="space-y-1.5 text-[11px] text-[var(--rx-fg-dim)] leading-relaxed">
                        <p>⚡ <strong>秒杀释义：</strong>在倒计时结束前从 4 个选项中快速选出正确释义！</p>
                        <p>🔒 <strong>答案蒙版：</strong>开启蒙版可先在脑海中回忆，点击任意处解锁显示选项！</p>
                      </div>
                    )}

                    {mode === "blitz" && (
                      <div className="space-y-1.5 text-[11px] text-[var(--rx-fg-dim)] leading-relaxed">
                        <p>🔥 <strong>直觉判断：</strong>限时内急速判断显示的单词与释义是否相符！</p>
                        <p>⚡ <strong>决断秒杀：</strong>正确选 True，错误选 False，考验瞬间反应！</p>
                      </div>
                    )}

                    {mode === "unscramble" && (
                      <div className="space-y-1.5 text-[11px] text-[var(--rx-fg-dim)] leading-relaxed">
                        <p>⌨️ <strong>盲打实操：</strong>根据日文字词，敲击物理键盘或屏幕按键完成罗马音拼写！</p>
                        <p>💡 <strong>提示开关：</strong>可在设置中选择开启或隐藏屏幕键盘提示。</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right: Timer / Round Progress */}
          <div className="flex items-center justify-end gap-1 font-mono text-[11px] text-[var(--rx-fg-dim)]">
            <Timer className="h-3.5 w-3.5 text-sky-400" />
            {mode === "match" && (
              <span className={cn(timerSeconds <= 10 && "text-rose-500 font-bold animate-ping")}>
                剩余 {timerSeconds}s
              </span>
            )}
            {mode === "blast" && (
              <span>
                第 {blastRound}/10 轮 ({blastTimeLeft}s)
              </span>
            )}
            {mode === "blitz" && (
              <span>
                第 {blitzRound}/12 轮 ({blitzTimer}s)
              </span>
            )}
            {mode === "unscramble" && <span>第 {scrambleRound}/8 关</span>}
          </div>
        </div>
      )}

      {/* MODE 1: SPEED MATCH GAME BOARD */}
      {mode === "match" && gameActive && (
        <div className="space-y-2.5">
          {/* Subtle精致提示微光条 */}
          <div className="text-[11px] text-center text-amber-500 font-medium py-1 px-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center gap-1 shadow-2xs">
            <span>💡 提示：按住气泡<strong className="font-bold text-amber-400">【拖动碰一碰】</strong>对侧释义，或【点击两端】连连看！</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Left Column: Words */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-[var(--rx-fg-dim)] px-1 uppercase tracking-wider flex items-center justify-between">
                <span>Word (日文单词)</span>
              </div>
              {matchWordTiles.map((tile, tIdx) => {
                const isCleared = clearedPairIds.has(tile.pairId);
                const isSelected = selectedWordTile === tile.id;
                const isHoveredTarget = hoveredTargetTileId === tile.id;

                if (isCleared) {
                  return (
                    <div
                      key={`word_cleared_${tile.id}_${tIdx}`}
                      className="p-2.5 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 text-emerald-500/40 text-xs font-mono text-center line-through select-none"
                    >
                      MATCHED
                    </div>
                  );
                }
                return (
                  <motion.button
                    key={`word_tile_${tile.id}_${tIdx}`}
                    data-tile-type="word"
                    data-tile-id={tile.id}
                    data-pair-id={tile.pairId}
                    drag
                    dragSnapToOrigin
                    dragElastic={0}
                    dragMomentum={false}
                    dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                    onDrag={(e, info) => handleDragTile(e, info, "word")}
                    onDragEnd={(e, info) => handleDragTileEnd(e, info, "word", tile.pairId)}
                    whileDrag={{ scale: 1.08, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.4)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTileClick("word", tile.id, tile.pairId)}
                    className={cn(
                      "w-full p-2.5 rounded-xl border text-xs font-bold text-center cursor-grab active:cursor-grabbing shadow-xs select-none relative touch-none transition-colors duration-150",
                      isSelected
                        ? "bg-amber-500/20 text-amber-500 border-amber-500 font-extrabold ring-2 ring-amber-500/30 scale-102"
                        : isHoveredTarget
                        ? "bg-amber-500/30 text-amber-500 border-amber-500 ring-4 ring-amber-500/50 scale-105 animate-pulse shadow-md"
                        : "bg-[var(--rx-bg-elev)] border-[var(--rx-border-soft)] text-[var(--rx-fg)] hover:border-amber-500/50"
                    )}
                  >
                    {tile.word}
                    {isHoveredTarget && (
                      <span className="absolute -top-2 right-2 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold shadow-xs animate-bounce z-10">
                        ✨ 碰一碰
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Right Column: Meanings */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-[var(--rx-fg-dim)] px-1 uppercase tracking-wider flex items-center justify-between">
                <span>Meaning (中文释义)</span>
              </div>
              {matchMeaningTiles.map((tile, mIdx) => {
                const isCleared = clearedPairIds.has(tile.pairId);
                const isSelected = selectedMeaningTile === tile.id;
                const isHoveredTarget = hoveredTargetTileId === tile.id;

                if (isCleared) {
                  return (
                    <div
                      key={`meaning_cleared_${tile.id}_${mIdx}`}
                      className="p-2.5 rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 text-emerald-500/40 text-xs text-center line-through select-none"
                    >
                      已消除
                    </div>
                  );
                }
                return (
                  <motion.button
                    key={`meaning_tile_${tile.id}_${mIdx}`}
                    data-tile-type="meaning"
                    data-tile-id={tile.id}
                    data-pair-id={tile.pairId}
                    drag
                    dragSnapToOrigin
                    dragElastic={0}
                    dragMomentum={false}
                    dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
                    onDrag={(e, info) => handleDragTile(e, info, "meaning")}
                    onDragEnd={(e, info) => handleDragTileEnd(e, info, "meaning", tile.pairId)}
                    whileDrag={{ scale: 1.08, zIndex: 50, boxShadow: "0 10px 25px -5px rgba(245, 158, 11, 0.4)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTileClick("meaning", tile.id, tile.pairId)}
                    className={cn(
                      "w-full p-2.5 rounded-xl border text-xs text-center cursor-grab active:cursor-grabbing shadow-xs select-none line-clamp-1 relative touch-none transition-colors duration-150",
                      isSelected
                        ? "bg-amber-500/20 text-amber-500 border-amber-500 font-bold ring-2 ring-amber-500/30 scale-102"
                        : isHoveredTarget
                        ? "bg-amber-500/30 text-amber-500 border-amber-500 ring-4 ring-amber-500/50 scale-105 animate-pulse shadow-md"
                        : "bg-[var(--rx-bg-elev)] border-[var(--rx-border-soft)] text-[var(--rx-fg)] hover:border-amber-500/50"
                    )}
                  >
                    {tile.meaning}
                    {isHoveredTarget && (
                      <span className="absolute -top-2 right-2 text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold shadow-xs animate-bounce z-10">
                        ✨ 碰一碰
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: MEANING BLAST GAME BOARD */}
      {mode === "blast" && gameActive && blastCurrentWord && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-b from-purple-500/15 via-purple-500/5 to-transparent border border-purple-500/30 text-center space-y-2 relative overflow-hidden shadow-sm">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-bold font-mono">
              TARGET WORD
            </span>
            <h3 className="text-2xl font-black text-[var(--rx-fg)] tracking-tight">
              {blastCurrentWord.word}
            </h3>
            {blastCurrentWord.phonetic && (
              <p className="text-xs text-[var(--rx-fg-dim)] font-mono">
                {blastCurrentWord.phonetic}
              </p>
            )}

            <Progress
              value={(blastTimeLeft / blastTimerSeconds) * 100}
              className="h-1.5 mt-2 bg-purple-500/20"
            />
          </div>

          <div
            className="grid grid-cols-1 gap-2 relative"
            onClick={() => {
              if (maskBlastOptions && !isBlastOptionsRevealed) {
                if (soundEnabled) playArcadeSound("click");
                setIsBlastOptionsRevealed(true);
              }
            }}
          >
            {/* Interactive Mask Overlay */}
            {maskBlastOptions && !isBlastOptionsRevealed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 rounded-2xl bg-[var(--rx-bg-elev)]/85 backdrop-blur-md border-2 border-dashed border-purple-500/50 cursor-pointer text-center space-y-2 shadow-lg hover:border-purple-400 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center animate-bounce">
                  <EyeOff className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--rx-fg)]">
                    🔒 选项答案蒙版 (回忆思考模式)
                  </h4>
                  <p className="text-[11px] text-purple-400 font-semibold mt-0.5">
                    💡 请先尝试在脑海中思考释义，点击任意位置解封 4 个选项
                  </p>
                </div>
                <span className="text-[10px] px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold animate-pulse border border-purple-500/30">
                  👉 点击显示 4 个释义选项
                </span>
              </motion.div>
            )}

            {blastOptions.map((opt, idx) => (
              <motion.button
                key={`blast_opt_${opt}_${idx}`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  if (maskBlastOptions && !isBlastOptionsRevealed) {
                    e.stopPropagation();
                    if (soundEnabled) playArcadeSound("click");
                    setIsBlastOptionsRevealed(true);
                    return;
                  }
                  handleBlastOptionSelect(opt);
                }}
                className={cn(
                  "w-full p-3 rounded-xl border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] text-xs text-left text-[var(--rx-fg)] font-medium hover:border-purple-500/50 hover:bg-purple-500/10 transition-all cursor-pointer shadow-xs active:bg-purple-500/20",
                  maskBlastOptions &&
                    !isBlastOptionsRevealed &&
                    "filter blur-xs opacity-30 pointer-events-none"
                )}
              >
                <span className="font-mono text-purple-400 font-bold mr-2">
                  0{idx + 1}.
                </span>
                {opt}
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* MODE 3: TRUE FALSE BLITZ GAME BOARD */}
      {mode === "blitz" && gameActive && blitzCard && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-b from-rose-500/15 via-rose-500/5 to-transparent border border-rose-500/30 text-center space-y-3 relative shadow-sm">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold font-mono">
              FAST JUDGMENT 3S
            </span>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-[var(--rx-fg)]">
                {blitzCard.word}
              </h3>
              <p className="text-sm font-semibold text-rose-500 dark:text-rose-300">
                等于："{blitzCard.shownMeaning}" ？
              </p>
            </div>

            <Progress value={(blitzTimer / 4) * 100} className="h-1.5 bg-rose-500/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleBlitzChoice(true)}
              className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm flex flex-col items-center justify-center gap-1 hover:bg-emerald-500/25 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <CheckCircle2 className="h-6 w-6" />
              <span>正确 (True)</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleBlitzChoice(false)}
              className="p-4 rounded-2xl border border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold text-sm flex flex-col items-center justify-center gap-1 hover:bg-rose-500/25 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <XCircle className="h-6 w-6" />
              <span>假骗 (False)</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* MODE 4: JAPANESE TYPING GAME BOARD */}
      {mode === "unscramble" && gameActive && scrambleTarget && (
        <div className="space-y-3.5">
          {/* Header Card with Word Display */}
          <div
            className={cn(
              "p-4 rounded-2xl bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent border text-center space-y-2 shadow-sm transition-all duration-200 relative overflow-hidden",
              typingErrorFlash
                ? "border-rose-500/80 bg-rose-500/20 animate-shake"
                : "border-emerald-500/40"
            )}
          >
            {/* Top Stats Pill */}
            <div className="flex items-center justify-between text-xs font-mono font-bold">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                <Keyboard className="h-3 w-3" />
                第 {scrambleRound} / 8 词
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[var(--rx-fg-dim)]">
                  准确率:{" "}
                  <strong className="text-emerald-500">
                    {totalKeystrokes > 0
                      ? Math.round((correctKeystrokes / totalKeystrokes) * 100)
                      : 100}
                    %
                  </strong>
                </span>
                <button
                  onClick={() => speakJapanese(scrambleTarget.word)}
                  className="p-1 rounded-lg bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-colors cursor-pointer"
                  title="播放发音"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Kanji & Furigana */}
            <div className="py-1 space-y-0.5">
              <span className="text-sm font-bold text-emerald-500/90 font-mono tracking-widest block">
                {scrambleTarget.reading || scrambleTarget.word}
              </span>
              <h3 className="text-2xl font-black text-[var(--rx-fg)] tracking-wide">
                {scrambleTarget.word}
              </h3>
              <p className="text-xs font-semibold text-[var(--rx-fg-dim)]">
                释义: {scrambleTarget.meaning}
              </p>
            </div>

            {/* Interactive Romaji Typing Track */}
            <div className="pt-2 border-t border-[var(--rx-border-soft)]">
              <div className="flex items-center justify-center gap-1.5 flex-wrap font-mono">
                {targetRomaji.split("").map((char, idx) => {
                  const isTyped = idx < typedIndex;
                  const isCurrent = idx === typedIndex;

                  return (
                    <motion.div
                      key={`romaji_${idx}`}
                      initial={false}
                      animate={
                        isCurrent
                          ? { scale: [1, 1.08, 1] }
                          : { scale: 1 }
                      }
                      transition={
                        isCurrent
                          ? { repeat: Infinity, duration: 1 }
                          : { duration: 0.2 }
                      }
                      className={cn(
                        "w-9 h-11 rounded-xl font-black text-lg flex items-center justify-center select-none shadow-xs transition-all relative",
                        isTyped
                          ? "bg-emerald-500 text-purple-950 border border-emerald-400 font-extrabold shadow-emerald-500/20"
                          : isCurrent
                          ? "bg-amber-500 text-purple-950 border-2 border-amber-300 ring-2 ring-amber-500/40 shadow-md font-black"
                          : "bg-[var(--rx-bg-soft)] text-[var(--rx-fg-dim)] border border-[var(--rx-border-soft)]"
                      )}
                    >
                      {char.toUpperCase()}
                      {isCurrent && (
                        <motion.span
                          animate={{ opacity: [1, 0, 1] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                          className="absolute -bottom-1 w-4 h-1 rounded-full bg-amber-400"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Interactive Arcade Keyboard (Touch & Key Visualizer) */}
          <div className="p-3 bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--rx-fg-dim)]">
              <span className="flex items-center gap-1.5 text-amber-500">
                <Keyboard className="h-3.5 w-3.5" />
                敲击键盘字母或下侧按键输入
              </span>
              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                目标按键: {targetRomaji[typedIndex]?.toUpperCase() || "✔"}
              </span>
            </div>

            {showVirtualKeyboard ? (
              /* QWERTY Key Rows */
              <div className="space-y-1.5 pt-1">
                {[
                  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
                  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
                  ["z", "x", "c", "v", "b", "n", "m"],
                ].map((row, rIdx) => (
                  <div key={`row_${rIdx}`} className="flex items-center justify-center gap-1">
                    {row.map((k, kIdx) => {
                      const isNextTarget =
                        targetRomaji[typedIndex]?.toLowerCase() === k;
                      const isActive = activeVirtualKey === k;

                      return (
                        <motion.button
                          key={`kb_${rIdx}_${k}_${kIdx}`}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => processTypingKey(k)}
                          className={cn(
                            "h-10 min-w-[28px] px-2 rounded-lg font-mono font-extrabold text-xs border flex items-center justify-center transition-all cursor-pointer select-none",
                            isActive
                              ? "bg-amber-400 text-purple-950 border-amber-300 scale-110 shadow-md z-10"
                              : isNextTarget
                              ? "bg-amber-500/20 text-amber-500 border-amber-500/80 animate-pulse font-black ring-1 ring-amber-500/40"
                              : "bg-[var(--rx-bg-soft)] border-[var(--rx-border-soft)] text-[var(--rx-fg)] hover:border-amber-500/50 hover:text-amber-500"
                          )}
                        >
                          {k.toUpperCase()}
                        </motion.button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs font-semibold text-[var(--rx-fg-dim)] bg-[var(--rx-bg-soft)] rounded-xl border border-[var(--rx-border-soft)] font-mono">
                ⌨️ 纯盲打模式已开启：请直接在电脑物理键盘上敲击字母输入！
              </div>
            )}
          </div>
        </div>
      )}

      {/* GAME FINISHED / RESULT SCREEN */}
      {gameFinished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 via-[var(--rx-bg-elev)] to-[var(--rx-bg-elev)] text-center space-y-4 shadow-md"
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
            <Trophy className="h-6 w-6 animate-bounce" />
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-[var(--rx-fg)]">
              挑战完成！战果结清
            </h3>
            <p className="text-xs text-[var(--rx-fg-dim)]">
              大脑多巴胺全面释放，记忆印象已深度沉淀！
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--rx-border-soft)]">
            <div className="space-y-0.5">
              <span className="text-[10px] text-[var(--rx-fg-dim)]">最终得分</span>
              <p className="text-base font-extrabold text-amber-500 font-mono">
                {score}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-[var(--rx-fg-dim)]">最高连击</span>
              <p className="text-base font-extrabold text-amber-400 font-mono">
                🔥 x{maxCombo}
              </p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-[var(--rx-fg-dim)]">奖励结算</span>
              <p className="text-xs font-bold text-emerald-500 font-mono">
                +{Math.max(15, Math.floor(score / 10))} XP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={() => {
                setGameFinished(false);
                if (mode === "match") startMatchGame();
                else if (mode === "blast") startBlastGame();
                else if (mode === "blitz") startBlitzGame();
                else if (mode === "unscramble") startUnscrambleGame();
              }}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-purple-950 font-bold text-xs rounded-xl py-2 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              再玩一局
            </Button>

            <Button
              onClick={() => {
                setGameFinished(false);
                setMode("menu");
              }}
              variant="outline"
              className="flex-1 text-xs rounded-xl py-2 cursor-pointer"
            >
              返回大厅
            </Button>
          </div>
        </motion.div>
      )}

      {/* GAME SETTINGS DIALOG MODAL */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => setSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[var(--rx-bg-elev)] border border-[var(--rx-border-soft)] rounded-2xl shadow-xl overflow-hidden text-[var(--rx-fg)]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <Sliders className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--rx-fg)]">
                      ⚙️ 游戏小工具参数设置
                    </h3>
                    <p className="text-[10px] text-[var(--rx-fg-dim)]">
                      自定义语音朗读、难度参数及特定玩法设置
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] hover:bg-[var(--rx-bg-soft)] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Content / Sections */}
              <div className="p-4 space-y-4 max-h-[68vh] overflow-y-auto custom-scrollbar text-xs">
                {/* SECTION 1: AUDIO & VOICE */}
                <div className="p-3 bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-amber-500">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>音效与日语朗读 (Audio & TTS)</span>
                  </div>

                  {/* Setting: Main Sound Effects */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="font-semibold text-xs">游戏物理音效</div>
                      <div className="text-[10px] text-[var(--rx-fg-dim)]">
                        点击、答对、Combo连击合奏音效
                      </div>
                    </div>
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                        soundEnabled
                          ? "bg-amber-500 text-purple-950 border-amber-400"
                          : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)]"
                      )}
                    >
                      {soundEnabled ? "已开启" : "已静音"}
                    </button>
                  </div>

                  {/* Setting: Auto TTS on correct */}
                  <div className="flex items-center justify-between border-t border-[var(--rx-border-soft)] pt-2.5">
                    <div>
                      <div className="font-semibold text-xs">答对自动朗读</div>
                      <div className="text-[10px] text-[var(--rx-fg-dim)]">
                        答对时通过日语 TTS 原声朗读单词
                      </div>
                    </div>
                    <button
                      onClick={() => setAutoSpeechOnCorrect(!autoSpeechOnCorrect)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                        autoSpeechOnCorrect
                          ? "bg-emerald-500 text-purple-950 border-emerald-400"
                          : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)]"
                      )}
                    >
                      {autoSpeechOnCorrect ? "开启" : "关闭"}
                    </button>
                  </div>

                  {/* Setting: Speech Rate */}
                  <div className="border-t border-[var(--rx-border-soft)] pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">日语朗读语速</span>
                      <span className="text-[10px] text-amber-500 font-mono font-bold">
                        {speechSpeed}x 语速
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 font-mono">
                      {[
                        { speed: 0.8, label: "0.8x 慢速" },
                        { speed: 1.0, label: "1.0x 标准" },
                        { speed: 1.2, label: "1.2x 快速" },
                      ].map((item) => (
                        <button
                          key={item.speed}
                          onClick={() => setSpeechSpeed(item.speed)}
                          className={cn(
                            "py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                            speechSpeed === item.speed
                              ? "bg-amber-500 text-purple-950 border-amber-400 font-black shadow-2xs"
                              : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SECTION 2: GAME PARAMETERS */}
                <div className="p-3 bg-[var(--rx-bg-soft)] border border-[var(--rx-border-soft)] rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 font-bold text-amber-500">
                    <Gamepad2 className="h-3.5 w-3.5" />
                    <span>各个小游戏玩法参数设置</span>
                  </div>

                  {/* Match Game Pair Count */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" />
                        日汉连连看：气泡对数
                      </div>
                      <span className="text-[10px] text-amber-500 font-mono font-bold">
                        {matchPairCount} 对/波
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { count: 4, label: "4 对 (轻松)" },
                        { count: 6, label: "6 对 (标准)" },
                        { count: 8, label: "8 对 (高密)" },
                      ].map((item) => (
                        <button
                          key={item.count}
                          onClick={() => setMatchPairCount(item.count)}
                          className={cn(
                            "py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                            matchPairCount === item.count
                              ? "bg-amber-500 text-purple-950 border-amber-400 font-black"
                              : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Meaning Blast Timer */}
                  <div className="border-t border-[var(--rx-border-soft)] pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs flex items-center gap-1">
                        <Target className="h-3 w-3 text-purple-500" />
                        极速释义选：思考限时
                      </div>
                      <span className="text-[10px] text-purple-500 font-mono font-bold">
                        {blastTimerSeconds} 秒/题
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { sec: 3, label: "3 秒 (极限)" },
                        { sec: 5, label: "5 秒 (标准)" },
                        { sec: 8, label: "8 秒 (从容)" },
                      ].map((item) => (
                        <button
                          key={item.sec}
                          onClick={() => setBlastTimerSeconds(item.sec)}
                          className={cn(
                            "py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                            blastTimerSeconds === item.sec
                              ? "bg-purple-500 text-white border-purple-400 font-black"
                              : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Meaning Blast Masking Option */}
                  <div className="border-t border-[var(--rx-border-soft)] pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-xs flex items-center gap-1">
                          <EyeOff className="h-3 w-3 text-purple-500" />
                          极速释义选：答案选项蒙版
                        </div>
                        <div className="text-[10px] text-[var(--rx-fg-dim)]">
                          默认遮挡 4 个释义，先自行回忆，点击任意处解锁显示
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { mask: false, label: "默认显示选项" },
                        { mask: true, label: "开启蒙版 (需点击解锁)" },
                      ].map((item) => (
                        <button
                          key={String(item.mask)}
                          onClick={() => setMaskBlastOptions(item.mask)}
                          className={cn(
                            "py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                            maskBlastOptions === item.mask
                              ? "bg-purple-500 text-white border-purple-400 font-black"
                              : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* True/False Blitz Timer */}
                  <div className="border-t border-[var(--rx-border-soft)] pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs flex items-center gap-1">
                        <Flame className="h-3 w-3 text-rose-500" />
                        日汉真假辨：决断限时
                      </div>
                      <span className="text-[10px] text-rose-500 font-mono font-bold">
                        {blitzTimerSeconds} 秒/题
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { sec: 2, label: "2 秒 (直觉)" },
                        { sec: 3, label: "3 秒 (标准)" },
                        { sec: 5, label: "5 秒 (宽裕)" },
                      ].map((item) => (
                        <button
                          key={item.sec}
                          onClick={() => setBlitzTimerSeconds(item.sec)}
                          className={cn(
                            "py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                            blitzTimerSeconds === item.sec
                              ? "bg-rose-500 text-white border-rose-400 font-black"
                              : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Japanese Typing Virtual Keyboard */}
                  <div className="border-t border-[var(--rx-border-soft)] pt-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs flex items-center gap-1">
                        <Keyboard className="h-3 w-3 text-emerald-500" />
                        日语打字狂飙：屏幕按键提示
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { show: true, label: "显示屏幕按键提示" },
                        { show: false, label: "隐藏键盘 (纯盲打)" },
                      ].map((item) => (
                        <button
                          key={String(item.show)}
                          onClick={() => setShowVirtualKeyboard(item.show)}
                          className={cn(
                            "py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer",
                            showVirtualKeyboard === item.show
                              ? "bg-emerald-500 text-purple-950 border-emerald-400 font-black"
                              : "bg-[var(--rx-bg-elev)] text-[var(--rx-fg-dim)] border-[var(--rx-border-soft)] hover:text-[var(--rx-fg)]"
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between p-3.5 border-t border-[var(--rx-border-soft)] bg-[var(--rx-bg-soft)]/50">
                <button
                  onClick={resetSettings}
                  className="px-3 py-1.5 rounded-lg border border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] text-[11px] font-semibold text-[var(--rx-fg-dim)] hover:text-[var(--rx-fg)] hover:border-amber-500/40 transition-all cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  恢复默认设置
                </button>

                <Button
                  onClick={() => setSettingsOpen(false)}
                  className="bg-amber-500 hover:bg-amber-600 text-purple-950 font-bold px-4 py-1.5 text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  完成并保存
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

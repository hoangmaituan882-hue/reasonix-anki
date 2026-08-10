import DOMPurify from "dompurify";
import type { CardKind, StudyCard } from "../../lib/reasonix-addon/schemas";

export const VOCABULARY_MAPPING_SCHEMA_VERSION = 1;

export type VocabularySemanticField =
  | "expression"
  | "expressionFurigana"
  | "expressionReading"
  | "expressionAudio"
  | "mainDefinition"
  | "glossary"
  | "sentence"
  | "sentenceFurigana"
  | "sentenceAudio"
  | "picture"
  | "pitchPosition"
  | "pitchCategories"
  | "frequency"
  | "selectionText"
  | "hint"
  | "miscInfo"
  | "isWordAndSentenceCard"
  | "isClickCard"
  | "isSentenceCard"
  | "isAudioCard";

export interface VocabularyFieldMapping {
  schemaVersion: typeof VOCABULARY_MAPPING_SCHEMA_VERSION;
  fields: Partial<Record<VocabularySemanticField, string>>;
  templateKinds?: Record<string, CardKind>;
}

export function vocabularyTemplateKey(
  templateOrd: number,
  templateName: string,
): string {
  return `${templateOrd}:${templateName}`;
}

export interface JapaneseWordRecord {
  cardId: number;
  noteId: number;
  deckId: number;
  modelId: number;
  modelName: string;
  templateOrd: number;
  templateName: string;
  cardKind: CardKind;
  expressionHtml: string;
  expressionFuriganaHtml: string;
  expressionReadingHtml: string;
  expressionAudio: string;
  mainDefinitionHtml: string;
  glossaryHtml: string;
  sentenceHtml: string;
  sentenceFuriganaHtml: string;
  sentenceAudio: string;
  pictureHtml: string;
  pitchPosition: string;
  pitchCategories: string;
  frequency: string;
  selectionTextHtml: string;
  hintHtml: string;
  miscInfoHtml: string;
  tags: string[];
}

const STANDARD_FIELD_ALIASES: readonly [
  VocabularySemanticField,
  readonly string[],
][] = [
  ["expression", ["Expression"]],
  ["expressionFurigana", ["ExpressionFurigana"]],
  ["expressionReading", ["ExpressionReading"]],
  ["expressionAudio", ["ExpressionAudio"]],
  ["mainDefinition", ["MainDefinition"]],
  ["glossary", ["Glossary"]],
  ["sentence", ["Sentence"]],
  ["sentenceFurigana", ["SentenceFurigana"]],
  ["sentenceAudio", ["SentenceAudio"]],
  ["picture", ["Picture", "DefinitionPicture"]],
  ["pitchPosition", ["PitchPosition"]],
  ["pitchCategories", ["PitchCategories"]],
  ["frequency", ["Frequency", "FreqSort"]],
  ["selectionText", ["SelectionText"]],
  ["hint", ["Hint"]],
  ["miscInfo", ["MiscInfo"]],
  ["isWordAndSentenceCard", ["IsWordAndSentenceCard"]],
  ["isClickCard", ["IsClickCard"]],
  ["isSentenceCard", ["IsSentenceCard"]],
  ["isAudioCard", ["IsAudioCard"]],
];

export function detectStandardLapisMapping(
  fieldNames: readonly string[],
): VocabularyFieldMapping | null {
  const available = new Set(fieldNames);
  const fields: VocabularyFieldMapping["fields"] = {};

  for (const [semantic, aliases] of STANDARD_FIELD_ALIASES) {
    const field = aliases.find((alias) => available.has(alias));
    if (field) fields[semantic] = field;
  }

  if (!fields.expression || (!fields.mainDefinition && !fields.glossary)) {
    return null;
  }

  return { schemaVersion: VOCABULARY_MAPPING_SCHEMA_VERSION, fields };
}

export function vocabularyFieldSignature(fieldNames: readonly string[]): string {
  return fieldNames.map((field) => `${field.length}:${field}`).join("|");
}

export function inferLapisCardKind(input: {
  cardKind: CardKind;
  templateName: string;
  templateOrd: number;
  fields: Readonly<Record<string, string>>;
}): CardKind {
  if (input.cardKind !== "unknown") return input.cardKind;

  const template = input.templateName.toLocaleLowerCase().replace(/[_-]+/g, " ");
  if (template.includes("audio") || template.includes("listening")) return "audio";
  if (template.includes("click")) return "click";
  if (
    template.includes("sentence") &&
    (template.includes("word") || template.includes("vocabulary"))
  ) {
    return "word_sentence";
  }
  if (template.includes("sentence")) return "sentence";
  if (template.includes("vocabulary") || template.includes("word")) {
    return "vocabulary";
  }

  if (detectStandardLapisMapping(Object.keys(input.fields))) {
    const standardKinds: readonly CardKind[] = [
      "vocabulary",
      "word_sentence",
      "click",
      "sentence",
      "audio",
    ];
    return standardKinds[input.templateOrd] ?? "unknown";
  }

  return "unknown";
}

export function toJapaneseWordRecord(
  card: StudyCard,
  mapping?: VocabularyFieldMapping,
): JapaneseWordRecord | null {
  const activeMapping =
    mapping ?? detectStandardLapisMapping(Object.keys(card.fields));
  if (
    !activeMapping ||
    activeMapping.schemaVersion !== VOCABULARY_MAPPING_SCHEMA_VERSION
  ) {
    return null;
  }

  const field = (semantic: VocabularySemanticField): string => {
    const sourceName = activeMapping.fields[semantic];
    return sourceName ? (card.fields[sourceName] ?? "") : "";
  };
  if (!field("expression") || (!field("mainDefinition") && !field("glossary"))) {
    return null;
  }

  const sanitize = (value: string): string => DOMPurify.sanitize(value);

  return {
    cardId: card.cardId,
    noteId: card.noteId,
    deckId: card.deckId,
    modelId: card.modelId,
    modelName: card.modelName,
    templateOrd: card.templateOrd,
    templateName: card.templateName,
    cardKind:
      activeMapping.templateKinds?.[
        vocabularyTemplateKey(card.templateOrd, card.templateName)
      ] ?? inferLapisCardKind(card),
    expressionHtml: sanitize(field("expression")),
    expressionFuriganaHtml: sanitize(field("expressionFurigana")),
    expressionReadingHtml: sanitize(field("expressionReading")),
    expressionAudio: field("expressionAudio"),
    mainDefinitionHtml: sanitize(field("mainDefinition")),
    glossaryHtml: sanitize(field("glossary")),
    sentenceHtml: sanitize(field("sentence")),
    sentenceFuriganaHtml: sanitize(field("sentenceFurigana")),
    sentenceAudio: field("sentenceAudio"),
    pictureHtml: sanitize(field("picture")),
    pitchPosition: field("pitchPosition"),
    pitchCategories: field("pitchCategories"),
    frequency: field("frequency"),
    selectionTextHtml: sanitize(field("selectionText")),
    hintHtml: sanitize(field("hint")),
    miscInfoHtml: sanitize(field("miscInfo")),
    tags: [...card.tags],
  };
}

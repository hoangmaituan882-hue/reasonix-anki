import { useMemo, useState } from "react";
import { ArrowRight, Link2, SlidersHorizontal } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@reasonix/ui";
import type { CardKind, StudyCard } from "../../lib/reasonix-addon/schemas";
import {
  VOCABULARY_MAPPING_SCHEMA_VERSION,
  type VocabularyFieldMapping,
  type VocabularySemanticField,
  vocabularyTemplateKey,
} from "./lapisAdapter";

type OptionalMapping = Partial<Record<VocabularySemanticField, string | null>>;

export function buildVocabularyMapping(input: {
  expression: string | null;
  mainDefinition: string | null;
  glossary: string | null;
  templateOrd: number;
  templateName: string;
  cardKind: CardKind;
  optionalFields?: OptionalMapping;
}): VocabularyFieldMapping | null {
  if (!input.expression || (!input.mainDefinition && !input.glossary)) {
    return null;
  }
  const fields: VocabularyFieldMapping["fields"] = {
    expression: input.expression,
  };
  if (input.mainDefinition) fields.mainDefinition = input.mainDefinition;
  if (input.glossary) fields.glossary = input.glossary;
  for (const [semantic, source] of Object.entries(input.optionalFields ?? {})) {
    if (source && !fields[semantic as VocabularySemanticField]) {
      fields[semantic as VocabularySemanticField] = source;
    }
  }
  return {
    schemaVersion: VOCABULARY_MAPPING_SCHEMA_VERSION,
    fields,
    templateKinds: {
      [vocabularyTemplateKey(input.templateOrd, input.templateName)]: input.cardKind,
    },
  };
}

const NONE = "__none__";

const OPTIONAL_FIELDS: readonly {
  semantic: VocabularySemanticField;
  label: string;
  guesses: readonly string[];
}[] = [
  { semantic: "expressionFurigana", label: "振假名", guesses: ["furigana", "wordfurigana", "词条假名"] },
  { semantic: "expressionReading", label: "纯读音", guesses: ["reading", "kana", "读音"] },
  { semantic: "expressionAudio", label: "词条音频", guesses: ["audio", "wordaudio", "词条音频"] },
  { semantic: "sentence", label: "例句", guesses: ["sentence", "example", "例句"] },
  { semantic: "sentenceFurigana", label: "例句振假名", guesses: ["sentencefurigana", "examplefurigana", "例句假名"] },
  { semantic: "sentenceAudio", label: "例句音频", guesses: ["sentenceaudio", "exampleaudio", "例句音频"] },
  { semantic: "picture", label: "图片", guesses: ["picture", "image", "definitionpicture", "图片"] },
  { semantic: "pitchCategories", label: "音调", guesses: ["pitch", "pitchcategories", "accent", "音调"] },
  { semantic: "frequency", label: "频率", guesses: ["frequency", "freqsort", "频率"] },
];

function guessField(fieldNames: readonly string[], guesses: readonly string[]): string | null {
  const normalized = new Map(fieldNames.map((field) => [field.toLocaleLowerCase().replace(/\s+/g, ""), field]));
  for (const guess of guesses) {
    const exact = normalized.get(guess.toLocaleLowerCase().replace(/\s+/g, ""));
    if (exact) return exact;
  }
  for (const field of fieldNames) {
    const normalizedField = field.toLocaleLowerCase().replace(/\s+/g, "");
    if (guesses.some((guess) => normalizedField.includes(guess.toLocaleLowerCase().replace(/\s+/g, "")))) {
      return field;
    }
  }
  return null;
}

function FieldSelect({
  label,
  value,
  fieldNames,
  required,
  onChange,
}: {
  label: string;
  value: string | null;
  fieldNames: readonly string[];
  required?: boolean;
  onChange(value: string | null): void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="ml-1 text-[var(--rx-err)]">*</span>}
      </Label>
      <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue placeholder="不映射" />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>不映射</SelectItem>}
          {fieldNames.map((field) => (
            <SelectItem key={field} value={field}>{field}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function MappingWizard({
  card,
  error,
  onConfirm,
}: {
  card: StudyCard;
  error?: string | null;
  onConfirm(mapping: VocabularyFieldMapping): void;
}) {
  const fieldNames = useMemo(() => Object.keys(card.fields), [card.fields]);
  const [expression, setExpression] = useState<string | null>(() =>
    guessField(fieldNames, ["expression", "word", "term", "vocabulary", "词条", "单词"]),
  );
  const [mainDefinition, setMainDefinition] = useState<string | null>(() =>
    guessField(fieldNames, ["maindefinition", "meaning", "definition", "释义", "解释"]),
  );
  const [glossary, setGlossary] = useState<string | null>(() =>
    guessField(fieldNames, ["glossary", "dictionary", "词典"]),
  );
  const [cardKind, setCardKind] = useState<CardKind>(
    card.cardKind === "unknown" ? "vocabulary" : card.cardKind,
  );
  const [optional, setOptional] = useState<OptionalMapping>(() =>
    Object.fromEntries(
      OPTIONAL_FIELDS.map(({ semantic, guesses }) => [semantic, guessField(fieldNames, guesses)]),
    ),
  );
  const valid = Boolean(expression && (mainDefinition || glossary));

  const confirm = () => {
    const mapping = buildVocabularyMapping({
      expression,
      mainDefinition,
      glossary,
      templateOrd: card.templateOrd,
      templateName: card.templateName,
      cardKind,
      optionalFields: optional,
    });
    if (mapping) onConfirm(mapping);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <Card className="mx-auto max-w-3xl border-[var(--rx-border-soft)] bg-[var(--rx-bg-elev)] rx-anim-modal">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[var(--rx-r-m)] rx-accent-soft">
            <Link2 className="h-5 w-5 text-[var(--rx-accent)]" />
          </div>
          <CardTitle>一次性字段映射</CardTitle>
          <CardDescription>
            模型“{card.modelName}”不是标准 Lapis。Reasonix 不会修改原笔记；映射仅保存在当前 Anki Profile 下，字段结构变化后自动失效。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert><AlertDescription>{error}</AlertDescription></Alert>
          )}
          <section className="grid gap-4 sm:grid-cols-2">
            <FieldSelect label="词条" required value={expression} fieldNames={fieldNames} onChange={setExpression} />
            <FieldSelect label="核心释义" value={mainDefinition} fieldNames={fieldNames} onChange={setMainDefinition} />
            <FieldSelect label="完整词典" value={glossary} fieldNames={fieldNames} onChange={setGlossary} />
            <div className="space-y-1.5">
              <Label>当前模板语义</Label>
              <Select value={cardKind} onValueChange={(value) => setCardKind(value as CardKind)}>
                <SelectTrigger className="w-full" aria-label="当前模板语义"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vocabulary">词汇卡</SelectItem>
                  <SelectItem value="word_sentence">词句卡</SelectItem>
                  <SelectItem value="click">点击卡</SelectItem>
                  <SelectItem value="sentence">句子卡</SelectItem>
                  <SelectItem value="audio">听力卡</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <details className="group rounded-[var(--rx-r-m)] border border-[var(--rx-border-soft)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4" />
              补充字段
            </summary>
            <div className="grid gap-4 border-t border-[var(--rx-border-soft)] p-4 sm:grid-cols-2">
              {OPTIONAL_FIELDS.map(({ semantic, label }) => (
                <FieldSelect
                  key={semantic}
                  label={label}
                  value={optional[semantic] ?? null}
                  fieldNames={fieldNames}
                  onChange={(value) => setOptional((current) => ({ ...current, [semantic]: value }))}
                />
              ))}
            </div>
          </details>

          <div className="flex items-center justify-between gap-4 border-t border-[var(--rx-border-soft)] pt-5">
            <p className="text-xs text-[var(--rx-fg-faint)]">词条必填；核心释义与完整词典至少选择一个。</p>
            <Button disabled={!valid} onClick={confirm}>
              保存并继续
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

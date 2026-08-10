import { describe, expect, it } from "vitest";
import lapisFixture from "../../../reasonix-addon/fixtures/lapis-qa-sample.json";
import sessionNextFixture from "../../../protocol/fixtures/v1/session-next.response.json";
import { parseSessionNextResponse } from "../../lib/reasonix-addon/schemas";
import {
  detectStandardLapisMapping,
  inferLapisCardKind,
  toJapaneseWordRecord,
  vocabularyFieldSignature,
  vocabularyTemplateKey,
} from "./lapisAdapter";

describe("detectStandardLapisMapping", () => {
  it("recognizes the standard Lapis fields without a mapping wizard", () => {
    const mapping = detectStandardLapisMapping(lapisFixture.fields);

    expect(mapping).not.toBeNull();
    expect(mapping?.fields).toMatchObject({
      expression: "Expression",
      expressionFurigana: "ExpressionFurigana",
      expressionReading: "ExpressionReading",
      expressionAudio: "ExpressionAudio",
      mainDefinition: "MainDefinition",
      glossary: "Glossary",
      sentence: "Sentence",
      sentenceFurigana: "SentenceFurigana",
      sentenceAudio: "SentenceAudio",
      picture: "Picture",
      pitchPosition: "PitchPosition",
      pitchCategories: "PitchCategories",
      frequency: "Frequency",
      selectionText: "SelectionText",
      hint: "Hint",
      miscInfo: "MiscInfo",
      isWordAndSentenceCard: "IsWordAndSentenceCard",
      isClickCard: "IsClickCard",
      isSentenceCard: "IsSentenceCard",
      isAudioCard: "IsAudioCard",
    });
  });

  it("accepts the documented picture and frequency aliases", () => {
    const fields = lapisFixture.fields.map((field) => {
      if (field === "Picture") return "DefinitionPicture";
      if (field === "Frequency") return "FreqSort";
      return field;
    });

    const mapping = detectStandardLapisMapping(fields);

    expect(mapping?.fields.picture).toBe("DefinitionPicture");
    expect(mapping?.fields.frequency).toBe("FreqSort");
  });
});

describe("vocabularyFieldSignature", () => {
  it("changes when the model field schema changes", () => {
    const original = vocabularyFieldSignature(lapisFixture.fields);
    const changed = vocabularyFieldSignature([...lapisFixture.fields, "Source"]);

    expect(original).not.toBe("");
    expect(changed).not.toBe(original);
    expect(vocabularyFieldSignature(lapisFixture.fields)).toBe(original);
  });
});

describe("inferLapisCardKind", () => {
  it("recognizes all preserved Lapis template semantics", () => {
    const note = lapisFixture.notes[0];

    for (const card of note.cards) {
      expect(
        inferLapisCardKind({
          cardKind: "unknown",
          templateName: card.templateName,
          templateOrd: card.templateOrd,
          fields: note.fields,
        }),
      ).toBe(card.cardKind);
    }
  });
});

describe("toJapaneseWordRecord", () => {
  it("recomposes a standard Lapis card without configuration", () => {
    const card = parseSessionNextResponse(sessionNextFixture).result.card;

    const record = toJapaneseWordRecord(card);

    expect(record).toMatchObject({
      cardId: card.cardId,
      cardKind: "vocabulary",
      expressionHtml: "人間",
      expressionFuriganaHtml: "<ruby>人間<rt>にんげん</rt></ruby>",
      expressionReadingHtml: "にんげん",
      mainDefinitionHtml: "<ol><li>人类；人。</li></ol>",
      sentenceHtml: "人間は社会の中で生きている。",
      tags: ["Lapis", "ReasonixQA"],
    });
  });

  it("uses an explicit mapping for a non-standard model", () => {
    const source = parseSessionNextResponse(sessionNextFixture).result.card;
    const card = {
      ...source,
      modelName: "自制日语",
      fields: { Word: "猫", Meaning: "<b>猫；cat</b>" },
    };

    const record = toJapaneseWordRecord(card, {
      schemaVersion: 1,
      fields: { expression: "Word", mainDefinition: "Meaning" },
      templateKinds: {
        [vocabularyTemplateKey(card.templateOrd, card.templateName)]: "audio",
      },
    });

    expect(record?.expressionHtml).toBe("猫");
    expect(record?.mainDefinitionHtml).toBe("<b>猫；cat</b>");
    expect(record?.cardKind).toBe("audio");
  });

  it("sanitizes untrusted field HTML before native rendering", () => {
    const source = parseSessionNextResponse(sessionNextFixture).result.card;
    const card = {
      ...source,
      fields: {
        ...source.fields,
        MainDefinition:
          '<img src="definition.png" onerror="window.pwned=true"><script>window.pwned=true</script><b>安全释义</b>',
      },
    };

    const record = toJapaneseWordRecord(card);

    expect(record?.mainDefinitionHtml).toContain("安全释义");
    expect(record?.mainDefinitionHtml).toContain("definition.png");
    expect(record?.mainDefinitionHtml).not.toContain("onerror");
    expect(record?.mainDefinitionHtml).not.toContain("script");
  });
});

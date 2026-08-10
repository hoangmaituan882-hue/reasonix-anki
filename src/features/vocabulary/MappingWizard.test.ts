import { describe, expect, it } from "vitest";
import { buildVocabularyMapping } from "./MappingWizard";

describe("buildVocabularyMapping", () => {
  it("requires a word and at least one definition source", () => {
    expect(
      buildVocabularyMapping({
        expression: null,
        mainDefinition: "Meaning",
        glossary: null,
        templateOrd: 0,
        templateName: "Recognition",
        cardKind: "vocabulary",
      }),
    ).toBeNull();
    expect(
      buildVocabularyMapping({
        expression: "Word",
        mainDefinition: null,
        glossary: null,
        templateOrd: 0,
        templateName: "Recognition",
        cardKind: "vocabulary",
      }),
    ).toBeNull();
  });

  it("records the confirmed field and template semantics", () => {
    expect(
      buildVocabularyMapping({
        expression: "Word",
        mainDefinition: "Meaning",
        glossary: "Dictionary",
        templateOrd: 2,
        templateName: "Listening",
        cardKind: "audio",
      }),
    ).toEqual({
      schemaVersion: 1,
      fields: {
        expression: "Word",
        mainDefinition: "Meaning",
        glossary: "Dictionary",
      },
      templateKinds: { "2:Listening": "audio" },
    });
  });
});

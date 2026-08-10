import { describe, expect, it } from "vitest";
import type { VocabularyFieldMapping } from "../../features/vocabulary/lapisAdapter";
import {
  type MappingDatabase,
  VocabularyMappingRepository,
} from "./mappings";

class FakeDatabase implements MappingDatabase {
  readonly executions: { query: string; values: unknown[] }[] = [];
  rows: unknown[] = [];

  async execute(query: string, bindValues: unknown[] = []): Promise<void> {
    this.executions.push({ query, values: bindValues });
  }

  async select<T>(): Promise<T> {
    return this.rows as T;
  }
}

const mapping: VocabularyFieldMapping = {
  schemaVersion: 1,
  fields: { expression: "Word", mainDefinition: "Meaning" },
};

describe("VocabularyMappingRepository", () => {
  it("persists a profile-scoped model mapping and reloads it", async () => {
    const database = new FakeDatabase();
    const repository = new VocabularyMappingRepository(database);

    await repository.initialize();
    await repository.save({
      profileKey: "profile-a",
      modelId: 42,
      fieldNames: ["Word", "Meaning"],
      mapping,
    });

    expect(database.executions[0]?.query).toContain(
      "CREATE TABLE IF NOT EXISTS vocabulary_mappings",
    );
    expect(database.executions[1]?.query).toContain("INSERT INTO vocabulary_mappings");
    expect(database.executions[1]?.values.slice(0, 3)).toEqual([
      "profile-a",
      42,
      1,
    ]);

    const [, , , fieldSignature, mappingJson] = database.executions[1].values;
    database.rows = [
      { field_signature: fieldSignature, mapping_json: mappingJson },
    ];

    await expect(
      repository.load({
        profileKey: "profile-a",
        modelId: 42,
        fieldNames: ["Word", "Meaning"],
      }),
    ).resolves.toEqual(mapping);
  });

  it("invalidates a saved mapping when model fields change", async () => {
    const database = new FakeDatabase();
    database.rows = [
      {
        field_signature: "4:Word|7:Meaning",
        mapping_json: JSON.stringify(mapping),
      },
    ];
    const repository = new VocabularyMappingRepository(database);

    await expect(
      repository.load({
        profileKey: "profile-a",
        modelId: 42,
        fieldNames: ["Word", "Meaning", "Source"],
      }),
    ).resolves.toBeNull();
  });
});

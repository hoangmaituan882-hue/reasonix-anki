import Database from "@tauri-apps/plugin-sql";
import {
  VOCABULARY_MAPPING_SCHEMA_VERSION,
  type VocabularyFieldMapping,
  vocabularyFieldSignature,
} from "../../features/vocabulary/lapisAdapter";

export interface MappingDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

interface MappingRow {
  field_signature: string;
  mapping_json: string;
}

export class VocabularyMappingRepository {
  constructor(private readonly database: MappingDatabase) {}

  async initialize(): Promise<void> {
    await this.database.execute(`
      CREATE TABLE IF NOT EXISTS vocabulary_mappings (
        profile_key    TEXT NOT NULL,
        model_id       INTEGER NOT NULL,
        schema_version INTEGER NOT NULL,
        field_signature TEXT NOT NULL,
        mapping_json   TEXT NOT NULL,
        updated_at     INTEGER NOT NULL,
        PRIMARY KEY (profile_key, model_id, schema_version)
      )
    `);
  }

  async save(input: {
    profileKey: string;
    modelId: number;
    fieldNames: readonly string[];
    mapping: VocabularyFieldMapping;
  }): Promise<void> {
    if (input.mapping.schemaVersion !== VOCABULARY_MAPPING_SCHEMA_VERSION) {
      throw new Error("不支持的词条映射版本");
    }
    await this.database.execute(
      `INSERT INTO vocabulary_mappings
         (profile_key, model_id, schema_version, field_signature, mapping_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_key, model_id, schema_version) DO UPDATE SET
         field_signature = excluded.field_signature,
         mapping_json = excluded.mapping_json,
         updated_at = excluded.updated_at`,
      [
        input.profileKey,
        input.modelId,
        input.mapping.schemaVersion,
        vocabularyFieldSignature(input.fieldNames),
        JSON.stringify(input.mapping),
        Date.now(),
      ],
    );
  }

  async load(input: {
    profileKey: string;
    modelId: number;
    fieldNames: readonly string[];
  }): Promise<VocabularyFieldMapping | null> {
    const rows = await this.database.select<MappingRow[]>(
      `SELECT field_signature, mapping_json
       FROM vocabulary_mappings
       WHERE profile_key = ? AND model_id = ? AND schema_version = ?`,
      [input.profileKey, input.modelId, VOCABULARY_MAPPING_SCHEMA_VERSION],
    );
    const row = rows[0];
    if (
      !row ||
      row.field_signature !== vocabularyFieldSignature(input.fieldNames)
    ) {
      return null;
    }

    try {
      const parsed = JSON.parse(row.mapping_json) as unknown;
      if (!isVocabularyFieldMapping(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

function isVocabularyFieldMapping(value: unknown): value is VocabularyFieldMapping {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    schemaVersion?: unknown;
    fields?: unknown;
  };
  if (
    candidate.schemaVersion !== VOCABULARY_MAPPING_SCHEMA_VERSION ||
    !candidate.fields ||
    typeof candidate.fields !== "object"
  ) {
    return false;
  }
  return Object.values(candidate.fields).every(
    (fieldName) => typeof fieldName === "string" && fieldName.length > 0,
  );
}

let repositoryPromise: Promise<VocabularyMappingRepository> | null = null;

export async function vocabularyMappings(): Promise<VocabularyMappingRepository> {
  if (!repositoryPromise) {
    repositoryPromise = (async () => {
      const database = await Database.load("sqlite:reasonix-stats.db");
      const repository = new VocabularyMappingRepository(database);
      await repository.initialize();
      return repository;
    })();
  }
  return repositoryPromise;
}

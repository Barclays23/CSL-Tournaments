import { createSeasonDatabase, type SeasonMockDatabase } from "@/mocks/seasonSeed";

const DB_KEY = "csl-season-preview-db-v1";
let memory: SeasonMockDatabase | null = null;

function loadDatabase(): SeasonMockDatabase {
  if (memory) return memory;
  if (typeof window === "undefined") {
    memory = createSeasonDatabase();
    return memory;
  }
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      memory = JSON.parse(raw) as SeasonMockDatabase;
      return memory;
    }
  } catch {
    memory = null;
  }
  memory = createSeasonDatabase();
  window.localStorage.setItem(DB_KEY, JSON.stringify(memory));
  return memory;
}

export function readSeasonDb(): SeasonMockDatabase {
  return structuredClone(loadDatabase());
}

export function commitSeasonDb(database: SeasonMockDatabase): void {
  memory = database;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(database));
  } catch {
    throw new Error("Season preview storage is full. Reset the sample data and try again.");
  }
}

export function resetSeasonPreviewData(): SeasonMockDatabase {
  memory = createSeasonDatabase();
  if (typeof window !== "undefined") window.localStorage.setItem(DB_KEY, JSON.stringify(memory));
  return structuredClone(memory);
}

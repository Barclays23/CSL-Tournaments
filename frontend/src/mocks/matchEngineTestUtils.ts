import { readDb, resetPreviewData, writeSession } from "./store.js";
import { commitSeasonDb, readSeasonDb } from "./seasonStore.js";
import type { MockSeasonMatch } from "./seasonSeed.js";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, String(value)); },
  };
}

export function resetMockSeasonRepositoryState(): void {
  const local = memoryStorage();
  const session = memoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { localStorage: local, sessionStorage: session } as unknown as Window,
  });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: local });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, writable: true, value: session });

  resetPreviewData();
  writeSession(readDb().user);
}

export function seedMockSeasonMatch(
  overrides: Partial<MockSeasonMatch> = {},
): { seasonId: string; match: MockSeasonMatch } {
  const database = readSeasonDb();
  const season = database.seasons.find((item) => item.status === "active");
  if (!season) throw new Error("The mock test database must contain an Active Season.");
  const template = database.matches.find((item) => item.seasonRef === season._id && item.stage === "group");
  if (!template) throw new Error("The mock test database must contain a Group Stage fixture.");

  const match: MockSeasonMatch = {
    ...template,
    _id: "f00000000000000000000001",
    matchNumber: 990,
    roundNumber: 99,
    status: "live",
    actualStartedAt: "2026-11-20T12:00:00.000Z",
    phase: "first_half",
    clock: {
      isRunning: false,
      clockStartedAt: null,
      periodElapsedSecondsByPeriod: {
        firstHalf: 600,
        secondHalf: 0,
        extraTimeFirstHalf: 0,
        extraTimeSecondHalf: 0,
      },
    },
    goals: [],
    cards: [],
    penaltyShootout: null,
    winnerSeasonTeamRef: null,
    resolutionHistory: [],
    statusHistory: [],
    correctionHistory: [],
    auditHistory: [],
    eventAuditHistory: [],
    ...overrides,
  };

  database.matches.push(match);
  commitSeasonDb(database);
  return { seasonId: season._id, match };
}

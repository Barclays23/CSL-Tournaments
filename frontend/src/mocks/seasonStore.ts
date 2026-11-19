import { createSeasonDatabase, type MockVenue, type SeasonMockDatabase } from "@/mocks/seasonSeed";
import type { Asset } from "@/types/api.types";
import { createMockObjectId } from "@/mocks/objectId";

const DB_KEY = "csl-season-preview-db-v4";
let memory: SeasonMockDatabase | null = null;

function withoutInlineImage(asset: Asset | null | undefined): Asset | null {
  if (!asset) return asset ?? null;
  return asset.url.startsWith("data:") ? null : asset;
}

/**
 * Team and player documents are the authoritative owners of uploaded image bytes.
 * SeasonTeam and award snapshots keep their other historical fields, but avoid
 * persisting another Base64 copy of those same images in the season preview store.
 */
function compactSeasonDatabase(database: SeasonMockDatabase): SeasonMockDatabase {
  return {
    ...database,
    teams: database.teams.map((team) => ({
      ...team,
      logo: withoutInlineImage(team.logo),
      poster: withoutInlineImage(team.poster),
    })),
    seasonTeams: database.seasonTeams.map((team) => ({
      ...team,
      logoSnapshot: withoutInlineImage(team.logoSnapshot),
    })),
    awards: database.awards.map((award) => ({
      ...award,
      recipients: award.recipients.map((recipient) => ({
        ...recipient,
        profileImageSnapshot: withoutInlineImage(recipient.profileImageSnapshot),
        teamLogoSnapshot: withoutInlineImage(recipient.teamLogoSnapshot),
      })),
    })),
  };
}

function loadDatabase(): SeasonMockDatabase {
  if (memory) return memory;
  if (typeof window === "undefined") {
    memory = compactSeasonDatabase(createSeasonDatabase());
    return memory;
  }
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<SeasonMockDatabase>;
      const seeded = createSeasonDatabase();
      const availableSeasons = Array.isArray(stored.seasons) ? stored.seasons : seeded.seasons;
      const availableSeasonTeams = Array.isArray(stored.seasonTeams) ? stored.seasonTeams : seeded.seasonTeams;
      const storedMatches = Array.isArray(stored.matches) ? stored.matches : seeded.matches;
      const usedMatchIds = new Set<string>();
      const normalizedMatches = storedMatches.map((match: any) => {
        const storedId = typeof match._id === "string" ? match._id : "";
        const matchId = !storedId || usedMatchIds.has(storedId)
          ? createMockObjectId(usedMatchIds)
          : storedId;
        usedMatchIds.add(matchId);
        const isScheduled = match.status === "scheduled";
        return {
          ...match,
          _id: matchId,
          goals: isScheduled ? [] : Array.isArray(match.goals) ? match.goals : [],
          winnerSeasonTeamRef: isScheduled ? null : match.winnerSeasonTeamRef ?? null,
        };
      });
      const availableVenues: MockVenue[] = Array.isArray(stored.venues) ? stored.venues : [...seeded.venues];
      if (availableVenues.length === 0) availableVenues.push(...seeded.venues);
      for (const match of storedMatches) {
        const venueName = String((match as any).venue ?? "").trim();
        if (!venueName || availableVenues.some((venue) => venue.name.trim().toLowerCase() === venueName.toLowerCase())) continue;
        let hash = 0;
        for (const character of venueName) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
        availableVenues.push({ _id: "000000000000" + hash.toString(16).padStart(12, "0"), name: venueName, location: null, notes: "Migrated from existing mock fixture", status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }
      const availablePlayers = Array.isArray(stored.players) ? stored.players.map((player: any) => ({
        _id: player._id, __v: player.__v ?? 0, name: player.name,
        mobile: player.mobile ?? null, email: player.email ?? null, dateOfBirth: player.dateOfBirth ?? null,
        profilePic: player.profilePic ?? null, status: player.status === "inactive" ? "inactive" : "active",
        notes: player.notes ?? null, createdAt: player.createdAt ?? new Date().toISOString(),
        updatedAt: player.updatedAt ?? new Date().toISOString(),
      })) : seeded.players;
      // v4 previews created before awards were introduced have no "awards" key.
      // Migrate in place and seed the sample historical awards without replacing
      // any existing users, teams, registrations, fixtures or auction activity.
      memory = {
        ...seeded,
        ...stored,
        users: Array.isArray(stored.users) ? stored.users : seeded.users,
        teams: Array.isArray(stored.teams) ? stored.teams : seeded.teams,
        players: Array.isArray(stored.players) ? stored.players.map((player: any) => ({
          _id: player._id, __v: player.__v ?? 0, name: player.name,
          mobile: player.mobile ?? null, email: player.email ?? null,
          dateOfBirth: player.dateOfBirth ?? null, profilePic: player.profilePic ?? null,
          status: player.status === "inactive" ? "inactive" : "active",
          notes: player.notes ?? null, createdAt: player.createdAt ?? new Date().toISOString(),
          updatedAt: player.updatedAt ?? new Date().toISOString(),
        })) : seeded.players,
        managers: Array.isArray(stored.managers) ? stored.managers : seeded.managers,
        sponsors: Array.isArray(stored.sponsors) ? stored.sponsors : seeded.sponsors,
        organizers: Array.isArray(stored.organizers) ? stored.organizers : seeded.organizers,
        seasons: Array.isArray(stored.seasons) ? stored.seasons.map((season: any) => ({ ...season, homeAndAwayFixtures: season.homeAndAwayFixtures ?? false })) : seeded.seasons,
        seasonTeams: Array.isArray(stored.seasonTeams) ? stored.seasonTeams : seeded.seasonTeams,
        auctionLots: Array.isArray(stored.auctionLots) ? stored.auctionLots : seeded.auctionLots,
        matches: normalizedMatches.map((match: any) => {
          const venue = availableVenues.find((item) => item._id === match.venueRef)
            ?? availableVenues.find((item) => item.name.trim().toLowerCase() === String(match.venue ?? "").trim().toLowerCase())
            ?? availableVenues[0];
          return { ...match, roundNumber: Number.isInteger(match.roundNumber) && match.roundNumber > 0 ? match.roundNumber : 1, venueRef: venue._id, venue: venue.name };
        }),
        groups: Array.isArray(stored.groups) ? stored.groups : seeded.groups,
        venues: availableVenues,
        awards: Array.isArray(stored.awards) ? stored.awards : seeded.awards.filter((award) =>
          availableSeasons.some((season) => season._id === award.seasonRef) &&
          award.recipients.every((recipient) => availableSeasonTeams.some((team) => team._id === recipient.seasonTeamRef) && (!recipient.playerRef || availablePlayers.some((player) => player._id === recipient.playerRef))),
        ),
      };
      // Compact old preview records in memory. The next normal commit persists the
      // smaller representation without deleting seasons, registrations or history.
      memory = compactSeasonDatabase(memory);
      return memory;
    }
  } catch {
    memory = null;
  }
  memory = compactSeasonDatabase(createSeasonDatabase());
  window.localStorage.setItem(DB_KEY, JSON.stringify(memory));
  return memory;
}

export function readSeasonDb(): SeasonMockDatabase {
  return structuredClone(loadDatabase());
}

export function commitSeasonDb(database: SeasonMockDatabase): void {
  const compacted = compactSeasonDatabase(database);
  if (typeof window !== "undefined") {
    try {
      // Persist first: if storage is still full, keep the last saved in-memory state.
      window.localStorage.setItem(DB_KEY, JSON.stringify(compacted));
    } catch {
      throw new Error("Season preview storage is full. Remove a large uploaded image or free browser storage, then try again.");
    }
  }
  memory = compacted;
}

export function resetSeasonPreviewData(): SeasonMockDatabase {
  memory = createSeasonDatabase();
  if (typeof window !== "undefined") window.localStorage.setItem(DB_KEY, JSON.stringify(memory));
  return structuredClone(memory);
}

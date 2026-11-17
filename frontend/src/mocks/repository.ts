import type { ApiResponse, Pagination } from "@/types/api.types";
import type { AdminUser } from "@/types/auth.types";
import type { AdminManager, ManagerQuery, ManagerWrite, PublicManager } from "@/types/manager.types";
import type { GoalWrite, Match, MatchQuery, MatchWrite } from "@/types/match.types";
import type { PlayerBrief } from "@/types/match.types";
import type { AdminPlayer, PlayerQuery, PlayerWrite, PublicPlayer } from "@/types/player.types";
import type { SettingsUpdate } from "@/types/settings.types";
import type { AdminSponsor, PublicSponsor, SponsorQuery, SponsorWrite } from "@/types/sponsor.types";
import type { DashboardSummary, GroupStanding, StandingRow, TeamStatistics, TopScorer } from "@/types/statistics.types";
import type { Team, TeamBrief, TeamWrite } from "@/types/team.types";
import { isKnockout } from "@/constants/football.constants";
import {
  commit,
  isAdmin,
  readDb,
  readSession,
  requireAdmin,
  resetPreviewData,
  uid,
  writeSession,
  type Database,
  type StoredGoal,
  type StoredManager,
  type StoredMatch,
  type StoredPlayer,
  type StoredSponsor,
  type StoredTeam,
} from "@/mocks/store";
import { ApiError } from "@/utils/errorHandler";
import { getMatchScore } from "@/utils/getMatchScore";
import type { MockPlayer } from "@/mocks/seasonSeed";
import { commitSeasonDb, readSeasonDb } from "@/mocks/seasonStore";

const PREVIEW_EMAIL = "admin@csl.local";
const PREVIEW_PASSWORD = "Admin@12345";

function ok<T>(message: string, data: T, pagination?: Pagination) {
  return { success: true as const, message, data, ...(pagination ? { pagination } : {}) };
}

function fail(status: number, message: string, fieldErrors?: Record<string, string>): never {
  throw new ApiError(status, message, { fieldErrors, errorCode: status === 409 ? "CONFLICT" : "RULE" });
}

function paginate<T>(items: T[], page = 1, limit = 12) {
  const safeLimit = Math.min(Math.max(limit, 1), 60);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * safeLimit;
  return {
    slice: items.slice(start, start + safeLimit),
    pagination: { page: safePage, limit: safeLimit, total, totalPages },
  };
}

function briefTeam(team: StoredTeam): TeamBrief {
  return {
    _id: team._id,
    name: team.name,
    shortName: team.shortName,
    logo: team.logo,
  };
}

function presentTeam(team: StoredTeam): Team {
  return { ...team, description: team.description };
}

function presentPlayer(_db: Database, player: StoredPlayer, admin: boolean): PublicPlayer | AdminPlayer {
  const base: PublicPlayer = {
    _id: player._id,
    name: player.name,
    profilePic: player.profilePic,
    status: player.status,
  };
  if (!admin) return base;
  return {
    ...base,
    mobile: player.mobile,
    email: player.email,
    dateOfBirth: player.dateOfBirth,
    notes: player.notes ?? null,
    createdAt: player.createdAt ?? new Date().toISOString(),
    updatedAt: player.updatedAt ?? new Date().toISOString(),
  };
}

function playerBrief(player: StoredPlayer): PlayerBrief {
  return {
    _id: player._id,
    name: player.name,
    profilePic: player.profilePic,
  };
}

function presentMatch(db: Database, match: StoredMatch): Match {
  const team1 = db.teams.find((team) => team._id === match.team1Ref);
  const team2 = db.teams.find((team) => team._id === match.team2Ref);
  return {
    ...match,
    team1Ref: team1 ? briefTeam(team1) : match.team1Ref,
    team2Ref: team2 ? briefTeam(team2) : match.team2Ref,
    goals: match.goals.map((goal) => {
      const scoring = db.teams.find((team) => team._id === goal.scoringTeamRef);
      const scorer = goal.scorerRef ? db.players.find((player) => player._id === goal.scorerRef) : null;
      const own = goal.ownGoalPlayerRef ? db.players.find((player) => player._id === goal.ownGoalPlayerRef) : null;
      return {
        ...goal,
        scoringTeamRef: scoring ? briefTeam(scoring) : goal.scoringTeamRef,
        scorerRef: scorer ? playerBrief(scorer) : null,
        ownGoalPlayerRef: own ? playerBrief(own) : null,
      };
    }),
  };
}

function presentManager(
  db: Database,
  manager: StoredManager,
  admin: boolean,
): PublicManager | AdminManager {
  const team = manager.teamRef ? db.teams.find((item) => item._id === manager.teamRef) : null;
  const base: PublicManager = {
    _id: manager._id,
    name: manager.name,
    email: manager.email,
    dateOfBirth: manager.dateOfBirth,
    teamRef: manager.teamRef,
    team: team ? briefTeam(team) : null,
    role: manager.role,
    profilePic: manager.profilePic,
    status: manager.status,
  };
  if (!admin) return base;
  return { ...base, mobile: manager.mobile };
}

function presentSponsor(sponsor: StoredSponsor, admin: boolean): PublicSponsor | AdminSponsor {
  const base: PublicSponsor = {
    _id: sponsor._id,
    name: sponsor.name,
    logo: sponsor.logo,
    tier: sponsor.tier,
    website: sponsor.website,
    status: sponsor.status,
  };
  if (!admin) return base;
  return {
    ...base,
    contactPerson: sponsor.contactPerson,
    contactMobile: sponsor.contactMobile,
    notes: sponsor.notes,
  };
}

function createMockObjectId(): string {
  return Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function syncSeasonPlayer(seasonPlayers: MockPlayer[], player: StoredPlayer): void {
  const master: MockPlayer = {
    _id: player._id, __v: player.__v, name: player.name, mobile: player.mobile,
    email: player.email, dateOfBirth: player.dateOfBirth, profilePic: player.profilePic,
    status: player.status, notes: player.notes ?? null,
    createdAt: player.createdAt, updatedAt: player.updatedAt,
  };
  const index = seasonPlayers.findIndex((item) => item._id === player._id);
  if (index >= 0) seasonPlayers[index] = master;
  else seasonPlayers.push(master);
}

function applyPlayer(db: Database, input: PlayerWrite, existing?: StoredPlayer): StoredPlayer {
  const mobile = input.mobile?.trim() || "";
  const email = input.email?.trim().toLowerCase() || null;
  if (mobile && db.players.some((player) => player.mobile === mobile && player._id !== existing?._id)) {
    fail(409, "A player with this mobile number already exists", { mobile: "This mobile number is already used" });
  }
  if (email && db.players.some((player) => player.email === email && player._id !== existing?._id)) {
    fail(409, "A player with this email already exists", { email: "This email is already used" });
  }
  const now = new Date().toISOString();
  return {
    ...(existing ?? {
      _id: createMockObjectId(),
      __v: 0,
      createdAt: now,
    }),
    name: input.name.trim(),
    mobile,
    email,
    dateOfBirth: input.dateOfBirth || null,
    status: input.status,
    profilePic: input.profilePic === undefined ? existing?.profilePic ?? null : input.profilePic,
    notes: input.notes?.trim() || null,
    updatedAt: now,
  };
}

function scorePair(match: StoredMatch) {
  return getMatchScore(match);
}

function validateShootout(match: StoredMatch) {
  const score = scorePair(match);
  const shootout = match.penaltyShootout;
  if (!isKnockout(match.stage)) {
    if (shootout) fail(422, "Group matches cannot have a penalty shootout", { team1Shootout: "Remove the shootout score" });
    return;
  }
  if (match.status !== "completed") {
    match.penaltyShootout = null;
    return;
  }
  if (!score.tied) {
    match.penaltyShootout = null;
    return;
  }
  if (!shootout) {
    fail(422, "A completed, level knockout match needs a penalty shootout", {
      team1Shootout: "Enter the shootout score",
    });
  }
  if (
    !Number.isInteger(shootout.team1Score) ||
    !Number.isInteger(shootout.team2Score) ||
    shootout.team1Score < 0 ||
    shootout.team2Score < 0 ||
    shootout.team1Score === shootout.team2Score
  ) {
    fail(422, "Shootout scores must be different whole numbers", { team2Shootout: "The shootout needs a winner" });
  }
}

function applyMatch(db: Database, input: MatchWrite, existing?: StoredMatch): StoredMatch {
  if (input.team1Ref === input.team2Ref) {
    fail(422, "A match needs two different teams", { team2Ref: "Choose a different team" });
  }
  const team1 = db.teams.find((team) => team._id === input.team1Ref);
  const team2 = db.teams.find((team) => team._id === input.team2Ref);
  if (!team1 || team1.status !== "active") fail(422, "Home team must be active", { team1Ref: "Choose an active team" });
  if (!team2 || team2.status !== "active") fail(422, "Away team must be active", { team2Ref: "Choose an active team" });
  const matchNo = input.matchNo.trim();
  if (db.matches.some((match) => match.matchNo.toLowerCase() === matchNo.toLowerCase() && match._id !== existing?._id)) {
    fail(409, "That match number is already used", { matchNo: "Match number must be unique" });
  }
  let groupName = input.groupName?.trim() || null;
  if (input.stage === "group") {
    if (!groupName) fail(422, "Group fixtures need a group name", { groupName: "Enter the group" });
      } else {
    groupName = null;
  }
  const next: StoredMatch = {
    _id: existing?._id ?? uid("match"),
    matchNo,
    stage: input.stage,
    groupName,
    kickoffAt: input.kickoffAt,
    venue: input.venue?.trim() || null,
    team1Ref: input.team1Ref,
    team2Ref: input.team2Ref,
    status: input.status,
    goals: existing?.goals ?? [],
    penaltyShootout: input.stage === "group" ? null : input.penaltyShootout ?? null,
    notes: input.notes?.trim() || null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (next.status === "cancelled") next.goals = [];
  validateShootout(next);
  return next;
}

function playerBelongsToActiveSeasonTeam(playerId: string, teamId: string): boolean {
  const seasonDb = readSeasonDb();
  const activeSeason = seasonDb.seasons.find((season) => season.status === "active");
  if (!activeSeason) return false;
  const lot = seasonDb.auctionLots.find((item) => item.seasonRef === activeSeason._id && item.playerRef === playerId && item.auctionStatus === "sold");
  if (!lot?.seasonTeamRef) return false;
  const seasonTeam = seasonDb.seasonTeams.find((item) => item._id === lot.seasonTeamRef);
  return Boolean(seasonTeam && seasonTeam.teamRef === teamId && !["withdrawn", "eliminated", "completed"].includes(seasonTeam.status));
}

function validateGoal(db: Database, match: StoredMatch, input: GoalWrite) {
  if (match.status === "cancelled") fail(422, "Cancelled matches cannot record goals");
  if (input.scoringTeamRef !== match.team1Ref && input.scoringTeamRef !== match.team2Ref) {
    fail(422, "The scoring team must be playing in this match", { scoringTeamRef: "Choose one of the two teams" });
  }
  const opponent = input.scoringTeamRef === match.team1Ref ? match.team2Ref : match.team1Ref;
  if (input.goalType === "normal") {
    if (input.scorerRef) {
      const scorer = db.players.find((player) => player._id === input.scorerRef);
      if (!scorer || scorer.status !== "active" || !playerBelongsToActiveSeasonTeam(input.scorerRef, input.scoringTeamRef)) {
        fail(422, "A normal scorer must be an active player sold to the scoring team in the active season", { scorerRef: "This player is not in the scoring team's active-season squad" });
      }
    }
    return { scorerRef: input.scorerRef || null, ownGoalPlayerRef: null as string | null };
  }
  if (!input.ownGoalPlayerRef) fail(422, "Choose the player who scored the own goal", { ownGoalPlayerRef: "Choose an opposing player" });
  const own = db.players.find((player) => player._id === input.ownGoalPlayerRef);
  if (!own || own.status !== "active" || !playerBelongsToActiveSeasonTeam(input.ownGoalPlayerRef, opponent)) {
    fail(422, "An own-goal player must be an active player sold to the opposing team in the active season", { ownGoalPlayerRef: "This player is not on the opposing team's active-season squad" });
  }
  return { scorerRef: null as string | null, ownGoalPlayerRef: input.ownGoalPlayerRef };
}

function emptyRow(team: StoredTeam): StandingRow {
  return {
    position: 0,
    team: briefTeam(team),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    qualified: false,
  };
}

function buildStandings(db: Database): GroupStanding[] {
  // The compatibility preview derives group participation from season fixture
  // snapshots. Permanent Team records deliberately contain no group assignment.
  const groups = new Map<string, StandingRow[]>();
  for (const match of db.matches) {
    if (match.stage !== "group" || !match.groupName) continue;
    const rows = groups.get(match.groupName) ?? [];
    for (const teamId of [match.team1Ref, match.team2Ref]) {
      if (rows.some((row) => row.team._id === teamId)) continue;
      const team = db.teams.find((item) => item._id === teamId);
      if (team && team.status === "active") rows.push(emptyRow(team));
    }
    groups.set(match.groupName, rows);
  }
  const rule = db.settings.pointsRule;
  for (const match of db.matches) {
    if (match.status !== "completed" || match.stage !== "group" || !match.groupName) continue;
    const rows = groups.get(match.groupName);
    if (!rows) continue;
    const score = scorePair(match);
    const home = rows.find((row) => row.team._id === match.team1Ref);
    const away = rows.find((row) => row.team._id === match.team2Ref);
    if (!home || !away) continue;
    home.played += 1; away.played += 1;
    home.goalsFor += score.team1; home.goalsAgainst += score.team2;
    away.goalsFor += score.team2; away.goalsAgainst += score.team1;
    if (score.team1 > score.team2) { home.won += 1; away.lost += 1; home.points += rule.win; away.points += rule.loss; }
    else if (score.team1 < score.team2) { away.won += 1; home.lost += 1; away.points += rule.win; home.points += rule.loss; }
    else { home.drawn += 1; away.drawn += 1; home.points += rule.draw; away.points += rule.draw; }
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([groupName, rows]) => {
    const sorted = rows.map((row) => ({ ...row, goalDifference: row.goalsFor - row.goalsAgainst }))
      .sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || a.team.name.localeCompare(b.team.name))
      .map((row, index) => ({ ...row, position: index + 1, qualified: index < 2 }));
    return { groupName, rows: sorted };
  });
}

function topScorers(db: Database): TopScorer[] {
  const counts = new Map<string, number>();
  const scoringTeamByPlayer = new Map<string, string>();
  for (const match of db.matches) {
    if (match.status !== "completed") continue;
    for (const item of match.goals) {
      if (item.goalType === "normal" && item.scorerRef) {
        counts.set(item.scorerRef, (counts.get(item.scorerRef) ?? 0) + 1);
        scoringTeamByPlayer.set(item.scorerRef, item.scoringTeamRef);
      }
    }
  }
  const rows = [...counts.entries()].map(([playerId, goals]) => {
    const player = db.players.find((item) => item._id === playerId);
    if (!player) return null;
    const teamId = scoringTeamByPlayer.get(playerId);
    const team = teamId ? db.teams.find((item) => item._id === teamId) : null;
    const presentedPlayer = presentPlayer(db, player, false) as PublicPlayer;
    return { player: { _id: presentedPlayer._id, name: presentedPlayer.name, profilePic: presentedPlayer.profilePic }, team: team ? briefTeam(team) : null, goals };
  }).filter((row): row is Omit<TopScorer, "rank"> => Boolean(row))
    .sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name));
  let lastGoals = -1, rank = 0;
  return rows.map((row, index) => {
    if (row.goals !== lastGoals) { rank = index + 1; lastGoals = row.goals; }
    return { ...row, rank };
  });
}

function teamGoalTotals(db: Database) {
  const totals = new Map<string, { scored: number; conceded: number; cleanSheets: number }>();
  for (const team of db.teams) totals.set(team._id, { scored: 0, conceded: 0, cleanSheets: 0 });
  for (const match of db.matches) {
    if (match.status !== "completed") continue;
    const score = scorePair(match);
    const home = totals.get(match.team1Ref);
    const away = totals.get(match.team2Ref);
    if (!home || !away) continue;
    home.scored += score.team1;
    home.conceded += score.team2;
    away.scored += score.team2;
    away.conceded += score.team1;
    if (score.team2 === 0) home.cleanSheets += 1;
    if (score.team1 === 0) away.cleanSheets += 1;
  }
  return totals;
}

export const previewRepository = {
  async login(email: string, password: string) {
    const db = readDb();
    if (email.trim().toLowerCase() !== PREVIEW_EMAIL || password !== PREVIEW_PASSWORD) {
      fail(401, "Email or password is incorrect");
    }
    if (db.user.status === "blocked") fail(403, "This admin account is blocked");
    writeSession(db.user);
    return ok("Signed in", db.user);
  },
  async logout() {
    writeSession(null);
    return ok("Signed out", null);
  },
  async me() {
    const session = readSession();
    if (!session || !isAdmin()) return ok("No active admin session", null as AdminUser | null);
    return ok("Admin session", readDb().user);
  },
  async getSettings() {
    return ok("Settings loaded", readDb().settings);
  },
  async updateSettings(input: SettingsUpdate) {
    requireAdmin();
    const db = readDb();
    db.settings = { ...db.settings, ...input, singletonKey: "CSL_CURRENT", updatedAt: new Date().toISOString() };
    commit(db);
    return ok("Settings saved", db.settings);
  },
  async reset() {
    requireAdmin();
    const db = resetPreviewData();
    return ok("Sample tournament restored", db.settings);
  },
  async getPlayers(query: PlayerQuery = {}) {
    const db = readDb();
    const admin = isAdmin();
    let items = [...db.players];
    if (!admin) items = items.filter((player) => player.status === "active");
    if (query.search) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((player) => player.name.toLowerCase().includes(needle));
    }
    if (admin && query.status) items = items.filter((player) => player.status === query.status);
    items.sort((a, b) => a.name.localeCompare(b.name));
    const page = paginate(items, query.page ?? 1, query.limit ?? 12);
    return ok(
      "Players loaded",
      page.slice.map((player) => presentPlayer(db, player, admin)),
      page.pagination,
    );
  },
  async getPlayer(id: string) {
    const db = readDb();
    const player = db.players.find((item) => item._id === id);
    if (!player) fail(404, "Player not found");
    if (!isAdmin() && player.status !== "active") fail(404, "Player not found");
    return ok("Player loaded", presentPlayer(db, player, isAdmin()));
  },
  async createPlayer(input: PlayerWrite): Promise<ApiResponse<AdminPlayer>> {
    requireAdmin();
    const db = readDb();
    const seasonDb = readSeasonDb();
    const player = applyPlayer(db, input);
    db.players.push(player);
    syncSeasonPlayer(seasonDb.players, player);
    commit(db);
    commitSeasonDb(seasonDb);
    return ok("Player created", presentPlayer(db, player, true) as AdminPlayer);
  },
  async updatePlayer(id: string, input: PlayerWrite): Promise<ApiResponse<AdminPlayer>> {
    requireAdmin();
    const db = readDb();
    const seasonDb = readSeasonDb();
    const index = db.players.findIndex((player) => player._id === id);
    if (index < 0) fail(404, "Player not found");
    const player = applyPlayer(db, input, db.players[index]);
    db.players[index] = player;
    syncSeasonPlayer(seasonDb.players, player);
    commit(db);
    commitSeasonDb(seasonDb);
    return ok("Player updated", presentPlayer(db, player, true) as AdminPlayer);
  },
  async deactivatePlayer(id: string): Promise<ApiResponse<AdminPlayer>> {
    requireAdmin();
    const db = readDb();
    const current = db.players.find((player) => player._id === id);
    if (!current) fail(404, "Player not found");
    return this.updatePlayer(id, { ...current, status: "inactive" });
  },
  async deletePlayer(id: string) {
    requireAdmin();
    const db = readDb();
    const seasonDb = readSeasonDb();
    const usedInSeason = seasonDb.auctionLots.some((lot) => lot.playerRef === id) ||
      seasonDb.matches.some((match) => match.goals.some((goal) => goal.scorerPlayerRef === id) ||
        (match.penaltyShootout?.kicks ?? []).some((kick) => kick.playerRef === id)) ||
      seasonDb.awards.some((award) => award.recipients.some((recipient) => recipient.playerRef === id));
    const used = usedInSeason || db.matches.some((match) =>
      match.goals.some((item) => item.scorerRef === id || item.ownGoalPlayerRef === id),
    );
    if (used) {
      fail(409, "This player has auction, match, or award history. Deactivate the player to preserve historical records.");
    }
    const before = db.players.length;
    db.players = db.players.filter((player) => player._id !== id);
    if (db.players.length === before) fail(404, "Player not found");
    seasonDb.players = seasonDb.players.filter((player) => player._id !== id);
    commit(db);
    commitSeasonDb(seasonDb);
    return ok("Player deleted", null);
  },
  async getTeams() {
    const db = readDb();
    const admin = isAdmin();
    const teams = db.teams.filter((team) => admin || team.status === "active").map(presentTeam);
    return ok("Teams loaded", teams);
  },
  async getTeam(id: string) {
    const db = readDb();
    const team = db.teams.find((item) => item._id === id);
    if (!team || (!isAdmin() && team.status !== "active")) fail(404, "Team not found");
    return ok("Team loaded", presentTeam(team));
  },
  async createTeam(input: TeamWrite) {
    requireAdmin();
    const db = readDb();
    if (db.teams.some((team) => team.name.toLowerCase() === input.name.trim().toLowerCase())) {
      fail(409, "A team with this name already exists", { name: "Team name must be unique" });
    }
    if (input.status === "active" && db.teams.filter((team) => team.status === "active").length >= db.settings.maxActiveTeams) {
      fail(422, `The active team limit is ${db.settings.maxActiveTeams}`, { status: "Deactivate another team first" });
    }
    const team: StoredTeam = {
      _id: uid("team"),
      name: input.name.trim(),
      shortName: input.shortName?.trim() || null,
      description: input.description?.trim() || null,
      logo: input.logo ?? null,
      poster: input.poster ?? null,
      status: input.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.teams.push(team);
    commit(db);
    return ok("Team created", presentTeam(team));
  },
  async updateTeam(id: string, input: TeamWrite) {
    requireAdmin();
    const db = readDb();
    const index = db.teams.findIndex((team) => team._id === id);
    if (index < 0) fail(404, "Team not found");
    if (db.teams.some((team) => team._id !== id && team.name.toLowerCase() === input.name.trim().toLowerCase())) {
      fail(409, "A team with this name already exists", { name: "Team name must be unique" });
    }
    const current = db.teams[index];
    if (
      input.status === "active" &&
      current.status !== "active" &&
      db.teams.filter((team) => team.status === "active").length >= db.settings.maxActiveTeams
    ) {
      fail(422, `The active team limit is ${db.settings.maxActiveTeams}`, { status: "Deactivate another team first" });
    }
    const team: StoredTeam = {
      ...current,
      name: input.name.trim(),
      shortName: input.shortName?.trim() || null,
      description: input.description === undefined ? current.description : input.description?.trim() || null,
      logo: input.logo === undefined ? current.logo : input.logo,
      poster: input.poster === undefined ? current.poster : input.poster,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };
    db.teams[index] = team;
    commit(db);
    return ok("Team updated", presentTeam(team));
  },
  async deleteTeam(id: string) {
    requireAdmin();
    const db = readDb();
    const seasonDb = readSeasonDb();
    if (seasonDb.seasonTeams.some((seasonTeam) => seasonTeam.teamRef === id)) {
      fail(422, "This team has season participation history and cannot be deleted.");
    }
    if (db.managers.some((manager) => manager.teamRef === id)) {
      fail(422, "Reassign this team's managers before deleting it");
    }
    if (db.matches.some((match) => match.team1Ref === id || match.team2Ref === id)) {
      fail(422, "Delete or edit the fixtures that use this team first");
    }
    const before = db.teams.length;
    db.teams = db.teams.filter((team) => team._id !== id);
    if (db.teams.length === before) fail(404, "Team not found");
    commit(db);
    return ok("Team deleted", null);
  },
  async getManagers(query: ManagerQuery = {}) {
    const db = readDb();
    const admin = isAdmin();
    let items = db.managers.filter((manager) => admin || manager.status === "active");
    if (query.search) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((manager) => manager.name.toLowerCase().includes(needle));
    }
    if (admin && query.status) items = items.filter((manager) => manager.status === query.status);
    if (query.teamRef) items = items.filter((manager) => manager.teamRef === query.teamRef);
    items.sort((a, b) => a.name.localeCompare(b.name));
    const page = paginate(items, query.page ?? 1, query.limit ?? 12);
    return ok(
      "Managers loaded",
      page.slice.map((manager) => presentManager(db, manager, admin)),
      page.pagination,
    );
  },
  async getManager(id: string) {
    const db = readDb();
    const manager = db.managers.find((item) => item._id === id);
    if (!manager || (!isAdmin() && manager.status !== "active")) fail(404, "Manager not found");
    return ok("Manager loaded", presentManager(db, manager, isAdmin()));
  },
  async saveManager(input: ManagerWrite, existing?: StoredManager) {
    const db = readDb();
    if (db.managers.some((manager) => manager.mobile === input.mobile && manager._id !== existing?._id)) {
      fail(409, "A manager with this mobile number already exists", { mobile: "This mobile number is already used" });
    }
    const email = input.email?.trim().toLowerCase() || null;
    if (email && db.managers.some((manager) => manager.email === email && manager._id !== existing?._id)) {
      fail(409, "A manager with this email already exists", { email: "This email is already used" });
    }
    if (input.teamRef && !db.teams.some((team) => team._id === input.teamRef)) {
      fail(422, "Choose a valid team", { teamRef: "That team does not exist" });
    }
    const manager: StoredManager = {
      _id: existing?._id ?? uid("manager"),
      name: input.name.trim(),
      mobile: input.mobile,
      email,
      dateOfBirth: input.dateOfBirth || null,
      teamRef: input.teamRef || null,
      role: input.role?.trim() || null,
      profilePic: input.profilePic === undefined ? existing?.profilePic ?? null : input.profilePic,
      status: input.status,
    };
    return manager;
  },
  async createManager(input: ManagerWrite): Promise<ApiResponse<AdminManager>> {
    requireAdmin();
    const db = readDb();
    const manager = await this.saveManager(input);
    db.managers.push(manager);
    commit(db);
    return ok("Manager created", presentManager(db, manager, true) as AdminManager);
  },
  async updateManager(id: string, input: ManagerWrite): Promise<ApiResponse<AdminManager>> {
    requireAdmin();
    const db = readDb();
    const index = db.managers.findIndex((manager) => manager._id === id);
    if (index < 0) fail(404, "Manager not found");
    const manager = await this.saveManager(input, db.managers[index]);
    db.managers[index] = manager;
    commit(db);
    return ok("Manager updated", presentManager(db, manager, true) as AdminManager);
  },
  async deleteManager(id: string) {
    requireAdmin();
    const db = readDb();
    const before = db.managers.length;
    db.managers = db.managers.filter((manager) => manager._id !== id);
    if (db.managers.length === before) fail(404, "Manager not found");
    commit(db);
    return ok("Manager deleted", null);
  },
  async getSponsors(query: SponsorQuery = {}) {
    const db = readDb();
    const admin = isAdmin();
    let items = db.sponsors.filter((sponsor) => admin || sponsor.status === "active");
    if (query.search) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((sponsor) => sponsor.name.toLowerCase().includes(needle));
    }
    if (admin && query.status) items = items.filter((sponsor) => sponsor.status === query.status);
    items.sort((a, b) => a.name.localeCompare(b.name));
    const page = paginate(items, query.page ?? 1, query.limit ?? 12);
    return ok(
      "Sponsors loaded",
      page.slice.map((sponsor) => presentSponsor(sponsor, admin)),
      page.pagination,
    );
  },
  async createSponsor(input: SponsorWrite): Promise<ApiResponse<AdminSponsor>> {
    requireAdmin();
    const db = readDb();
    const sponsor: StoredSponsor = {
      _id: uid("sponsor"),
      name: input.name.trim(),
      logo: input.logo ?? null,
      tier: input.tier?.trim() || null,
      website: input.website?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      contactMobile: input.contactMobile || null,
      notes: input.notes?.trim() || null,
      status: input.status,
    };
    db.sponsors.push(sponsor);
    commit(db);
    return ok("Sponsor created", presentSponsor(sponsor, true) as AdminSponsor);
  },
  async updateSponsor(id: string, input: SponsorWrite): Promise<ApiResponse<AdminSponsor>> {
    requireAdmin();
    const db = readDb();
    const index = db.sponsors.findIndex((sponsor) => sponsor._id === id);
    if (index < 0) fail(404, "Sponsor not found");
    const current = db.sponsors[index];
    const sponsor: StoredSponsor = {
      ...current,
      name: input.name.trim(),
      logo: input.logo === undefined ? current.logo : input.logo,
      tier: input.tier?.trim() || null,
      website: input.website?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      contactMobile: input.contactMobile || null,
      notes: input.notes?.trim() || null,
      status: input.status,
    };
    db.sponsors[index] = sponsor;
    commit(db);
    return ok("Sponsor updated", presentSponsor(sponsor, true) as AdminSponsor);
  },
  async deleteSponsor(id: string) {
    requireAdmin();
    const db = readDb();
    const before = db.sponsors.length;
    db.sponsors = db.sponsors.filter((sponsor) => sponsor._id !== id);
    if (db.sponsors.length === before) fail(404, "Sponsor not found");
    commit(db);
    return ok("Sponsor deleted", null);
  },
  async getMatches(query: MatchQuery = {}) {
    const db = readDb();
    let items = [...db.matches];
    if (query.stage) items = items.filter((match) => match.stage === query.stage);
    if (query.groupName) items = items.filter((match) => match.groupName === query.groupName);
    if (query.status) items = items.filter((match) => match.status === query.status);
    if (query.search) {
      const needle = query.search.trim().toLowerCase();
      items = items.filter((match) => {
        const home = db.teams.find((team) => team._id === match.team1Ref)?.name ?? "";
        const away = db.teams.find((team) => team._id === match.team2Ref)?.name ?? "";
        return (
          match.matchNo.toLowerCase().includes(needle) ||
          home.toLowerCase().includes(needle) ||
          away.toLowerCase().includes(needle)
        );
      });
    }
    items.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
    const page = paginate(items, query.page ?? 1, query.limit ?? 8);
    return ok(
      "Matches loaded",
      page.slice.map((match) => presentMatch(db, match)),
      page.pagination,
    );
  },
  async getMatch(id: string) {
    const db = readDb();
    const match = db.matches.find((item) => item._id === id);
    if (!match) fail(404, "Match not found");
    return ok("Match loaded", presentMatch(db, match));
  },
  async createMatch(input: MatchWrite) {
    requireAdmin();
    const db = readDb();
    const match = applyMatch(db, input);
    db.matches.push(match);
    commit(db);
    return ok("Fixture created", presentMatch(db, match));
  },
  async updateMatch(id: string, input: MatchWrite) {
    requireAdmin();
    const db = readDb();
    const index = db.matches.findIndex((match) => match._id === id);
    if (index < 0) fail(404, "Match not found");
    const match = applyMatch(db, input, db.matches[index]);
    db.matches[index] = match;
    commit(db);
    return ok("Fixture updated", presentMatch(db, match));
  },
  async deleteMatch(id: string) {
    requireAdmin();
    const db = readDb();
    const before = db.matches.length;
    db.matches = db.matches.filter((match) => match._id !== id);
    if (db.matches.length === before) fail(404, "Match not found");
    commit(db);
    return ok("Fixture deleted", null);
  },
  async addGoal(matchId: string, input: GoalWrite) {
    requireAdmin();
    const db = readDb();
    const match = db.matches.find((item) => item._id === matchId);
    if (!match) fail(404, "Match not found");
    const refs = validateGoal(db, match, input);
    const item: StoredGoal = {
      _id: uid("goal"),
      scoringTeamRef: input.scoringTeamRef,
      goalType: input.goalType,
      ...refs,
      createdAt: new Date().toISOString(),
    };
    match.goals.push(item);
    match.updatedAt = new Date().toISOString();
    validateShootout(match);
    commit(db);
    return ok("Goal added", presentMatch(db, match));
  },
  async updateGoal(matchId: string, goalId: string, input: GoalWrite) {
    requireAdmin();
    const db = readDb();
    const match = db.matches.find((item) => item._id === matchId);
    if (!match) fail(404, "Match not found");
    const index = match.goals.findIndex((item) => item._id === goalId);
    if (index < 0) fail(404, "Goal not found");
    const refs = validateGoal(db, match, input);
    match.goals[index] = {
      ...match.goals[index],
      scoringTeamRef: input.scoringTeamRef,
      goalType: input.goalType,
      ...refs,
    };
    match.updatedAt = new Date().toISOString();
    validateShootout(match);
    commit(db);
    return ok("Goal updated", presentMatch(db, match));
  },
  async deleteGoal(matchId: string, goalId: string) {
    requireAdmin();
    const db = readDb();
    const match = db.matches.find((item) => item._id === matchId);
    if (!match) fail(404, "Match not found");
    const before = match.goals.length;
    match.goals = match.goals.filter((item) => item._id !== goalId);
    if (match.goals.length === before) fail(404, "Goal not found");
    match.updatedAt = new Date().toISOString();
    validateShootout(match);
    commit(db);
    return ok("Goal removed", presentMatch(db, match));
  },
  async getStandings() {
    return ok("Standings loaded", buildStandings(readDb()));
  },
  async getTopScorers() {
    return ok("Top scorers loaded", topScorers(readDb()));
  },
  async getTeamStatistics(teamId: string) {
    const db = readDb();
    const team = db.teams.find((item) => item._id === teamId);
    if (!team) fail(404, "Team not found");
    const standing = buildStandings(db)
      .flatMap((group) => group.rows)
      .find((row) => row.team._id === teamId);
    const overall = teamGoalTotals(db).get(teamId) ?? { scored: 0, conceded: 0, cleanSheets: 0 };
    const played = db.matches.filter(
      (match) => match.status === "completed" && (match.team1Ref === teamId || match.team2Ref === teamId),
    ).length;
    const group: TeamStatistics["group"] = standing
      ? {
          played: standing.played,
          won: standing.won,
          drawn: standing.drawn,
          lost: standing.lost,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
          goalDifference: standing.goalDifference,
          points: standing.points,
        }
      : { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
    const stats: TeamStatistics = {
      team: briefTeam(team),
      group,
      overall: { played, goalsFor: overall.scored, goalsAgainst: overall.conceded, cleanSheets: overall.cleanSheets },
    };
    return ok("Team statistics loaded", stats);
  },
  async getDashboard(): Promise<ReturnType<typeof ok<DashboardSummary>>> {
    const db = readDb();
    const seasonDb = readSeasonDb();
    const activeSeason = seasonDb.seasons.find((season) => season.status === "active")
      ?? [...seasonDb.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
    const seasonLots = activeSeason ? seasonDb.auctionLots.filter((lot) => lot.seasonRef === activeSeason._id) : [];
    const activePlayerIds = new Set(seasonDb.players.filter((player) => player.status === "active").map((player) => player._id));
    const activeLots = seasonLots.filter((lot) => activePlayerIds.has(lot.playerRef));
    const seasonTeams = activeSeason ? seasonDb.seasonTeams.filter((team) => team.seasonRef === activeSeason._id) : [];
    const soldLots = activeLots.filter((lot) => lot.auctionStatus === "sold");
    const auctionTotals = {
      activeTeams: seasonTeams.length,
      activeAuctionPlayers: activePlayerIds.size,
      pendingPlayers: activeLots.filter((lot) => lot.auctionStatus === "pending").length,
      soldPlayers: soldLots.length,
      unsoldPlayers: activeLots.filter((lot) => lot.auctionStatus === "unsold").length,
      totalAuctionSpend: soldLots.reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0),
    };
    const scorers = topScorers(db);
    const totals = teamGoalTotals(db);
    const completed = db.matches.filter((match) => match.status === "completed");
    const ranked = db.teams
      .map((team) => ({ team: briefTeam(team), ...(totals.get(team._id) ?? { scored: 0, conceded: 0, cleanSheets: 0 }) }))
      .filter((row) => row.scored + row.conceded + row.cleanSheets > 0);
    const mostScoring = [...ranked].sort((a, b) => b.scored - a.scored || a.team.name.localeCompare(b.team.name))[0];
    const mostConceding = [...ranked].sort((a, b) => b.conceded - a.conceded || a.team.name.localeCompare(b.team.name))[0];
    const bestClean = ranked.reduce((max, row) => Math.max(max, row.cleanSheets), 0);
    const alerts: string[] = [];
    for (const seasonTeam of seasonTeams) {
      const teamLots = soldLots.filter((lot) => lot.seasonTeamRef === seasonTeam._id);
      const squadSize = activeSeason?.auctionSettings?.teamSquadSize ?? 0;
      const iconLimit = activeSeason?.auctionSettings?.iconPlayerLimit ?? 0;
      const goalkeeperLimit = activeSeason?.auctionSettings?.goalkeeperLimit ?? 0;
      if (teamLots.length < squadSize) alerts.push(`${seasonTeam.displayName} has ${squadSize - teamLots.length} squad place${squadSize - teamLots.length === 1 ? "" : "s"} left`);
      if (teamLots.length > 0 && teamLots.filter((lot) => lot.isIconPlayer).length < iconLimit) alerts.push(`${seasonTeam.displayName} is missing an icon player`);
      if (teamLots.length > 0 && teamLots.filter((lot) => lot.isGoalkeeper).length < goalkeeperLimit) alerts.push(`${seasonTeam.displayName} is missing a goalkeeper`);
    }
    const live = db.matches.filter((match) => match.status === "live").length;
    if (live) alerts.push(`${live} match${live === 1 ? " is" : "es are"} live`);
    const summary: DashboardSummary = {
      tournamentName: db.settings.tournamentName,
      startDate: db.settings.startDate,
      endDate: db.settings.endDate,
      totalMatchesPlayed: completed.length,
      totalGoals: completed.reduce((sum, match) => sum + match.goals.length, 0),
      activeTeams: auctionTotals.activeTeams,
      activePlayers: auctionTotals.activeAuctionPlayers,
      pendingPlayers: auctionTotals.pendingPlayers,
      soldPlayers: auctionTotals.soldPlayers,
      unsoldPlayers: auctionTotals.unsoldPlayers,
      totalAuctionSpend: auctionTotals.totalAuctionSpend,
      upcomingMatchCount: db.matches.filter((match) => match.status === "scheduled").length,
      topScorer: scorers[0] ?? null,
      mostScoringTeam: mostScoring ? { team: mostScoring.team, goals: mostScoring.scored } : null,
      mostConcedingTeam: mostConceding ? { team: mostConceding.team, goals: mostConceding.conceded } : null,
      mostCleanSheets: ranked
        .filter((row) => row.cleanSheets === bestClean && bestClean > 0)
        .map((row) => ({ team: row.team, cleanSheets: row.cleanSheets })),
      upcomingFixtures: db.matches
        .filter((match) => match.status === "scheduled")
        .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())
        .slice(0, 4)
        .map((match) => presentMatch(db, match)),
      recentResults: completed
        .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime())
        .slice(0, 4)
        .map((match) => presentMatch(db, match)),
      alerts,
    };
    return ok("Dashboard loaded", summary);
  },
};

export const PREVIEW_LOGIN = { email: PREVIEW_EMAIL, password: PREVIEW_PASSWORD };

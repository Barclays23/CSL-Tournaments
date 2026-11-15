import type { ApiResponse } from "@/types/api.types";
import type { AuctionLot, AuctionLotsQuery, AuctionSummary, Season, SeasonTeam, SeasonWrite, UpdateAuctionLotInput } from "@/types/season.types";
import type { PlayerHistory, SeasonTeamDashboard } from "@/types/seasonStatistics.types";
import { readSeasonDb, commitSeasonDb } from "@/mocks/seasonStore";
import { requireAdmin } from "@/mocks/store";
import type { MockAuctionLot, MockSeason, MockSeasonTeam, SeasonMockDatabase } from "@/mocks/seasonSeed";
import { ApiError } from "@/utils/errorHandler";

let sequence = 9000;
const oid = (n: number) => n.toString(16).padStart(24, "0");
const newId = () => oid(sequence++);
const now = () => new Date().toISOString();
const ok = <T>(message: string, data: T): ApiResponse<T> => ({ success: true, message, data });
const fail = (status: number, message: string): never => { throw new ApiError(status, message, { errorCode: status === 409 ? "CONFLICT" : "RULE" }); };

function seasonById(db: SeasonMockDatabase, id: string): MockSeason {
  const season = db.seasons.find((item) => item._id === id);
  if (!season) return fail(404, "Season not found");
  return season;
}
function seasonBrief(season: MockSeason) {
  return { _id: season._id, name: season.name, seasonNumber: season.seasonNumber, year: season.year, status: season.status };
}
function teamById(db: SeasonMockDatabase, id: string) {
  const team = db.teams.find((item) => item._id === id);
  if (!team) return fail(404, "Team not found");
  return team;
}
function playerById(db: SeasonMockDatabase, id: string) {
  const player = db.players.find((item) => item._id === id);
  if (!player) return fail(404, "Player not found");
  return player;
}
function groupById(db: SeasonMockDatabase, id: string | null) {
  return id ? db.groups.find((item) => item._id === id) ?? null : null;
}
function teamBrief(db: SeasonMockDatabase, st: MockSeasonTeam) {
  const team = teamById(db, st.teamRef);
  const group = groupById(db, st.groupRef);
  return { _id: st._id, teamId: team._id, displayName: st.displayName, shortName: team.shortName, logo: st.logoSnapshot, groupRef: st.groupRef, groupName: group?.groupName ?? null };
}
function populatedSeasonTeam(db: SeasonMockDatabase, st: MockSeasonTeam): SeasonTeam {
  const team = teamById(db, st.teamRef);
  const group = groupById(db, st.groupRef);
  return {
    _id: st._id, seasonRef: st.seasonRef, teamRef: st.teamRef, displayName: st.displayName,
    logoSnapshot: st.logoSnapshot, groupRef: st.groupRef, managerRefs: [...st.managerRefs], status: st.status,
    team: { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo },
    group: group ? { _id: group._id, groupName: group.groupName, displayOrder: group.displayOrder } : null,
    managers: st.managerRefs.map((id) => db.managers.find((m) => m._id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m)).map((m) => ({ _id: m._id, name: m.name, role: m.role, profilePic: m.profilePic })),
  };
}
function populatedLot(db: SeasonMockDatabase, lot: MockAuctionLot): AuctionLot {
  const player = playerById(db, lot.playerRef);
  const st = lot.seasonTeamRef ? db.seasonTeams.find((item) => item._id === lot.seasonTeamRef) ?? null : null;
  const seasonTeamRef = st ? {
    _id: st._id, displayName: st.displayName,
    team: (() => { const team = teamById(db, st.teamRef); return { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo }; })(),
  } : null;
  return {
    _id: lot._id, seasonRef: lot.seasonRef, seasonTeamRef,
    playerRef: { _id: player._id, name: player.name, profilePic: player.profilePic },
    lotNumber: lot.lotNumber, auctionStatus: lot.auctionStatus, purchasePrice: lot.purchasePrice,
    playerPosition: lot.playerPosition, isIconPlayer: lot.isIconPlayer, isGoalkeeper: lot.playerPosition === "goalkeeper",
    jerseyNo: lot.jerseyNo, nominatedAt: lot.nominatedAt, soldAt: lot.soldAt,
  };
}
function soldLots(db: SeasonMockDatabase, seasonId: string, seasonTeamId?: string) {
  return db.auctionLots.filter((lot) => lot.seasonRef === seasonId && lot.auctionStatus === "sold" && (!seasonTeamId || lot.seasonTeamRef === seasonTeamId));
}
function summaryFor(db: SeasonMockDatabase, season: MockSeason): AuctionSummary {
  const lots = db.auctionLots.filter((lot) => lot.seasonRef === season._id);
  const teams = db.seasonTeams.filter((st) => st.seasonRef === season._id).map((st) => {
    const teamLots = soldLots(db, season._id, st._id);
    const totalSpent = teamLots.reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0);
    const settings = season.auctionSettings;
    return {
      seasonTeamId: st._id, teamId: st.teamRef, displayName: st.displayName, logoSnapshot: st.logoSnapshot,
      status: st.status, budget: settings.budgetPerTeam, playersSigned: teamLots.length,
      remainingSlots: Math.max(0, settings.teamSquadSize - teamLots.length), totalSpent,
      balance: settings.budgetPerTeam - totalSpent,
      averagePrice: teamLots.length ? Math.round(totalSpent / teamLots.length) : 0,
      iconCount: teamLots.filter((lot) => lot.isIconPlayer).length,
      goalkeeperCount: teamLots.filter((lot) => lot.playerPosition === "goalkeeper").length,
      lots: teamLots.map((lot) => populatedLot(db, lot)),
    };
  });
  return {
    season: { _id: season._id, name: season.name, year: season.year, status: season.status, auctionSettings: season.auctionSettings },
    totals: {
      participatingTeams: teams.length, lots: lots.length,
      sold: lots.filter((lot) => lot.auctionStatus === "sold").length,
      pending: lots.filter((lot) => lot.auctionStatus === "pending").length,
      unsold: lots.filter((lot) => lot.auctionStatus === "unsold").length,
      withdrawn: lots.filter((lot) => lot.auctionStatus === "withdrawn").length,
      totalSoldValue: soldLots(db, season._id).reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0),
    },
    teams, lots: lots.map((lot) => populatedLot(db, lot)),
  };
}
function matchScore(match: SeasonMockDatabase["matches"][number], seasonTeamId: string) {
  return match.goals.filter((goal) => goal.scoringSeasonTeamRef === seasonTeamId).length;
}
function fixture(db: SeasonMockDatabase, match: SeasonMockDatabase["matches"][number]) {
  const home = db.seasonTeams.find((st) => st._id === match.homeSeasonTeamRef)!;
  const away = db.seasonTeams.find((st) => st._id === match.awaySeasonTeamRef)!;
  return {
    _id: match._id, matchNumber: match.matchNumber, stage: match.stage, kickoffAt: match.kickoffAt,
    status: match.status, home: teamBrief(db, home), away: teamBrief(db, away),
    homeScore: matchScore(match, home._id), awayScore: matchScore(match, away._id),
    winnerSeasonTeamRef: match.winnerSeasonTeamRef,
    penaltyShootout: match.penaltyShootout ? { homeTeamScore: match.penaltyShootout.homeTeamScore, awayTeamScore: match.penaltyShootout.awayTeamScore, status: match.penaltyShootout.status } : null,
  };
}
function teamRecord(db: SeasonMockDatabase, seasonId: string, seasonTeamId: string, groupOnly = false) {
  const relevant = db.matches.filter((m) => m.seasonRef === seasonId && m.status === "completed" && (!groupOnly || m.stage === "group") && (m.homeSeasonTeamRef === seasonTeamId || m.awaySeasonTeamRef === seasonTeamId));
  const rules = seasonById(db, seasonId).pointsRules;
  let played = 0, won = 0, drawn = 0, lost = 0, goalsScored = 0, goalsConceded = 0, cleanSheets = 0, points = 0;
  for (const match of relevant) {
    const isHome = match.homeSeasonTeamRef === seasonTeamId;
    const opponentId = isHome ? match.awaySeasonTeamRef : match.homeSeasonTeamRef;
    const gf = matchScore(match, seasonTeamId), ga = matchScore(match, opponentId);
    played++; goalsScored += gf; goalsConceded += ga;
    if (ga === 0) cleanSheets++;
    if (gf > ga) { won++; if (match.stage === "group") points += rules.win; } else if (gf === ga) { drawn++; if (match.stage === "group") points += rules.draw; } else { lost++; if (match.stage === "group") points += rules.loss; }
  }
  const scorerCounts = new Map<string, number>();
  for (const match of relevant) for (const goal of match.goals) {
    if (goal.goalType === "normal" && goal.playerSeasonTeamRef === seasonTeamId && goal.scorerPlayerRef) scorerCounts.set(goal.scorerPlayerRef, (scorerCounts.get(goal.scorerPlayerRef) ?? 0) + 1);
  }
  const top = [...scorerCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const player = top ? db.players.find((p) => p._id === top[0]) : null;
  return {
    played, won, drawn, lost, goalsScored, goalsConceded, goalDifference: goalsScored - goalsConceded, cleanSheets, points,
    topScorer: top && player ? { player: { _id: player._id, name: player.name, profilePic: player.profilePic }, goals: top[1] } : null,
  };
}
function groupStandings(db: SeasonMockDatabase, season: MockSeason) {
  const groups = db.groups.filter((group) => group.seasonRef === season._id).sort((a, b) => a.displayOrder - b.displayOrder);
  return groups.map((group) => {
    const entries = db.seasonTeams
      .filter((seasonTeam) => seasonTeam.seasonRef === season._id && seasonTeam.groupRef === group._id)
      .map((seasonTeam) => ({ team: teamBrief(db, seasonTeam), ...teamRecord(db, season._id, seasonTeam._id, true) }));
    entries.sort((a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsScored - a.goalsScored ||
      a.team.displayName.localeCompare(b.team.displayName),
    );
    return {
      groupRef: group._id,
      groupName: group.groupName,
      rows: entries.map((row, index) => ({ position: index + 1, ...row, qualified: index < 2 })),
    };
  });
}

export const seasonPreviewRepository = {
  async getSeasons() {
    const db = readSeasonDb();
    return ok("Seasons loaded", [...db.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber) as unknown as Season[]);
  },
  async createSeason(input: SeasonWrite) {
    requireAdmin();
    const db = readSeasonDb();
    if (db.seasons.some((s) => s.seasonNumber === input.seasonNumber)) fail(409, "Season number already exists");
    if (input.status === "active" && db.seasons.some((s) => s.status === "active")) fail(409, "Another season is already active");
    if (new Set(input.teamIds).size !== input.teamIds.length) fail(409, "A team can only be registered once in a season");
    if (input.teamIds.length > input.auctionSettings.seasonTeamCount) fail(422, "Selected teams exceed the season team limit");
    const date = now();
    const season: MockSeason = {
      _id: newId(), seasonNumber: input.seasonNumber, name: input.name, year: input.year,
      startDate: input.startDate ?? null, endDate: input.endDate ?? null, timeZone: input.timeZone ?? "Asia/Kolkata",
      status: input.status ?? "draft", auctionSettings: input.auctionSettings,
      pointsRules: input.pointsRules ?? { win: 3, draw: 1, loss: 0 },
      standingsTieBreakers: input.standingsTieBreakers ?? ["points", "goalDifference", "goalsScored", "teamNameAsc"],
      matchRules: input.matchRules ?? { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false },
      auctionRevision: 0, createdAt: date, updatedAt: date,
    };
    db.seasons.push(season);
    for (const teamId of input.teamIds) {
      const team = teamById(db, teamId);
      if (team.status !== "active") fail(422, "All selected teams must be active");
      db.seasonTeams.push({ _id: newId(), seasonRef: season._id, teamRef: team._id, displayName: team.name, logoSnapshot: team.logo, groupRef: null, managerRefs: [], status: "registered", createdAt: date, updatedAt: date });
    }
    commitSeasonDb(db);
    return ok("Season created", season as unknown as Season);
  },
  async updateSeason(id: string, input: Partial<SeasonWrite>) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (input.status === "active" && db.seasons.some((s) => s._id !== id && s.status === "active")) fail(409, "Another season is already active");
    if (input.auctionSettings && db.auctionLots.some((lot) => lot.seasonRef === id) && JSON.stringify(input.auctionSettings) !== JSON.stringify(season.auctionSettings)) fail(409, "Auction settings cannot be changed after player nominations");
    if (input.auctionSettings && input.auctionSettings.seasonTeamCount < db.seasonTeams.filter((st) => st.seasonRef === id).length) fail(409, "Team limit cannot be lower than registered teams");
    const patch: Partial<SeasonWrite> = { ...input };
    delete patch.teamIds;
    Object.assign(season, patch, { updatedAt: now() });
    commitSeasonDb(db);
    return ok("Season updated", season as unknown as Season);
  },
  async deleteSeason(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    seasonById(db, id);
    db.matches = db.matches.filter((match) => match.seasonRef !== id);
    db.auctionLots = db.auctionLots.filter((lot) => lot.seasonRef !== id);
    db.seasonTeams = db.seasonTeams.filter((team) => team.seasonRef !== id);
    db.groups = db.groups.filter((group) => group.seasonRef !== id);
    db.seasons = db.seasons.filter((season) => season._id !== id);
    commitSeasonDb(db);
    return ok("Season and its preview records deleted", null);
  },
  async getSeasonTeams(id: string) {
    const db = readSeasonDb();
    seasonById(db, id);
    return ok("Season teams loaded", db.seasonTeams.filter((st) => st.seasonRef === id).map((st) => populatedSeasonTeam(db, st)));
  },
  async registerSeasonTeams(id: string, teamIds: string[]) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (season.status === "completed" || season.status === "archived") fail(409, "Teams cannot be registered in a completed or archived season");
    const existing = db.seasonTeams.filter((st) => st.seasonRef === id);
    if (new Set(teamIds).size !== teamIds.length) fail(409, "A team can only be registered once in a season");
    const known = new Set(existing.map((st) => st.teamRef));
    if (teamIds.some((teamId) => known.has(teamId))) fail(409, "One or more teams are already registered in this season");
    if (existing.length + teamIds.length > season.auctionSettings.seasonTeamCount) fail(422, "Season team limit exceeded");
    const date = now();
    for (const teamId of teamIds) {
      const team = teamById(db, teamId);
      if (team.status !== "active") fail(422, "Selected team is not active");
      db.seasonTeams.push({ _id: newId(), seasonRef: id, teamRef: teamId, displayName: team.name, logoSnapshot: team.logo, groupRef: null, managerRefs: [], status: "registered", createdAt: date, updatedAt: date });
    }
    commitSeasonDb(db);
    return ok("Season teams registered", db.seasonTeams.filter((st) => st.seasonRef === id && teamIds.includes(st.teamRef)).map((st) => populatedSeasonTeam(db, st)));
  },
  async getAuctionSummary(id: string) {
    const db = readSeasonDb();
    return ok("Auction summary loaded", summaryFor(db, seasonById(db, id)));
  },
  async getAuctionLots(query: AuctionLotsQuery) {
    const db = readSeasonDb();
    seasonById(db, query.seasonId);
    let lots = db.auctionLots.filter((lot) => lot.seasonRef === query.seasonId);
    if (query.seasonTeamId) lots = lots.filter((lot) => lot.seasonTeamRef === query.seasonTeamId);
    if (query.playerPosition) lots = lots.filter((lot) => lot.playerPosition === query.playerPosition);
    if (query.auctionStatus) lots = lots.filter((lot) => lot.auctionStatus === query.auctionStatus);
    if (query.isIconPlayer !== undefined) lots = lots.filter((lot) => lot.isIconPlayer === query.isIconPlayer);
    if (query.isGoalkeeper !== undefined) lots = lots.filter((lot) => lot.isGoalkeeper === query.isGoalkeeper);
    if (query.playerName) {
      const needle = query.playerName.toLowerCase();
      lots = lots.filter((lot) => playerById(db, lot.playerRef).name.toLowerCase().includes(needle));
    }
    lots.sort((a, b) => (a.lotNumber ?? 0) - (b.lotNumber ?? 0));
    return ok("Auction lots loaded", lots.map((lot) => populatedLot(db, lot)));
  },
  async nominatePlayer(input: { seasonId: string; playerId: string; playerPosition: MockAuctionLot["playerPosition"]; isIconPlayer: boolean }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, input.seasonId);
    if (season.status === "completed" || season.status === "archived") fail(409, "Auction is closed for this season");
    const player = playerById(db, input.playerId);
    if (player.status !== "active") fail(422, "Only active players can be nominated");
    if (db.auctionLots.some((lot) => lot.seasonRef === season._id && lot.playerRef === player._id)) fail(409, "This player has already been nominated in this season");
    const seasonLots = db.auctionLots.filter((lot) => lot.seasonRef === season._id);
    if (seasonLots.length >= season.auctionSettings.playersCount) fail(422, "Season player nomination limit reached");
    const date = now();
    const lot: MockAuctionLot = {
      _id: newId(), seasonRef: season._id, seasonTeamRef: null, playerRef: player._id,
      lotNumber: seasonLots.length + 1, auctionStatus: "pending", purchasePrice: null,
      playerPosition: input.playerPosition, isIconPlayer: input.isIconPlayer, isGoalkeeper: input.playerPosition === "goalkeeper",
      jerseyNo: null, nominatedAt: date, soldAt: null, createdAt: date, updatedAt: date,
    };
    db.auctionLots.push(lot);
    season.auctionRevision += 1;
    commitSeasonDb(db);
    return ok("Player nominated", populatedLot(db, lot));
  },
  async sellAuctionLot(id: string, input: { seasonTeamId: string; purchasePrice: number; jerseyNo?: number | null }) {
    requireAdmin();
    const db = readSeasonDb();
    const lot = db.auctionLots.find((item) => item._id === id);
    if (!lot) return fail(404, "Auction lot not found");
    const season = seasonById(db, lot.seasonRef);
    if (season.status === "completed" || season.status === "archived") fail(409, "Auction is closed for this season");
    if (lot.auctionStatus !== "pending") fail(409, "Only pending lots can be sold");
    const st = db.seasonTeams.find((item) => item._id === input.seasonTeamId && item.seasonRef === lot.seasonRef);
    if (!st || st.status === "withdrawn") return fail(422, "Winning team must be an active participant in the same season");
    if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) fail(422, "Purchase price must be zero or greater");
    const existing = soldLots(db, lot.seasonRef, st._id);
    const settings = season.auctionSettings;
    const spent = existing.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
    if (existing.length >= settings.teamSquadSize) fail(422, "Team squad size limit reached");
    if (spent + input.purchasePrice > settings.budgetPerTeam) fail(422, "Team auction budget exceeded");
    if (lot.isIconPlayer && existing.filter((item) => item.isIconPlayer).length >= settings.iconPlayerLimit) fail(422, "Icon player limit reached");
    if (lot.playerPosition === "goalkeeper" && existing.filter((item) => item.playerPosition === "goalkeeper").length >= settings.goalkeeperLimit) fail(422, "Goalkeeper limit reached");
    if (input.jerseyNo != null && (!Number.isInteger(input.jerseyNo) || input.jerseyNo < 1)) fail(422, "Jersey number must be a positive whole number");
    if (input.jerseyNo != null && existing.some((item) => item.jerseyNo === input.jerseyNo)) fail(409, "Jersey number is already used by this team in this season");
    const date = now();
    lot.seasonTeamRef = st._id; lot.auctionStatus = "sold"; lot.purchasePrice = input.purchasePrice;
    lot.jerseyNo = input.jerseyNo ?? null; lot.isGoalkeeper = lot.playerPosition === "goalkeeper"; lot.soldAt = date; lot.updatedAt = date;
    season.auctionRevision += 1;
    commitSeasonDb(db);
    return ok("Auction sale completed", populatedLot(db, lot));
  },
  async updateAuctionLot(id: string, input: UpdateAuctionLotInput) {
    requireAdmin();
    const db = readSeasonDb();
    const lot = db.auctionLots.find((item) => item._id === id);
    if (!lot) return fail(404, "Auction lot not found");
    const season = seasonById(db, lot.seasonRef);
    if (season.status === "completed" || season.status === "archived") fail(409, "Auction is closed for this season");

    const nextPosition = input.playerPosition ?? lot.playerPosition;
    const nextIconStatus = input.isIconPlayer ?? lot.isIconPlayer;
    if (input.auctionStatus === "sold") {
      const selectedSeasonTeamId = input.seasonTeamId ?? (lot.auctionStatus === "sold" ? lot.seasonTeamRef : null);
      const purchasePrice = input.purchasePrice ?? (lot.auctionStatus === "sold" ? lot.purchasePrice : null);
      if (!selectedSeasonTeamId || purchasePrice === null || purchasePrice === undefined) {
        fail(422, "A sold lot must have a season team and purchase price");
      }
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) fail(422, "Purchase price must be zero or greater");

      const seasonTeam = db.seasonTeams.find((item) =>
        item._id === selectedSeasonTeamId && item.seasonRef === lot.seasonRef,
      );
      if (!seasonTeam || ["withdrawn", "eliminated", "completed"].includes(seasonTeam.status)) {
        fail(422, "Select an eligible team registered in this season");
      }
      const player = playerById(db, lot.playerRef);
      if (player.status !== "active") fail(409, "Only active players can be assigned to a team");

      const existing = soldLots(db, lot.seasonRef, seasonTeam._id).filter((item) => item._id !== lot._id);
      const settings = season.auctionSettings;
      const spent = existing.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
      if (existing.length >= settings.teamSquadSize) fail(422, "Team squad size limit reached");
      if (spent + purchasePrice > settings.budgetPerTeam) fail(422, "Team auction budget exceeded");
      if (nextIconStatus && existing.filter((item) => item.isIconPlayer).length >= settings.iconPlayerLimit) {
        fail(422, "Icon player limit reached");
      }
      const isGoalkeeper = nextPosition === "goalkeeper";
      if (isGoalkeeper && existing.filter((item) => item.playerPosition === "goalkeeper").length >= settings.goalkeeperLimit) {
        fail(422, "Goalkeeper limit reached");
      }

      const jerseyNo = input.jerseyNo !== undefined
        ? input.jerseyNo
        : lot.auctionStatus === "sold" && lot.seasonTeamRef === seasonTeam._id
          ? lot.jerseyNo
          : null;
      if (jerseyNo !== null && (!Number.isInteger(jerseyNo) || jerseyNo < 1 || jerseyNo > 99)) {
        fail(422, "Jersey number must be between 1 and 99");
      }
      if (jerseyNo !== null && existing.some((item) => item.jerseyNo === jerseyNo)) {
        fail(409, "Jersey number is already used by this team in this season");
      }

      lot.auctionStatus = "sold";
      lot.seasonTeamRef = seasonTeam._id;
      lot.purchasePrice = purchasePrice;
      lot.jerseyNo = jerseyNo;
      lot.soldAt = now();
    } else {
      lot.auctionStatus = input.auctionStatus;
      lot.seasonTeamRef = null;
      lot.purchasePrice = null;
      lot.jerseyNo = null;
      lot.soldAt = null;
    }

    lot.playerPosition = nextPosition;
    lot.isIconPlayer = nextIconStatus;
    lot.isGoalkeeper = nextPosition === "goalkeeper";
    lot.updatedAt = now();
    season.auctionRevision += 1;
    commitSeasonDb(db);
    return ok("Auction lot updated", populatedLot(db, lot));
  },
  async updateAuctionLotStatus(id: string, auctionStatus: "pending" | "unsold" | "withdrawn") {
    return this.updateAuctionLot(id, { auctionStatus });
  },
  async getSeasonTeamDashboard(teamId: string, seasonId: string) {
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    const team = teamById(db, teamId);
    const st = db.seasonTeams.find((item) => item.seasonRef === seasonId && item.teamRef === teamId) ?? null;
    const emptyStats = { played: 0, won: 0, drawn: 0, lost: 0, goalsScored: 0, goalsConceded: 0, goalDifference: 0, cleanSheets: 0, points: 0, topScorer: null };
    if (!st) return ok("Team season dashboard loaded", {
      participates: false, season: seasonBrief(season), team: { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo },
      seasonTeam: null, managers: [], squad: [], stats: emptyStats, recentFixtures: [], upcomingFixtures: [],
    } as unknown as SeasonTeamDashboard);
    const stats = teamRecord(db, seasonId, st._id);
    const squad = soldLots(db, seasonId, st._id).map((lot) => {
      const player = playerById(db, lot.playerRef);
      return { player: { _id: player._id, name: player.name, profilePic: player.profilePic }, position: lot.playerPosition, jerseyNo: lot.jerseyNo, purchasePrice: lot.purchasePrice, isIconPlayer: lot.isIconPlayer, isGoalkeeper: lot.playerPosition === "goalkeeper" };
    });
    const related = db.matches.filter((m) => m.seasonRef === seasonId && (m.homeSeasonTeamRef === st._id || m.awaySeasonTeamRef === st._id));
    const recentFixtures = related.filter((m) => m.status === "completed").sort((a, b) => b.kickoffAt.localeCompare(a.kickoffAt)).slice(0, 5).map((m) => fixture(db, m));
    const upcomingFixtures = related.filter((m) => m.status === "scheduled" || m.status === "live").sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)).slice(0, 5).map((m) => fixture(db, m));
    const managersForTeam = st.managerRefs.map((id) => db.managers.find((m) => m._id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m)).map((m) => ({ _id: m._id, name: m.name, role: m.role, profilePic: m.profilePic }));
    return ok("Team season dashboard loaded", {
      participates: true, season: seasonBrief(season), team: { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo },
      seasonTeam: teamBrief(db, st), managers: managersForTeam, squad, stats, recentFixtures, upcomingFixtures,
    } as SeasonTeamDashboard);
  },
  async getPlayerHistory(playerId: string) {
    const db = readSeasonDb();
    const player = playerById(db, playerId);
    const orderedLots = db.auctionLots.filter((lot) => lot.playerRef === playerId).sort((a, b) => {
      const aSeason = seasonById(db, a.seasonRef).seasonNumber;
      const bSeason = seasonById(db, b.seasonRef).seasonNumber;
      return aSeason - bSeason;
    });
    const currentSeason = db.seasons.find((s) => s.status === "active") ?? [...db.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber)[0] ?? null;
    const mapHistory = (lot: MockAuctionLot) => {
      const season = seasonById(db, lot.seasonRef);
      const st = lot.seasonTeamRef ? db.seasonTeams.find((item) => item._id === lot.seasonTeamRef) ?? null : null;
      return { season: seasonBrief(season), status: lot.auctionStatus, team: st ? teamBrief(db, st) : null, position: lot.playerPosition, jerseyNo: lot.jerseyNo, purchasePrice: lot.purchasePrice, isIconPlayer: lot.isIconPlayer, isGoalkeeper: lot.playerPosition === "goalkeeper", soldAt: lot.soldAt };
    };
    const goalCounts = new Map<string, number>();
    for (const match of db.matches) if (match.status === "completed") for (const goal of match.goals) {
      if (goal.goalType === "normal" && goal.scorerPlayerRef === playerId) goalCounts.set(match.seasonRef, (goalCounts.get(match.seasonRef) ?? 0) + 1);
    }
    const goalHistory = db.seasons.filter((s) => goalCounts.has(s._id)).sort((a, b) => a.seasonNumber - b.seasonNumber).map((s) => ({ season: seasonBrief(s), goals: goalCounts.get(s._id)! }));
    const currentLot = currentSeason ? orderedLots.find((lot) => lot.seasonRef === currentSeason._id && lot.auctionStatus === "sold") : undefined;
    const currentSt = currentLot?.seasonTeamRef ? db.seasonTeams.find((st) => st._id === currentLot.seasonTeamRef) : null;
    return ok("Player history loaded", {
      player: { _id: player._id, name: player.name, mobile: player.mobile, email: player.email, dateOfBirth: player.dateOfBirth, profilePic: player.profilePic, status: player.status },
      currentSeason: currentSeason ? seasonBrief(currentSeason) : null,
      currentSeasonTeam: currentLot && currentSt ? { seasonTeamId: currentSt._id, team: teamBrief(db, currentSt), position: currentLot.playerPosition, jerseyNo: currentLot.jerseyNo, purchasePrice: currentLot.purchasePrice, isIconPlayer: currentLot.isIconPlayer, isGoalkeeper: currentLot.playerPosition === "goalkeeper" } : null,
      auctionHistory: orderedLots.map(mapHistory), teamMovementHistory: orderedLots.filter((lot) => lot.auctionStatus === "sold").map(mapHistory),
      goalHistory, totalNormalGoals: [...goalCounts.values()].reduce((sum, count) => sum + count, 0),
    } as PlayerHistory);
  },
  async getSeasonStandings(seasonId: string) {
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    return ok("Season standings loaded", {
      season: seasonBrief(season),
      groups: groupStandings(db, season),
    });
  },
  async getSeasonTopScorers(seasonId: string) {
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    const counts = new Map<string, number>();
    const playerTeams = new Map<string, string>();
    for (const match of db.matches) {
      if (match.seasonRef !== seasonId || match.status !== "completed") continue;
      for (const goal of match.goals) {
        if (goal.goalType !== "normal" || !goal.scorerPlayerRef) continue;
        counts.set(goal.scorerPlayerRef, (counts.get(goal.scorerPlayerRef) ?? 0) + 1);
        if (goal.playerSeasonTeamRef) playerTeams.set(goal.scorerPlayerRef, goal.playerSeasonTeamRef);
      }
    }
    const rows = [...counts.entries()].map(([playerId, goals]) => {
      const player = playerById(db, playerId);
      const lot = db.auctionLots.find((item) =>
        item.seasonRef === seasonId && item.playerRef === playerId && item.auctionStatus === "sold",
      );
      const seasonTeamId = playerTeams.get(playerId) ?? lot?.seasonTeamRef ?? null;
      const seasonTeam = seasonTeamId
        ? db.seasonTeams.find((item) => item._id === seasonTeamId && item.seasonRef === seasonId) ?? null
        : null;
      const position = lot?.playerPosition ?? null;
      return {
        rank: 0,
        player: { _id: player._id, name: player.name, profilePic: player.profilePic },
        team: seasonTeam ? teamBrief(db, seasonTeam) : null,
        position,
        jerseyNo: lot?.jerseyNo ?? null,
        goals,
      };
    }).sort((a, b) => b.goals - a.goals || a.player.name.localeCompare(b.player.name));
    let currentRank = 0;
    let previousGoals = -1;
    rows.forEach((row, index) => {
      if (row.goals !== previousGoals) {
        currentRank = index + 1;
        previousGoals = row.goals;
      }
      row.rank = currentRank;
    });
    return ok("Season top scorers loaded", { season: seasonBrief(season), items: rows });
  },
};

import type { ApiResponse } from "@/types/api.types";
import type { Venue, VenueWrite } from "@/types/venue.types";
import type { AuctionLot, AuctionLotsQuery, AuctionSummary, Season, SeasonTeam, SeasonWrite, SeasonPatch, UpdateAuctionLotInput } from "@/types/season.types";
import type { PlayerHistory, SeasonTeamDashboard } from "@/types/seasonStatistics.types";
import type { SeasonGroup, SeasonMatch, SeasonMatchQuery, SeasonMatchWrite, SeasonMatchCreateWrite } from "@/types/seasonMatch.types";
import { readSeasonDb, commitSeasonDb } from "@/mocks/seasonStore";
import { readDb as readPrimaryDb, readSession, requireAdmin } from "@/mocks/store";
import type { MockAuctionLot, MockSeason, MockSeasonAward, MockSeasonMatch, MockSeasonTeam, MockVenue, SeasonMockDatabase } from "@/mocks/seasonSeed";
import type { SeasonAward, SeasonAwardInput } from "@/types/seasonAward.types";
import { ApiError } from "@/utils/errorHandler";
import { getMockAuctionSetupBlockers } from "@/mocks/auctionCompletionRules";
import { createMockObjectId } from "@/mocks/objectId";
import { getMockFixtureGroupReadinessBlockers, hasMockMatchIncidents } from "@/mocks/seasonFixtureRules";
import {
  assertMockGoalManagementAllowed,
  assertMockShootoutScore,
  assertMockStatusTransition,
  calculateMockCompletedWinner,
} from "@/mocks/matchLifecycleRules";

const newId = () => createMockObjectId();
const now = () => new Date().toISOString();
const ok = <T>(message: string, data: T): ApiResponse<T> => ({ success: true, message, data });
function fail(status: number, message: string, errorCode?: string, fieldErrors?: Record<string, string>): never {
  throw new ApiError(status, message, { errorCode: errorCode ?? (status === 409 ? "CONFLICT" : "RULE"), fieldErrors });
}

function seasonById(db: SeasonMockDatabase, id: string): MockSeason {
  const season = db.seasons.find((item) => item._id === id);
  if (!season) return fail(404, "Season not found");
  return season;
}
function assertActiveSeasonForMatchOperations(season: MockSeason, action: string): void {
  if (season.status !== "active") {
    fail(409, `${action} is available only while the season is Active.`, "SEASON_NOT_ACTIVE");
  }
}
function presentAward(db: SeasonMockDatabase, award: MockSeasonAward): SeasonAward {
  return {
    ...award,
    recipients: (Array.isArray(award?.recipients) ? award.recipients : []).filter(Boolean).map((recipient) => {
      const seasonTeam = db.seasonTeams.find((item) => item._id === recipient.seasonTeamRef);
      const team = seasonTeam ? teamById(db, seasonTeam.teamRef) : null;
      return {
        ...recipient,
        teamNameSnapshot: team?.name ?? recipient.teamNameSnapshot,
        profileImageSnapshot: recipient.playerRef
          ? db.players.find((player) => player._id === recipient.playerRef)?.profilePic ?? recipient.profileImageSnapshot
          : recipient.profileImageSnapshot,
        teamLogoSnapshot: team?.logo ?? recipient.teamLogoSnapshot,
      };
    }),
  };
}
function seasonBrief(season: MockSeason) {
  return { _id: season._id, name: season.name, seasonNumber: season.seasonNumber, year: season.year, status: season.status };
}
function teamById(db: SeasonMockDatabase, id: string) {
  const seasonCopy = db.teams.find((item) => item._id === id);
  // The compatibility mock and season mock can contain separate Team copies.
  // Older preview versions created permanent Teams only in the compatibility store,
  // so fall back to that master record instead of reporting a false "Team not found".
  const master = readPrimaryDb().teams.find((item) => item._id === id);
  if (!seasonCopy && !master) return fail(404, "Team not found");

  const team = seasonCopy ?? { ...master!, __v: 0 };
  if (!master) return team;
  return {
    ...team,
    name: master.name,
    shortName: master.shortName,
    description: master.description,
    logo: master.logo,
    poster: master.poster,
    status: master.status,
    updatedAt: master.updatedAt,
  };
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
  return { _id: st._id, teamId: team._id, displayName: team.name, shortName: team.shortName, logo: team.logo, groupRef: st.groupRef, groupName: group?.groupName ?? null };
}
function populatedSeasonTeam(db: SeasonMockDatabase, st: MockSeasonTeam): SeasonTeam {
  const team = teamById(db, st.teamRef);
  const group = groupById(db, st.groupRef);
  return {
    _id: st._id, seasonRef: st.seasonRef, teamRef: st.teamRef, displayName: team.name,
    logoSnapshot: team.logo, groupRef: st.groupRef, managerRefs: [...st.managerRefs],
    playersCount: db.auctionLots.filter((lot) => lot.seasonRef === st.seasonRef && lot.seasonTeamRef === st._id && lot.auctionStatus === "sold").length,
    status: st.status,
    team: { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo },
    group: group ? { _id: group._id, groupName: group.groupName, displayOrder: group.displayOrder } : null,
    managers: st.managerRefs.map((id) => db.managers.find((m) => m._id === id)).filter((m): m is NonNullable<typeof m> => Boolean(m)).map((m) => ({ _id: m._id, name: m.name, role: m.role, profilePic: m.profilePic })),
  };
}
function populatedLot(db: SeasonMockDatabase, lot: MockAuctionLot): AuctionLot {
  const player = playerById(db, lot.playerRef);
  const st = lot.seasonTeamRef ? db.seasonTeams.find((item) => item._id === lot.seasonTeamRef) ?? null : null;
  const seasonTeamRef = st ? {
    _id: st._id, displayName: teamById(db, st.teamRef).name,
    team: (() => { const team = teamById(db, st.teamRef); return { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo }; })(),
  } : null;
  return {
    _id: lot._id, seasonRef: lot.seasonRef, seasonTeamRef,
    playerRef: { _id: player._id, name: player.name, profilePic: player.profilePic },
    lotNumber: lot.lotNumber, auctionStatus: lot.auctionStatus, purchasePrice: lot.purchasePrice,
    playerPosition: lot.playerPosition, isIconPlayer: lot.isIconPlayer, isGoalkeeper: lot.isGoalkeeper,
    jerseyNo: lot.jerseyNo, nominatedAt: lot.nominatedAt, soldAt: lot.soldAt,
  };
}
function soldLots(db: SeasonMockDatabase, seasonId: string, seasonTeamId?: string) {
  return db.auctionLots.filter((lot) => lot.seasonRef === seasonId && lot.auctionStatus === "sold" && (!seasonTeamId || lot.seasonTeamRef === seasonTeamId));
}
function summaryFor(db: SeasonMockDatabase, season: MockSeason): AuctionSummary {
  const lots = db.auctionLots.filter((lot) => lot.seasonRef === season._id);
  const nominatedLots = lots.filter((lot) => lot.auctionStatus !== "withdrawn");
  const teams = db.seasonTeams.filter((st) => st.seasonRef === season._id).map((st) => {
    const historicalTeamLots = db.auctionLots.filter((lot) => lot.seasonRef === season._id && lot.seasonTeamRef === st._id && ["sold", "withdrawn"].includes(lot.auctionStatus));
    const teamLots = historicalTeamLots.filter((lot) => lot.auctionStatus === "sold");
    const totalSpent = teamLots.reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0);
    const settings = season.auctionSettings;
    return {
      seasonTeamId: st._id, teamId: st.teamRef, displayName: teamById(db, st.teamRef).name, logoSnapshot: teamById(db, st.teamRef).logo,
      status: st.status, budget: settings.budgetPerTeam, playersSigned: teamLots.length,
      remainingSlots: Math.max(0, settings.teamSquadSize - teamLots.length), totalSpent,
      balance: settings.budgetPerTeam - totalSpent,
      averagePrice: teamLots.length ? Math.round(totalSpent / teamLots.length) : 0,
      iconCount: teamLots.filter((lot) => lot.isIconPlayer).length,
      goalkeeperCount: teamLots.filter((lot) => lot.isGoalkeeper).length,
      lots: historicalTeamLots.map((lot) => populatedLot(db, lot)),
    };
  });
  return {
    season: { _id: season._id, name: season.name, year: season.year, status: season.status, auctionSettings: season.auctionSettings, auctionLifecycleStatus: season.auctionLifecycleStatus },
    totals: {
      participatingTeams: teams.length, lots: lots.length,
      sold: lots.filter((lot) => lot.auctionStatus === "sold").length,
      pending: lots.filter((lot) => lot.auctionStatus === "pending").length,
      unsold: lots.filter((lot) => lot.auctionStatus === "unsold").length,
      withdrawn: lots.filter((lot) => lot.auctionStatus === "withdrawn").length,
      totalSoldValue: soldLots(db, season._id).reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0),
      nominatedIconPlayers: nominatedLots.filter((lot) => lot.isIconPlayer).length,
      nominatedGoalkeepers: nominatedLots.filter((lot) => lot.isGoalkeeper).length,
    },
    nominatedPlayerIds: lots.map((lot) => lot.playerRef),
    teams,
  };
}
function matchScore(match: SeasonMockDatabase["matches"][number], seasonTeamId: string) {
  return match.goals.filter((goal) => goal.scoringSeasonTeamRef === seasonTeamId).length;
}

function assertLiveMatch(match: MockSeasonMatch): void {
  assertMockGoalManagementAllowed(match.status, fail);
}

function assertNoOtherLiveMatch(
  db: SeasonMockDatabase,
  seasonId: string,
  homeId: string,
  awayId: string,
  excludeMatchId?: string,
) {
  const requestedTeamIds = new Set([homeId, awayId]);
  const conflictingTeamIds = new Set<string>();

  for (const fixture of db.matches) {
    if (fixture.seasonRef !== seasonId || fixture.status !== "live" || fixture._id === excludeMatchId) continue;
    for (const teamId of [fixture.homeSeasonTeamRef, fixture.awaySeasonTeamRef]) {
      if (requestedTeamIds.has(teamId)) conflictingTeamIds.add(teamId);
    }
  }

  if (!conflictingTeamIds.size) return;
  const names = [...conflictingTeamIds].map((teamId) =>
    db.seasonTeams.find((team) => team._id === teamId && team.seasonRef === seasonId)?.displayName ?? "This team",
  );
  fail(
    409,
    `${names.join(" and ")} already has another match ongoing. A team can only have one ongoing match at a time in a season.`,
    "TEAM_ALREADY_HAS_LIVE_MATCH",
  );
}

function validateMockPair(db: SeasonMockDatabase, season: MockSeason, stage: MockSeasonMatch["stage"], groupRef: string | null, roundNumber: number, homeId: string, awayId: string, excludeId?: string) {
  const fixtures = db.matches.filter((item) => item.seasonRef === season._id && item.stage === stage
    && (stage === "group" ? item.groupRef === groupRef : true)
    && ((item.homeSeasonTeamRef === homeId && item.awaySeasonTeamRef === awayId) || (item.homeSeasonTeamRef === awayId && item.awaySeasonTeamRef === homeId))
    && item._id !== excludeId);
  if (fixtures.some((item) => item.roundNumber === roundNumber)) fail(409, "These two teams already have a fixture in this round. Reversing home and away does not create a separate fixture.");
  if (!season.homeAndAwayFixtures && fixtures.length) fail(409, "This team pair already has a fixture. Enable Home and Away Fixtures in season settings to schedule the return fixture.");
  if (season.homeAndAwayFixtures) {
    if (fixtures.length >= 2) fail(409, "A team pair can have at most two fixtures in a home-and-away season");
    if (fixtures.some((item) => item.homeSeasonTeamRef === homeId && item.awaySeasonTeamRef === awayId)) fail(409, "The return fixture must reverse the home and away teams.");
  }
}
function mockGroupQualifiers(db: SeasonMockDatabase, season: MockSeason) {
  const qualified = new Set<string>();
  for (const group of db.groups.filter((item) => item.seasonRef === season._id)) {
    const teams = db.seasonTeams.filter((team) => team.seasonRef === season._id && team.groupRef === group._id && team.status === "active");
    const rows = teams.map((team) => ({ team, points: 0, goalsFor: 0, goalsAgainst: 0 }));
    const byId = new Map(rows.map((row) => [row.team._id, row]));
    for (const match of db.matches.filter((item) => item.seasonRef === season._id && item.stage === "group" && item.status === "completed")) {
      const home = byId.get(match.homeSeasonTeamRef), away = byId.get(match.awaySeasonTeamRef);
      if (!home || !away) continue;
      const homeGoals = matchScore(match, home.team._id), awayGoals = matchScore(match, away.team._id);
      home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
      if (homeGoals > awayGoals) { home.points += season.pointsRules.win; away.points += season.pointsRules.loss; }
      else if (homeGoals < awayGoals) { away.points += season.pointsRules.win; home.points += season.pointsRules.loss; }
      else { home.points += season.pointsRules.draw; away.points += season.pointsRules.draw; }
    }
    rows.sort((a, b) => b.points - a.points ||
      (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor || a.team.displayName.localeCompare(b.team.displayName));
    rows.slice(0, 2).forEach((row) => qualified.add(row.team._id));
  }
  return qualified;
}

function mockKnockoutEligibleTeams(db: SeasonMockDatabase, season: MockSeason, stage: MockSeasonMatch["stage"]) {
  const active = new Set(db.seasonTeams.filter((team) => team.seasonRef === season._id && team.status === "active").map((team) => team._id));
  let groupQualifiers = new Set<string>();
  if (season.groupStageEnabled) {
    const groupMatches = db.matches.filter((match) => match.seasonRef === season._id && match.stage === "group");
    if (!groupMatches.length || groupMatches.some((match) => !["completed", "cancelled", "abandoned"].includes(match.status))) {
      fail(409, "All group-stage fixtures must be resolved before creating knockout fixtures");
    }
    groupQualifiers = mockGroupQualifiers(db, season);
  }
  const stageMatches = (name: MockSeasonMatch["stage"]) => db.matches.filter((match) => match.seasonRef === season._id && match.stage === name);
  const winners = (matches: MockSeasonMatch[], losers = false) => {
    const result = new Set<string>();
    for (const match of matches) {
      if (match.status !== "completed" || !match.winnerSeasonTeamRef) continue;
      if (!losers) result.add(match.winnerSeasonTeamRef);
      else result.add(match.winnerSeasonTeamRef === match.homeSeasonTeamRef ? match.awaySeasonTeamRef : match.homeSeasonTeamRef);
    }
    return result;
  };
  const previous = stage === "quarter_final" ? stageMatches("round_of_16")
    : stage === "semi_final" ? (stageMatches("quarter_final").length ? stageMatches("quarter_final") : stageMatches("round_of_16"))
    : stage === "final" || stage === "third_place" ? stageMatches("semi_final") : [];
  if (previous.length && previous.some((match) => match.status !== "completed")) fail(409, "All fixtures in the previous knockout stage must be completed before advancing");
  if ((stage === "final" || stage === "third_place") && !stageMatches("semi_final").length) fail(409, "Semi-final fixtures must be recorded before creating the final or third-place playoff");
  if (stage === "round_of_16") return groupQualifiers.size ? groupQualifiers : active;
  if (stage === "quarter_final") return stageMatches("round_of_16").length ? winners(stageMatches("round_of_16")) : groupQualifiers.size ? groupQualifiers : active;
  if (stage === "semi_final") return stageMatches("quarter_final").length ? winners(stageMatches("quarter_final")) : stageMatches("round_of_16").length ? winners(stageMatches("round_of_16")) : groupQualifiers.size ? groupQualifiers : active;
  if (stage === "final") return winners(stageMatches("semi_final"));
  if (stage === "third_place") return winners(stageMatches("semi_final"), true);
  return new Set<string>();
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
function populatedMatchTeam(db: SeasonMockDatabase, seasonTeamId: string) {
  const seasonTeam = db.seasonTeams.find((item) => item._id === seasonTeamId);
  if (!seasonTeam) return null;
  const team = teamById(db, seasonTeam.teamRef);
  return {
    _id: seasonTeam._id,
    displayName: teamById(db, seasonTeam.teamRef).name,
    logoSnapshot: teamById(db, seasonTeam.teamRef).logo,
    team: { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo },
  };
}
function populatedSeasonMatch(db: SeasonMockDatabase, match: MockSeasonMatch): SeasonMatch {
  return {
    ...match,
    venueRef: (() => { const venue = db.venues.find((item) => item._id === match.venueRef); return venue ? { _id: venue._id, name: venue.name, location: venue.location } : match.venueRef; })(),
    homeSeasonTeamRef: populatedMatchTeam(db, match.homeSeasonTeamRef) ?? match.homeSeasonTeamRef,
    awaySeasonTeamRef: populatedMatchTeam(db, match.awaySeasonTeamRef) ?? match.awaySeasonTeamRef,
    winnerSeasonTeamRef: match.winnerSeasonTeamRef
      ? populatedMatchTeam(db, match.winnerSeasonTeamRef) ?? match.winnerSeasonTeamRef
      : null,
    cards: (match.cards ?? []).map((card) => {
      const player = db.players.find((item) => item._id === card.playerRef);
      return { ...card, seasonTeamRef: populatedMatchTeam(db, card.seasonTeamRef) ?? card.seasonTeamRef, playerRef: player ? { _id: player._id, name: player.name, profilePic: player.profilePic } : card.playerRef };
    }),
    goals: match.goals.map((goal) => {
      const scorer = goal.scorerPlayerRef ? playerById(db, goal.scorerPlayerRef) : null;
      return {
        ...goal,
        scoringSeasonTeamRef: populatedMatchTeam(db, goal.scoringSeasonTeamRef) ?? goal.scoringSeasonTeamRef,
        scorerPlayerRef: scorer ? { _id: scorer._id, name: scorer.name, profilePic: scorer.profilePic } : null,
        playerSeasonTeamRef: goal.playerSeasonTeamRef
          ? populatedMatchTeam(db, goal.playerSeasonTeamRef) ?? goal.playerSeasonTeamRef
          : null,
      };
    }),
    penaltyShootout: match.penaltyShootout ? {
      ...match.penaltyShootout,
      kicks: match.penaltyShootout.kicks.map((kick) => ({ ...kick })),
    } : null,
  } as SeasonMatch;
}
function teamRecord(db: SeasonMockDatabase, seasonId: string, seasonTeamId: string, groupOnly = false) {
  const relevant = db.matches.filter((m) => m.seasonRef === seasonId && (m.status === "completed" || (groupOnly && m.status === "live")) && (!groupOnly || m.stage === "group") && (m.homeSeasonTeamRef === seasonTeamId || m.awaySeasonTeamRef === seasonTeamId));
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
  const groups = db.groups.filter((group) => group.seasonRef === season._id);
  const groupById = new Map(groups.map((group) => [group._id, group]));
  const participatingTeams = db.seasonTeams.filter(
    (seasonTeam) => seasonTeam.seasonRef === season._id && seasonTeam.status !== "withdrawn",
  );
  const teamsByGroup = new Map<string, typeof participatingTeams>();

  for (const seasonTeam of participatingTeams) {
    const groupKey = seasonTeam.groupRef ?? "ungrouped";
    const entries = teamsByGroup.get(groupKey) ?? [];
    entries.push(seasonTeam);
    teamsByGroup.set(groupKey, entries);
  }

  const tieBreakers = season.standingsTieBreakers ?? ["points", "goalDifference", "goalsScored", "teamNameAsc"];
  return [...teamsByGroup.entries()].map(([groupKey, seasonTeams]) => {
    const rows = seasonTeams.map((seasonTeam) => ({
      team: teamBrief(db, seasonTeam),
      ...teamRecord(db, season._id, seasonTeam._id, true),
    }));

    rows.sort((a, b) => {
      for (const tieBreaker of tieBreakers) {
        const difference = tieBreaker === "points"
          ? b.points - a.points
          : tieBreaker === "goalDifference"
            ? b.goalDifference - a.goalDifference
            : tieBreaker === "goalsScored"
              ? b.goalsScored - a.goalsScored
              : a.team.displayName.localeCompare(b.team.displayName);
        if (difference !== 0) return difference;
      }
      return a.team.displayName.localeCompare(b.team.displayName);
    });

    const group = groupKey === "ungrouped" ? null : groupById.get(groupKey);
    return {
      groupRef: groupKey === "ungrouped" ? null : groupKey,
      groupName: groupKey === "ungrouped" ? "Ungrouped" : group?.groupName ?? "Ungrouped",
      rows: rows.map((row, index) => ({ position: index + 1, ...row, qualified: index < 2 })),
    };
  }).sort((a, b) => a.groupName.localeCompare(b.groupName));
}

function mockAwardReadiness(db: SeasonMockDatabase, seasonId: string): string[] {
  const matches = db.matches.filter((match) => match.seasonRef === seasonId);
  const blockers: string[] = [];
  if (!matches.length) blockers.push("Create fixtures before assigning achievements");
  for (const match of matches) {
    if (["live", "scheduled", "postponed", "abandoned"].includes(match.status)) blockers.push("Match " + match.matchNumber + " is " + match.status);
    if (match.status === "cancelled" && !match.resolutionHistory?.some((entry) => entry.status === "cancelled" && entry.reason.trim().length >= 3 && Boolean(entry.decidedAt))) blockers.push("Match " + match.matchNumber + " needs an audited cancellation reason");
    if (match.status === "completed" && match.stage !== "group" && (!match.winnerSeasonTeamRef || (match.winnerSeasonTeamRef !== match.homeSeasonTeamRef && match.winnerSeasonTeamRef !== match.awaySeasonTeamRef))) blockers.push("Knockout match " + match.matchNumber + " has no valid winner");
  }
  const pending = db.auctionLots.filter((lot) => lot.seasonRef === seasonId && lot.auctionStatus === "pending").length;
  if (pending) blockers.push(pending + " pending auction lot(s) remain");
  return blockers;
}

export const seasonPreviewRepository = {

  async getSeasonAwards(seasonId: string) {
    const db=readSeasonDb(); seasonById(db,seasonId);
    return ok("Season achievements loaded",(Array.isArray(db.awards)?db.awards:[]).filter((award)=>award?.seasonRef===seasonId).map((award)=>presentAward(db, award)));
  },
  async createSeasonAward(seasonId:string,input:SeasonAwardInput) {
    requireAdmin(); const db=readSeasonDb(); const season=seasonById(db,seasonId);
    if(season.status!=="active") fail(409,"Awards can only be managed while a season is Active");
    const readiness = mockAwardReadiness(db, seasonId); if (readiness.length) fail(409, readiness.join("; "));
    if(db.awards.some((a)=>a.seasonRef===seasonId&&a.awardType===input.awardType)) fail(409,"This award category already exists");
    if(input.awardType==="special"&&!input.title?.trim()) fail(422,"A title is required for a special award");
    const recipients=input.recipients.map((item)=>{
      const st=db.seasonTeams.find((x)=>x._id===item.seasonTeamId&&x.seasonRef===seasonId&&["registered","active"].includes(x.status));
      if(!st) return fail(422,"Recipient SeasonTeam is invalid for this season");
      const player=item.playerId?db.players.find((x)=>x._id===item.playerId):null;
      const currentTeam=teamById(db,st.teamRef);
      if(item.playerId&&(!player||!db.auctionLots.some((lot)=>lot.seasonRef===seasonId&&lot.seasonTeamRef===st._id&&lot.playerRef===player._id&&lot.auctionStatus==="sold"))) fail(422,"Player is not rostered for this SeasonTeam");
      if(["champions","runner_up"].includes(input.awardType)&&(input.recipients.length!==1||player)) fail(422,"Team awards require exactly one SeasonTeam");
      if(!["champions","runner_up","special"].includes(input.awardType)&&!player) fail(422,"This award requires a player recipient");
      return {_id:newId(),recipientType:player?"player" as const:"season_team" as const,seasonTeamRef:st._id,playerRef:player?._id??null,displayNameSnapshot:player?.name??currentTeam.name,profileImageSnapshot:null,teamNameSnapshot:currentTeam.name,teamLogoSnapshot:null};
    });
    if(!recipients.length||recipients.length>20) fail(422,"An award must have one to twenty recipients");
    if(new Set(recipients.map((r)=>r.playerRef?r.seasonTeamRef+":"+r.playerRef:r.seasonTeamRef+":team")).size!==recipients.length) fail(422,"Duplicate award recipients are not allowed");
    if(["champions","runner_up"].includes(input.awardType)) {
      const other=db.awards.find((a)=>a.seasonRef===seasonId&&a.awardType!==input.awardType&&["champions","runner_up"].includes(a.awardType));
      if(other?.recipients[0]?.seasonTeamRef===recipients[0].seasonTeamRef) fail(422,"Champion and Runner-up must be different teams");
    }
    const labels:Record<SeasonAwardInput["awardType"],string>={champions:"Champions",runner_up:"Runner-up",golden_boot:"Golden Boot / Top Scorer",golden_glove:"Golden Glove",player_of_the_season:"Player of the Season",best_young_player:"Best Young Player",best_defender:"Best Defender",best_midfielder:"Best Midfielder",special:input.title?.trim() || "Special Award"};
    const stamp=now(); const award:MockSeasonAward={_id:newId(),seasonRef:seasonId,awardType:input.awardType,title:input.title?.trim()||labels[input.awardType],description:input.description?.trim()||null,recipients,createdAt:stamp,updatedAt:stamp};
    db.awards.push(award);commitSeasonDb(db);return ok("Season achievement saved",presentAward(db, award));
  },
  async updateSeasonAward(seasonId:string,awardId:string,input:Partial<SeasonAwardInput>) {
    requireAdmin();const db=readSeasonDb();const season=seasonById(db,seasonId);
    if(season.status!=="active") fail(409,"Awards can only be edited while a season is Active");
    const readiness = mockAwardReadiness(db, seasonId); if (readiness.length) fail(409, readiness.join("; "));
    const award=db.awards.find((a)=>a._id===awardId&&a.seasonRef===seasonId);if(!award)return fail(404,"Season award not found");
    const nextType=input.awardType??award.awardType;
    if(input.awardType&&db.awards.some((a)=>a._id!==awardId&&a.seasonRef===seasonId&&a.awardType===input.awardType))fail(409,"This award category already exists");
    if(input.recipients) {
      if(!input.recipients.length||input.recipients.length>20)fail(422,"An award must have one to twenty recipients");
      const replacement=input.recipients.map((item)=>{
        const st=db.seasonTeams.find((x)=>x._id===item.seasonTeamId&&x.seasonRef===seasonId&&["registered","active"].includes(x.status));if(!st)return fail(422,"Recipient SeasonTeam is invalid for this season");
        const player=item.playerId?db.players.find((x)=>x._id===item.playerId):null;
        const currentTeam=teamById(db,st.teamRef);
        if(item.playerId&&(!player||!db.auctionLots.some((lot)=>lot.seasonRef===seasonId&&lot.seasonTeamRef===st._id&&lot.playerRef===player._id&&lot.auctionStatus==="sold")))fail(422,"Player is not rostered for this SeasonTeam");
        if(["champions","runner_up"].includes(nextType)&&(input.recipients!.length!==1||player))fail(422,"Team awards require exactly one SeasonTeam");
        if(!["champions","runner_up","special"].includes(nextType)&&!player)fail(422,"This award requires a player recipient");
        return {_id:newId(),recipientType:player?"player" as const:"season_team" as const,seasonTeamRef:st._id,playerRef:player?._id??null,displayNameSnapshot:player?.name??currentTeam.name,profileImageSnapshot:null,teamNameSnapshot:currentTeam.name,teamLogoSnapshot:null};
      });
      if(new Set(replacement.map((r)=>r.playerRef?r.seasonTeamRef+":"+r.playerRef:r.seasonTeamRef+":team")).size!==replacement.length)fail(422,"Duplicate award recipients are not allowed");
      if(["champions","runner_up"].includes(nextType)){const other=db.awards.find((a)=>a.seasonRef===seasonId&&a._id!==awardId&&["champions","runner_up"].includes(a.awardType));if(other?.recipients[0]?.seasonTeamRef===replacement[0].seasonTeamRef)fail(422,"Champion and Runner-up must be different teams");}
      award.recipients=replacement;
    }
    if(input.awardType)award.awardType=input.awardType;if(input.title!==undefined)award.title=input.title;if(input.description!==undefined)award.description=input.description;award.updatedAt=now();commitSeasonDb(db);return ok("Season achievement updated",presentAward(db, award));
  },
  async deleteSeasonAward(seasonId:string,awardId:string) {
    requireAdmin();const db=readSeasonDb();const season=seasonById(db,seasonId);if(season.status!=="active")fail(409,"Awards can only be changed while a season is Active");
    const readiness = mockAwardReadiness(db, seasonId); if (readiness.length) fail(409, readiness.join("; "));
    const index=db.awards.findIndex((a)=>a._id===awardId&&a.seasonRef===seasonId);if(index<0)fail(404,"Season award not found");
    if(["champions","runner_up"].includes(db.awards[index].awardType))fail(409,"Mandatory team achievements cannot be deleted");
    db.awards.splice(index,1);commitSeasonDb(db);return ok("Optional award deleted",null);
  },

  async getSeasonGroups(seasonId: string) {
    const db = readSeasonDb();
    seasonById(db, seasonId);
    const groups = db.groups
      .filter((group) => group.seasonRef === seasonId)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.groupName.localeCompare(b.groupName) || a._id.localeCompare(b._id));
    return ok("Season groups loaded", groups as SeasonGroup[]);
  },
  async getSeasonMatches(seasonId: string, query: SeasonMatchQuery = {}) {
    const db = readSeasonDb();
    seasonById(db, seasonId);
    let items = db.matches.filter((match) => match.seasonRef === seasonId);
    if (query.stage) items = items.filter((match) => match.stage === query.stage);
    if (query.groupRef) items = items.filter((match) => match.groupRef === query.groupRef);
    if (query.status) items = items.filter((match) => match.status === query.status);
    if (query.search?.trim()) {
      const needle = query.search.trim().toLowerCase();
      const numberNeedle = Array.from(needle).filter((character) => character >= "0" && character <= "9").join("");
      items = items.filter((match) => {
        const home = db.seasonTeams.find((team) => team._id === match.homeSeasonTeamRef)?.displayName ?? "";
        const away = db.seasonTeams.find((team) => team._id === match.awaySeasonTeamRef)?.displayName ?? "";
        return (numberNeedle && String(match.matchNumber).includes(numberNeedle))
          || home.toLowerCase().includes(needle)
          || away.toLowerCase().includes(needle);
      });
    }
    items.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.matchNumber - b.matchNumber);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.max(1, query.limit ?? 8);
    const total = items.length;
    const data = items.slice((page - 1) * limit, page * limit).map((match) => populatedSeasonMatch(db, match));
    return {
      success: true,
      message: "Season fixtures loaded",
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
  async getSeasonMatch(seasonId: string, matchId: string) {
    const db = readSeasonDb();
    seasonById(db, seasonId);
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    return ok("Season fixture loaded", populatedSeasonMatch(db, match));
  },
  async updateSeasonMatchStatus(
    seasonId: string,
    matchId: string,
    input: { status: MockSeasonMatch["status"]; statusReason?: string; resolutionReason?: string },
  ) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Match status changes");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");

    const nextStatus = input.status;
    assertMockStatusTransition(match.status, nextStatus, fail);
    if (match.status === "live" && nextStatus === "scheduled" && (match.goals.length > 0 || (match.cards ?? []).length > 0)) {
      fail(409, "Remove all recorded goal and card events before reverting this Live match to Scheduled.", "MATCH_HAS_GOALS");
    }
    if (nextStatus === "live") {
      assertNoOtherLiveMatch(db, seasonId, match.homeSeasonTeamRef, match.awaySeasonTeamRef, matchId);
    }
    if (match.status === "postponed" && nextStatus === "scheduled") {
      fail(409, "Postponed matches can only be returned to Scheduled through the reschedule operation with a new kickoff date and time", "MATCH_RESCHEDULE_REQUIRED");
    }

    const statusReason = input.statusReason?.trim();
    const resolutionReason = input.resolutionReason?.trim();
    if (statusReason !== undefined && resolutionReason !== undefined && statusReason !== resolutionReason) {
      fail(422, "Use one consistent reason for the status change", "CONFLICTING_STATUS_REASONS", { statusReason: "Use one consistent reason" });
    }
    if (resolutionReason !== undefined && nextStatus !== "cancelled" && nextStatus !== "abandoned") {
      fail(422, "A resolution reason is only valid when cancelling or abandoning a fixture", "INVALID_FIXTURE_RESOLUTION");
    }
    const reason = statusReason ?? resolutionReason;
    const changed = nextStatus !== match.status;
    if (!changed && reason !== undefined) fail(422, "A status-change reason can only be supplied when the match status changes", "STATUS_REASON_WITHOUT_TRANSITION");
    const requiresReason = ["postponed", "cancelled", "abandoned"].includes(nextStatus)
      || (match.status === "live" && nextStatus === "scheduled");
    if (changed && requiresReason && !reason) {
      fail(422, "A reason is required when postponing, cancelling, abandoning or reverting a match", "MATCH_STATUS_REASON_REQUIRED", { statusReason: "Enter a reason of at least 3 characters" });
    }
    if (reason !== undefined && (reason.length < 3 || reason.length > 500)) {
      fail(422, "Enter a status-change reason between 3 and 500 characters", "INVALID_MATCH_STATUS_REASON", { statusReason: "Reason must contain 3 to 500 characters" });
    }

    const session = readSession();
    if (changed && !session?._id) fail(401, "An authenticated user is required to change match status", "UNAUTHENTICATED");
    if (changed) {
      const changedAt = now();
      match.statusHistory ??= [];
      match.statusHistory.push({
        fromStatus: match.status,
        toStatus: nextStatus,
        reason: reason ?? null,
        changedBy: session!._id,
        changedAt,
        fromKickoffAt: match.kickoffAt,
        toKickoffAt: match.kickoffAt,
      });
      if (nextStatus === "cancelled" || nextStatus === "abandoned") {
        match.resolutionHistory ??= [];
        match.resolutionHistory.push({ status: nextStatus, reason: reason!, decidedAt: changedAt });
      }
      if (match.status === "live" && nextStatus === "scheduled") {
        match.winnerSeasonTeamRef = null;
        match.penaltyShootout = null;
      }
      match.status = nextStatus;
      if (nextStatus === "completed") this.recalculateMockWinner(season, match);
      match.updatedAt = changedAt;
      commitSeasonDb(db);
    }
    return ok("Match status updated", populatedSeasonMatch(db, match));
  },
  async rescheduleSeasonMatch(
    seasonId: string,
    matchId: string,
    input: { kickoffAt: string; reason?: string },
  ) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (season.auctionLifecycleStatus !== "completed") fail(409, "Complete the auction and validate every team roster before creating or changing fixtures.", "AUCTION_NOT_COMPLETED");
    assertActiveSeasonForMatchOperations(season, "Match rescheduling");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    if (match.status !== "postponed") fail(409, "Only Postponed matches can be rescheduled", "MATCH_NOT_POSTPONED");
    assertMockStatusTransition(match.status, "scheduled", fail);

    const kickoff = new Date(input.kickoffAt);
    if (Number.isNaN(kickoff.getTime())) fail(422, "A valid new match date and kick-off time are required", "RESCHEDULE_KICKOFF_REQUIRED", { kickoffAt: "Enter a valid date and kick-off time" });
    if (kickoff.getTime() <= Date.now()) fail(422, "Choose a future date and kick-off time when rescheduling", "RESCHEDULE_KICKOFF_NOT_FUTURE", { kickoffAt: "The new kickoff must be in the future" });
    if (kickoff.getTime() === new Date(match.kickoffAt).getTime()) fail(422, "Choose a new date or kick-off time different from the postponed fixture", "RESCHEDULE_KICKOFF_UNCHANGED", { kickoffAt: "Choose a different date or time" });
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: season.timeZone }).format(kickoff);
    const start = season.startDate ? new Intl.DateTimeFormat("en-CA", { timeZone: season.timeZone }).format(new Date(season.startDate)) : null;
    const end = season.endDate ? new Intl.DateTimeFormat("en-CA", { timeZone: season.timeZone }).format(new Date(season.endDate)) : null;
    if (start && day < start) fail(422, "Fixture date is before the season start date", "FIXTURE_BEFORE_SEASON");
    if (end && day > end) fail(422, "Fixture date is after the season end date", "FIXTURE_AFTER_SEASON");

    const reason = input.reason?.trim() || null;
    if (reason !== null && (reason.length < 3 || reason.length > 500)) {
      fail(422, "Enter a rescheduling reason between 3 and 500 characters", "INVALID_RESCHEDULE_REASON", { reason: "Reason must contain 3 to 500 characters" });
    }
    const sessionId = readSession()?._id;
    if (!sessionId) fail(401, "An authenticated user is required to reschedule a match", "UNAUTHENTICATED");

    const changedAt = now();
    const previousKickoff = match.kickoffAt;
    match.statusHistory ??= [];
    match.statusHistory.push({
      fromStatus: "postponed",
      toStatus: "scheduled",
      reason,
      changedBy: sessionId!,
      changedAt,
      fromKickoffAt: previousKickoff,
      toKickoffAt: kickoff.toISOString(),
    });
    match.status = "scheduled";
    match.kickoffAt = kickoff.toISOString();
    match.updatedAt = changedAt;
    commitSeasonDb(db);
    return ok("Match rescheduled", populatedSeasonMatch(db, match));
  },
  async correctCompletedSeasonMatch(
    seasonId: string,
    matchId: string,
    input: {
      reason: string;
      goals: Array<{ scoringSeasonTeamRef: string; scorerPlayerRef?: string | null; goalType: "normal" | "own_goal" }>;
      penaltyShootout: MockSeasonMatch["penaltyShootout"];
    },
  ) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Completed match corrections");
    if (!season.matchRules) fail(409, "Match rules are unavailable for this historical season", "SEASON_RULES_UNAVAILABLE");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    if (match.status !== "completed") fail(409, "Only Completed matches can use the correction workflow", "MATCH_NOT_COMPLETED");
    const reason = input.reason.trim();
    if (reason.length < 3 || reason.length > 1000) fail(422, "Enter a correction reason between 3 and 1000 characters", "MATCH_CORRECTION_REASON_REQUIRED", { reason: "A correction reason is required" });
    const correctedBy = readSession()?._id;
    if (!correctedBy) fail(403, "An authenticated administrator is required to correct a completed match", "FORBIDDEN");

    const originalGoals = match.goals.map((goal) => ({ ...goal }));
    const originalShootout = match.penaltyShootout ? { ...match.penaltyShootout, kicks: match.penaltyShootout.kicks.map((kick) => ({ ...kick })) } : null;
    const originalWinner = match.winnerSeasonTeamRef;
    const originalScore = {
      homeScore: originalGoals.filter((goal) => goal.scoringSeasonTeamRef === match.homeSeasonTeamRef).length,
      awayScore: originalGoals.filter((goal) => goal.scoringSeasonTeamRef === match.awaySeasonTeamRef).length,
    };
    const usedIds = new Set<string>();
    const correctedGoals: MockSeasonMatch["goals"] = [];
    for (const goal of input.goals) {
      const scoring = goal.scoringSeasonTeamRef;
      if (scoring !== match.homeSeasonTeamRef && scoring !== match.awaySeasonTeamRef) fail(422, "Credited team must be one of the match participants", "INVALID_SCORING_TEAM");
      const scorerId = goal.scorerPlayerRef ?? null;
      const existingGoal = originalGoals.find((item) => !usedIds.has(item._id)
        && item.scoringSeasonTeamRef === scoring && item.scorerPlayerRef === scorerId && item.goalType === goal.goalType);
      if (existingGoal) {
        usedIds.add(existingGoal._id);
        correctedGoals.push({ ...existingGoal });
        continue;
      }
      let playerSeasonTeamRef: string | null = null;
      if (goal.goalType === "normal") {
        if (!scorerId) fail(422, "Select the goal scorer", "SCORER_REQUIRED");
        const player = db.players.find((item) => item._id === scorerId && item.status === "active");
        const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === scorerId && item.auctionStatus === "sold");
        if (!player || !lot || lot.seasonTeamRef !== scoring) fail(422, "Normal goal scorer must be an active player sold to the credited season team", "INVALID_SCORER");
        playerSeasonTeamRef = scoring;
      } else if (goal.goalType === "own_goal" && scorerId) {
        const responsibleTeam = scoring === match.homeSeasonTeamRef ? match.awaySeasonTeamRef : match.homeSeasonTeamRef;
        const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === scorerId && item.auctionStatus === "sold");
        if (!lot || lot.seasonTeamRef !== responsibleTeam) fail(422, "Own-goal player must belong to the opposing season team", "INVALID_OWN_GOAL_PLAYER");
        playerSeasonTeamRef = responsibleTeam;
      } else if (goal.goalType !== "own_goal") fail(422, "Unsupported goal type", "INVALID_GOAL_TYPE");
      correctedGoals.push({ _id: newId(), scoringSeasonTeamRef: scoring, scorerPlayerRef: scorerId, playerSeasonTeamRef, goalType: goal.goalType, createdAt: now() });
    }

    const shootout = input.penaltyShootout ? { ...input.penaltyShootout, kicks: input.penaltyShootout.kicks.map((kick) => ({ ...kick })) } : null;
    if (shootout) {
      assertMockShootoutScore(match, shootout, fail);
      for (const kick of shootout.kicks) {
        if (kick.playerRef) {
          const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === kick.playerRef && item.auctionStatus === "sold");
          if (!lot || lot.seasonTeamRef !== kick.seasonTeamRef) fail(422, "Shootout player must belong to the kicking team", "INVALID_SHOOTOUT_PLAYER");
        }
      }
    }
    const correctedMatch = { ...match, status: "completed" as const, goals: correctedGoals, penaltyShootout: shootout };
    const correctedWinner = calculateMockCompletedWinner(correctedMatch, season, fail);
    const correctedScore = {
      homeScore: correctedGoals.filter((goal) => goal.scoringSeasonTeamRef === match.homeSeasonTeamRef).length,
      awayScore: correctedGoals.filter((goal) => goal.scoringSeasonTeamRef === match.awaySeasonTeamRef).length,
    };
    const correctedAt = now();
    match.correctionHistory ??= [];
    match.correctionHistory.push({
      reason,
      correctedBy: correctedBy!,
      correctedAt,
      originalResult: { ...originalScore, goals: originalGoals, penaltyShootout: originalShootout, winnerSeasonTeamRef: originalWinner },
      correctedResult: { ...correctedScore, goals: correctedGoals.map((goal) => ({ ...goal })), penaltyShootout: shootout ? { ...shootout, kicks: shootout.kicks.map((kick) => ({ ...kick })) } : null, winnerSeasonTeamRef: correctedWinner },
    });
    match.goals = correctedGoals;
    match.penaltyShootout = shootout;
    match.winnerSeasonTeamRef = correctedWinner;
    match.updatedAt = correctedAt;
    commitSeasonDb(db);
    return ok("Completed match corrected", populatedSeasonMatch(db, match));
  },
  async updateSeasonMatchResolution(seasonId: string, matchId: string, input: { status: "cancelled" | "abandoned"; resolutionReason: string }) {
    const reason = input.resolutionReason.trim();
    if (reason.length < 3 || reason.length > 500) fail(422, "Enter a status-change reason between 3 and 500 characters", "INVALID_MATCH_STATUS_REASON", { statusReason: "Reason must contain 3 to 500 characters" });
    return this.updateSeasonMatchStatus(seasonId, matchId, { status: input.status, resolutionReason: reason });
  },
  async createSeasonMatch(seasonId: string, input: SeasonMatchCreateWrite) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (season.auctionLifecycleStatus !== "completed") fail(409, "Complete the auction and validate every team roster before creating or changing fixtures.", "AUCTION_NOT_COMPLETED");
    assertActiveSeasonForMatchOperations(season, "Fixture creation");
    if (!season.matchRules) fail(409, "Match rules are unavailable for this historical season");
    if (db.matches.some((match) => match.seasonRef === seasonId && match.matchNumber === input.matchNumber)) {
      fail(409, "Match number already exists in this season");
    }
    if (input.homeSeasonTeamRef === input.awaySeasonTeamRef) fail(422, "A team cannot play itself");
    const home = db.seasonTeams.find((team) => team._id === input.homeSeasonTeamRef && team.seasonRef === seasonId);
    const away = db.seasonTeams.find((team) => team._id === input.awaySeasonTeamRef && team.seasonRef === seasonId);
    if (!home || !away) return fail(422, "Both teams must be participating in this season");
    if (["withdrawn", "eliminated", "completed"].includes(home.status) || ["withdrawn", "eliminated", "completed"].includes(away.status)) {
      return fail(422, "Both teams must be participating in this season");
    }
    if (season.groupStageEnabled !== false) {
      const participatingTeams = db.seasonTeams.filter((team) =>
        team.seasonRef === seasonId && !["withdrawn", "eliminated", "completed"].includes(team.status),
      );
      const groupBlockers = getMockFixtureGroupReadinessBlockers({
        groupStageEnabled: season.groupStageEnabled,
        groups: db.groups.filter((group) => group.seasonRef === seasonId),
        participatingTeams,
      });
      if (groupBlockers.length) {
        fail(409, "Season Group-stage setup is incomplete: " + groupBlockers.join("; "), "SEASON_GROUPS_INCOMPLETE", {
          groups: groupBlockers.join("; "),
        });
      }
    }
    if (input.stage === "group" && season.groupStageEnabled === false) fail(409, "Group-stage fixtures are disabled for this season");
    validateMockPair(db, season, input.stage, input.stage === "group" ? input.groupRef ?? null : null, input.roundNumber, input.homeSeasonTeamRef, input.awaySeasonTeamRef);
    const venue = db.venues.find((item) => item._id === input.venueRef && item.status === "active");
    if (!venue) return fail(422, "Choose an active venue from the venue list");
    if (input.stage !== "group") {
      const eligible = mockKnockoutEligibleTeams(db, season, input.stage);
      if (!eligible.has(input.homeSeasonTeamRef) || !eligible.has(input.awaySeasonTeamRef)) fail(422, "Both teams must have qualified for this knockout stage");
    }
    if (input.stage !== "group" && input.groupRef) fail(422, "Knockout fixtures cannot belong to a group");
    if (input.stage === "group") {
      const group = input.groupRef ? db.groups.find((item) => item._id === input.groupRef && item.seasonRef === seasonId) : null;
      if (!group) return fail(422, "Both teams must belong to the selected group");
      if (home.groupRef !== group._id || away.groupRef !== group._id) {
        return fail(422, "Both teams must belong to the selected group");
      }
    }
    const kickoff = new Date(input.kickoffAt);
    if (Number.isNaN(kickoff.getTime())) fail(422, "Enter a valid kick-off date and time");
    const status = input.status ?? "scheduled";
    if (status === "live") assertNoOtherLiveMatch(db, seasonId, home._id, away._id);
    if (status !== "scheduled") fail(422, "New fixtures must start as Scheduled");
    const date = now();
    const match: MockSeasonMatch = {
      _id: newId(),
      seasonRef: seasonId,
      matchNumber: input.matchNumber,
      roundNumber: input.roundNumber,
      stage: input.stage,
      groupRef: input.stage === "group" ? input.groupRef ?? null : null,
      kickoffAt: kickoff.toISOString(),
      venueRef: venue._id,
      venue: venue.name,
      homeSeasonTeamRef: home._id,
      awaySeasonTeamRef: away._id,
      status,
      matchDurationMinutes:input.matchDurationMinutes??season.matchRules!.defaultMatchDurationMinutes,
      decidingRules:{extraTime:{isAllowed:input.stage==="group"?false:season.matchRules!.extraTime.isAllowedByDefault,durationMinutes:season.matchRules!.extraTime.defaultDurationMinutes},penaltyShootout:{isAllowed:input.stage==="group"?false:season.matchRules!.penaltyShootout.isAllowedByDefault}},
      actualStartedAt:null,phase:null,clock:{isRunning:false,clockStartedAt:null,periodElapsedSecondsByPeriod:{firstHalf:0,secondHalf:0,extraTimeFirstHalf:0,extraTimeSecondHalf:0}},
      goals: [],
      penaltyShootout: null,
      winnerSeasonTeamRef: null,
      notes: input.notes ?? null,
      resolutionHistory: [],
      createdAt: date,
      updatedAt: date,
    };
    db.matches.push(match);
    commitSeasonDb(db);
    return ok("Season fixture created", populatedSeasonMatch(db, match));
  },
  async updateSeasonMatch(seasonId: string, matchId: string, input: Partial<SeasonMatchWrite>) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Fixture editing");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    if (match.status === "completed") fail(409, "Completed fixtures can only be changed through the audited correction workflow.", "MATCH_DETAILS_EDIT_NOT_ALLOWED");
    if (match.status === "postponed" && input.kickoffAt !== undefined) fail(409, "Postponed matches can only be rescheduled through the dedicated reschedule operation.", "MATCH_RESCHEDULE_REQUIRED");
    const fixtureDetailFields: Array<keyof SeasonMatchWrite> = ["matchNumber", "roundNumber", "stage", "groupRef", "kickoffAt", "venueRef", "homeSeasonTeamRef", "awaySeasonTeamRef", "notes"];
    const isFixtureDetailsEdit = fixtureDetailFields.some((field) => input[field] !== undefined);
    const matchCards = (match as MockSeasonMatch & { cards?: unknown[] }).cards ?? [];
    if (isFixtureDetailsEdit && season.auctionLifecycleStatus !== "completed") fail(409, "Complete the auction before editing fixture details or schedules.", "AUCTION_NOT_COMPLETED");
    if (isFixtureDetailsEdit) {
      if (match.status !== "scheduled" && match.status !== "live") fail(409, "Only Scheduled or Live matches can be edited.", "MATCH_DETAILS_EDIT_NOT_ALLOWED");
      if (match.goals.length > 0 || matchCards.length > 0) fail(409, "Match details cannot be edited after goals or cards have been recorded.", "MATCH_HAS_EVENTS");
    }
    const homeId = input.homeSeasonTeamRef ?? match.homeSeasonTeamRef;
    const awayId = input.awaySeasonTeamRef ?? match.awaySeasonTeamRef;
    if (match.status === "live") assertNoOtherLiveMatch(db, seasonId, homeId, awayId, matchId);
    const stage = input.stage ?? match.stage;
    const groupRef = stage === "group" ? (input.groupRef === undefined ? match.groupRef : input.groupRef) : null;
    const roundNumber = input.roundNumber ?? match.roundNumber;
    const venueRef = input.venueRef ?? match.venueRef;
    const pairingChanged = homeId !== match.homeSeasonTeamRef || awayId !== match.awaySeasonTeamRef || stage !== match.stage || groupRef !== match.groupRef || roundNumber !== match.roundNumber;
    if (pairingChanged) validateMockPair(db, season, stage, groupRef, roundNumber, homeId, awayId, matchId);
    const venue = db.venues.find((item) => item._id === venueRef && (item.status === "active" || item._id === match.venueRef));
    if (!venue) return fail(422, "Choose an active venue from the venue list");
    if (homeId === awayId) fail(422, "A team cannot play itself");
    if ((homeId !== match.homeSeasonTeamRef || awayId !== match.awaySeasonTeamRef || stage !== match.stage || groupRef !== match.groupRef)
      && (match.goals.length > 0 || (match.resolutionHistory?.length ?? 0) > 0)) {
      fail(409, "Participating teams, stage and group cannot be changed after goal or resolution history has been recorded");
    }
    const home = db.seasonTeams.find((team) => team._id === homeId && team.seasonRef === seasonId);
    const away = db.seasonTeams.find((team) => team._id === awayId && team.seasonRef === seasonId);
    if (!home || !away || ["withdrawn", "eliminated", "completed"].includes(home.status) || ["withdrawn", "eliminated", "completed"].includes(away.status)) {
      return fail(422, "Both teams must be eligible participants in this season");
    }
    if (stage === "group" && season.groupStageEnabled === false) fail(409, "Group-stage fixtures are disabled for this season");
    if (stage !== "group") {
      const eligible = mockKnockoutEligibleTeams(db, season, stage);
      if (!eligible.has(homeId) || !eligible.has(awayId)) fail(422, "Both teams must have qualified for this knockout stage");
    }
    if (stage === "group") {
      const group = groupRef ? db.groups.find((item) => item._id === groupRef && item.seasonRef === seasonId) : null;
      if (!group || home.groupRef !== group._id || away.groupRef !== group._id) return fail(422, "Both teams must belong to the selected group");
    } else if (groupRef) fail(422, "Knockout fixtures cannot belong to a group");
    const kickoff = new Date(input.kickoffAt ?? match.kickoffAt);
    if (Number.isNaN(kickoff.getTime())) fail(422, "Enter a valid kick-off date and time");
    const start = season.startDate ? new Date(season.startDate) : null;
    const end = season.endDate ? new Date(season.endDate) : null;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: season.timeZone }).format(kickoff);
    if (start && day < new Intl.DateTimeFormat("en-CA", { timeZone: season.timeZone }).format(start)) fail(422, "Fixture date is before the season start date");
    if (end && day > new Intl.DateTimeFormat("en-CA", { timeZone: season.timeZone }).format(end)) fail(422, "Fixture date is after the season end date");
    if (input.matchNumber !== undefined && db.matches.some((item) => item._id !== matchId && item.seasonRef === seasonId && item.matchNumber === input.matchNumber)) fail(409, "Match number already exists in this season");
    if (input.status !== undefined && input.status !== match.status) fail(422, "Change fixture status through the match status and resolution workflow");
    match.matchNumber = input.matchNumber ?? match.matchNumber;
    match.stage = stage;
    match.roundNumber = roundNumber;
    match.groupRef = groupRef;
    match.venueRef = venue._id;
    match.venue = venue.name;
    match.kickoffAt = kickoff.toISOString();

    match.homeSeasonTeamRef = homeId;
    match.awaySeasonTeamRef = awayId;
    match.notes = input.notes === undefined ? match.notes : input.notes ?? null;
    if (input.penaltyShootout !== undefined) {
      if (input.penaltyShootout) {
        if (match.stage === "group") fail(422, "Group-stage matches cannot have penalty shootouts.", "GROUP_SHOOTOUT");
        assertMockShootoutScore(match, input.penaltyShootout, fail);
        for (const kick of input.penaltyShootout.kicks) {
          if (kick.playerRef) {
            const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === kick.playerRef && item.auctionStatus === "sold");
            if (!lot || lot.seasonTeamRef !== kick.seasonTeamRef) fail(422, "Shootout player must belong to the kicking team", "INVALID_SHOOTOUT_PLAYER");
          }
        }
      }
      match.penaltyShootout = input.penaltyShootout ? { ...input.penaltyShootout, kicks: input.penaltyShootout.kicks.map((kick) => ({ ...kick })) } : null;
    }
    this.recalculateMockWinner(season, match);
    match.updatedAt = now();
    commitSeasonDb(db);
    return ok("Season fixture updated", populatedSeasonMatch(db, match));
  },
  async deleteSeasonMatch(seasonId: string, matchId: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    if (hasMockMatchIncidents(match)) {
      fail(409, "This match cannot be deleted because it contains recorded goals, cards, penalty-shootout events or correction history.", "MATCH_HAS_EVENTS");
    }
    assertActiveSeasonForMatchOperations(season, "Fixture deletion");
    if (season.auctionLifecycleStatus !== "completed") fail(409, "Complete the auction before deleting fixtures.", "AUCTION_NOT_COMPLETED");
    const index = db.matches.findIndex((item) => item._id === matchId && item.seasonRef === seasonId);
    if (index < 0) return fail(404, "Season fixture not found");
    db.matches.splice(index, 1);
    commitSeasonDb(db);
    return ok("Season fixture deleted", null);
  },
  async addSeasonMatchGoal(seasonId: string, matchId: string, input: { scoringSeasonTeamRef: string; scorerPlayerRef?: string | null; goalType: "normal" | "own_goal" }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Match incident management");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    assertLiveMatch(match);
    const home = match.homeSeasonTeamRef, away = match.awaySeasonTeamRef, scoring = input.scoringSeasonTeamRef;
    if (scoring !== home && scoring !== away) fail(422, "Credited team must be one of the match participants");
    const scorerId = input.scorerPlayerRef ?? null;
    if (input.goalType === "normal" && !scorerId) fail(422, "Select the goal scorer");
    let playerSeasonTeamRef: string | null = null;
    if (scorerId) {
      const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === scorerId && item.auctionStatus === "sold");
      const expectedTeam = input.goalType === "normal" ? scoring : (scoring === home ? away : home);
      if (!lot || lot.seasonTeamRef !== expectedTeam) return fail(422, input.goalType === "normal" ? "Normal scorer must belong to the credited team" : "Own-goal player must belong to the opposing team");
      playerSeasonTeamRef = lot.seasonTeamRef;
    }
    match.goals.push({ _id: newId(), scoringSeasonTeamRef: scoring, scorerPlayerRef: scorerId, playerSeasonTeamRef, goalType: input.goalType, createdAt: now() });
    this.recalculateMockWinner(season, match);
    match.updatedAt = now();
    commitSeasonDb(db);
    return ok("Goal added", populatedSeasonMatch(db, match));
  },
  async updateSeasonMatchGoal(seasonId: string, matchId: string, goalId: string, input: { scoringSeasonTeamRef: string; scorerPlayerRef?: string | null; goalType: "normal" | "own_goal" }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Match incident management");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    assertLiveMatch(match);
    const index = match.goals.findIndex((goal) => goal._id === goalId);
    if (index < 0) return fail(404, "Goal not found");
    const home = match.homeSeasonTeamRef, away = match.awaySeasonTeamRef, scoring = input.scoringSeasonTeamRef;
    if (scoring !== home && scoring !== away) fail(422, "Credited team must be one of the match participants");
    const scorerId = input.scorerPlayerRef ?? null;
    if (input.goalType === "normal" && !scorerId) fail(422, "Select the goal scorer");
    let playerSeasonTeamRef: string | null = null;
    if (scorerId) {
      const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === scorerId && item.auctionStatus === "sold");
      const expectedTeam = input.goalType === "normal" ? scoring : (scoring === home ? away : home);
      if (!lot || lot.seasonTeamRef !== expectedTeam) return fail(422, input.goalType === "normal" ? "Normal scorer must belong to the credited team" : "Own-goal player must belong to the opposing team");
      playerSeasonTeamRef = lot.seasonTeamRef;
    }
    match.goals[index] = { ...match.goals[index], scoringSeasonTeamRef: scoring, scorerPlayerRef: scorerId, playerSeasonTeamRef, goalType: input.goalType };
    this.recalculateMockWinner(season, match);
    match.updatedAt = now();
    commitSeasonDb(db);
    return ok("Goal updated", populatedSeasonMatch(db, match));
  },
  async deleteSeasonMatchGoal(seasonId: string, matchId: string, goalId: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Match incident management");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    assertLiveMatch(match);
    const index = match.goals.findIndex((goal) => goal._id === goalId);
    if (index < 0) return fail(404, "Goal not found");
    match.goals.splice(index, 1);
    this.recalculateMockWinner(season, match);
    match.updatedAt = now();
    commitSeasonDb(db);
    return ok("Goal deleted", populatedSeasonMatch(db, match));
  },
  async addSeasonMatchCard(seasonId: string, matchId: string, input: { seasonTeamRef: string; playerRef: string; cardType: "yellow_card" | "red_card" | "second_yellow" }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Match incident management");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    assertLiveMatch(match);
    if (input.seasonTeamRef !== match.homeSeasonTeamRef && input.seasonTeamRef !== match.awaySeasonTeamRef) fail(422, "Card recipient team must be one of the match participants", "INVALID_CARD_TEAM");
    const player = db.players.find((item) => item._id === input.playerRef && item.status === "active");
    const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === input.playerRef && item.auctionStatus === "sold");
    if (!player || !lot || lot.seasonTeamRef !== input.seasonTeamRef) fail(422, "Card recipient must be an active player registered to the selected match team", "INVALID_CARD_PLAYER");
    match.cards ??= [];
    match.cards.push({ _id: newId(), ...input, createdAt: now() });
    match.updatedAt = now();
    commitSeasonDb(db);
    return ok("Card recorded", populatedSeasonMatch(db, match));
  },
  async updateSeasonMatchCard(seasonId: string, matchId: string, cardId: string, input: { seasonTeamRef: string; playerRef: string; cardType: "yellow_card" | "red_card" | "second_yellow" }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Match incident management");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    assertLiveMatch(match);
    const cards = match.cards ?? [];
    const index = cards.findIndex((card) => card._id === cardId);
    if (index < 0) return fail(404, "Card not found");
    if (input.seasonTeamRef !== match.homeSeasonTeamRef && input.seasonTeamRef !== match.awaySeasonTeamRef) fail(422, "Card recipient team must be one of the match participants", "INVALID_CARD_TEAM");
    const player = db.players.find((item) => item._id === input.playerRef && item.status === "active");
    const lot = db.auctionLots.find((item) => item.seasonRef === seasonId && item.playerRef === input.playerRef && item.auctionStatus === "sold");
    if (!player || !lot || lot.seasonTeamRef !== input.seasonTeamRef) fail(422, "Card recipient must be an active player registered to the selected match team", "INVALID_CARD_PLAYER");
    cards[index] = { ...cards[index], ...input };
    match.cards = cards;
    match.updatedAt = now();
    commitSeasonDb(db);
    return ok("Card updated", populatedSeasonMatch(db, match));
  },
  async deleteSeasonMatchCard(seasonId: string, matchId: string, cardId: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    assertActiveSeasonForMatchOperations(season, "Match incident management");
    const match = db.matches.find((item) => item._id === matchId && item.seasonRef === seasonId);
    if (!match) return fail(404, "Season fixture not found");
    assertLiveMatch(match);
    const cards = match.cards ?? [];
    const index = cards.findIndex((card) => card._id === cardId);
    if (index < 0) return fail(404, "Card not found");
    cards.splice(index, 1);
    match.cards = cards;
    match.updatedAt = now();
    commitSeasonDb(db);
    return ok("Card removed", populatedSeasonMatch(db, match));
  },
  recalculateMockWinner(season: MockSeason, match: MockSeasonMatch) {
    match.winnerSeasonTeamRef = calculateMockCompletedWinner(match, season, fail);
  },
  async getVenue(id: string) {
    const db = readSeasonDb();
    const venue = db.venues.find((item) => item._id === id);
    if (!venue) return fail(404, "Venue not found");
    if (venue.status !== "active") requireAdmin();
    return ok("Venue fetched", venue as Venue);
  },
  async getVenues(status: "active" | "inactive" | "all" = "active") {
    if (status !== "active") requireAdmin();
    const db = readSeasonDb();
    const items = db.venues.filter((venue) => status === "all" || venue.status === status).sort((a, b) => a.name.localeCompare(b.name));
    return ok("Venues fetched", items as Venue[]);
  },
  async createVenue(input: VenueWrite) {
    requireAdmin();
    const db = readSeasonDb();
    const normalized = input.name.trim().normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
    if (db.venues.some((venue) => venue.name.trim().normalize("NFKC").replace(/\s+/g, " ").toLowerCase() === normalized)) fail(409, "A venue with this name already exists");
    const date = now();
    const venue: MockVenue = { _id: newId(), name: input.name.trim(), location: input.location?.trim() || null, notes: input.notes?.trim() || null, status: "active", createdAt: date, updatedAt: date };
    db.venues.push(venue);
    commitSeasonDb(db);
    return ok("Venue created", venue as Venue);
  },
  async updateVenue(id: string, input: Partial<VenueWrite> & { status?: "active" | "inactive" }) {
    requireAdmin();
    const db = readSeasonDb();
    const venue = db.venues.find((item) => item._id === id);
    if (!venue) return fail(404, "Venue not found");
    const name = input.name?.trim() ?? venue.name;
    const normalized = name.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
    if (db.venues.some((item) => item._id !== id && item.name.normalize("NFKC").replace(/\s+/g, " ").toLowerCase() === normalized)) fail(409, "A venue with this name already exists");
    venue.name = name;
    if (input.location !== undefined) venue.location = input.location?.trim() || null;
    if (input.notes !== undefined) venue.notes = input.notes?.trim() || null;
    if (input.status !== undefined) venue.status = input.status;
    venue.updatedAt = now();
    db.matches.filter((match) => match.venueRef === id).forEach((match) => { match.venue = venue.name; });
    commitSeasonDb(db);
    return ok("Venue updated", venue as Venue);
  },
  async deleteVenue(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    if (db.matches.some((match) => match.venueRef === id)) fail(409, "This venue is used by existing fixtures. Deactivate it instead.");
    const index = db.venues.findIndex((item) => item._id === id);
    if (index < 0) return fail(404, "Venue not found");
    db.venues.splice(index, 1);
    commitSeasonDb(db);
    return ok("Venue deleted", null);
  },
  async getSeasons() {
    const db = readSeasonDb();
    return ok("Seasons loaded", [...db.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber) as unknown as Season[]);
  },
  async   createSeason(input: SeasonWrite) {
    requireAdmin();
    const db = readSeasonDb();
    const normalizedName = input.name.trim().replace(/\s+/g, " ").toLowerCase();
    if (db.seasons.some((s) => s.seasonNumber === input.seasonNumber)) fail(409, "Season number already exists");
    if (db.seasons.some((s) => s.name.trim().replace(/\s+/g, " ").toLowerCase() === normalizedName)) fail(409, "Season name already exists");
    if (input.startDate && input.endDate && input.endDate < input.startDate) fail(422, "End date must be on or after start date");
    const date = now();
    const season: MockSeason = {
      _id: newId(), seasonNumber: input.seasonNumber, name: input.name.trim(), year: input.year,
      startDate: input.startDate ?? null, endDate: input.endDate ?? null, timeZone: input.timeZone ?? "Asia/Kolkata",
      groupStageEnabled: input.groupStageEnabled ?? true, homeAndAwayFixtures: input.homeAndAwayFixtures ?? false, status: "draft", auctionLifecycleStatus: "not_started", auctionSettings: input.auctionSettings,
      pointsRules: input.pointsRules ?? { win: 3, draw: 1, loss: 0 },
      standingsTieBreakers: input.standingsTieBreakers ?? ["points", "goalDifference", "goalsScored", "teamNameAsc"],
      matchRules: input.matchRules ?? { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false },
      auctionRevision: 0, createdAt: date, updatedAt: date,
    };
    db.seasons.push(season);
    commitSeasonDb(db);
    return ok("Draft season created", season as unknown as Season);
  },
  async updateSeason(id: string, input: SeasonPatch) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (season.status === "completed" || season.status === "archived") fail(409, "Completed and archived seasons are read-only");
    if (season.status === "active") fail(409, "Active-season configuration requires an audited correction workflow");
    const teams = db.seasonTeams.filter((st) => st.seasonRef === id);
    const lots = db.auctionLots.filter((lot) => lot.seasonRef === id);
    const matches = db.matches.filter((match) => match.seasonRef === id);
    const hasIdentityDependencies = teams.length > 0 || lots.length > 0 || matches.length > 0 || db.groups.some((g) => g.seasonRef === id);
    if ((input.name !== undefined || input.seasonNumber !== undefined || input.year !== undefined)
      && (season.status !== "draft" || hasIdentityDependencies)) {
      fail(409, "Season name, edition number and year can only be changed on an empty Draft season");
    }
    if (input.seasonNumber !== undefined && db.seasons.some((s) => s._id !== id && s.seasonNumber === input.seasonNumber)) fail(409, "Season number already exists");
    if (input.name !== undefined) {
      const normalized = input.name.trim().replace(/\s+/g, " ").toLowerCase();
      if (db.seasons.some((s) => s._id !== id && s.name.trim().replace(/\s+/g, " ").toLowerCase() === normalized)) fail(409, "Season name already exists");
    }
    if (input.auctionSettings && lots.length) fail(409, "Auction settings are locked after the first AuctionLot is created");
    if ((input.pointsRules || input.standingsTieBreakers || input.matchRules || input.groupStageEnabled !== undefined || input.homeAndAwayFixtures !== undefined) && matches.length) {
      fail(409, "Points, tiebreaker, match and group-stage rules are locked after the first fixture");
    }
    if (input.auctionSettings && input.auctionSettings.seasonTeamCount < teams.length) fail(409, "Team limit cannot be lower than registered teams");
    const nextStart = input.startDate === undefined ? season.startDate : input.startDate;
    const nextEnd = input.endDate === undefined ? season.endDate : input.endDate;
    if (nextStart && nextEnd && nextEnd < nextStart) fail(422, "End date must be on or after start date");
    if (input.startDate !== undefined || input.endDate !== undefined) {
      const localDate = (date: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(date));
      if (matches.some((match) => (nextStart && localDate(match.kickoffAt) < nextStart) || (nextEnd && localDate(match.kickoffAt) > nextEnd))) {
        fail(409, "Season dates cannot exclude existing fixtures");
      }
    }
    const patch: SeasonPatch = { ...input };
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.auctionSettings) patch.auctionSettings = { ...season.auctionSettings, ...input.auctionSettings };
    if (input.pointsRules) patch.pointsRules = { ...season.pointsRules, ...input.pointsRules };
    Object.assign(season, patch, { updatedAt: now() });
    commitSeasonDb(db);
    return ok("Season updated", season as unknown as Season);
  },
  async transitionSeason(id: string, next: "draft" | "upcoming" | "active") {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    const allowed = (season.status === "draft" && next === "upcoming") || (season.status === "upcoming" && (next === "draft" || next === "active"));
    if (!allowed) fail(409, "This season lifecycle transition is not allowed");
    if (next === "draft" && (db.auctionLots.some((lot) => lot.seasonRef === id) || db.matches.some((match) => match.seasonRef === id))) fail(409, "Remove all auction lots and ensure no fixtures exist before returning this season to Draft. Sold, Unsold and Withdrawn auction history cannot be deleted.");
    if (next === "active" && season.auctionLifecycleStatus !== "completed") fail(409, "Complete the auction and validate all team rosters before activating this season.", "AUCTION_NOT_COMPLETED");
    if (next === "upcoming" || next === "active") {
      const participants = db.seasonTeams.filter((st) => st.seasonRef === id && !["withdrawn", "eliminated", "completed"].includes(st.status));
      if (participants.length < 2) fail(422, "At least two participating teams are required");
      if (next === "active" && participants.length !== season.auctionSettings.seasonTeamCount) fail(422, "Registered participating teams must exactly match the configured season team count", "SEASON_TEAM_COUNT_MISMATCH");
      if (participants.length > season.auctionSettings.seasonTeamCount) fail(422, "Registered teams exceed the configured limit");
      if (season.groupStageEnabled !== false) {
        const groups = db.groups.filter((g) => g.seasonRef === id);
        const counts = new Map(groups.map((g) => [g._id, 0]));
        for (const team of participants) {
          const groupRef = team.groupRef;
          if (typeof groupRef !== "string" || !counts.has(groupRef)) {
            return fail(422, "Every participating team must be assigned to a valid season group");
          }
          counts.set(groupRef, (counts.get(groupRef) ?? 0) + 1);
        }
        if (next === "active") {
          const emptyGroups = groups.filter((group) => (counts.get(group._id) ?? 0) === 0);
          if (emptyGroups.length) {
            const names = emptyGroups.map((group) => group.groupName);
            fail(
              422,
              "Remove unused groups before activating the season: " + names.join(", "),
              "SEASON_GROUPS_INCOMPLETE",
              { emptyGroups: names.join(", ") },
            );
          }
        }
        if (!groups.length || [...counts.values()].some((count) => count > 0 && count < 2)) {
          fail(422, "Every participating group must contain at least two teams", "SEASON_GROUPS_INCOMPLETE");
        }
      }
    }
    if (next === "active" && db.seasons.some((s) => s._id !== id && s.status === "active")) fail(409, "Another season is already Active");
    season.status = next;
    if (next === "draft") season.auctionLifecycleStatus = "not_started";
    if (next === "upcoming") season.auctionLifecycleStatus = "not_started";
    season.updatedAt = now();
    commitSeasonDb(db);
    return ok("Season status updated", season as unknown as Season);
  },
  async startSeasonAuction(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (!["upcoming", "active"].includes(season.status) || season.auctionLifecycleStatus !== "not_started") fail(409, "Auction can only be started once in an Upcoming or Active season", "AUCTION_START_NOT_ALLOWED");
    const teams = db.seasonTeams.filter((team) => team.seasonRef === id && ["registered", "active"].includes(team.status));
    const currentLots = db.auctionLots.filter((lot) => lot.seasonRef === id && lot.auctionStatus !== "withdrawn");
    const settings = season.auctionSettings;
    const blockers: string[] = [];
    if (!Number.isInteger(settings.playersCount) || settings.playersCount < 1) blockers.push("Season player limit must be a positive whole number");
    if (!Number.isInteger(settings.seasonTeamCount) || settings.seasonTeamCount < 2) blockers.push("Season team limit must be at least two teams");
    if (!Number.isInteger(settings.teamSquadSize) || settings.teamSquadSize < 1) blockers.push("Team squad size must be a positive whole number");
    if (settings.playersCount !== settings.seasonTeamCount * settings.teamSquadSize) blockers.push("Configured playersCount must equal seasonTeamCount multiplied by teamSquadSize");
    if (teams.length !== settings.seasonTeamCount) blockers.push("Registered eligible teams must exactly match the configured season team count");
    if (currentLots.length !== settings.playersCount) blockers.push("Current non-withdrawn auction lots must exactly match the configured player count");
    if (blockers.length) fail(422, "Cannot start auction for this season: " + blockers.join("; "), "AUCTION_START_BLOCKED");
    season.auctionLifecycleStatus = "in_progress";
    season.auctionRevision += 1;
    season.updatedAt = now();
    commitSeasonDb(db);
    return ok("Auction started", season as unknown as Season);
  },
  async completeSeasonAuction(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (!["upcoming", "active"].includes(season.status) || season.auctionLifecycleStatus !== "in_progress") fail(409, "Only an Upcoming or Active auction in progress can be completed", "AUCTION_COMPLETE_NOT_ALLOWED");
    const settings = season.auctionSettings;
    const teams = db.seasonTeams.filter((team) => team.seasonRef === id && ["registered", "active"].includes(team.status));
    const allLots = db.auctionLots.filter((lot) => lot.seasonRef === id);
    const lots = allLots.filter((lot) => lot.auctionStatus !== "withdrawn");
    const setupBlockers = getMockAuctionSetupBlockers(
      season.auctionSettings.seasonTeamCount,
      teams,
      season.groupStageEnabled !== false,
      db.groups.filter((group) => group.seasonRef === id).map((group) => group._id),
    );
    const blockers: string[] = [];
    if (!Number.isFinite(settings.budgetPerTeam) || settings.budgetPerTeam < 0) blockers.push("Team budget setting must be zero or greater");
    if (!Number.isInteger(settings.playersCount) || settings.playersCount < 1) blockers.push("Season player limit must be a positive whole number");
    if (!Number.isInteger(settings.seasonTeamCount) || settings.seasonTeamCount < 2) blockers.push("Season team limit must be at least two teams");
    if (!Number.isInteger(settings.teamSquadSize) || settings.teamSquadSize < 1) blockers.push("Team squad size must be a positive whole number");
    if (!Number.isInteger(settings.iconPlayerLimit) || settings.iconPlayerLimit < 0 || settings.iconPlayerLimit > settings.teamSquadSize) blockers.push("Icon Player limit must be between zero and the team squad size");
    if (!Number.isInteger(settings.goalkeeperLimit) || settings.goalkeeperLimit < 0 || settings.goalkeeperLimit > settings.teamSquadSize) blockers.push("Goalkeeper limit must be between zero and the team squad size");
    if (settings.playersCount !== settings.seasonTeamCount * settings.teamSquadSize) blockers.push("Configured playersCount must equal seasonTeamCount multiplied by teamSquadSize");
    blockers.push(...setupBlockers);
    if (lots.length !== settings.playersCount) blockers.push("Current non-withdrawn auction lots must exactly match the configured player count");
    if (lots.some((lot) => lot.auctionStatus === "pending")) blockers.push("Pending auction lots remain");
    if (lots.some((lot) => lot.auctionStatus === "unsold")) blockers.push("Unsold players must be assigned to a team");
    if (lots.some((lot) => lot.auctionStatus !== "sold")) blockers.push("Every current non-withdrawn auction lot must be Sold");
    if (allLots.some((lot) => lot.auctionStatus === "withdrawn" && (!lot.seasonTeamRef || lot.purchasePrice === null || !lot.soldAt))) blockers.push("Withdrawn sold players must retain their original team and sale history");
    for (const team of teams) {
      const roster = lots.filter((lot) => lot.auctionStatus === "sold" && lot.seasonTeamRef === team._id);
      if (roster.length !== settings.teamSquadSize) blockers.push(team.displayName + " must have exactly " + settings.teamSquadSize + " Sold players");
      if (roster.filter((lot) => lot.isIconPlayer).length > settings.iconPlayerLimit) blockers.push(team.displayName + " exceeds the Icon Player limit");
      if (roster.filter((lot) => lot.isGoalkeeper).length > settings.goalkeeperLimit) blockers.push(team.displayName + " exceeds the Goalkeeper limit");
      if (roster.reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0) > settings.budgetPerTeam) blockers.push(team.displayName + " exceeds the team auction budget");
      const jerseys = roster.map((lot) => lot.jerseyNo).filter((number): number is number => number !== null);
      if (new Set(jerseys).size !== jerseys.length) blockers.push(team.displayName + " has duplicate jersey numbers");
    }
    const invalidLots = lots.filter((lot) => lot.auctionStatus === "sold" && (!lot.seasonTeamRef || !teams.some((team) => team._id === lot.seasonTeamRef)));
    if (invalidLots.length) blockers.push(invalidLots.length + " sold auction lot(s) have invalid team assignments");
    if (blockers.length) fail(422, "Auction completion is blocked: " + blockers.join("; "), "AUCTION_COMPLETION_BLOCKED", Object.fromEntries(blockers.map((message, index) => ["blocker." + (index + 1), message])));
    season.auctionLifecycleStatus = "completed";
    season.auctionRevision += 1;
    season.updatedAt = now();
    commitSeasonDb(db);
    return ok("Auction completed", season as unknown as Season);
  },
  async reopenSeasonAuction(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (!["upcoming", "active"].includes(season.status)) fail(409, "Auction cannot be reopened after the season is Completed or Archived", "AUCTION_REOPEN_NOT_ALLOWED");
    if (season.auctionLifecycleStatus !== "completed") fail(409, "Only a completed auction can be reopened", "AUCTION_NOT_COMPLETED");
    season.auctionLifecycleStatus = "in_progress";
    season.auctionRevision += 1;
    season.updatedAt = now();
    commitSeasonDb(db);
    return ok("Auction reopened", season as unknown as Season);
  },
  async deletePendingAuctionLot(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const index = db.auctionLots.findIndex((lot) => lot._id === id);
    if (index < 0) fail(404, "Auction lot not found");
    const lot = db.auctionLots[index];
    if (lot.auctionStatus !== "pending") fail(409, "Only pending auction lots can be removed. Sold, Unsold and Withdrawn lots are retained as auction history.", "LOT_DELETE_NOT_ALLOWED");
    if (lot.seasonTeamRef) fail(409, "An auction lot assigned to a season team cannot be removed", "LOT_ALREADY_ASSIGNED");
    const season = seasonById(db, lot.seasonRef);
    if (!["upcoming", "active"].includes(season.status) || !["not_started", "in_progress"].includes(season.auctionLifecycleStatus)) {
      fail(409, "Pending lots can only be removed before the auction is completed", "SEASON_NOT_AUCTION_READY");
    }
    db.auctionLots.splice(index, 1);
    season.auctionRevision += 1;
    season.updatedAt = now();
    commitSeasonDb(db);
    return ok("Pending auction lot removed", null);
  },  async completeSeason(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (season.status !== "active") fail(409, "Only an Active season can be completed");
    if (season.auctionLifecycleStatus !== "completed") fail(409, "The auction must be completed before completing the season.", "AUCTION_NOT_COMPLETED");
    const matches = db.matches.filter((match) => match.seasonRef === id);
    const blockers = matches.filter((match) => match.status !== "completed");
    if (blockers.length) fail(422, blockers.map((match) => "Match " + match.matchNumber + " is " + match.status).join("; "));
    const invalidKnockouts = matches.filter((match) => match.stage !== "group" && (
      !match.winnerSeasonTeamRef
      || (match.winnerSeasonTeamRef !== match.homeSeasonTeamRef && match.winnerSeasonTeamRef !== match.awaySeasonTeamRef)
    ));
    if (invalidKnockouts.length) fail(422, invalidKnockouts.map((match) => "Knockout match " + match.matchNumber + " has no valid winner among its participants").join("; "));
    const finalMatch = matches.filter((match) => match.stage === "final").sort((a, b) => b.matchNumber - a.matchNumber)[0];
    if (!finalMatch || !finalMatch.winnerSeasonTeamRef) fail(422, "The final must be completed with a determinable winner");
    if (db.auctionLots.some((lot) => lot.seasonRef === id && lot.auctionStatus === "pending")) fail(422, "Pending auction lots must be resolved before completion");
    season.status = "completed"; season.updatedAt = now(); commitSeasonDb(db);
    return ok("Season completed", season as unknown as Season);
  },
  async archiveSeason(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (season.status !== "completed") fail(409, "Only a Completed season can be archived");
    season.status = "archived"; season.updatedAt = now(); commitSeasonDb(db);
    return ok("Season archived", season as unknown as Season);
  },
  async deleteSeason(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (season.status !== "draft") fail(409, "Only an empty Draft season can be deleted");
    const hasDependencies = db.seasonTeams.some((st) => st.seasonRef === id)
      || db.groups.some((group) => group.seasonRef === id)
      || db.auctionLots.some((lot) => lot.seasonRef === id)
      || db.matches.some((match) => match.seasonRef === id);
    if (hasDependencies) fail(409, "This season has dependent records. No historical or dependent data will be deleted.");
    db.seasons = db.seasons.filter((item) => item._id !== id);
    commitSeasonDb(db);
    return ok("Empty Draft season deleted", null);
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
    if (!["draft", "upcoming"].includes(season.status)) fail(409, "SeasonTeam registration is frozen after activation");
    const existing = db.seasonTeams.filter((st) => st.seasonRef === id);
    if (new Set(teamIds).size !== teamIds.length) fail(409, "A team can only be registered once in a season");
    const known = new Set(existing.map((st) => st.teamRef));
    if (teamIds.some((teamId) => known.has(teamId))) fail(409, "One or more teams are already registered in this season");
    if (existing.length + teamIds.length > season.auctionSettings.seasonTeamCount) fail(422, "Season team limit exceeded");
    const additions = teamIds.map((teamId) => {
      const team = teamById(db, teamId);
      if (team.status !== "active") fail(422, "Selected team is not active");

      // Backfill the season mock's Team copy for permanent Teams created by older
      // preview versions. SeasonTeam keeps the permanent Team ID as its reference.
      if (!db.teams.some((item) => item._id === teamId)) {
        db.teams.push({ ...team, logo: null, poster: null });
      }

      // The primary Team owns the uploaded image. The SeasonTeam stores its Team
      // reference and display snapshot metadata without another Base64 image copy.
      return { _id: newId(), seasonRef: id, teamRef: teamId, displayName: team.name, logoSnapshot: null, groupRef: null, managerRefs: [], status: "registered" as const, createdAt: now(), updatedAt: now() };
    });
    db.seasonTeams.push(...additions);
    commitSeasonDb(db);
    return ok("Season teams registered", additions.map((st) => populatedSeasonTeam(db, st)));
  },
  async updateSeasonTeam(id: string, input: { groupId?: string | null; managerIds?: string[] }) {
    requireAdmin();
    const db = readSeasonDb();
    const team = db.seasonTeams.find((st) => st._id === id);
    if (!team) return fail(404, "SeasonTeam not found");
    const season = seasonById(db, team.seasonRef);
    if (["completed", "archived"].includes(season.status)) fail(409, "Closed season participation is read-only");
    if (input.groupId !== undefined) {
      if (input.groupId !== null && season.groupStageEnabled === false) fail(409, "Group assignment is disabled for this season");
      if (!["draft", "upcoming"].includes(season.status)) fail(409, "Group assignment is frozen after activation");
      if (db.matches.some((match) => match.seasonRef === season._id)) fail(409, "Group assignment is locked after fixtures exist");
      if (input.groupId && !db.groups.some((group) => group._id === input.groupId && group.seasonRef === season._id)) fail(422, "Group must belong to the same season");
      team.groupRef = input.groupId ?? null;
    }
    if (input.managerIds) {
      const valid = input.managerIds.every((managerId) => db.managers.some((manager) => manager._id === managerId && manager.status === "active"));
      if (!valid || new Set(input.managerIds).size !== input.managerIds.length) fail(422, "Assign only unique active managers");
      team.managerRefs = [...input.managerIds];
    }
    team.updatedAt = now(); commitSeasonDb(db);
    return ok("SeasonTeam updated", populatedSeasonTeam(db, team));
  },
  async removeSeasonTeam(seasonId: string, id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (!["draft", "upcoming"].includes(season.status)) fail(409, "SeasonTeam registrations can only be removed before activation");
    const team = db.seasonTeams.find((st) => st._id === id && st.seasonRef === seasonId);
    if (!team) return fail(404, "SeasonTeam not found");
    if (db.auctionLots.some((lot) => lot.seasonRef === seasonId && lot.seasonTeamRef === id)
      || db.matches.some((match) => match.seasonRef === seasonId && (match.homeSeasonTeamRef === id || match.awaySeasonTeamRef === id))) {
      fail(409, "This SeasonTeam has auction or fixture history and cannot be hard-deleted");
    }
    db.seasonTeams = db.seasonTeams.filter((st) => st._id !== id);
    commitSeasonDb(db); return ok("Unused registration removed", null);
  },
  async recallSeasonTeam(seasonId: string, id: string, reason: string) {
    requireAdmin(); const db = readSeasonDb(); const season = seasonById(db, seasonId);
    if (season.status !== "active") fail(409, "A withdrawn team can only be recalled during an Active season");
    const team = db.seasonTeams.find((st) => st._id === id && st.seasonRef === seasonId);
    if (!team) return fail(404, "SeasonTeam not found");
    if (team.status !== "withdrawn") fail(409, "Only a withdrawn SeasonTeam can be recalled");
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 3 || normalizedReason.length > 500) fail(422, "Provide a recall reason between 3 and 500 characters");
    const related = db.matches.filter((match) => match.seasonRef === seasonId && (match.homeSeasonTeamRef === id || match.awaySeasonTeamRef === id));
    const blockers = related.filter((match) => {
      if (match.status === "completed") return false;
      if (match.status === "cancelled") return !match.resolutionHistory?.some((entry) => entry.status === "cancelled" && entry.reason.trim().length >= 3 && Boolean(entry.decidedAt));
      return true;
    });
    if (blockers.length) fail(409, "Resolve every fixture before recalling this team");
    team.status = "active"; team.participationHistory ??= [];
    team.participationHistory.push({ fromStatus: "withdrawn", toStatus: "active", reason: normalizedReason, changedAt: now() });
    team.updatedAt = now(); commitSeasonDb(db);
    return ok("Season team reinstated", populatedSeasonTeam(db, team));
  },
  async withdrawSeasonTeam(seasonId: string, id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (season.status !== "active") fail(409, "Controlled withdrawal is available only during an Active season");
    const team = db.seasonTeams.find((st) => st._id === id && st.seasonRef === seasonId);
    if (!team) return fail(404, "SeasonTeam not found");
    if (!["registered", "active"].includes(team.status)) fail(409, "Only a registered or active SeasonTeam can be withdrawn");
    const teamMatches = db.matches.filter((match) => match.seasonRef === seasonId && (match.homeSeasonTeamRef === id || match.awaySeasonTeamRef === id));
    const blockers = teamMatches.flatMap((match) => {
      if (match.status === "completed") return [];
      if (match.status === "live") return ["Match " + match.matchNumber + " is live"];
      if (match.status === "scheduled" || match.status === "postponed") return ["Match " + match.matchNumber + " is " + match.status + " and must be resolved first"];
      if (match.status === "cancelled" || match.status === "abandoned") {
        const audited = match.resolutionHistory?.some((entry) => entry.status === match.status && entry.reason.trim().length >= 3 && Boolean(entry.decidedAt));
        return audited ? [] : ["Match " + match.matchNumber + " is " + match.status + " without an audited resolution reason"];
      }
      return ["Match " + match.matchNumber + " has an unsupported status: " + match.status];
    });
    if (blockers.length) fail(409, blockers.join("; "));
    const previousStatus = team.status; team.status = "withdrawn"; team.participationHistory ??= []; team.participationHistory.push({ fromStatus: previousStatus, toStatus: "withdrawn", reason: "Withdrawn by tournament administrator", changedAt: now() }); team.updatedAt = now();
    commitSeasonDb(db); return ok("SeasonTeam withdrawn; history preserved", populatedSeasonTeam(db, team));
  },
  async createSeasonGroup(seasonId: string, input: { groupName: string; displayOrder?: number }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (!["draft", "upcoming"].includes(season.status) || db.matches.some((match) => match.seasonRef === seasonId)) fail(409, "Groups can only be created before fixtures exist");
    if (season.groupStageEnabled === false) fail(409, "Groups are not enabled for this season");
    if (!db.seasonTeams.some((team) => team.seasonRef === seasonId)) fail(409, "Register participating SeasonTeams before creating groups");
    const groupName = input.groupName.trim();
    if (!groupName || groupName.length > 40) fail(422, "Group name must contain 1 to 40 characters");
    const displayOrder = input.displayOrder ?? 0;
    if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 1000) fail(422, "Display order must be a whole number between 0 and 1000");
    const normalized = groupName.replace(/\s+/g, " ").toLocaleLowerCase("en");
    if (db.groups.some((group) => group.seasonRef === seasonId && group.groupName.trim().replace(/\s+/g, " ").toLocaleLowerCase("en") === normalized)) fail(409, "Group name already exists in this season");
    const group = { _id: newId(), seasonRef: seasonId, groupName, displayOrder, createdAt: now(), updatedAt: now() };
    db.groups.push(group); commitSeasonDb(db); return ok("Season group created", group);
  },
  async updateSeasonGroup(seasonId: string, groupId: string, input: { groupName?: string; displayOrder?: number }) {
    requireAdmin();
    const db = readSeasonDb(); const season = seasonById(db, seasonId);
    if (!["draft", "upcoming"].includes(season.status) || db.matches.some((match) => match.seasonRef === seasonId)) fail(409, "Groups are locked after fixtures exist");
    if (season.groupStageEnabled === false) fail(409, "Groups are not enabled for this season");
    if (input.groupName === undefined && input.displayOrder === undefined) fail(422, "At least one group field is required");
    if (input.displayOrder !== undefined && (!Number.isInteger(input.displayOrder) || input.displayOrder < 0 || input.displayOrder > 1000)) fail(422, "Display order must be a whole number between 0 and 1000");
    const group = db.groups.find((item) => item._id === groupId && item.seasonRef === seasonId);
    if (!group) return fail(404, "Group not found");
    if (input.groupName !== undefined) {
      const groupName = input.groupName.trim();
      if (!groupName || groupName.length > 40) fail(422, "Group name must contain 1 to 40 characters");
      const normalized = groupName.replace(/\s+/g, " ").toLocaleLowerCase("en");
      if (db.groups.some((item) => item._id !== groupId && item.seasonRef === seasonId && item.groupName.trim().replace(/\s+/g, " ").toLocaleLowerCase("en") === normalized)) fail(409, "Group name already exists in this season");
      group.groupName = groupName;
    }
    if (input.displayOrder !== undefined) group.displayOrder = input.displayOrder;
    group.updatedAt = now(); commitSeasonDb(db); return ok("Group updated", group);
  },
  async deleteSeasonGroup(seasonId: string, groupId: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (!["draft", "upcoming"].includes(season.status)) fail(409, "Groups can only be deleted before activation");
    if (season.groupStageEnabled === false) fail(409, "Groups are not enabled for this season");
    const group = db.groups.find((item) => item._id === groupId && item.seasonRef === seasonId);
    if (!group) return fail(404, "Group not found");
    const assignedSeasonTeamIds = new Set(
      db.seasonTeams.filter((st) => st.seasonRef === seasonId && st.groupRef === groupId).map((st) => st._id),
    );
    if (assignedSeasonTeamIds.size) fail(409, "Remove all team assignments from this group before deleting it");
    if (db.matches.some((match) => {
      if (match.seasonRef !== seasonId) return false;
      return match.groupRef === groupId
        || assignedSeasonTeamIds.has(match.homeSeasonTeamRef)
        || assignedSeasonTeamIds.has(match.awaySeasonTeamRef);
    })) {
      fail(409, "Fixtures reference this group or one of its assigned teams and must be preserved");
    }
    db.groups = db.groups.filter((item) => item._id !== groupId);
    commitSeasonDb(db);
    return ok("Unused group deleted", null);
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
    const total = lots.length;
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const start = (page - 1) * limit;
    return {
      success: true,
      message: "Auction lots loaded",
      data: lots.slice(start, start + limit).map((lot) => populatedLot(db, lot)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
  async nominatePlayer(input: { seasonId: string; playerId: string; playerPosition: MockAuctionLot["playerPosition"]; isIconPlayer: boolean; isGoalkeeper?: boolean }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, input.seasonId);
    if (!["upcoming", "active"].includes(season.status) || !["not_started", "in_progress"].includes(season.auctionLifecycleStatus)) fail(409, "Auction nominations are available only before or during an Upcoming or Active season auction.", "SEASON_NOT_AUCTION_READY");
    if (season.status === "completed" || season.status === "archived") fail(409, "Auction is closed for this season");
    const player = playerById(db, input.playerId);
    const isGoalkeeper = input.playerPosition === "goalkeeper";
    if (input.isGoalkeeper !== undefined && input.isGoalkeeper !== isGoalkeeper) fail(422, "Goalkeeper designation must match the selected Goalkeeper position.", "GOALKEEPER_POSITION_MISMATCH");
    if (player.status !== "active") fail(422, "Only active players can be nominated");
    if (db.auctionLots.some((lot) => lot.seasonRef === season._id && lot.playerRef === player._id)) fail(409, "This player has already been nominated in this season");
    const seasonLots = db.auctionLots.filter((lot) => lot.seasonRef === season._id && lot.auctionStatus !== "withdrawn");
    if (seasonLots.length >= season.auctionSettings.playersCount) fail(422, "Season player nomination limit reached");
    const date = now();
    const lot: MockAuctionLot = {
      _id: newId(), seasonRef: season._id, seasonTeamRef: null, playerRef: player._id,
      lotNumber: seasonLots.length + 1, auctionStatus: "pending", purchasePrice: null,
      playerPosition: input.playerPosition, isIconPlayer: input.isIconPlayer, isGoalkeeper,
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
    if (!["upcoming", "active"].includes(season.status) || season.auctionLifecycleStatus !== "in_progress") fail(409, "Auction sales are available only while an Upcoming or Active season auction is in progress.", "SEASON_NOT_AUCTION_READY");
    if (season.status === "completed" || season.status === "archived") fail(409, "Auction is closed for this season");
    if (lot.auctionStatus !== "pending") fail(409, "Only pending lots can be sold");
    const st = db.seasonTeams.find((item) => item._id === input.seasonTeamId && item.seasonRef === lot.seasonRef);
    if (!st || !["registered", "active"].includes(st.status)) return fail(422, "Winning team must be an eligible participating team in the same season");
    if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) fail(422, "Purchase price must be zero or greater");
    const existing = soldLots(db, lot.seasonRef, st._id);
    const settings = season.auctionSettings;
    const spent = existing.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
    if (existing.length >= settings.teamSquadSize) fail(422, "Team squad size limit reached for this team");
    if (spent + input.purchasePrice > settings.budgetPerTeam) fail(422, "Team auction budget exceeded");
    if (lot.isIconPlayer && existing.filter((item) => item.isIconPlayer).length >= settings.iconPlayerLimit) fail(422, "Icon player limit reached");
    if (lot.isGoalkeeper && existing.filter((item) => item.isGoalkeeper).length >= settings.goalkeeperLimit) fail(422, "Goalkeeper limit reached");
    if (input.jerseyNo != null && (!Number.isInteger(input.jerseyNo) || input.jerseyNo < 1)) fail(422, "Jersey number must be a positive whole number");
    if (input.jerseyNo != null && existing.some((item) => item.jerseyNo === input.jerseyNo)) fail(409, "Jersey number is already used by this team in this season");
    const date = now();
    lot.seasonTeamRef = st._id; lot.auctionStatus = "sold"; lot.purchasePrice = input.purchasePrice;
    lot.jerseyNo = input.jerseyNo ?? null; lot.soldAt = date; lot.updatedAt = date;
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
    const previousStatus = lot.auctionStatus;
    const pendingPreparationEdit = season.auctionLifecycleStatus === "not_started"
      && previousStatus === "pending"
      && input.auctionStatus === "pending";
    if (!["upcoming", "active"].includes(season.status)
      || (season.auctionLifecycleStatus !== "in_progress" && !pendingPreparationEdit)) {
      fail(409, "Before the auction starts, only Pending lot details can be edited. Start the auction to record sales or change lot status.", "SEASON_NOT_AUCTION_READY");
    }
    if (previousStatus === "withdrawn") fail(409, "Withdrawn auction lots are historical records and cannot be changed again.", "LOT_WITHDRAWN_READ_ONLY");
    if (input.auctionStatus === "withdrawn" && previousStatus !== "sold") fail(409, "Only a Sold player can be marked Withdrawn.", "LOT_WITHDRAWAL_NOT_ALLOWED");
    if (previousStatus === "sold" && (input.auctionStatus === "pending" || input.auctionStatus === "unsold")) {
      const hasFixtures = db.matches.some((match) => match.seasonRef === lot.seasonRef
        && (match.homeSeasonTeamRef === lot.seasonTeamRef || match.awaySeasonTeamRef === lot.seasonTeamRef));
      if (hasFixtures) fail(409, "A Sold player cannot be reset to Pending or Unsold after the team has fixtures. Mark the player Withdrawn to preserve history.", "LOT_HAS_FIXTURES");
    }

    const nextPosition = input.playerPosition ?? lot.playerPosition;
    const nextIconStatus = input.isIconPlayer ?? lot.isIconPlayer;
    const nextGoalkeeperStatus = nextPosition === "goalkeeper";
    if (input.isGoalkeeper !== undefined && input.isGoalkeeper !== nextGoalkeeperStatus) fail(422, "Goalkeeper designation must match the selected Goalkeeper position.", "GOALKEEPER_POSITION_MISMATCH");
    if (input.auctionStatus === "sold") {
      const selectedSeasonTeamId = input.seasonTeamId ?? (lot.auctionStatus === "sold" ? lot.seasonTeamRef : null);
      const purchasePrice = input.purchasePrice ?? (lot.auctionStatus === "sold" ? lot.purchasePrice : null);
      if (!selectedSeasonTeamId) return fail(422, "A sold lot must have a season team and purchase price");
      if (purchasePrice === null || purchasePrice === undefined) return fail(422, "A sold lot must have a season team and purchase price");
      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) return fail(422, "Purchase price must be zero or greater");

      const seasonTeam = db.seasonTeams.find((item) =>
        item._id === selectedSeasonTeamId && item.seasonRef === lot.seasonRef,
      );
      if (!seasonTeam) return fail(422, "Select an eligible team registered in this season");
      if (["withdrawn", "eliminated", "completed"].includes(seasonTeam.status)) {
        return fail(422, "Select an eligible team registered in this season");
      }
      const player = playerById(db, lot.playerRef);
      if (player.status !== "active") fail(409, "Only active players can be assigned to a team");

      const existing = soldLots(db, lot.seasonRef, seasonTeam._id).filter((item) => item._id !== lot._id);
      const settings = season.auctionSettings;
      const spent = existing.reduce((sum, item) => sum + (item.purchasePrice ?? 0), 0);
      if (existing.length >= settings.teamSquadSize) fail(422, "Team squad size limit reached for " + seasonTeam.displayName);
      if (spent + purchasePrice > settings.budgetPerTeam) fail(422, "Team auction budget exceeded");
      if (nextIconStatus && existing.filter((item) => item.isIconPlayer).length >= settings.iconPlayerLimit) {
        fail(422, "Icon player limit reached");
      }
      if (nextGoalkeeperStatus && existing.filter((item) => item.isGoalkeeper).length >= settings.goalkeeperLimit) {
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
      lot.soldAt = previousStatus === "sold" && lot.soldAt ? lot.soldAt : now();
    } else {
      lot.auctionStatus = input.auctionStatus;
      if (input.auctionStatus !== "withdrawn") {
        lot.seasonTeamRef = null;
        lot.purchasePrice = null;
        lot.jerseyNo = null;
        lot.soldAt = null;
      } else {
        season.auctionLifecycleStatus = "in_progress";
      }
    }

    lot.playerPosition = nextPosition;
    lot.isIconPlayer = nextIconStatus;
    lot.isGoalkeeper = nextGoalkeeperStatus;
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
    const emptyStats = { played: 0, won: 0, drawn: 0, lost: 0, goalsScored: 0, goalsConceded: 0, goalDifference: 0, cleanSheets: 0, topScorer: null };
    if (!st) return ok("Team season dashboard loaded", {
      participates: false, season: seasonBrief(season), team: { _id: team._id, name: team.name, shortName: team.shortName, logo: team.logo },
      seasonTeam: null, managers: [], squad: [], stats: emptyStats, recentFixtures: [], upcomingFixtures: [],
    } as unknown as SeasonTeamDashboard);
    const { points: groupStagePoints, ...stats } = teamRecord(db, seasonId, st._id);
    void groupStagePoints;
    const squad = db.auctionLots.filter((lot) => lot.seasonRef === seasonId && lot.seasonTeamRef === st._id && ["sold", "withdrawn"].includes(lot.auctionStatus)).map((lot) => {
      const player = playerById(db, lot.playerRef);
      return { player: { _id: player._id, name: player.name, profilePic: player.profilePic }, position: lot.playerPosition, jerseyNo: lot.jerseyNo, purchasePrice: lot.purchasePrice, isIconPlayer: lot.isIconPlayer, isGoalkeeper: lot.isGoalkeeper, auctionStatus: lot.auctionStatus };
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
    const currentSeason = db.seasons.find((s) => s.status === "active") ?? null;
    const mapHistory = (lot: MockAuctionLot) => {
      const season = seasonById(db, lot.seasonRef);
      const st = lot.seasonTeamRef ? db.seasonTeams.find((item) => item._id === lot.seasonTeamRef) ?? null : null;
      return { season: seasonBrief(season), status: lot.auctionStatus, team: st ? teamBrief(db, st) : null, position: lot.playerPosition, jerseyNo: lot.jerseyNo, purchasePrice: lot.purchasePrice, isIconPlayer: lot.isIconPlayer, isGoalkeeper: lot.isGoalkeeper, soldAt: lot.soldAt };
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
      currentSeasonTeam: currentLot && currentSt ? { seasonTeamId: currentSt._id, team: teamBrief(db, currentSt), position: currentLot.playerPosition, jerseyNo: currentLot.jerseyNo, purchasePrice: currentLot.purchasePrice, isIconPlayer: currentLot.isIconPlayer, isGoalkeeper: currentLot.isGoalkeeper } : null,
      auctionHistory: orderedLots.map(mapHistory), teamMovementHistory: orderedLots.filter((lot) => lot.auctionStatus === "sold" || lot.auctionStatus === "withdrawn").map(mapHistory),
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
      if (match.seasonRef !== seasonId || (match.status !== "completed" && match.status !== "live")) continue;
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

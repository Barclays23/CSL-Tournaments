import type { ApiResponse } from "@/types/api.types";
import type { AuctionLot, AuctionLotsQuery, AuctionSummary, Season, SeasonTeam, SeasonWrite, SeasonPatch, UpdateAuctionLotInput } from "@/types/season.types";
import type { PlayerHistory, SeasonTeamDashboard } from "@/types/seasonStatistics.types";
import type { SeasonGroup, SeasonMatch, SeasonMatchQuery, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { readSeasonDb, commitSeasonDb } from "@/mocks/seasonStore";
import { readDb as readPrimaryDb, requireAdmin } from "@/mocks/store";
import type { MockAuctionLot, MockSeason, MockSeasonAward, MockSeasonMatch, MockSeasonTeam, SeasonMockDatabase } from "@/mocks/seasonSeed";
import type { SeasonAward, SeasonAwardInput } from "@/types/seasonAward.types";
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
function presentAward(db: SeasonMockDatabase, award: MockSeasonAward): SeasonAward {
  return {
    ...award,
    recipients: (Array.isArray(award?.recipients) ? award.recipients : []).filter(Boolean).map((recipient) => {
      const seasonTeam = db.seasonTeams.find((item) => item._id === recipient.seasonTeamRef);
      const team = seasonTeam ? teamById(db, seasonTeam.teamRef) : null;
      return {
        ...recipient,
        teamNameSnapshot: team?.name ?? recipient.teamNameSnapshot,
        teamLogoSnapshot: team?.logo ?? recipient.teamLogoSnapshot,
      };
    }),
  };
}
function seasonBrief(season: MockSeason) {
  return { _id: season._id, name: season.name, seasonNumber: season.seasonNumber, year: season.year, status: season.status };
}
function teamById(db: SeasonMockDatabase, id: string) {
  const team = db.teams.find((item) => item._id === id);
  if (!team) return fail(404, "Team not found");
  // The compatibility mock and season mock keep separate copies of Team records.
  // Prefer the editable master record so existing season views reflect its current name and logo.
  const current = readPrimaryDb().teams.find((item) => item._id === id);
  return current ? {
    ...team,
    name: current.name,
    shortName: current.shortName,
    description: current.description,
    logo: current.logo,
    poster: current.poster,
    status: current.status,
    updatedAt: current.updatedAt,
  } : team;
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
    logoSnapshot: team.logo, groupRef: st.groupRef, managerRefs: [...st.managerRefs], status: st.status,
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
  const teams = db.seasonTeams.filter((st) => st.seasonRef === season._id).map((st) => {
    const teamLots = soldLots(db, season._id, st._id);
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
    homeSeasonTeamRef: populatedMatchTeam(db, match.homeSeasonTeamRef) ?? match.homeSeasonTeamRef,
    awaySeasonTeamRef: populatedMatchTeam(db, match.awaySeasonTeamRef) ?? match.awaySeasonTeamRef,
    winnerSeasonTeamRef: match.winnerSeasonTeamRef
      ? populatedMatchTeam(db, match.winnerSeasonTeamRef) ?? match.winnerSeasonTeamRef
      : null,
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

  async getSeasonAwards(seasonId: string) {
    const db=readSeasonDb(); seasonById(db,seasonId);
    return ok("Season achievements loaded",(Array.isArray(db.awards)?db.awards:[]).filter((award)=>award?.seasonRef===seasonId).map((award)=>presentAward(db, award)));
  },
  async createSeasonAward(seasonId:string,input:SeasonAwardInput) {
    requireAdmin(); const db=readSeasonDb(); const season=seasonById(db,seasonId);
    if(season.status!=="active") fail(409,"Awards can only be managed while a season is Active");
    if(db.awards.some((a)=>a.seasonRef===seasonId&&a.awardType===input.awardType)) fail(409,"This award category already exists");
    if(input.awardType==="special"&&!input.title?.trim()) fail(422,"A title is required for a special award");
    const recipients=input.recipients.map((item)=>{
      const st=db.seasonTeams.find((x)=>x._id===item.seasonTeamId&&x.seasonRef===seasonId&&["registered","active"].includes(x.status));
      if(!st) fail(422,"Recipient SeasonTeam is invalid for this season");
      const player=item.playerId?db.players.find((x)=>x._id===item.playerId):null;
      const currentTeam=teamById(db,st.teamRef);
      if(item.playerId&&(!player||!db.auctionLots.some((lot)=>lot.seasonRef===seasonId&&lot.seasonTeamRef===st._id&&lot.playerRef===player._id&&lot.auctionStatus==="sold"))) fail(422,"Player is not rostered for this SeasonTeam");
      if(["champions","runner_up"].includes(input.awardType)&&(input.recipients.length!==1||player)) fail(422,"Team awards require exactly one SeasonTeam");
      if(!["champions","runner_up","special"].includes(input.awardType)&&!player) fail(422,"This award requires a player recipient");
      return {_id:newId(),recipientType:player?"player" as const:"season_team" as const,seasonTeamRef:st._id,playerRef:player?._id??null,displayNameSnapshot:player?.name??currentTeam.name,profileImageSnapshot:player?.profilePic??currentTeam.logo,teamNameSnapshot:currentTeam.name,teamLogoSnapshot:currentTeam.logo};
    });
    if(!recipients.length||recipients.length>20) fail(422,"An award must have one to twenty recipients");
    if(new Set(recipients.map((r)=>r.playerRef?r.seasonTeamRef+":"+r.playerRef:r.seasonTeamRef+":team")).size!==recipients.length) fail(422,"Duplicate award recipients are not allowed");
    if(["champions","runner_up"].includes(input.awardType)) {
      const other=db.awards.find((a)=>a.seasonRef===seasonId&&a.awardType!==input.awardType&&["champions","runner_up"].includes(a.awardType));
      if(other?.recipients[0]?.seasonTeamRef===recipients[0].seasonTeamRef) fail(422,"Champion and Runner-up must be different teams");
    }
    const labels:Record<SeasonAwardInput["awardType"],string>={champions:"Champions",runner_up:"Runner-up",golden_boot:"Golden Boot / Top Scorer",golden_glove:"Golden Glove",player_of_the_season:"Player of the Season",best_young_player:"Best Young Player",best_defender:"Best Defender",best_midfielder:"Best Midfielder",special:input.title!.trim()};
    const stamp=now(); const award:MockSeasonAward={_id:newId(),seasonRef:seasonId,awardType:input.awardType,title:input.title?.trim()||labels[input.awardType],description:input.description?.trim()||null,recipients,createdAt:stamp,updatedAt:stamp};
    db.awards.push(award);commitSeasonDb(db);return ok("Season achievement saved",presentAward(db, award));
  },
  async updateSeasonAward(seasonId:string,awardId:string,input:Partial<SeasonAwardInput>) {
    requireAdmin();const db=readSeasonDb();const season=seasonById(db,seasonId);
    if(season.status!=="active") fail(409,"Awards can only be edited while a season is Active");
    const award=db.awards.find((a)=>a._id===awardId&&a.seasonRef===seasonId);if(!award)fail(404,"Season award not found");
    const nextType=input.awardType??award.awardType;
    if(input.awardType&&db.awards.some((a)=>a._id!==awardId&&a.seasonRef===seasonId&&a.awardType===input.awardType))fail(409,"This award category already exists");
    if(input.recipients) {
      if(!input.recipients.length||input.recipients.length>20)fail(422,"An award must have one to twenty recipients");
      const replacement=input.recipients.map((item)=>{
        const st=db.seasonTeams.find((x)=>x._id===item.seasonTeamId&&x.seasonRef===seasonId&&["registered","active"].includes(x.status));if(!st)fail(422,"Recipient SeasonTeam is invalid for this season");
        const player=item.playerId?db.players.find((x)=>x._id===item.playerId):null;
        const currentTeam=teamById(db,st.teamRef);
        if(item.playerId&&(!player||!db.auctionLots.some((lot)=>lot.seasonRef===seasonId&&lot.seasonTeamRef===st._id&&lot.playerRef===player._id&&lot.auctionStatus==="sold")))fail(422,"Player is not rostered for this SeasonTeam");
        if(["champions","runner_up"].includes(nextType)&&(input.recipients!.length!==1||player))fail(422,"Team awards require exactly one SeasonTeam");
        if(!["champions","runner_up","special"].includes(nextType)&&!player)fail(422,"This award requires a player recipient");
        return {_id:newId(),recipientType:player?"player" as const:"season_team" as const,seasonTeamRef:st._id,playerRef:player?._id??null,displayNameSnapshot:player?.name??currentTeam.name,profileImageSnapshot:player?.profilePic??currentTeam.logo,teamNameSnapshot:currentTeam.name,teamLogoSnapshot:currentTeam.logo};
      });
      if(new Set(replacement.map((r)=>r.playerRef?r.seasonTeamRef+":"+r.playerRef:r.seasonTeamRef+":team")).size!==replacement.length)fail(422,"Duplicate award recipients are not allowed");
      if(["champions","runner_up"].includes(nextType)){const other=db.awards.find((a)=>a.seasonRef===seasonId&&a._id!==awardId&&["champions","runner_up"].includes(a.awardType));if(other?.recipients[0]?.seasonTeamRef===replacement[0].seasonTeamRef)fail(422,"Champion and Runner-up must be different teams");}
      award.recipients=replacement;
    }
    if(input.awardType)award.awardType=input.awardType;if(input.title!==undefined)award.title=input.title;if(input.description!==undefined)award.description=input.description;award.updatedAt=now();commitSeasonDb(db);return ok("Season achievement updated",presentAward(db, award));
  },
  async deleteSeasonAward(seasonId:string,awardId:string) {
    requireAdmin();const db=readSeasonDb();const season=seasonById(db,seasonId);if(season.status!=="active")fail(409,"Awards can only be changed while a season is Active");
    const index=db.awards.findIndex((a)=>a._id===awardId&&a.seasonRef===seasonId);if(index<0)fail(404,"Season award not found");
    if(["champions","runner_up"].includes(db.awards[index].awardType))fail(409,"Mandatory team achievements cannot be deleted");
    db.awards.splice(index,1);commitSeasonDb(db);return ok("Optional award deleted",null);
  },

  async getSeasonGroups(seasonId: string) {
    const db = readSeasonDb();
    seasonById(db, seasonId);
    const groups = db.groups
      .filter((group) => group.seasonRef === seasonId)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.groupName.localeCompare(b.groupName));
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
  async createSeasonMatch(seasonId: string, input: SeasonMatchWrite) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (["completed", "archived"].includes(season.status)) fail(409, "Season is closed for fixture creation");
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
    if (status === "completed") fail(422, "Create fixtures as scheduled, then record goals and complete the match");
    const date = now();
    const match: MockSeasonMatch = {
      _id: newId(),
      seasonRef: seasonId,
      matchNumber: input.matchNumber,
      stage: input.stage,
      groupRef: input.stage === "group" ? input.groupRef ?? null : null,
      kickoffAt: kickoff.toISOString(),
      venue: input.venue ?? null,
      homeSeasonTeamRef: home._id,
      awaySeasonTeamRef: away._id,
      status,
      goals: [],
      penaltyShootout: null,
      winnerSeasonTeamRef: null,
      notes: input.notes ?? null,
      createdAt: date,
      updatedAt: date,
    };
    db.matches.push(match);
    commitSeasonDb(db);
    return ok("Season fixture created", populatedSeasonMatch(db, match));
  },
  async getSeasons() {
    const db = readSeasonDb();
    return ok("Seasons loaded", [...db.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber) as unknown as Season[]);
  },
  async createSeason(input: SeasonWrite) {
    requireAdmin();
    const db = readSeasonDb();
    const normalizedName = input.name.trim().replace(/\s+/g, " ").toLowerCase();
    if (db.seasons.some((s) => s.seasonNumber === input.seasonNumber)) fail(409, "Season number already exists");
    if (db.seasons.some((s) => s.name.trim().replace(/\s+/g, " ").toLowerCase() === normalizedName)) fail(409, "Season name already exists");
    if (input.teamIds.length !== new Set(input.teamIds).size) fail(409, "A team can only be registered once in a season");
    if (input.teamIds.length > input.auctionSettings.seasonTeamCount) fail(422, "Selected teams exceed the season team limit");
    if (input.startDate && input.endDate && input.endDate < input.startDate) fail(422, "End date must be on or after start date");
    const date = now();
    const season: MockSeason = {
      _id: newId(), seasonNumber: input.seasonNumber, name: input.name.trim(), year: input.year,
      startDate: input.startDate ?? null, endDate: input.endDate ?? null, timeZone: input.timeZone ?? "Asia/Kolkata",
      groupStageEnabled: input.groupStageEnabled ?? true, status: "draft", auctionSettings: input.auctionSettings,
      pointsRules: input.pointsRules ?? { win: 3, draw: 1, loss: 0 },
      standingsTieBreakers: input.standingsTieBreakers ?? ["points", "goalDifference", "goalsScored", "teamNameAsc"],
      matchRules: input.matchRules ?? { groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true, shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false },
      auctionRevision: 0, createdAt: date, updatedAt: date,
    };
    const initialTeams = input.teamIds.map((teamId) => {
      const team = teamById(db, teamId);
      if (team.status !== "active") fail(422, "All selected teams must be active");
      return { _id: newId(), seasonRef: season._id, teamRef: team._id, displayName: team.name, logoSnapshot: team.logo, groupRef: null, managerRefs: [], status: "registered" as const, createdAt: date, updatedAt: date };
    });
    db.seasons.push(season);
    db.seasonTeams.push(...initialTeams);
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
    if ((input.pointsRules || input.standingsTieBreakers || input.matchRules || input.groupStageEnabled !== undefined) && matches.length) {
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
    if (next === "draft" && (db.auctionLots.some((lot) => lot.seasonRef === id) || db.matches.some((match) => match.seasonRef === id))) fail(409, "An Upcoming season can only return to Draft before auction or fixture activity");
    if (next === "upcoming" || next === "active") {
      const participants = db.seasonTeams.filter((st) => st.seasonRef === id && !["withdrawn", "eliminated", "completed"].includes(st.status));
      if (participants.length < 2) fail(422, "At least two participating teams are required");
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
        if (!groups.length || [...counts.values()].some((count) => count < 2)) fail(422, "Every group must contain at least two participating teams");
      }
    }
    if (next === "active" && db.seasons.some((s) => s._id !== id && s.status === "active")) fail(409, "Another season is already Active");
    season.status = next;
    season.updatedAt = now();
    commitSeasonDb(db);
    return ok("Season status updated", season as unknown as Season);
  },
  async completeSeason(id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, id);
    if (season.status !== "active") fail(409, "Only an Active season can be completed");
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
      return { _id: newId(), seasonRef: id, teamRef: teamId, displayName: team.name, logoSnapshot: team.logo, groupRef: null, managerRefs: [], status: "registered" as const, createdAt: now(), updatedAt: now() };
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
    if (!team) fail(404, "SeasonTeam not found");
    if (db.auctionLots.some((lot) => lot.seasonRef === seasonId && lot.seasonTeamRef === id)
      || db.matches.some((match) => match.seasonRef === seasonId && (match.homeSeasonTeamRef === id || match.awaySeasonTeamRef === id))) {
      fail(409, "This SeasonTeam has auction or fixture history and cannot be hard-deleted");
    }
    db.seasonTeams = db.seasonTeams.filter((st) => st._id !== id);
    commitSeasonDb(db); return ok("Unused registration removed", null);
  },
  async withdrawSeasonTeam(seasonId: string, id: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (season.status !== "active") fail(409, "Controlled withdrawal is available only during an Active season");
    const team = db.seasonTeams.find((st) => st._id === id && st.seasonRef === seasonId);
    if (!team) return fail(404, "SeasonTeam not found");
    if (team.status === "withdrawn") fail(409, "SeasonTeam has already withdrawn");
    const teamMatches = db.matches.filter((match) => match.seasonRef === seasonId && (match.homeSeasonTeamRef === id || match.awaySeasonTeamRef === id));
    if (teamMatches.some((match) => match.status === "live")) fail(409, "A team cannot withdraw during a live match");
    if (teamMatches.some((match) => ["scheduled", "postponed"].includes(match.status))) {
      fail(409, "Reschedule or explicitly cancel all scheduled/postponed fixtures before withdrawing this team");
    }
    team.status = "withdrawn"; team.updatedAt = now();
    commitSeasonDb(db); return ok("SeasonTeam withdrawn; history preserved", populatedSeasonTeam(db, team));
  },
  async createSeasonGroup(seasonId: string, input: { groupName: string; displayOrder?: number }) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (!["draft", "upcoming"].includes(season.status) || db.matches.some((match) => match.seasonRef === seasonId)) fail(409, "Groups can only be created before fixtures exist");
    const normalized = input.groupName.trim().replace(/\s+/g, " ").toLowerCase();
    if (db.groups.some((group) => group.seasonRef === seasonId && group.groupName.trim().replace(/\s+/g, " ").toLowerCase() === normalized)) fail(409, "Group name already exists in this season");
    const group = { _id: newId(), seasonRef: seasonId, groupName: input.groupName.trim(), displayOrder: input.displayOrder ?? 0, createdAt: now(), updatedAt: now() };
    db.groups.push(group); commitSeasonDb(db); return ok("Season group created", group);
  },
  async updateSeasonGroup(seasonId: string, groupId: string, input: { groupName?: string; displayOrder?: number }) {
    requireAdmin();
    const db = readSeasonDb(); const season = seasonById(db, seasonId);
    if (!["draft", "upcoming"].includes(season.status) || db.matches.some((match) => match.seasonRef === seasonId)) fail(409, "Groups are locked after fixtures exist");
    const group = db.groups.find((item) => item._id === groupId && item.seasonRef === seasonId);
    if (!group) return fail(404, "Group not found");
    if (input.groupName !== undefined) {
      const normalized = input.groupName.trim().replace(/\s+/g, " ").toLowerCase();
      if (db.groups.some((item) => item._id !== groupId && item.seasonRef === seasonId && item.groupName.trim().replace(/\s+/g, " ").toLowerCase() === normalized)) fail(409, "Group name already exists in this season");
      group.groupName = input.groupName.trim();
    }
    if (input.displayOrder !== undefined) group.displayOrder = input.displayOrder;
    group.updatedAt = now(); commitSeasonDb(db); return ok("Group updated", group);
  },
  async deleteSeasonGroup(seasonId: string, groupId: string) {
    requireAdmin();
    const db = readSeasonDb();
    const season = seasonById(db, seasonId);
    if (!["draft", "upcoming"].includes(season.status)) fail(409, "Groups can only be deleted before activation");
    const group = db.groups.find((item) => item._id === groupId && item.seasonRef === seasonId);
    if (!group) return fail(404, "Group not found");
    if (db.seasonTeams.some((st) => st.seasonRef === seasonId && st.groupRef === groupId)) fail(409, "Remove all SeasonTeam assignments before deleting this group");
    if (db.matches.some((match) => match.seasonRef === seasonId && match.groupRef === groupId)) {
      fail(409, "This group is referenced by a fixture and cannot be deleted");
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
    return ok("Auction lots loaded", lots.map((lot) => populatedLot(db, lot)));
  },
  async nominatePlayer(input: { seasonId: string; playerId: string; playerPosition: MockAuctionLot["playerPosition"]; isIconPlayer: boolean; isGoalkeeper?: boolean }) {
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
      playerPosition: input.playerPosition, isIconPlayer: input.isIconPlayer, isGoalkeeper: Boolean(input.isGoalkeeper),
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
    if (season.status === "completed" || season.status === "archived") fail(409, "Auction is closed for this season");

    const nextPosition = input.playerPosition ?? lot.playerPosition;
    const nextIconStatus = input.isIconPlayer ?? lot.isIconPlayer;
    const nextGoalkeeperStatus = input.isGoalkeeper ?? lot.isGoalkeeper;
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
      if (existing.length >= settings.teamSquadSize) fail(422, "Team squad size limit reached");
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
    const squad = soldLots(db, seasonId, st._id).map((lot) => {
      const player = playerById(db, lot.playerRef);
      return { player: { _id: player._id, name: player.name, profilePic: player.profilePic }, position: lot.playerPosition, jerseyNo: lot.jerseyNo, purchasePrice: lot.purchasePrice, isIconPlayer: lot.isIconPlayer, isGoalkeeper: lot.isGoalkeeper };
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

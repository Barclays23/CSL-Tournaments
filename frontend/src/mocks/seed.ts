import type { Database, StoredGoal, StoredMatch, StoredPlayer, StoredTeam } from "@/mocks/store";
import { createSeasonDatabase } from "@/mocks/seasonSeed";

// Compatibility projection for older UI services. The authoritative mock documents
// live in seasonSeed.ts and use the season-based Mongoose collection structure.
export function createSeed(): Database {
  const source = createSeasonDatabase();
  const activeSeason = (source.seasons.find((season) => season.status === "active") ?? [...source.seasons].sort((a, b) => b.seasonNumber - a.seasonNumber)[0])!;
  const seasonTeams = source.seasonTeams.filter((item) => item.seasonRef === activeSeason._id);
  const teams: StoredTeam[] = source.teams.map((team) => ({
    _id: team._id, name: team.name, shortName: team.shortName, description: team.description,
    logo: team.logo, poster: team.poster, status: team.status,
    createdAt: team.createdAt, updatedAt: team.updatedAt,
  }));
  const players: StoredPlayer[] = source.players.map((player) => ({
    _id: player._id, __v: player.__v, name: player.name, mobile: player.mobile, email: player.email,
    dateOfBirth: player.dateOfBirth, status: player.status, profilePic: player.profilePic,
    notes: player.notes, createdAt: player.createdAt, updatedAt: player.updatedAt,
  }));
  const managers = source.managers.map((manager) => {
    const assigned = seasonTeams.find((item) => item.managerRefs.includes(manager._id));
    return { _id: manager._id, name: manager.name, mobile: manager.mobile, email: manager.email, dateOfBirth: manager.dateOfBirth, teamRef: assigned?.teamRef ?? null, role: "Manager", profilePic: manager.profilePic, status: manager.status };
  });
  const sponsors = source.sponsors.map((sponsor) => ({
    _id: sponsor._id, name: sponsor.name, logo: sponsor.logo, tier: sponsor.tier, website: sponsor.website,
    contactPerson: sponsor.contactPerson, contactMobile: sponsor.contactMobile, notes: sponsor.notes, status: sponsor.status,
  }));
  const matches: StoredMatch[] = source.matches.filter((match) => match.seasonRef === activeSeason._id).map((match) => {
    const home = seasonTeams.find((item) => item._id === match.homeSeasonTeamRef)!;
    const away = seasonTeams.find((item) => item._id === match.awaySeasonTeamRef)!;
    const group = source.groups.find((item) => item._id === match.groupRef);
    const goals: StoredGoal[] = match.status === "scheduled" ? [] : match.goals.map((goal) => {
      const scoring = seasonTeams.find((item) => item._id === goal.scoringSeasonTeamRef)!;
      const responsible = goal.playerSeasonTeamRef ? seasonTeams.find((item) => item._id === goal.playerSeasonTeamRef) : null;
      const ownGoalPlayer = goal.goalType === "own_goal" && responsible
        ? source.auctionLots.find((lot) => lot.seasonRef === activeSeason._id && lot.seasonTeamRef === responsible._id && lot.auctionStatus === "sold")?.playerRef ?? null
        : null;
      return { _id: goal._id, scoringTeamRef: scoring.teamRef, goalType: goal.goalType, scorerRef: goal.scorerPlayerRef, ownGoalPlayerRef: ownGoalPlayer, createdAt: goal.createdAt };
    });
    const stage: StoredMatch["stage"] = match.stage === "group" ? "group" : match.stage === "final" ? "final" : match.stage === "semi_final" || match.stage === "third_place" ? "semi_final" : "quarter_final";
    return {
      _id: match._id, matchNo: `S${activeSeason.seasonNumber}-M${String(match.matchNumber).padStart(2, "0")}`,
      stage, groupName: group?.groupName ?? null, kickoffAt: match.kickoffAt, venue: match.venue,
      team1Ref: home.teamRef, team2Ref: away.teamRef,
      status: match.status === "abandoned" ? "cancelled" : match.status,
      goals, penaltyShootout: match.penaltyShootout ? { team1Score: match.penaltyShootout.homeTeamScore, team2Score: match.penaltyShootout.awayTeamScore } : null,
      notes: match.notes, createdAt: match.createdAt, updatedAt: match.updatedAt,
    };
  });
  return {
    settings: {
      _id: "settings-preview-derived", singletonKey: "CSL_CURRENT", tournamentName: activeSeason.name,
      startDate: activeSeason.startDate ?? "", endDate: activeSeason.endDate ?? "",
      maxActivePlayers: activeSeason.auctionSettings.playersCount,
      maxActiveTeams: activeSeason.auctionSettings.seasonTeamCount,
      maxPlayersPerTeam: activeSeason.auctionSettings.teamSquadSize,
      auctionBudgetPerTeam: activeSeason.auctionSettings.budgetPerTeam,
      requiredIconPlayers: activeSeason.auctionSettings.iconPlayerLimit,
      requiredGoalkeepers: activeSeason.auctionSettings.goalkeeperLimit,
      pointsRule: activeSeason.pointsRules, auctionState: activeSeason.status === "active" ? "in_progress" : "completed",
      auctionCompletedAt: null, updatedAt: activeSeason.updatedAt,
    },
    user: { _id: source.users[0]._id, name: source.users[0].name, email: source.users[0].email, role: "admin", status: "active" },
    teams, players, managers, sponsors, matches,
  };
}

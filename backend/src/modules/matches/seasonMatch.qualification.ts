import type { SeasonPointsRules } from "../seasons/season.types.js";
import type { SeasonMatchStage } from "./seasonMatch.types.js";

type QualificationTeam = { _id: unknown; displayName: string; groupRef: unknown; status: string };
type QualificationMatch = { stage: SeasonMatchStage; status: string; homeSeasonTeamRef: unknown; awaySeasonTeamRef: unknown; goals: Array<{ scoringSeasonTeamRef: unknown }>; winnerSeasonTeamRef: unknown };
const id = (value: unknown) => String(value);

export function groupStageQualifiers(teams: QualificationTeam[], matches: QualificationMatch[], points: SeasonPointsRules, placesPerGroup = 2): Set<string> {
  const groups = new Map<string, QualificationTeam[]>();
  for (const team of teams) {
    if (team.status !== "active" || !team.groupRef) continue;
    const key = id(team.groupRef);
    groups.set(key, [...(groups.get(key) ?? []), team]);
  }
  const qualified = new Set<string>();
  for (const groupTeams of groups.values()) {
    const standings = groupTeams.map((team) => ({ team, points: 0, goalsFor: 0, goalsAgainst: 0 }));
    const rows = new Map(standings.map((row) => [id(row.team._id), row]));
    for (const match of matches) {
      if (match.stage !== "group" || match.status !== "completed") continue;
      const home = rows.get(id(match.homeSeasonTeamRef));
      const away = rows.get(id(match.awaySeasonTeamRef));
      if (!home || !away) continue;
      const homeGoals = match.goals.filter((goal) => id(goal.scoringSeasonTeamRef) === id(home.team._id)).length;
      const awayGoals = match.goals.filter((goal) => id(goal.scoringSeasonTeamRef) === id(away.team._id)).length;
      home.goalsFor += homeGoals; home.goalsAgainst += awayGoals;
      away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
      if (homeGoals > awayGoals) { home.points += points.win; away.points += points.loss; }
      else if (homeGoals < awayGoals) { away.points += points.win; home.points += points.loss; }
      else { home.points += points.draw; away.points += points.draw; }
    }
    standings.sort((a, b) => b.points - a.points ||
      (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor || a.team.displayName.localeCompare(b.team.displayName));
    for (const row of standings.slice(0, placesPerGroup)) qualified.add(id(row.team._id));
  }
  return qualified;
}

export function qualifiedTeamsForStage(stage: SeasonMatchStage, groupQualifiers: Set<string>, activeTeamIds: Set<string>, roundOf16: QualificationMatch[], quarterFinals: QualificationMatch[], semiFinals: QualificationMatch[]): Set<string> {
  const winners = (matches: QualificationMatch[], losers = false) => {
    const result = new Set<string>();
    for (const match of matches) {
      if (match.status !== "completed" || !match.winnerSeasonTeamRef) continue;
      const winner = id(match.winnerSeasonTeamRef);
      if (losers) {
        const home = id(match.homeSeasonTeamRef), away = id(match.awaySeasonTeamRef);
        result.add(winner === home ? away : home);
      } else result.add(winner);
    }
    return result;
  };
  if (stage === "round_of_16") return new Set(groupQualifiers.size ? groupQualifiers : activeTeamIds);
  if (stage === "quarter_final") return roundOf16.length ? winners(roundOf16) : new Set(groupQualifiers.size ? groupQualifiers : activeTeamIds);
  if (stage === "semi_final") return quarterFinals.length ? winners(quarterFinals) : roundOf16.length ? winners(roundOf16) : new Set(groupQualifiers.size ? groupQualifiers : activeTeamIds);
  if (stage === "final") return winners(semiFinals);
  if (stage === "third_place") return winners(semiFinals, true);
  return new Set();
}

export function assertStageMatchesResolved(matches: QualificationMatch[], label: string): void {
  if (matches.some((match) => match.status !== "completed")) throw new Error(`All ${label} fixtures must be completed before advancing teams`);
}

import type { SeasonAuctionSettings } from "./season.types.js";

export interface AuctionCompletionTeam {
  _id: unknown;
  status: string;
}

export interface AuctionCompletionLot {
  _id?: unknown;
  auctionStatus: string;
  seasonTeamRef: unknown;
  purchasePrice: number | null;
  isIconPlayer: boolean;
  isGoalkeeper: boolean;
  jerseyNo: number | null;
}

const id = (value: unknown): string => {
  if (value && typeof value === "object" && "_id" in value) return String((value as { _id: unknown })._id);
  return value == null ? "" : String(value);
};

const ELIGIBLE_TEAM_STATUSES = new Set(["registered", "active"]);

/** Validate the full auction snapshot before changing the season lifecycle to completed. */
export function getAuctionCompletionBlockers(
  settings: SeasonAuctionSettings,
  teams: AuctionCompletionTeam[],
  lots: AuctionCompletionLot[],
): string[] {
  const blockers: string[] = [];
  const eligibleTeams = teams.filter((team) => ELIGIBLE_TEAM_STATUSES.has(team.status));
  const eligibleIds = new Set(eligibleTeams.map((team) => id(team._id)));

  if (eligibleTeams.length < 2) blockers.push("At least two eligible participating teams are required");
  if (teams.length > settings.seasonTeamCount) blockers.push("Registered teams exceed the configured season team limit");
  if (lots.length > settings.playersCount) blockers.push("Nominated players exceed the configured player limit");

  const pending = lots.filter((lot) => lot.auctionStatus === "pending").length;
  if (pending) blockers.push(pending + " pending auction lot(s) remain; resolve every lot as Sold, Unsold or Withdrawn");

  const unsupported = lots.filter((lot) => !["pending", "sold", "unsold", "withdrawn"].includes(lot.auctionStatus));
  if (unsupported.length) blockers.push(unsupported.length + " auction lot(s) have an unsupported lot status");

  const soldByTeam = new Map<string, AuctionCompletionLot[]>();
  const invalidAssignments = lots.filter((lot) => {
    if (lot.auctionStatus === "sold") return !id(lot.seasonTeamRef) || !eligibleIds.has(id(lot.seasonTeamRef));
    return Boolean(id(lot.seasonTeamRef));
  });
  if (invalidAssignments.length) blockers.push(invalidAssignments.length + " auction lot(s) have an invalid team assignment for their lot status");

  for (const lot of lots) {
    if (lot.auctionStatus !== "sold" || !id(lot.seasonTeamRef) || !eligibleIds.has(id(lot.seasonTeamRef))) continue;
    const teamId = id(lot.seasonTeamRef);
    const assigned = soldByTeam.get(teamId) ?? [];
    assigned.push(lot);
    soldByTeam.set(teamId, assigned);
    if (lot.purchasePrice === null || !Number.isFinite(lot.purchasePrice) || lot.purchasePrice < 0) {
      blockers.push("A sold auction lot has an invalid purchase price");
    }
  }

  for (const team of eligibleTeams) {
    const teamId = id(team._id);
    const roster = soldByTeam.get(teamId) ?? [];
    const label = "Team " + teamId;
    if (!roster.length) blockers.push(label + " has no players purchased");
    if (roster.length > settings.teamSquadSize) blockers.push(label + " exceeds the configured squad size of " + settings.teamSquadSize);
    const iconCount = roster.filter((lot) => lot.isIconPlayer).length;
    if (iconCount > settings.iconPlayerLimit) blockers.push(label + " exceeds the Icon Player limit of " + settings.iconPlayerLimit);
    const goalkeeperCount = roster.filter((lot) => lot.isGoalkeeper).length;
    if (goalkeeperCount > settings.goalkeeperLimit) blockers.push(label + " exceeds the Goalkeeper limit of " + settings.goalkeeperLimit);
    const spend = roster.reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0);
    if (spend > settings.budgetPerTeam) blockers.push(label + " exceeds the team auction budget");
    const jerseyNumbers = roster.map((lot) => lot.jerseyNo).filter((value): value is number => value !== null);
    if (new Set(jerseyNumbers).size !== jerseyNumbers.length) blockers.push(label + " has duplicate jersey numbers");
  }

  return [...new Set(blockers)];
}

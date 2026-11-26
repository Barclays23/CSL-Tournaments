import type { SeasonAuctionSettings } from "./season.types.js";

export interface AuctionCompletionTeam {
  _id: unknown;
  status: string;
  displayName?: string;
  groupRef?: unknown;
}

export interface AuctionCompletionGroupReadiness {
  groupStageEnabled: boolean;
  groupIds: unknown[];
}

export interface AuctionCompletionLot {
  _id?: unknown;
  auctionStatus: string;
  seasonTeamRef: unknown;
  purchasePrice: number | null;
  isIconPlayer: boolean;
  isGoalkeeper: boolean;
  jerseyNo: number | null;
  soldAt?: Date | null;
}

const id = (value: unknown): string => {
  if (value && typeof value === "object" && "_id" in value) return String((value as { _id: unknown })._id);
  return value == null ? "" : String(value);
};

const ELIGIBLE_TEAM_STATUSES = new Set(["registered", "active"]);

/** Validate nomination count and team configuration before explicitly starting an auction. */
export function getAuctionStartBlockers(
  settings: SeasonAuctionSettings,
  teams: AuctionCompletionTeam[],
  nonWithdrawnLotCount: number,
): string[] {
  const blockers: string[] = [];
  const eligibleTeams = teams.filter((team) => ELIGIBLE_TEAM_STATUSES.has(team.status));
  if (settings.playersCount !== settings.seasonTeamCount * settings.teamSquadSize) {
    blockers.push("Configured playersCount must equal seasonTeamCount multiplied by teamSquadSize");
  }
  if (eligibleTeams.length !== settings.seasonTeamCount) {
    blockers.push("Registered eligible teams must exactly match the configured season team count");
  }
  if (nonWithdrawnLotCount !== settings.playersCount) {
    blockers.push("Current non-withdrawn auction lots must exactly match the configured player count");
  }
  return blockers;
}

/** Validate the current auction snapshot. Withdrawn lots remain history, not active roster entries. */
export function getAuctionCompletionBlockers(
  settings: SeasonAuctionSettings,
  teams: AuctionCompletionTeam[],
  lots: AuctionCompletionLot[],
  groupReadiness?: AuctionCompletionGroupReadiness,
): string[] {
  const blockers: string[] = [];
  if (!Number.isFinite(settings.budgetPerTeam) || settings.budgetPerTeam < 0) blockers.push("Team budget setting must be zero or greater");
  if (!Number.isInteger(settings.playersCount) || settings.playersCount < 1) blockers.push("Season player limit must be a positive whole number");
  if (!Number.isInteger(settings.seasonTeamCount) || settings.seasonTeamCount < 2) blockers.push("Season team limit must be at least two teams");
  if (!Number.isInteger(settings.teamSquadSize) || settings.teamSquadSize < 1) blockers.push("Team squad size must be a positive whole number");
  if (!Number.isInteger(settings.iconPlayerLimit) || settings.iconPlayerLimit < 0 || settings.iconPlayerLimit > settings.teamSquadSize) blockers.push("Icon Player limit must be between zero and the team squad size");
  if (!Number.isInteger(settings.goalkeeperLimit) || settings.goalkeeperLimit < 0 || settings.goalkeeperLimit > settings.teamSquadSize) blockers.push("Goalkeeper limit must be between zero and the team squad size");
  if (settings.playersCount !== settings.seasonTeamCount * settings.teamSquadSize) {
    blockers.push("Configured playersCount must equal seasonTeamCount multiplied by teamSquadSize");
  }

  const eligibleTeams = teams.filter((team) => ELIGIBLE_TEAM_STATUSES.has(team.status));
  const eligibleIds = new Set(eligibleTeams.map((team) => id(team._id)));
  const allTeamIds = new Set(teams.map((team) => id(team._id)));
  if (groupReadiness?.groupStageEnabled) {
    const validGroupIds = new Set(groupReadiness.groupIds.map((groupId) => id(groupId)).filter(Boolean));
    const unassignedTeams = eligibleTeams.filter((team) => !id(team.groupRef) || !validGroupIds.has(id(team.groupRef)));
    if (unassignedTeams.length) {
      const labels = unassignedTeams.map((team) => team.displayName?.trim() || ("Team " + id(team._id)));
      blockers.push("Assign every participating team to a valid Season Group before completing the auction: " + labels.join(", "));
    }
  }
  if (eligibleTeams.length !== settings.seasonTeamCount) blockers.push("Registered eligible teams must exactly match the configured season team count");
  const currentLots = lots.filter((lot) => lot.auctionStatus !== "withdrawn");
  if (currentLots.length !== settings.playersCount) blockers.push("Current non-withdrawn auction lots must exactly match the configured player count");
  const unsupported = currentLots.filter((lot) => !["pending", "sold", "unsold"].includes(lot.auctionStatus));
  if (unsupported.length) blockers.push(unsupported.length + " current auction lot(s) have an unsupported status");
  const pending = currentLots.filter((lot) => lot.auctionStatus === "pending").length;
  const unsold = currentLots.filter((lot) => lot.auctionStatus === "unsold").length;
  if (pending) blockers.push(pending + " pending auction lot(s) remain");
  if (unsold) blockers.push(unsold + " unsold auction lot(s) must be assigned to a team");
  const sold = currentLots.filter((lot) => lot.auctionStatus === "sold");
  if (sold.length !== settings.playersCount) blockers.push("Every current non-withdrawn auction lot must be Sold");

  const soldByTeam = new Map<string, AuctionCompletionLot[]>();
  const invalidAssignments = sold.filter((lot) => !id(lot.seasonTeamRef) || !eligibleIds.has(id(lot.seasonTeamRef)));
  if (invalidAssignments.length) blockers.push(invalidAssignments.length + " sold auction lot(s) have an invalid team assignment");
  for (const lot of sold) {
    if (!id(lot.seasonTeamRef) || !eligibleIds.has(id(lot.seasonTeamRef))) continue;
    const teamId = id(lot.seasonTeamRef);
    const roster = soldByTeam.get(teamId) ?? [];
    roster.push(lot);
    soldByTeam.set(teamId, roster);
    if (lot.purchasePrice === null || !Number.isFinite(lot.purchasePrice) || lot.purchasePrice < 0) blockers.push("A sold auction lot has an invalid purchase price");
  }
  if (lots.some((lot) => lot.auctionStatus === "withdrawn" && (!id(lot.seasonTeamRef) || !allTeamIds.has(id(lot.seasonTeamRef)) || lot.purchasePrice === null || lot.purchasePrice === undefined || !lot.soldAt))) {
    blockers.push("Withdrawn sold players must retain their original team, purchase price and soldAt history");
  }
  for (const team of eligibleTeams) {
    const roster = soldByTeam.get(id(team._id)) ?? [];
    const label = team.displayName?.trim() || ("Team " + id(team._id));
    if (roster.length !== settings.teamSquadSize) blockers.push(label + " must have exactly " + settings.teamSquadSize + " Sold players");
    if (roster.filter((lot) => lot.isIconPlayer).length > settings.iconPlayerLimit) blockers.push(label + " exceeds the Icon Player limit of " + settings.iconPlayerLimit);
    if (roster.filter((lot) => lot.isGoalkeeper).length > settings.goalkeeperLimit) blockers.push(label + " exceeds the Goalkeeper limit of " + settings.goalkeeperLimit);
    const spend = roster.reduce((sum, lot) => sum + (lot.purchasePrice ?? 0), 0);
    if (spend > settings.budgetPerTeam) blockers.push(label + " exceeds the team auction budget");
    const jerseys = roster.map((lot) => lot.jerseyNo).filter((value): value is number => value !== null);
    if (new Set(jerseys).size !== jerseys.length) blockers.push(label + " has duplicate jersey numbers");
  }
  return [...new Set(blockers)];
}

export interface AuctionNominationQuotaCounts {
  iconPlayers: number;
  goalkeepers: number;
}

export interface AuctionNominationFlags {
  isIconPlayer: boolean;
  isGoalkeeper: boolean;
}

/** Return quota messages for the destination team's existing Sold roster. */
export function getAuctionTeamQuotaBlockers(
  settings: SeasonAuctionSettings,
  counts: AuctionNominationQuotaCounts,
  player: AuctionNominationFlags,
  teamName: string,
): string[] {
  const blockers: string[] = [];

  if (player.isIconPlayer && counts.iconPlayers >= settings.iconPlayerLimit) {
    const countLabel = counts.iconPlayers === 1 ? "Icon Player" : "Icon Players";
    const limitLabel = settings.iconPlayerLimit === 1 ? "Icon Player" : "Icon Players";
    blockers.push(`${teamName} already has ${counts.iconPlayers} ${countLabel}. Each team can have a maximum of ${settings.iconPlayerLimit} ${limitLabel}.`);
  }

  if (player.isGoalkeeper && counts.goalkeepers >= settings.goalkeeperLimit) {
    const countLabel = counts.goalkeepers === 1 ? "Goalkeeper" : "Goalkeepers";
    const limitLabel = settings.goalkeeperLimit === 1 ? "Goalkeeper" : "Goalkeepers";
    blockers.push(`${teamName} already has ${counts.goalkeepers} ${countLabel}. Each team can have a maximum of ${settings.goalkeeperLimit} ${limitLabel}.`);
  }

  return blockers;
}

/** Enforce designation quotas across the whole season when a new lot is nominated. */
export function getAuctionNominationQuotaBlockers(
  settings: SeasonAuctionSettings,
  counts: AuctionNominationQuotaCounts,
  nomination: AuctionNominationFlags,
): string[] {
  const blockers: string[] = [];
  const iconPlayerLimit = settings.seasonTeamCount * settings.iconPlayerLimit;
  const goalkeeperLimit = settings.seasonTeamCount * settings.goalkeeperLimit;

  if (nomination.isIconPlayer && counts.iconPlayers >= iconPlayerLimit) {
    blockers.push(`The season Icon Player quota is full. A maximum of ${iconPlayerLimit} Icon Player nominations are allowed (${settings.iconPlayerLimit} per team × ${settings.seasonTeamCount} teams).`);
  }
  if (nomination.isGoalkeeper && counts.goalkeepers >= goalkeeperLimit) {
    blockers.push(`The season Goalkeeper quota is full. A maximum of ${goalkeeperLimit} Goalkeeper nominations are allowed (${settings.goalkeeperLimit} per team × ${settings.seasonTeamCount} teams).`);
  }
  return blockers;
}

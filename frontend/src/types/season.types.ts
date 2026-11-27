import type { Asset } from "@/types/api.types";

export type SeasonStatus = "draft" | "upcoming" | "active" | "completed" | "archived";
export type AuctionLifecycleStatus = "not_started" | "in_progress" | "completed";
export type SeasonPlayerPosition = "goalkeeper" | "defender" | "midfielder" | "forward";
export type AuctionLotStatus = "pending" | "sold" | "unsold" | "withdrawn";
export type SeasonTeamStatus = "registered" | "active" | "withdrawn" | "eliminated" | "completed";

export interface SeasonAuctionSettings {
  currency: "INR";
  budgetPerTeam: number;
  playersCount: number;
  seasonTeamCount: number;
  teamSquadSize: number;
  iconPlayerLimit: number;
  goalkeeperLimit: number;
}

export interface SeasonMatchDefaults {groupStageDrawAllowed:boolean;defaultMatchDurationMinutes:number;extraTime:{isAllowedByDefault:boolean;defaultDurationMinutes:number};penaltyShootout:{isAllowedByDefault:boolean};shootoutCountsForMatchScore:false;shootoutCountsForPlayerGoals:false;}

export interface Season {
  _id: string;
  seasonNumber: number;
  name: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  timeZone: "Asia/Kolkata";
  status: SeasonStatus;
  groupStageEnabled?: boolean;
  homeAndAwayFixtures?: boolean;
  historyCompleteness?: "not_applicable" | "metadata_only" | "partial" | "full";
  pointsRules?: { win: number; draw: number; loss: number } | null;
  standingsTieBreakers?: Array<"points" | "goalDifference" | "goalsScored" | "teamNameAsc"> | null;
  matchRules?:SeasonMatchDefaults|null;
  auctionSettings: SeasonAuctionSettings | null;
  auctionLifecycleStatus: AuctionLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SeasonWrite {
  seasonNumber: number;
  name: string;
  year: number;
  startDate?: string | null;
  endDate?: string | null;
  timeZone?: "Asia/Kolkata";
  groupStageEnabled?: boolean;
  homeAndAwayFixtures?: boolean;
  auctionSettings: SeasonAuctionSettings;
  pointsRules?: { win: number; draw: number; loss: number };
  standingsTieBreakers?: Array<"points" | "goalDifference" | "goalsScored" | "teamNameAsc">;
  matchRules?:SeasonMatchDefaults;
}

export type SeasonPatch=Omit<Partial<SeasonWrite>,"matchRules">&{auctionSettings?:Partial<SeasonAuctionSettings>;pointsRules?:Partial<{win:number;draw:number;loss:number}>;matchRules?:Partial<Omit<SeasonMatchDefaults,"extraTime"|"penaltyShootout">>&{extraTime?:Partial<SeasonMatchDefaults["extraTime"]>;penaltyShootout?:Partial<SeasonMatchDefaults["penaltyShootout"]>};};

export interface AuctionTeamRef {
  _id: string;
  displayName: string;
  team: { _id: string; name: string; shortName: string | null; logo: Asset | null } | null;
}

export interface AuctionPlayerRef {
  _id: string;
  name: string;
  profilePic: Asset | null;
}

export interface AuctionLot {
  _id: string;
  seasonRef: string;
  seasonTeamRef: string | AuctionTeamRef | null;
  playerRef: string | AuctionPlayerRef;
  lotNumber: number | null;
  auctionStatus: AuctionLotStatus;
  purchasePrice: number | null;
  playerPosition: SeasonPlayerPosition;
  isIconPlayer: boolean;
  isGoalkeeper: boolean;
  jerseyNo: number | null;
  nominatedAt: string | null;
  soldAt: string | null;
}

export interface AuctionLotsQuery {
  seasonId: string;
  page?: number;
  limit?: number;
  seasonTeamId?: string;
  playerName?: string;
  playerPosition?: SeasonPlayerPosition;
  auctionStatus?: AuctionLotStatus;
  isIconPlayer?: boolean;
  isGoalkeeper?: boolean;
}

export interface UpdateAuctionLotInput {
  auctionStatus: AuctionLotStatus;
  seasonTeamId?: string | null;
  purchasePrice?: number | null;
  jerseyNo?: number | null;
  playerPosition?: SeasonPlayerPosition;
  isIconPlayer?: boolean;
  isGoalkeeper?: boolean;
}

export interface NominatePlayerInput {
  seasonId: string;
  playerId: string;
  playerPosition: SeasonPlayerPosition;
  isIconPlayer: boolean;
  isGoalkeeper?: boolean;
}

export interface AuctionTeamSummary {
  seasonTeamId: string;
  teamId: string;
  displayName: string;
  logoSnapshot: Asset | null;
  status: SeasonTeamStatus;
  budget: number;
  playersSigned: number;
  remainingSlots: number;
  totalSpent: number;
  balance: number;
  averagePrice: number;
  iconCount: number;
  goalkeeperCount: number;
  lots: AuctionLot[];
}

export interface AuctionSummary {
  season: {
    _id: string;
    name: string;
    year: number;
    status: SeasonStatus;
    auctionSettings: SeasonAuctionSettings;
    auctionLifecycleStatus: AuctionLifecycleStatus;
  };
  totals: {
    participatingTeams: number;
    lots: number;
    sold: number;
    pending: number;
    unsold: number;
    withdrawn: number;
    totalSoldValue: number;
    nominatedIconPlayers: number;
    nominatedGoalkeepers: number;
  };
  nominatedPlayerIds: string[];
  teams: AuctionTeamSummary[];
}

export interface SeasonTeam {
  _id: string;
  seasonRef: string;
  teamRef: string;
  displayName: string;
  logoSnapshot: Asset | null;
  groupRef: string | null;
  managerRefs: string[];
  playersCount: number;
  status: SeasonTeamStatus;
  participationHistory?: Array<{fromStatus:string;toStatus:string;reason:string;changedAt:string}>;
  team: { _id: string; name: string; shortName: string | null; logo: Asset | null } | null;
  group: { _id: string; groupName: string; displayOrder: number } | null;
  managers: Array<{ _id: string; name: string; role: string | null; profilePic: Asset | null }>;
}

export interface SeasonBriefDto {
  _id: string;
  name: string;
  seasonNumber: number;
  year: number;
  status: SeasonStatus;
}

export interface SeasonTeamBriefDto {
  _id: string;
  teamId: string;
  displayName: string;
  shortName: string | null;
  logo: Asset | null;
  groupRef: string | null;
  groupName: string | null;
}

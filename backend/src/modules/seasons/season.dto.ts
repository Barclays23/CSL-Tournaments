import type { AuctionLifecycleStatus, SeasonAuctionSettings, SeasonMatchRules, SeasonPointsRules, SeasonStatus, SeasonTieBreaker } from "./season.types.js";

export interface CreateSeasonDto {
  seasonNumber: number;
  name: string;
  year: number;
  startDate?: Date | null;
  endDate?: Date | null;
  timeZone?: "Asia/Kolkata";
  groupStageEnabled?: boolean;
  homeAndAwayFixtures?: boolean;
  auctionSettings: SeasonAuctionSettings;
  pointsRules?: SeasonPointsRules;
  standingsTieBreakers?: SeasonTieBreaker[];
  matchRules?: SeasonMatchRules;
}

export interface UpdateSeasonDto {
  seasonNumber?: number;
  name?: string;
  year?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  timeZone?: "Asia/Kolkata";
  groupStageEnabled?: boolean;
  homeAndAwayFixtures?: boolean;
  auctionSettings?: Partial<SeasonAuctionSettings>;
  pointsRules?: Partial<SeasonPointsRules>;
  standingsTieBreakers?: SeasonTieBreaker[];
  matchRules?: Partial<SeasonMatchRules>;
}

export interface RegisterSeasonTeamsDto { teamIds: string[]; }
export interface SeasonQueryDto { year?: number; status?: SeasonStatus; }
export interface SeasonLifecycleDto { status: "draft" | "upcoming" | "active"; }

export interface SeasonResponseDto {
  _id: string;
  seasonNumber: number;
  name: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  timeZone: "Asia/Kolkata";
  groupStageEnabled: boolean;
  homeAndAwayFixtures: boolean;
  status: SeasonStatus;
  historyCompleteness: import("./season.types.js").SeasonHistoryCompleteness;
  auctionSettings: SeasonAuctionSettings | null;
  auctionLifecycleStatus: AuctionLifecycleStatus;
  pointsRules: SeasonPointsRules | null;
  standingsTieBreakers: SeasonTieBreaker[] | null;
  matchRules: SeasonMatchRules | null;
  createdAt: string;
  updatedAt: string;
}

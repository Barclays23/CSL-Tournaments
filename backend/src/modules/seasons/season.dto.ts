import type { SeasonAuctionSettings, SeasonMatchRules, SeasonPointsRules, SeasonStatus, SeasonTieBreaker } from "./season.types.js";

export interface CreateSeasonDto {
  seasonNumber: number;
  name: string;
  year: number;
  startDate?: Date | null;
  endDate?: Date | null;
  timeZone?: "Asia/Kolkata";
  status?: SeasonStatus;
  auctionSettings: SeasonAuctionSettings;
  pointsRules?: SeasonPointsRules;
  standingsTieBreakers?: SeasonTieBreaker[];
  matchRules?: SeasonMatchRules;
  teamIds: string[];
}
export type UpdateSeasonDto = Partial<Omit<CreateSeasonDto, "teamIds">>;
export interface RegisterSeasonTeamsDto { teamIds: string[]; }
export interface SeasonQueryDto { year?: number; status?: SeasonStatus; }
export interface SeasonResponseDto extends Omit<import("./season.types.js").SeasonEntity, "_id" | "startDate" | "endDate" | "createdAt" | "updatedAt"> {
  _id: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

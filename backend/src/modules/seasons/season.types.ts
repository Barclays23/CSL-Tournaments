import type { Types } from "mongoose";

export type SeasonStatus = "draft" | "upcoming" | "active" | "completed" | "archived";
export type SeasonHistoryCompleteness = "not_applicable" | "metadata_only" | "partial" | "full";
export type SeasonPlayerPosition = "goalkeeper" | "defender" | "midfielder" | "forward";
export type SeasonTieBreaker = "points" | "goalDifference" | "goalsScored" | "teamNameAsc";

export interface SeasonAuctionSettings {
  currency: "INR";
  budgetPerTeam: number;
  playersCount: number;
  seasonTeamCount: number;
  teamSquadSize: number;
  iconPlayerLimit: number;
  goalkeeperLimit: number;
}

export interface SeasonPointsRules { win: number; draw: number; loss: number; }
export interface SeasonMatchRules {
  groupStageDrawAllowed: boolean;
  knockoutDrawRequiresShootout: boolean;
  shootoutCountsForMatchScore: false;
  shootoutCountsForPlayerGoals: false;
}

export interface SeasonFields {
  seasonNumber: number;
  name: string;
  normalizedName: string;
  year: number;
  startDate: Date | null;
  endDate: Date | null;
  timeZone: "Asia/Kolkata";
  groupStageEnabled: boolean;
  homeAndAwayFixtures: boolean;
  status: SeasonStatus;
  historyCompleteness: SeasonHistoryCompleteness;
  auctionSettings: SeasonAuctionSettings | null;
  auctionClosedAt?: Date | null;
  pointsRules: SeasonPointsRules | null;
  standingsTieBreakers: SeasonTieBreaker[] | null;
  matchRules: SeasonMatchRules | null;
  auctionRevision: number;
}

export interface SeasonEntity extends SeasonFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonListFilter {
  year?: number;
  status?: SeasonStatus;
}

export type { ISeasonRepository, ISeasonService, ISeasonController } from "./season.interfaces.js";
export type { CreateSeasonDto, UpdateSeasonDto, SeasonQueryDto, SeasonResponseDto, SeasonLifecycleDto } from "./season.dto.js";

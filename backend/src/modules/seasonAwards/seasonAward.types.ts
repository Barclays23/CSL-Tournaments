import type { Types } from "mongoose";
import type { Asset } from "../../shared/types/common.types.js";

export const SEASON_AWARD_CATEGORIES = [
  { awardType: "champions", label: "Champions", recipientType: "season_team", mandatory: true, allowMultiple: false },
  { awardType: "runner_up", label: "Runner-up", recipientType: "season_team", mandatory: true, allowMultiple: false },
  { awardType: "golden_boot", label: "Golden Boot / Top Scorer", recipientType: "player", mandatory: false, allowMultiple: true },
  { awardType: "golden_glove", label: "Golden Glove / Best Goalkeeper", recipientType: "player", mandatory: false, allowMultiple: true },
  { awardType: "player_of_the_season", label: "Player of the Season / Best Player", recipientType: "player", mandatory: false, allowMultiple: true },
  { awardType: "best_young_player", label: "Best Young Player", recipientType: "player", mandatory: false, allowMultiple: true },
  { awardType: "best_defender", label: "Best Defender", recipientType: "player", mandatory: false, allowMultiple: true },
  { awardType: "best_midfielder", label: "Best Midfielder", recipientType: "player", mandatory: false, allowMultiple: true },
  { awardType: "special", label: "Special Award", recipientType: "mixed", mandatory: false, allowMultiple: true },
] as const;

export type SeasonAwardType = typeof SEASON_AWARD_CATEGORIES[number]["awardType"];
export type SeasonAwardRecipientType = "season_team" | "player";

export interface SeasonAwardRecipientFields {
  recipientType: SeasonAwardRecipientType;
  seasonTeamRef: Types.ObjectId;
  playerRef: Types.ObjectId | null;
  displayNameSnapshot: string;
  profileImageSnapshot: Asset | null;
  teamNameSnapshot: string;
  teamLogoSnapshot: Asset | null;
}

export interface SeasonAwardFields {
  seasonRef: Types.ObjectId;
  awardType: SeasonAwardType;
  title: string;
  description: string | null;
  recipients: SeasonAwardRecipientFields[];
}

export interface SeasonAwardEntity extends SeasonAwardFields {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonAwardRecipientInput {
  seasonTeamId: string;
  playerId?: string | null;
}

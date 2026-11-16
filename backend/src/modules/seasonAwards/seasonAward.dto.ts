import type { SeasonAwardRecipientInput, SeasonAwardType, SeasonAwardRecipientType } from "./seasonAward.types.js";
import type { Asset, ControllerMethod } from "../../shared/types/common.types.js";

export interface CreateSeasonAwardDto {
  awardType: SeasonAwardType;
  title?: string;
  description?: string | null;
  recipients: SeasonAwardRecipientInput[];
}

export interface UpdateSeasonAwardDto {
  awardType?: SeasonAwardType;
  title?: string;
  description?: string | null;
  recipients?: SeasonAwardRecipientInput[];
}

export interface SeasonAwardRecipientResponseDto {
  _id: string;
  recipientType: SeasonAwardRecipientType;
  seasonTeamRef: string;
  playerRef: string | null;
  displayNameSnapshot: string;
  profileImageSnapshot: Asset | null;
  teamNameSnapshot: string;
  teamLogoSnapshot: Asset | null;
}

export interface SeasonAwardResponseDto {
  _id: string;
  seasonRef: string;
  awardType: SeasonAwardType;
  title: string;
  description: string | null;
  recipients: SeasonAwardRecipientResponseDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ISeasonAwardService {
  list(seasonId: string): Promise<SeasonAwardResponseDto[]>;
  create(seasonId: string, input: CreateSeasonAwardDto): Promise<SeasonAwardResponseDto>;
  update(seasonId: string, awardId: string, input: UpdateSeasonAwardDto): Promise<SeasonAwardResponseDto>;
  delete(seasonId: string, awardId: string): Promise<void>;
}

export interface ISeasonAwardController {
  list: ControllerMethod;
  create: ControllerMethod;
  update: ControllerMethod;
  delete: ControllerMethod;
}

import type { PaginatedResult } from "../../shared/types/common.types.js";
import type { CreateSeasonMatchDto, UpdateSeasonMatchDto, SeasonMatchQueryDto, SeasonGoalDto, SeasonMatchResponseDto } from "./seasonMatch.dto.js";
export interface ISeasonMatchService {
  list(seasonId: string, query: SeasonMatchQueryDto): Promise<PaginatedResult<SeasonMatchResponseDto>>;
  get(id: string): Promise<SeasonMatchResponseDto>;
  create(seasonId: string, input: CreateSeasonMatchDto): Promise<SeasonMatchResponseDto>;
  update(id: string, input: UpdateSeasonMatchDto, changedBy?: string): Promise<SeasonMatchResponseDto>;
  delete(id: string): Promise<void>;
  addGoal(id: string, input: SeasonGoalDto): Promise<SeasonMatchResponseDto>;
  updateGoal(id: string, goalId: string, input: SeasonGoalDto): Promise<SeasonMatchResponseDto>;
  deleteGoal(id: string, goalId: string): Promise<SeasonMatchResponseDto>;
}

import type { PaginatedResult } from "../../shared/types/common.types.js";
import type { CreateSeasonMatchDto, UpdateSeasonMatchDto, SeasonMatchQueryDto, SeasonGoalDto, SeasonMatchCardDto, SeasonMatchResponseDto, RescheduleSeasonMatchDto, CorrectCompletedMatchDto, UpdateMatchDecidingRulesDto, MatchStatusActionDto, CorrectActualKickoffDto, CorrectMatchClockDto, UpdateMatchShootoutDto, CorrectMatchPhaseDto } from "./seasonMatch.dto.js";
export interface ISeasonMatchService {
  list(seasonId: string, query: SeasonMatchQueryDto): Promise<PaginatedResult<SeasonMatchResponseDto>>;
  get(id: string): Promise<SeasonMatchResponseDto>;
  create(seasonId: string, input: CreateSeasonMatchDto): Promise<SeasonMatchResponseDto>;
  update(id: string, input: UpdateSeasonMatchDto, changedBy?: string): Promise<SeasonMatchResponseDto>;
  startMatch(id: string, actor?: string): Promise<SeasonMatchResponseDto>;
  pauseClock(id: string, actor?: string): Promise<SeasonMatchResponseDto>;
  resumeClock(id: string, actor?: string): Promise<SeasonMatchResponseDto>;
  transitionPhase(id: string, action: import("./seasonMatch.engine.js").MatchPhaseAction, actor?: string): Promise<SeasonMatchResponseDto>;
  completeMatch(id: string, actor?: string): Promise<SeasonMatchResponseDto>;
  updateDecidingRules(id: string, input: UpdateMatchDecidingRulesDto, actor?: string): Promise<SeasonMatchResponseDto>;
  changeStatus(id: string, input: MatchStatusActionDto, actor?: string): Promise<SeasonMatchResponseDto>;
  correctActualKickoff(id: string, input: CorrectActualKickoffDto, actor?: string): Promise<SeasonMatchResponseDto>;
  correctClock(id: string, input: CorrectMatchClockDto, actor?: string): Promise<SeasonMatchResponseDto>;
  correctPhase(id: string, input: CorrectMatchPhaseDto, actor?: string): Promise<SeasonMatchResponseDto>;
  updateShootout(id: string, input: UpdateMatchShootoutDto, actor?: string): Promise<SeasonMatchResponseDto>;
  reschedule(id: string, input: RescheduleSeasonMatchDto, changedBy?: string): Promise<SeasonMatchResponseDto>;
  correctCompletedMatch(id: string, input: CorrectCompletedMatchDto, correctedBy?: string): Promise<SeasonMatchResponseDto>;
  delete(id: string): Promise<void>;
  addGoal(id: string, input: SeasonGoalDto, actor?: string): Promise<SeasonMatchResponseDto>;
  updateGoal(id: string, goalId: string, input: SeasonGoalDto, actor?: string): Promise<SeasonMatchResponseDto>;
  deleteGoal(id: string, goalId: string, actor?: string, reason?: string): Promise<SeasonMatchResponseDto>;
  addCard(id: string, input: SeasonMatchCardDto, actor?: string): Promise<SeasonMatchResponseDto>;
  updateCard(id: string, cardId: string, input: SeasonMatchCardDto, actor?: string): Promise<SeasonMatchResponseDto>;
  deleteCard(id: string, cardId: string, actor?: string, reason?: string): Promise<SeasonMatchResponseDto>;
}

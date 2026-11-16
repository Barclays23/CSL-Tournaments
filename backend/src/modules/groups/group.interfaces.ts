import type { GroupEntity, GroupFields } from "./group.types.js";
import type { SeasonStatus } from "../seasons/season.types.js";

export interface GroupSeasonState { status: SeasonStatus; groupStageEnabled: boolean; }

export interface IGroupRepository {
  findBySeason(seasonId: string): Promise<GroupEntity[]>;
  getSeasonState(seasonId: string): Promise<GroupSeasonState | null>;
  countSeasonTeams(seasonId: string): Promise<number>;
  countFixtures(seasonId: string): Promise<number>;
  findByName(seasonId: string, name: string): Promise<GroupEntity | null>;
  findInSeason(seasonId: string, groupId: string): Promise<GroupEntity | null>;
  countAssignments(seasonId: string, groupId: string): Promise<number>;
  create(data: GroupFields): Promise<GroupEntity>;
  updateInSeason(seasonId: string, groupId: string, data: Partial<Pick<GroupFields, "groupName" | "displayOrder">>): Promise<GroupEntity | null>;
  deleteInSeason(seasonId: string, groupId: string): Promise<boolean>;
}

export interface IGroupService {
  list(seasonId: string): Promise<import("./group.dto.js").GroupResponseDto[]>;
  create(seasonId: string, input: import("./group.dto.js").CreateGroupDto): Promise<import("./group.dto.js").GroupResponseDto>;
  update(seasonId: string, groupId: string, input: import("./group.dto.js").UpdateGroupDto): Promise<import("./group.dto.js").GroupResponseDto>;
  delete(seasonId: string, groupId: string): Promise<void>;
}

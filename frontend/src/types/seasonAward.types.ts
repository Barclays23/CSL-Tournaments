import type { Asset } from "@/types/api.types";
export type SeasonAwardType = "champions" | "runner_up" | "golden_boot" | "golden_glove" | "player_of_the_season" | "best_young_player" | "best_defender" | "best_midfielder" | "special";
export interface SeasonAwardRecipient { _id:string; recipientType:"season_team"|"player"; seasonTeamRef:string; playerRef:string|null; displayNameSnapshot:string; profileImageSnapshot:Asset|null; teamNameSnapshot:string; teamLogoSnapshot:Asset|null; }
export interface SeasonAward { _id:string; seasonRef:string; awardType:SeasonAwardType; title:string; description:string|null; recipients:SeasonAwardRecipient[]; createdAt:string; updatedAt:string; }
export interface SeasonAwardInput { awardType:SeasonAwardType; title?:string; description?:string|null; recipients:Array<{seasonTeamId:string;playerId?:string|null}>; }

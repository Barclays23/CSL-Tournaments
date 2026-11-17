import type { Asset } from "@/types/api.types";

export type TeamStatus = "active" | "inactive";

export interface TeamBrief {
  _id: string;
  name: string;
  shortName: string | null;
  logo: Asset | null;
}

export interface Team {
  _id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  logo: Asset | null;
  poster: Asset | null;
  status: TeamStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TeamWrite {
  name: string;
  shortName?: string | null;
  description?: string | null;
  logo?: Asset | null;
  poster?: Asset | null;
  status: TeamStatus;
}


export interface TeamSquadStats {
  auctionBudget: number;
  purchaseCost: number;
  remainingBalance: number;
  playerCount: number;
  remainingSlots: number;
  averagePurchaseCost: number;
  iconPlayerCount: number;
  goalkeeperCount: number;
  maxPlayers: number;
  requiredIcons: number;
  requiredGoalkeepers: number;
}

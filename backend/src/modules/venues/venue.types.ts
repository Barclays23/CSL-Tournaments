import type { Types } from "mongoose";
export type VenueStatus = "active" | "inactive";
export interface VenueFields { name: string; normalizedName: string; location: string | null; notes: string | null; status: VenueStatus; }
export interface VenueEntity extends VenueFields { _id: Types.ObjectId; createdAt: Date; updatedAt: Date; }
export interface VenueDto { _id: string; name: string; location: string | null; notes: string | null; status: VenueStatus; createdAt: string; updatedAt: string; }
export interface VenueCreateDto { name: string; location?: string | null; notes?: string | null; }
export interface VenueUpdateDto { name?: string; location?: string | null; notes?: string | null; status?: VenueStatus; }
export type VenueWriteDto = VenueCreateDto;

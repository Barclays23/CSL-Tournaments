import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import type { PaginatedResult } from "../../shared/types/common.types.js";
import { normalizeEmail, normalizeMobile } from "../../shared/utils/normalizeInput.js";
import type { IPlayerService, IPlayerRepository } from "./player.interfaces.js";
import type { PlayerAdminDTO, PlayerCreateDTO, PlayerEntity, PlayerFields, PlayerListFilter, PlayerQueryDTO, PlayerResponseDTO, PlayerUpdateDTO } from "./player.types.js";

export class PlayerService implements IPlayerService {
  constructor(private readonly _playerRepository: IPlayerRepository) {}

  async getPlayers(query: PlayerQueryDTO, isAdmin: boolean): Promise<PaginatedResult<PlayerResponseDTO>> {
    const filter: PlayerListFilter = {};
    if (query.search) filter.name = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    if (isAdmin && query.status) filter.status = query.status;
    else if (!isAdmin) filter.status = "active";
    const result = await this._playerRepository.findPlayers(filter, query.page, query.limit);
    return {
      items: result.items.map((player) => this.mapPlayer(player, isAdmin)),
      pagination: { page: query.page, limit: query.limit, total: result.total, totalPages: Math.ceil(result.total / query.limit) },
    };
  }

  async getPlayerById(playerId: string, isAdmin: boolean): Promise<PlayerResponseDTO> {
    this.ensureValidPlayerId(playerId);
    const player = await this._playerRepository.findPlayerById(playerId);
    if (!player) throw new AppError("Player not found", 404, "PLAYER_NOT_FOUND");
    return this.mapPlayer(player, isAdmin);
  }

  async createPlayer(input: PlayerCreateDTO): Promise<PlayerAdminDTO> {
    const fields: PlayerFields = {
      name: input.name.trim(),
      mobile: normalizeMobile(input.mobile ?? "") || null,
      email: normalizeEmail(input.email),
      dateOfBirth: input.dateOfBirth ?? null,
      profilePic: input.profilePic ?? null,
      status: input.status ?? "active",
      notes: input.notes?.trim() || null,
    };
    await this.ensureContactsUnique(fields.mobile, fields.email);
    try {
      const created = await this._playerRepository.createPlayer(fields);
      return this.mapPlayer(created, true) as PlayerAdminDTO;
    } catch (error: unknown) {
      this.handleDuplicateContactError(error);
    }
  }

  async updatePlayer(playerId: string, input: PlayerUpdateDTO): Promise<PlayerAdminDTO> {
    this.ensureValidPlayerId(playerId);
    const current = await this._playerRepository.findPlayerById(playerId);
    if (!current) throw new AppError("Player not found", 404, "PLAYER_NOT_FOUND");
    const updates: Partial<PlayerFields> = {};
    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.mobile !== undefined) updates.mobile = normalizeMobile(input.mobile ?? "") || null;
    if (input.email !== undefined) updates.email = normalizeEmail(input.email);
    if (input.dateOfBirth !== undefined) updates.dateOfBirth = input.dateOfBirth;
    if (input.profilePic !== undefined) updates.profilePic = input.profilePic;
    if (input.status !== undefined) updates.status = input.status;
    if (input.notes !== undefined) updates.notes = input.notes?.trim() || null;
    await this.ensureContactsUnique(updates.mobile === undefined ? null : updates.mobile, updates.email === undefined ? null : updates.email, playerId);
    try {
      const updated = await this._playerRepository.updatePlayer(playerId, updates);
      if (!updated) throw new AppError("Player not found", 404, "PLAYER_NOT_FOUND");
      return this.mapPlayer(updated, true) as PlayerAdminDTO;
    } catch (error: unknown) {
      this.handleDuplicateContactError(error);
    }
  }

  async deactivatePlayer(playerId: string): Promise<PlayerAdminDTO> {
    return this.updatePlayer(playerId, { status: "inactive" });
  }

  async deletePlayer(playerId: string): Promise<void> {
    this.ensureValidPlayerId(playerId);
    const player = await this._playerRepository.findPlayerById(playerId);
    if (!player) throw new AppError("Player not found", 404, "PLAYER_NOT_FOUND");
    const references = await this._playerRepository.countPlayerReferences(playerId);
    const total = Object.values(references).reduce((sum, count) => sum + count, 0);
    if (total > 0) {
      throw new AppError(
        `Player is protected by historical records (AuctionLots: ${references.auctionLots}, season matches: ${references.seasonMatches}, legacy matches: ${references.legacyMatches}, awards: ${references.awards}). Deactivate the player instead.`,
        409, "PLAYER_REFERENCED",
      );
    }
    if (!await this._playerRepository.deletePlayerIfUnreferenced(playerId)) {
      throw new AppError("Player could not be deleted because it is missing or has acquired dependent records. Deactivate instead.", 409, "PLAYER_REFERENCED");
    }
  }

  private handleDuplicateContactError(error: unknown): never {
    if ((error as { code?: number }).code === 11000) {
      const key = Object.keys((error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {})[0];
      const field = key === "mobile" ? "mobile" : "email";
      throw new AppError(`A player with this ${field} already exists`, 409, `DUPLICATE_PLAYER_${field.toUpperCase()}`, {
        [field]: `This ${field} is already registered`,
      });
    }
    throw error;
  }

  private async ensureContactsUnique(mobile: string | null, email: string | null, excludeId?: string): Promise<void> {
    if (mobile) {
      const existing = await this._playerRepository.findPlayerByMobile(mobile);
      if (existing && String(existing._id) !== excludeId) throw new AppError("Mobile already exists", 409, "DUPLICATE_MOBILE", { mobile: "Mobile already exists" });
    }
    if (email) {
      const existing = await this._playerRepository.findPlayerByEmail(email);
      if (existing && String(existing._id) !== excludeId) throw new AppError("Email already exists", 409, "DUPLICATE_EMAIL", { email: "Email already exists" });
    }
  }

  private mapPlayer(player: PlayerEntity, isAdmin: boolean): PlayerResponseDTO {
    const common = { _id: String(player._id), name: player.name, profilePic: player.profilePic, status: player.status };
    if (!isAdmin) return common;
    return {
      ...common, mobile: player.mobile, email: player.email,
      dateOfBirth: player.dateOfBirth?.toISOString() ?? null, notes: player.notes,
      createdAt: player.createdAt.toISOString(), updatedAt: player.updatedAt.toISOString(),
    };
  }

  private ensureValidPlayerId(playerId: string): void {
    if (!Types.ObjectId.isValid(playerId)) throw new AppError("Invalid player ID", 400, "INVALID_ID");
  }
}

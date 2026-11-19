import { Types } from "mongoose";
import { AppError } from "../../shared/errors/appError.js";
import { VenueRepository } from "./venue.repository.js";
import type { VenueDto, VenueEntity, VenueWriteDto, VenueUpdateDto } from "./venue.types.js";
export class VenueService {
  constructor(private readonly repo: VenueRepository) {}
  async list(status: "active" | "inactive" | "all" = "active"): Promise<VenueDto[]> { return (await this.repo.list(status)).map(v => this.map(v)); }
  async get(id: string): Promise<VenueDto> {
    this.ensureId(id);
    const venue = await this.repo.findById(id);
    if (!venue) throw new AppError("Venue not found", 404, "VENUE_NOT_FOUND");
    return this.map(venue);
  }
  async create(input: VenueWriteDto): Promise<VenueDto> {
    const normalizedName = this.normalize(input.name);
    if (await this.repo.findByNormalizedName(normalizedName)) throw new AppError("A venue with this name already exists", 409, "DUPLICATE_VENUE", { name: "Choose a unique venue name" });
    try { return this.map(await this.repo.create({ name: input.name.trim(), normalizedName, location: input.location?.trim() || null, notes: input.notes?.trim() || null })); }
    catch (error) { if ((error as { code?: number }).code === 11000) throw new AppError("A venue with this name already exists", 409, "DUPLICATE_VENUE", { name: "Choose a unique venue name" }); throw error; }
  }
  async update(id: string, input: VenueUpdateDto): Promise<VenueDto> {
    this.ensureId(id);
    const current = await this.repo.findById(id); if (!current) throw new AppError("Venue not found", 404, "VENUE_NOT_FOUND");
    const name = input.name?.trim() ?? current.name, normalizedName = this.normalize(name);
    if (input.name !== undefined && await this.repo.findByNormalizedName(normalizedName, id)) throw new AppError("A venue with this name already exists", 409, "DUPLICATE_VENUE", { name: "Choose a unique venue name" });
    const saved = await this.repo.update(id, { name, normalizedName, location: input.location === undefined ? current.location : input.location?.trim() || null, notes: input.notes === undefined ? current.notes : input.notes?.trim() || null, status: input.status ?? current.status });
    if (!saved) throw new AppError("Venue not found", 404, "VENUE_NOT_FOUND");
    return this.map(saved);
  }
  async delete(id: string): Promise<void> {
    this.ensureId(id);
    const current = await this.repo.findById(id); if (!current) throw new AppError("Venue not found", 404, "VENUE_NOT_FOUND");
    if (await this.repo.countFixtureReferences(id)) throw new AppError("This venue is used by existing fixtures. Mark it inactive instead of deleting it.", 409, "VENUE_IN_USE");
    await this.repo.delete(id);
  }
  private normalize(value: string) { return value.trim().normalize("NFKC").replace(/\s+/g, " ").toLocaleLowerCase("en"); }
  private ensureId(id: string) { if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid venue ID", 400, "INVALID_ID"); }
  private map(v: VenueEntity): VenueDto { return { _id: String(v._id), name: v.name, location: v.location, notes: v.notes, status: v.status, createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString() }; }
}

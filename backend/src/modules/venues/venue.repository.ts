import { Types } from "mongoose";
import { VenueModel } from "./venue.model.js";
import { SeasonMatchModel } from "../matches/seasonMatch.model.js";
import type { VenueEntity, VenueStatus } from "./venue.types.js";
export class VenueRepository {
  list(status: VenueStatus | "all" = "active") { return VenueModel.find(status === "all" ? {} : { status }).sort({ name: 1 }).lean<VenueEntity[]>().exec(); }
  findById(id: string) { return VenueModel.findById(id).lean<VenueEntity>().exec(); }
  findByNormalizedName(name: string, excludeId?: string) { return VenueModel.findOne({ normalizedName: name, ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}) }).lean<VenueEntity>().exec(); }
  create(data: Pick<VenueEntity, "name" | "normalizedName" | "location" | "notes">) { return VenueModel.create({ ...data, status: "active" }).then(doc => doc.toObject() as unknown as VenueEntity); }
  update(id: string, data: Partial<Pick<VenueEntity, "name" | "normalizedName" | "location" | "notes" | "status">>) {
    return VenueModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true }).lean<VenueEntity>().exec();
  }
  countFixtureReferences(id: string) { return SeasonMatchModel.countDocuments({ venueRef: new Types.ObjectId(id) }).exec(); }
  async delete(id: string) { const result = await VenueModel.deleteOne({ _id: new Types.ObjectId(id) }).exec(); return result.deletedCount === 1; }
}

import { OrganizerModel } from "./organizer.model.js";
import type { QueryFilter } from "mongoose";
import type { IOrganizerRepository, OrganizerEntityInput } from "./organizer.interfaces.js";
import type { OrganizerEntity, OrganizerListFilter, OrganizerFields } from "./organizer.types.js";

export class OrganizerRepository implements IOrganizerRepository {
  async findOrganizers(filter: OrganizerListFilter, page: number, limit: number): Promise<{ items: OrganizerEntity[]; total: number }> {
    const mongoFilter = filter as QueryFilter<OrganizerFields>;
    const [items, total] = await Promise.all([
      OrganizerModel.find(mongoFilter).sort({ displayOrder: 1, name: 1, _id: 1 })
        .skip((page - 1) * limit).limit(limit).lean<OrganizerEntity[]>().exec(),
      OrganizerModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }
  findOrganizerById(id: string): Promise<OrganizerEntity | null> {
    return OrganizerModel.findById(id).lean<OrganizerEntity>().exec();
  }
  async createOrganizer(data: OrganizerEntityInput): Promise<OrganizerEntity> {
    const created = await OrganizerModel.create(data);
    const saved = await this.findOrganizerById(String(created._id));
    if (!saved) throw new Error("Created organizer could not be retrieved");
    return saved;
  }
  updateOrganizer(id: string, data: Partial<OrganizerEntityInput>): Promise<OrganizerEntity | null> {
    return OrganizerModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true })
      .lean<OrganizerEntity>().exec();
  }
  async deleteOrganizer(id: string): Promise<boolean> {
    const deleted = await OrganizerModel.findByIdAndDelete(id).select("_id").lean().exec();
    return deleted !== null;
  }
}

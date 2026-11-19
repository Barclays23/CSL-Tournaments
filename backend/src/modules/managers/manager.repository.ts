import type { QueryFilter } from "mongoose";
import { ManagerModel } from "./manager.model.js";
import type { ManagerRecord } from "./manager.model.js";
import type { IManagerRepository } from "./manager.interfaces.js";
import type { ManagerEntity, ManagerFields, ManagerListFilter } from "./manager.types.js";

export class ManagerRepository implements IManagerRepository {
  async findManagers(
    filter: ManagerListFilter,
    page: number,
    limit: number,
  ): Promise<{ items: ManagerEntity[]; total: number }> {
    const mongoFilter: QueryFilter<ManagerRecord> = filter;
    const [items, total] = await Promise.all([
      ManagerModel.find(mongoFilter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<ManagerEntity[]>()
        .exec(),
      ManagerModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }

  async findManagerById(managerId: string): Promise<ManagerEntity | null> {
    return ManagerModel.findById(managerId).lean<ManagerEntity>().exec();
  }

  async findManagerByMobile(mobile: string): Promise<ManagerEntity | null> {
    return ManagerModel.findOne({ mobile }).lean<ManagerEntity>().exec();
  }

  async findManagerByEmail(email: string): Promise<ManagerEntity | null> {
    return ManagerModel.findOne({ email }).lean<ManagerEntity>().exec();
  }

  async createManager(data: ManagerFields): Promise<ManagerEntity> {
    const created = await ManagerModel.create(data);
    const saved = await this.findManagerById(String(created._id));
    if (!saved) throw new Error("Created manager could not be retrieved");
    return saved;
  }

  async updateManager(managerId: string, data: Partial<ManagerFields>): Promise<ManagerEntity | null> {
    return ManagerModel.findByIdAndUpdate(managerId, { $set: data }, {
      returnDocument: "after",
      runValidators: true,
    }).lean<ManagerEntity>().exec();
  }

  async deleteManager(managerId: string): Promise<boolean> {
    const deleted = await ManagerModel.findByIdAndDelete(managerId).select("_id").lean().exec();
    return deleted !== null;
  }
}

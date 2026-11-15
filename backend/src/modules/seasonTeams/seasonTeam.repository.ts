import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import { SeasonTeamModel } from "./seasonTeam.model.js";
import type { SeasonTeamEntity, SeasonTeamFields, SeasonTeamListFilter } from "./seasonTeam.types.js";

export class SeasonTeamRepository {
  async findBySeason(seasonId: string, session?: ClientSession): Promise<SeasonTeamEntity[]> {
    return SeasonTeamModel.find({ seasonRef: new Types.ObjectId(seasonId) }).sort({ displayName: 1 })
      .session(session ?? null).lean<SeasonTeamEntity[]>().exec();
  }
  async findById(id: string, session?: ClientSession): Promise<SeasonTeamEntity | null> {
    return SeasonTeamModel.findById(id).session(session ?? null).lean<SeasonTeamEntity>().exec();
  }
  async countBySeason(seasonId: string, session?: ClientSession): Promise<number> {
    return SeasonTeamModel.countDocuments({ seasonRef: new Types.ObjectId(seasonId) }).session(session ?? null).exec();
  }
  async createMany(records: SeasonTeamFields[], session?: ClientSession): Promise<SeasonTeamEntity[]> {
    if (!records.length) return [];
    const created = await SeasonTeamModel.insertMany(records, { session, ordered: true });
    return created.map((item) => item.toObject() as SeasonTeamEntity);
  }
  async updateStatus(id: string, status: SeasonTeamFields["status"]): Promise<SeasonTeamEntity | null> {
    return SeasonTeamModel.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: "after", runValidators: true }).lean<SeasonTeamEntity>().exec();
  }
}

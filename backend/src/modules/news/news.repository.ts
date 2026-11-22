import type { QueryFilter } from "mongoose";
import { Types } from "mongoose";
import { NewsModel } from "./news.model.js";
import type { INewsRepository, NewsEntityInput } from "./news.interfaces.js";
import type { NewsEntity, NewsFields, NewsFilter } from "./news.types.js";

export class NewsRepository implements INewsRepository {
  async find(filter: NewsFilter, page: number, limit: number): Promise<{ items: NewsEntity[]; total: number }> {
    const mongoFilter = filter as QueryFilter<NewsFields>;
    const [items, total] = await Promise.all([
      NewsModel.find(mongoFilter).sort({ publishedAt: -1, createdAt: -1, _id: -1 })
        .skip((page - 1) * limit).limit(limit).lean<NewsEntity[]>().exec(),
      NewsModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<NewsEntity | null> {
    return NewsModel.findById(id).lean<NewsEntity>().exec();
  }

  findBySlug(slug: string): Promise<NewsEntity | null> {
    return NewsModel.findOne({ slug }).lean<NewsEntity>().exec();
  }

  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    const filter: QueryFilter<NewsFields> = { slug };
    if (excludeId && Types.ObjectId.isValid(excludeId)) filter._id = { $ne: new Types.ObjectId(excludeId) };
    return Boolean(await NewsModel.exists(filter));
  }

  async create(data: NewsEntityInput): Promise<NewsEntity> {
    const created = await NewsModel.create(data);
    const saved = await this.findById(String(created._id));
    if (!saved) throw new Error("Created news article could not be retrieved");
    return saved;
  }

  update(id: string, data: Partial<NewsEntityInput>): Promise<NewsEntity | null> {
    return NewsModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after", runValidators: true })
      .lean<NewsEntity>().exec();
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await NewsModel.findByIdAndDelete(id).select("_id").lean().exec();
    return deleted !== null;
  }
}

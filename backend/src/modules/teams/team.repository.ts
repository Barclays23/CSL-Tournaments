import { Types, type QueryFilter } from "mongoose";
import { TeamModel } from "./team.model.js";
import type { TeamRecord } from "./team.model.js";
import { ManagerModel } from "../managers/manager.model.js";
import { MatchModel } from "../matches/match.model.js";
import { SeasonTeamModel } from "../seasonTeams/seasonTeam.model.js";
import { SeasonAwardModel } from "../seasonAwards/seasonAward.model.js";
import { PlayerModel } from "../players/player.model.js";
import type { ITeamRepository } from "./team.interfaces.js";
import type { TeamCreateDTO, TeamEntity, TeamFields, TeamListFilter, TeamReferenceCounts, TeamUpdateDTO } from "./team.types.js";

export class TeamRepository implements ITeamRepository {
  async findTeams(
    filter: TeamListFilter,
    page: number,
    limit: number,
  ): Promise<{ items: TeamEntity[]; total: number }> {
    const mongoFilter: QueryFilter<TeamRecord> = filter;
    const [items, total] = await Promise.all([
      TeamModel.find(mongoFilter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<TeamEntity[]>()
        .exec(),
      TeamModel.countDocuments(mongoFilter).exec(),
    ]);
    return { items, total };
  }

  async findTeamById(teamId: string): Promise<TeamEntity | null> {
    return TeamModel.findById(teamId).lean<TeamEntity>().exec();
  }

  async findTeamByName(name: string): Promise<TeamEntity | null> {
    return TeamModel.findOne({ name: { $regex: "^" + this.escapeRegex(name) + "$", $options: "i" } })
      .lean<TeamEntity>()
      .exec();
  }

  async countActiveTeams(): Promise<number> {
    return TeamModel.countDocuments({ status: "active" }).exec();
  }

  async findTeamReferenceCounts(teamId: string): Promise<TeamReferenceCounts> {
    const objectId = new Types.ObjectId(teamId);
    const [players, managers, matches, seasonTeams] = await Promise.all([
      PlayerModel.collection.countDocuments({ teamRef: objectId }),
      ManagerModel.countDocuments({ teamRef: objectId }).exec(),
      MatchModel.countDocuments({ $or: [{ team1Ref: objectId }, { team2Ref: objectId }] }).exec(),
      SeasonTeamModel.countDocuments({ teamRef: objectId }).exec(),
    ]);
    return { players, managers, matches, seasonTeams };
  }

  async createTeam(data: TeamCreateDTO): Promise<TeamEntity> {
    const fields: TeamFields = {
      name: data.name.trim(),
      shortName: data.shortName?.trim() || null,
      description: data.description?.trim() || null,
      logo: data.logo ?? null,
      poster: data.poster ?? null,
      status: data.status,
    };
    const createdTeam = await TeamModel.create(fields);
    const savedTeam = await this.findTeamById(String(createdTeam._id));
    if (!savedTeam) throw new Error("Created team could not be retrieved");
    return savedTeam;
  }

  async updateTeam(teamId: string, data: TeamUpdateDTO): Promise<TeamEntity | null> {
    const updateFields: Partial<TeamFields> = {};
    if (data.name !== undefined) updateFields.name = data.name.trim();
    if (data.shortName !== undefined) updateFields.shortName = data.shortName?.trim() || null;
    if (data.description !== undefined) updateFields.description = data.description?.trim() || null;
    if (data.logo !== undefined) updateFields.logo = data.logo;
    if (data.poster !== undefined) updateFields.poster = data.poster;
    if (data.status !== undefined) updateFields.status = data.status;
    const updatedTeam = await TeamModel.findByIdAndUpdate(teamId, { $set: updateFields }, {
      returnDocument: "after",
      runValidators: true,
    }).lean<TeamEntity>().exec();
    if (!updatedTeam) return null;

    if (data.name !== undefined || data.logo !== undefined) {
      const teamObjectId = new Types.ObjectId(teamId);
      const seasonTeams = await SeasonTeamModel.find({ teamRef: teamObjectId })
        .select("_id").lean<Array<{ _id: Types.ObjectId }>>().exec();
      const seasonTeamIds = seasonTeams.map((seasonTeam) => seasonTeam._id);
      const snapshotUpdates: Record<string, unknown> = {};
      if (data.name !== undefined) snapshotUpdates.displayName = updatedTeam.name;
      if (data.logo !== undefined) snapshotUpdates.logoSnapshot = updatedTeam.logo;

      await SeasonTeamModel.updateMany({ teamRef: teamObjectId }, { $set: snapshotUpdates }).exec();

      if (seasonTeamIds.length) {
        const awardSnapshotUpdates: Record<string, unknown> = {};
        if (data.name !== undefined) awardSnapshotUpdates["recipients.$[recipient].teamNameSnapshot"] = updatedTeam.name;
        if (data.logo !== undefined) awardSnapshotUpdates["recipients.$[recipient].teamLogoSnapshot"] = updatedTeam.logo;
        await SeasonAwardModel.updateMany(
          { "recipients.seasonTeamRef": { $in: seasonTeamIds } },
          { $set: awardSnapshotUpdates },
          { arrayFilters: [{ "recipient.seasonTeamRef": { $in: seasonTeamIds } }] },
        ).exec();
      }
    }
    return updatedTeam;
  }

  async deleteTeam(teamId: string): Promise<boolean> {
    const deletedTeam = await TeamModel.findByIdAndDelete(teamId).select("_id").lean().exec();
    return deletedTeam !== null;
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

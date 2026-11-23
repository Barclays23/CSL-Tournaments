import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { TopScorerCard } from "@/components/standings/TopScorerCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getSeasons } from "@/services/seasonService";
import { getSeasonStandings, getSeasonTopScorers } from "@/services/seasonStatisticsService";
import type { GroupStanding, TopScorer } from "@/types/statistics.types";
import { getDefaultSeason } from "@/utils/defaultSeason";

export function StandingsPage() {
  const [tab, setTab] = useState("groups");
  const [seasonId, setSeasonId] = useState("");
  const seasons = useServiceQuery(() => getSeasons(), []);

  useEffect(() => {
    if (!seasonId && seasons.data?.data.length) {
      const preferred = getDefaultSeason(seasons.data.data);
      if (preferred) setSeasonId(preferred._id);
    }
  }, [seasonId, seasons.data]);

  const standings = useServiceQuery(
    () => seasonId
      ? getSeasonStandings(seasonId)
      : Promise.resolve({
          success: true,
          message: "Waiting for a season",
          data: { season: undefined as never, groups: [] },
        }),
    [seasonId],

  );
  const scorers = useServiceQuery(
    () => seasonId
      ? getSeasonTopScorers(seasonId)
      : Promise.resolve({
          success: true,
          message: "Waiting for a season",
          data: { season: undefined as never, items: [] },
        }),
    [seasonId],

  );

  const groups: GroupStanding[] = (standings.data?.data.groups ?? []).map((group) => ({
    groupName: group.groupName,
    rows: group.rows.map((row) => ({
      position: row.position,
      team: {
        _id: row.team.teamId,
        name: row.team.displayName,
        shortName: row.team.shortName,
        logo: row.team.logo,
        groupName: row.team.groupName,
      },
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsScored,
      goalsAgainst: row.goalsConceded,
      goalDifference: row.goalDifference,
      points: row.points,
      qualified: row.qualified,
    })),
  }));

  const topScorers: TopScorer[] = (scorers.data?.data.items ?? []).map((scorer) => ({
    rank: scorer.rank,
    player: scorer.player,
    team: scorer.team
      ? {
          _id: scorer.team.teamId,
          name: scorer.team.displayName,
          shortName: scorer.team.shortName,
          logo: scorer.team.logo,
          groupName: scorer.team.groupName,
        }
      : null,
    goals: scorer.goals,
  }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Table"
        title="Standings"
        description="View group standings and top scorers for each tournament season."
      />
      <div className="my-4 max-w-sm">
        <Select
          aria-label="Season"
          value={seasonId}
          onChange={(event) => setSeasonId(event.target.value)}
          disabled={seasons.loading || !seasons.data?.data.length}
        >
          {!seasons.data?.data.length ? <option value="">No seasons available</option> : null}
          {seasons.data?.data.map((season) => (
            <option key={season._id} value={season._id}>
              Season {season.seasonNumber} · {season.year}
            </option>
          ))}
        </Select>
      </div>
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "groups", label: "Groups" },
          { value: "scorers", label: "Top scorers" },
        ]}
      />
      <div className="mt-5">
        {tab === "groups" ? (
          standings.loading ? <Skeleton className="h-64" /> : standings.error ? <ErrorState message={standings.error} onRetry={standings.reload} /> : groups.length ? (
            <div className="grid gap-4">
              {groups.map((group) => (
                <GlassCard key={group.groupName} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-display text-3xl text-fg">{group.groupName}</h2>
                    <p className="text-xs text-muted">Highlighted sides are in the top two</p>
                  </div>
                  <StandingsTable group={group} />
                </GlassCard>
              ))}
            </div>
          ) : <p className="py-8 text-center text-sm text-muted">No standings are available for this season yet.</p>
        ) : scorers.loading ? <Skeleton className="h-64" /> : scorers.error ? <ErrorState message={scorers.error} onRetry={scorers.reload} /> : (
          <div className="grid gap-3">
            {topScorers.map((scorer) => <TopScorerCard key={scorer.player._id} scorer={scorer} />)}
            {!topScorers.length ? <p className="py-8 text-center text-sm text-muted">No goals have been recorded for this season yet.</p> : null}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

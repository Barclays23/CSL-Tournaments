import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { Select } from "@/components/ui/Select";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getTeamById } from "@/services/teamService";
import { getSeasons } from "@/services/seasonService";
import { getSeasonStandings, getSeasonTeamDashboard } from "@/services/seasonStatisticsService";
import { getSeasonAwards } from "@/services/seasonAwardService";
import { formatCurrency } from "@/utils/formatCurrency";
import type { ApiResponse } from "@/types/api.types";
import type { SeasonStandings, SeasonTeamDashboard } from "@/types/seasonStatistics.types";
import type { SeasonAward } from "@/types/seasonAward.types";
import { getDefaultSeason } from "@/utils/defaultSeason";

const EMPTY_DASHBOARD: ApiResponse<SeasonTeamDashboard> = {
  success: true,
  message: "",
  data: null as unknown as SeasonTeamDashboard,
};
const EMPTY_STANDINGS: ApiResponse<SeasonStandings> = {
  success: true,
  message: "",
  data: { season: null as never, groups: [] },
};
const POSITION_LABEL: Record<string, string> = {
  goalkeeper: "Goalkeeper",
  defender: "Defender",
  midfielder: "Midfielder",
  forward: "Forward",
};

function GroupStandingsCard({
  group,
  teamId,
}: {
  group: SeasonStandings["groups"][number];
  teamId: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-2xl text-fg">{group.groupName}</h4>
        <Badge>{group.rows.length} teams</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((column) => (
                <th key={column} className="px-2 py-2 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row) => {
              const isCurrentTeam = row.team.teamId === teamId;
              return (
                <tr key={row.team._id} className={isCurrentTeam ? "bg-primary/10" : undefined}>
                  <td className="px-2 py-3 tabular text-muted">{row.position}</td>
                  <td className="px-2 py-3">
                    <Link
                      to={adminMode ? "/admin/teams/$teamId" : "/teams/$teamId"}
                      params={{ teamId: row.team.teamId }}
                      className="flex items-center gap-2 font-semibold text-fg"
                    >
                      <Avatar name={row.team.displayName} asset={row.team.logo} className="h-7 w-7 rounded-lg" />
                      <span>{row.team.displayName}</span>
                      {isCurrentTeam ? <Badge tone="primary">This team</Badge> : null}
                    </Link>
                  </td>
                  {[
                    row.played,
                    row.won,
                    row.drawn,
                    row.lost,
                    row.goalsScored,
                    row.goalsConceded,
                    row.goalDifference,
                  ].map((value, index) => (
                    <td key={index} className="px-2 py-3 tabular text-fg">{value}</td>
                  ))}
                  <td className="px-2 py-3 font-display text-xl tabular text-fg">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Points and positions are calculated from completed group-stage matches only.</p>
    </GlassCard>
  );
}

export function TeamDetailsPage({ teamId, adminMode = false }: { teamId: string; adminMode?: boolean }) {
  const team = useServiceQuery(() => getTeamById(teamId), [teamId]);
  const seasons = useServiceQuery(() => getSeasons(), []);
  const [seasonId, setSeasonId] = useState("");

  useEffect(() => {
    if (!seasonId && seasons.data?.data.length) {
      const preferred = getDefaultSeason(seasons.data.data);
      if (preferred) setSeasonId(preferred._id);
    }
  }, [seasonId, seasons.data]);

  const dashboard = useServiceQuery(
    () => seasonId ? getSeasonTeamDashboard(teamId, seasonId) : Promise.resolve(EMPTY_DASHBOARD),
    [teamId, seasonId],
  );
  const standings = useServiceQuery(
    () => seasonId ? getSeasonStandings(seasonId) : Promise.resolve(EMPTY_STANDINGS),
    [seasonId],
  );
  const awardsQuery = useServiceQuery(
    () => seasonId
      ? getSeasonAwards(seasonId)
      : Promise.resolve({ success: true, message: "", data: [] } as { success: boolean; message: string; data: SeasonAward[] }),
    [seasonId],
  );

  const record = team.data?.data;
  const data = dashboard.data?.data;
  const teamAwards = (Array.isArray(awardsQuery.data?.data) ? awardsQuery.data.data : [])
    .filter((award) => award && Array.isArray(award.recipients) &&
      award.recipients.some((recipient) => recipient.seasonTeamRef === data?.seasonTeam?._id));

  if (team.loading) return <PageContainer><Skeleton className="h-64" /></PageContainer>;
  if (team.error || !record) {
    return <PageContainer><ErrorState message={team.error || "Team not found"} onRetry={team.reload} /></PageContainer>;
  }

  return (
    <PageContainer>
      <AdminPageBanner
        breadcrumb={adminMode ? "Admin / Teams" : "Teams"}
        title={record.name}
        description="View season-specific team activity, squad information and competition history."
      />
      {adminMode ? <Link to="/admin/teams" className="text-sm font-semibold text-accent">Back to teams</Link> : null}
      <GlassCard className="mt-4 overflow-hidden">
        {record.poster ? <img src={record.poster.url} alt="" className="h-48 w-full object-cover" /> : null}
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          {record.logo ? <img src={record.logo.url} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : null}
          <div>
            <h1 className="font-display text-5xl text-fg">{record.name}</h1>
            <div className="mt-2 flex gap-2">
              {record.shortName ? <Badge>{record.shortName}</Badge> : null}
              <Badge tone="accent">Permanent team</Badge>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-fg">Season performance</h2>
          <p className="text-sm text-muted">
            These performance totals include all completed group-stage and knockout matches in the selected season.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label className="mb-1 block text-sm text-fg">Season</label>
          <Select value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
            <option value="">Select season</option>
            {seasons.data?.data.map((season) => (
              <option key={season._id} value={season._id}>{season.name} · {season.year}</option>
            ))}
          </Select>
        </div>
      </div>

      {dashboard.loading ? <Skeleton className="mt-4 h-48" /> : null}
      {dashboard.error ? <ErrorState message={dashboard.error} onRetry={dashboard.reload} /> : null}
      {data && !data.participates ? (
        <GlassCard className="mt-4 p-5 text-sm text-muted">
          This permanent team did not participate in the selected season.
        </GlassCard>
      ) : null}

      {data?.participates ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Played" value={data.stats.played} />
            <StatCard label="Won" value={data.stats.won} />
            <StatCard label="Drawn" value={data.stats.drawn} />
            <StatCard label="Lost" value={data.stats.lost} />
            <StatCard label="Goals scored" value={data.stats.goalsScored} />
            <StatCard label="Goals conceded" value={data.stats.goalsConceded} />
            <StatCard label="Goal difference" value={data.stats.goalDifference} />
            <StatCard label="Clean sheets" value={data.stats.cleanSheets} />
          </div>

          <section className="mt-7">
            <div className="mb-3">
              <h3 className="font-display text-2xl text-fg">Group-stage standings</h3>
              <p className="text-sm text-muted">
                Group points are kept separate from the overall season performance totals above.
              </p>
            </div>
            {standings.loading ? <Skeleton className="h-48" /> : null}
            {standings.error ? <ErrorState message={standings.error} onRetry={standings.reload} /> : null}
            {!standings.loading && !standings.error && standings.data?.data.groups.length ? (
              <div className="grid gap-4">
                {standings.data.data.groups.map((group) => (
                  <GroupStandingsCard key={group.groupRef ?? group.groupName} group={group} teamId={teamId} />
                ))}
              </div>
            ) : null}
            {!standings.loading && !standings.error && !standings.data?.data.groups.length ? (
              <GlassCard className="p-4 text-sm text-muted">No group standings are available for this season yet.</GlassCard>
            ) : null}
          </section>

          <section className="mt-6">
            <GlassCard className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">Club honours</p>
                  <h3 className="font-display text-2xl text-fg">Season achievements & awards</h3>
                  <p className="text-sm text-muted">Team achievements and individual awards earned while representing this team.</p>
                </div>
                <Badge>{teamAwards.length} award(s)</Badge>
              </div>
              {awardsQuery.loading ? <Skeleton className="mt-4 h-20" /> : null}
              {awardsQuery.error ? <div className="mt-4"><ErrorState message={awardsQuery.error} onRetry={awardsQuery.reload} /></div> : null}
              {!awardsQuery.loading && !awardsQuery.error && teamAwards.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {teamAwards.map((award) => (
                    <div key={award._id} className="rounded-xl border border-line p-3">
                      <p className="font-semibold text-fg">{award.title}</p>
                      <p className="text-xs text-muted">{award.awardType.replaceAll("_", " ")}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {award.recipients.filter((recipient) => recipient.seasonTeamRef === data.seasonTeam?._id).map((recipient) => (
                          <div key={recipient._id} className="flex items-center gap-2 rounded-lg bg-surface p-2">
                            <img
                              src={recipient.profileImageSnapshot?.url ?? recipient.teamLogoSnapshot?.url ?? "https://placehold.co/64x64?text=CSL"}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                            <div>
                              <p className="text-sm font-medium text-fg">{recipient.displayNameSnapshot}</p>
                              <p className="text-xs text-muted">{recipient.teamNameSnapshot}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {!awardsQuery.loading && !awardsQuery.error && !teamAwards.length ? (
                <p className="mt-4 rounded-xl bg-surface p-4 text-sm text-muted">No season achievements have been recorded for this team yet.</p>
              ) : null}
            </GlassCard>
          </section>

          <section className="mt-7 grid gap-4 lg:grid-cols-2">
            <GlassCard className="p-5">
              <h3 className="font-display text-2xl text-fg">Season squad</h3>
              <p className="mb-3 text-sm text-muted">{data.squad.filter((player) => player.auctionStatus === "sold").length} current player(s) · {data.squad.filter((player) => player.auctionStatus === "withdrawn").length} withdrawn player(s) in history</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.squad.map((player) => (
                  <div key={player.player._id} className="rounded-xl bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={adminMode ? "/admin/players/$playerId" : "/players/$playerId"}
                        params={{ playerId: player.player._id }}
                        className="font-semibold text-fg hover:text-accent"
                      >
                        {player.player.name}{player.jerseyNo ? " · #" + player.jerseyNo : ""}
                      </Link>
                      <Badge>{player.auctionStatus === "withdrawn" ? "Withdrawn" : "Sold"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {POSITION_LABEL[player.position]}{player.isIconPlayer ? " · Icon" : ""}{player.isGoalkeeper ? " · Goalkeeper" : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {player.purchasePrice === null ? "No price" : formatCurrency(player.purchasePrice)}
                    </p>
                  </div>
                ))}
              </div>
              {!data.squad.length ? <p className="text-sm text-muted">No players purchased yet.</p> : null}
            </GlassCard>
            <GlassCard className="p-5">
              <h3 className="font-display text-2xl text-fg">Managers</h3>
              {data.managers.length ? (
                <div className="mt-3 space-y-2">
                  {data.managers.map((manager) => (
                    <div key={manager._id} className="rounded-xl bg-surface p-3">
                      <p className="font-semibold text-fg">{manager.name}</p>
                      <p className="text-xs text-muted">{manager.role ?? "Manager"}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-muted">No managers assigned to this season team.</p>}
              {data.stats.topScorer ? (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="text-xs text-muted">Team top scorer</p>
                  <p className="mt-1 font-semibold text-fg">{data.stats.topScorer.player.name}</p>
                  <p className="text-sm text-muted">{data.stats.topScorer.goals} normal-time goals</p>
                </div>
              ) : null}
            </GlassCard>
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="mb-3 font-display text-2xl text-fg">Recent results</h3>
              <div className="space-y-2">
                {data.recentFixtures.map((fixture) => (
                  <div key={fixture._id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Match {fixture.matchNumber} · {fixture.stage.replaceAll("_", " ")}</span>
                      <span>{new Date(fixture.kickoffAt).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span className="text-fg">{fixture.home.displayName}</span>
                      <strong className="text-fg">{fixture.homeScore} - {fixture.awayScore}</strong>
                      <span className="text-right text-fg">{fixture.away.displayName}</span>
                    </div>
                  </div>
                ))}
              </div>
              {!data.recentFixtures.length ? <p className="text-sm text-muted">No completed fixtures.</p> : null}
            </div>
            <div>
              <h3 className="mb-3 font-display text-2xl text-fg">Upcoming fixtures</h3>
              <div className="space-y-2">
                {data.upcomingFixtures.map((fixture) => (
                  <div key={fixture._id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Match {fixture.matchNumber} · {fixture.stage.replaceAll("_", " ")}</span>
                      <span>{new Date(fixture.kickoffAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span className="text-fg">{fixture.home.displayName}</span>
                      <span className="text-muted">vs</span>
                      <span className="text-right text-fg">{fixture.away.displayName}</span>
                    </div>
                  </div>
                ))}
              </div>
              {!data.upcomingFixtures.length ? <p className="text-sm text-muted">No upcoming fixtures.</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </PageContainer>
  );
}

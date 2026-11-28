import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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

type Fixture = SeasonTeamDashboard["recentFixtures"][number];

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
/* ------------------------------------------------------------------ */

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-7 w-1.5 shrink-0 rounded-full bg-linear-to-b from-accent to-primary" />
        <div>
          <h3 className="font-display text-2xl text-fg">{title}</h3>
          {description ? <p className="mt-0.5 max-w-prose text-sm text-muted">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-glass p-5 text-center text-sm text-muted backdrop-blur-md">
      {children}
    </div>
  );
}

function FixtureCard({ fixture, completed }: { fixture: Fixture; completed: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-glass p-4 shadow-glass backdrop-blur-xl transition-colors hover:bg-glass-strong">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <Badge>Match {fixture.matchNumber} · {fixture.stage.replaceAll("_", " ")}</Badge>
        <span className="tabular">
          {completed
            ? new Date(fixture.kickoffAt).toLocaleDateString()
            : new Date(fixture.kickoffAt).toLocaleString()}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span className="truncate text-sm font-semibold text-fg">{fixture.home.displayName}</span>
        {completed ? (
          <span className="rounded-xl bg-surface px-3 py-1 font-display text-xl tabular text-fg">
            {fixture.homeScore} - {fixture.awayScore}
          </span>
        ) : (
          <span className="rounded-xl bg-surface px-3 py-1 text-xs font-semibold text-muted">VS</span>
        )}
        <span className="truncate text-right text-sm font-semibold text-fg">{fixture.away.displayName}</span>
      </div>
    </div>
  );
}

function GroupStandingsCard({
  group,
  teamId,
  adminMode,
}: {
  group: SeasonStandings["groups"][number];
  teamId: string;
  adminMode: boolean;
}) {
  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-2xl text-fg">{group.groupName}</h4>
        <Badge>{group.rows.length} teams</Badge>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface/40">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
            <tr>
              {["#", "Team", "P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((column) => (
                <th key={column} className="px-3 py-2.5 font-semibold">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {group.rows.map((row) => {
              const isCurrentTeam = row.team.teamId === teamId;
              return (
                <tr
                  key={row.team._id}
                  className={isCurrentTeam ? "bg-primary/15" : "transition-colors hover:bg-glass"}
                >
                  <td className="px-3 py-3 tabular text-muted">{row.position}</td>
                  <td className="px-3 py-3">
                    <Link
                      to={adminMode ? "/admin/teams/$teamId" : "/teams/$teamId"}
                      params={{ teamId: row.team.teamId }}
                      className="flex items-center gap-2 font-semibold text-fg hover:text-accent"
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
                    <td key={index} className="px-3 py-3 tabular text-fg">{value}</td>
                  ))}
                  <td className="px-3 py-3 font-display text-xl tabular text-accent">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Points and positions are calculated from completed group-stage matches only.
      </p>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

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

  const soldCount = data?.squad?.filter((player) => player.auctionStatus === "sold").length ?? 0;
  const withdrawnCount = data?.squad?.filter((player) => player.auctionStatus === "withdrawn").length ?? 0;

  return (
    <PageContainer>
      <AdminPageBanner
        breadcrumb={adminMode ? "Admin / Teams" : "Teams"}
        title={record.name}
        description="View season-specific team activity, squad information and competition history."
      />
      {adminMode ? (
        <Link to="/admin/teams" className="mt-3 inline-block text-sm font-semibold text-accent hover:underline">
          Back to teams
        </Link>
      ) : null}

      {/* ---------------------------- Hero ---------------------------- */}
      <GlassCard className="relative mt-4 overflow-hidden p-0">
        <div className="relative h-44 w-full sm:h-56">
          {record.poster ? (
            <img src={record.poster.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="pitch-stripes h-full w-full" />
          )}
          <div className="pitch-lines absolute inset-0" />
          <div className="absolute inset-0 bg-linear-to-t from-bg via-bg/50 to-transparent" />
        </div>

        <div className="relative -mt-14 flex flex-col gap-4 px-5 pb-6 sm:flex-row sm:items-end sm:px-7">
          <div className="rounded-3xl border border-line bg-glass-strong p-1.5 shadow-glass backdrop-blur-xl">
            {record.logo ? (
              <img src={record.logo.url} alt="" className="h-24 w-24 rounded-2xl object-cover sm:h-28 sm:w-28" />
            ) : (
              <Avatar name={record.name} className="h-24 w-24 rounded-2xl sm:h-28 sm:w-28" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-4xl text-fg sm:text-5xl">{record.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {record.shortName ? <Badge>{record.shortName}</Badge> : null}
              <Badge tone="accent">Permanent team</Badge>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ------------------------ Season picker ------------------------ */}
      <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-line bg-glass p-4 shadow-glass backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div>
          <h2 className="font-display text-2xl text-fg">Season performance</h2>
          <p className="mt-0.5 max-w-prose text-sm text-muted">
            These performance totals include all completed group-stage and knockout matches in the selected season.
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label htmlFor="team-season" className="mb-1 block text-sm font-semibold text-fg">Season</label>
          <Select id="team-season" value={seasonId} onChange={(event) => setSeasonId(event.target.value)}>
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
        <div className="mt-4">
          <EmptyNote>This permanent team did not participate in the selected season.</EmptyNote>
        </div>
      ) : null}

      {data?.participates ? (
        <>
          {/* ------------------------- Stats ------------------------- */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Played" value={data.stats.played} />
            <StatCard label="Won" value={data.stats.won} />
            <StatCard label="Drawn" value={data.stats.drawn} />
            <StatCard label="Lost" value={data.stats.lost} />
            <StatCard label="Goals scored" value={data.stats.goalsScored} />
            <StatCard label="Goals conceded" value={data.stats.goalsConceded} />
            <StatCard label="Goal difference" value={data.stats.goalDifference} />
            <StatCard label="Clean sheets" value={data.stats.cleanSheets} />
          </div>

          {/* ----------------------- Standings ----------------------- */}
          <section className="mt-10">
            <SectionHeader
              title="Group-stage standings"
              description="Group points are kept separate from the overall season performance totals above."
            />
            {standings.loading ? <Skeleton className="h-48" /> : null}
            {standings.error ? <ErrorState message={standings.error} onRetry={standings.reload} /> : null}
            {!standings.loading && !standings.error && standings.data?.data.groups.length ? (
              <div className="grid gap-4">
                {standings.data.data.groups.map((group) => (
                  <GroupStandingsCard
                    key={group.groupRef ?? group.groupName}
                    group={group}
                    teamId={teamId}
                    adminMode={adminMode}
                  />
                ))}
              </div>
            ) : null}
            {!standings.loading && !standings.error && !standings.data?.data.groups.length ? (
              <EmptyNote>No group standings are available for this season yet.</EmptyNote>
            ) : null}
          </section>

          {/* ------------------------ Honours ------------------------ */}
          <section className="mt-10">
            <GlassCard className="relative overflow-hidden p-5 sm:p-6">
              <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative">
                <SectionHeader
                  title="Season achievements & awards"
                  description="Team achievements and individual awards earned while representing this team."
                  action={<Badge tone="accent">{teamAwards.length} award(s)</Badge>}
                />
                {awardsQuery.loading ? <Skeleton className="h-20" /> : null}
                {awardsQuery.error ? <ErrorState message={awardsQuery.error} onRetry={awardsQuery.reload} /> : null}
                {!awardsQuery.loading && !awardsQuery.error && teamAwards.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {teamAwards.map((award) => (
                      <div
                        key={award._id}
                        className="rounded-2xl border border-line bg-glass p-4 backdrop-blur-md transition-colors hover:bg-glass-strong"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold text-lg text-gold-fg">
                            ★
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-fg">{award.title}</p>
                            <p className="text-xs capitalize text-muted">{award.awardType.replaceAll("_", " ")}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {award.recipients
                            .filter((recipient) => recipient.seasonTeamRef === data.seasonTeam?._id)
                            .map((recipient) => (
                              <div key={recipient._id} className="flex items-center gap-2 rounded-xl bg-surface p-2 pr-3">
                                <img
                                  src={recipient.profileImageSnapshot?.url ?? recipient.teamLogoSnapshot?.url ?? "https://placehold.co/64x64?text=CSL"}
                                  alt=""
                                  className="h-9 w-9 rounded-full object-cover ring-2 ring-line"
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
                  <EmptyNote>No season achievements have been recorded for this team yet.</EmptyNote>
                ) : null}
              </div>
            </GlassCard>
          </section>

          {/* ---------------------- Squad & staff ---------------------- */}
          <section className="mt-10 grid gap-5 lg:grid-cols-3">
            <GlassCard className="p-5 sm:p-6 lg:col-span-2">
              <SectionHeader
                title="Season Team Squad"
                description={`${soldCount} current player(s) · ${withdrawnCount} withdrawn player(s) in history`}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {data.squad.map((player) => {
                  const withdrawn = player.auctionStatus === "withdrawn";
                  return (
                    <Link
                      key={player.player._id}
                      to={adminMode ? "/admin/players/$playerId" : "/players/$playerId"}
                      params={{ playerId: player.player._id }}
                      className={
                        "group flex items-center gap-3 rounded-2xl border border-line bg-glass p-3 backdrop-blur-md " +
                        "transition hover:-translate-y-0.5 hover:border-accent hover:bg-glass-strong hover:shadow-glass " +
                        (withdrawn ? "opacity-70" : "")
                      }
                    >
                      <Avatar
                        name={player.player.name}
                        asset={player.player.profilePic}
                        className="h-14 w-14 shrink-0 rounded-2xl ring-2 ring-line transition group-hover:ring-accent"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate font-semibold text-fg transition-colors group-hover:text-accent">
                            {player.player.name}
                          </p>
                          {player.jerseyNo ? (
                            <span className="shrink-0 font-display text-lg tabular text-muted">#{player.jerseyNo}</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {POSITION_LABEL[player.position]}
                          {player.isIconPlayer ? " · Icon" : ""}
                          {player.isGoalkeeper ? " · Goalkeeper" : ""}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-fg tabular">
                            {player.purchasePrice === null ? "No price" : formatCurrency(player.purchasePrice)}
                          </span>
                          <Badge tone={withdrawn ? undefined : "primary"}>{withdrawn ? "Withdrawn" : "Sold"}</Badge>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              {!data.squad.length ? <EmptyNote>No players purchased yet.</EmptyNote> : null}
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <SectionHeader title="Managers" />
              {data.managers.length ? (
                <div className="space-y-2">
                  {data.managers.map((manager) => (
                    <div key={manager._id} className="flex items-center gap-3 rounded-2xl border border-line bg-glass p-3 backdrop-blur-md">
                      <Avatar name={manager.name} asset={manager.profilePic} className="h-10 w-10 rounded-xl" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-fg">{manager.name}</p>
                        <p className="text-xs text-muted">{manager.role ?? "Manager"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyNote>No managers assigned to this season team.</EmptyNote>
              )}

              {data.stats.topScorer ? (
                <div className="mt-6 rounded-2xl bg-linear-to-br from-primary/25 to-accent/10 p-4 ring-1 ring-line">
                  <p className="text-xs font-semibold text-muted">Team top scorer</p>
                  <p className="mt-1 font-display text-xl text-fg">{data.stats.topScorer.player.name}</p>
                  <p className="mt-1 text-sm text-muted">
                    <span className="font-display text-2xl tabular text-accent">{data.stats.topScorer.goals}</span>{" "}
                    normal-time goals
                  </p>
                </div>
              ) : null}
            </GlassCard>
          </section>

          {/* ------------------------ Fixtures ------------------------ */}
          <section className="mt-10 grid gap-5 lg:grid-cols-2">
            <div>
              <SectionHeader title="Recent results" />
              <div className="space-y-3">
                {data.recentFixtures.map((fixture) => (
                  <FixtureCard key={fixture._id} fixture={fixture} completed />
                ))}
              </div>
              {!data.recentFixtures.length ? <EmptyNote>No completed fixtures.</EmptyNote> : null}
            </div>
            <div>
              <SectionHeader title="Upcoming fixtures" />
              <div className="space-y-3">
                {data.upcomingFixtures.map((fixture) => (
                  <FixtureCard key={fixture._id} fixture={fixture} completed={false} />
                ))}
              </div>
              {!data.upcomingFixtures.length ? <EmptyNote>No upcoming fixtures.</EmptyNote> : null}
            </div>
          </section>
        </>
      ) : null}
    </PageContainer>
  );
}
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarRange, Shield, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AboutSection } from "@/components/home/AboutSection";
import { FixtureCard } from "@/components/matches/FixtureCard";
import { SponsorCard } from "@/components/sponsors/SponsorCard";
import { TopScorerCard } from "@/components/standings/TopScorerCard";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getSponsors } from "@/services/sponsorService";
import { getDashboardSummary } from "@/services/statisticsService";
import { getSeasons } from "@/services/seasonService";
import { getSeasonTopScorers } from "@/services/seasonStatisticsService";
import { getSeasonAwards } from "@/services/seasonAwardService";
import type { TopScorer } from "@/types/statistics.types";
import { formatDateRange } from "@/utils/formatDate";

export function HomePage() {
  const { isAdmin } = useAuth();
  const dashboard = useServiceQuery(() => getDashboardSummary(), []);
  const seasons = useServiceQuery(() => getSeasons(), []);
  const activeSeason = seasons.data?.data.find((season) => season.status === "active") ?? seasons.data?.data[0];
  const activeSeasonId = activeSeason?._id ?? "";
  const scorers = useServiceQuery(
    () => activeSeasonId
      ? getSeasonTopScorers(activeSeasonId)
      : Promise.resolve({
          success: true,
          message: "No season available",
          data: { season: undefined as never, items: [] },
        }),
    [activeSeasonId],
  );
  const historicalSeasons = seasons.data?.data.filter((season) => ["completed","archived"].includes(season.status)).sort((a,b)=>b.seasonNumber-a.seasonNumber) ?? [];
  const [historicalSeasonId, setHistoricalSeasonId] = useState("");
  const historicalSeason = historicalSeasons.find((season) => season._id === historicalSeasonId) ?? historicalSeasons[0];
  const historicalAwards = useServiceQuery(() => historicalSeason ? getSeasonAwards(historicalSeason._id) : Promise.resolve({success:true,message:"No completed season",data:[]} as Awaited<ReturnType<typeof getSeasonAwards>>), [historicalSeason?._id]);
  const sponsors = useServiceQuery(() => getSponsors({ limit: 8 }), []);
  const data = dashboard.data?.data;
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
    <div>
      <PageContainer className="pb-4">
        <section className="relative overflow-hidden rounded-card border border-line">
          <div className="pitch-stripes absolute inset-0" />
          <div className="pitch-lines absolute inset-0" />
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/25" />
          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Village football</p>
              <h1 className="mt-3 max-w-xl font-display text-5xl leading-none text-fg sm:text-7xl">
                {data?.tournamentName ?? "CSL Football Tournament"}
              </h1>
              <p className="mt-4 max-w-lg text-sm text-fg/90">
                Six teams, one ground, and a running record of the auction, the goals and the table.
              </p>
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-gold">
                <CalendarRange className="h-4 w-4" />
                {data ? formatDateRange(data.startDate, data.endDate) : "Dates loading"}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to="/teams">
                  <Button variant="accent">View teams</Button>
                </Link>
                <Link to="/matches">
                  <Button variant="surface">Fixtures</Button>
                </Link>
              </div>
            </div>
            <GlassCard className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next kick-off</p>
              <div className="mt-3">
                {dashboard.loading ? <Skeleton className="h-28" /> : null}
                {data?.upcomingFixtures[0] ? <FixtureCard match={data.upcomingFixtures[0]} /> : null}
                {data && !data.upcomingFixtures[0] ? <p className="text-sm text-muted">No upcoming fixtures.</p> : null}
              </div>
            </GlassCard>
          </div>
        </section>
      </PageContainer>

      <PageContainer>
        {isAdmin ? (
          <GlassCard className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-fg">You are managing this tournament.</p>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
              <Link to="/admin/seasons">
                <Button size="sm" variant="surface">
                  Manage seasons
                </Button>
              </Link>
            </div>
          </GlassCard>
        ) : null}

        {dashboard.error ? <ErrorState message={dashboard.error} onRetry={dashboard.reload} /> : null}
        {dashboard.loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : null}
        {data ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Swords} label="Matches played" value={data.totalMatchesPlayed} />
            <StatCard icon={Sparkles} label="Goals" value={data.totalGoals} hint="Normal goals and own goals" />
            <StatCard icon={Shield} label="Active teams" value={data.activeTeams} />
            <StatCard icon={Users} label="Active players" value={data.activePlayers} />
            <StatCard icon={Trophy} label="Top scorer" value={data.topScorer?.player.name ?? "—"} hint={data.topScorer ? `${data.topScorer.goals} goals` : "No goals yet"} />
            <StatCard label="Most scoring" value={data.mostScoringTeam?.team.shortName ?? data.mostScoringTeam?.team.name ?? "—"} hint={data.mostScoringTeam ? `${data.mostScoringTeam.goals} goals` : undefined} />
            <StatCard label="Most conceded" value={data.mostConcedingTeam?.team.shortName ?? "—"} hint={data.mostConcedingTeam ? `${data.mostConcedingTeam.goals} against` : undefined} />
            <StatCard label="Clean sheets" value={data.mostCleanSheets[0]?.team.shortName ?? "—"} hint={data.mostCleanSheets[0] ? `${data.mostCleanSheets[0].cleanSheets} shutouts` : "None yet"} />
          </div>
        ) : null}

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 font-display text-3xl text-fg">Upcoming</h2>
            <div className="grid gap-3">
              {data?.upcomingFixtures.length ? data.upcomingFixtures.map((match) => <FixtureCard key={match._id} match={match} />) : <p className="text-sm text-muted">Nothing scheduled.</p>}
            </div>
          </section>
          <section>
            <h2 className="mb-4 font-display text-3xl text-fg">Recent results</h2>
            <div className="grid gap-3">
              {data?.recentResults.length ? data.recentResults.map((match) => <FixtureCard key={match._id} match={match} />) : <p className="text-sm text-muted">No completed matches yet.</p>}
            </div>
          </section>
        </div>

        <section className="mt-10">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-display text-3xl text-fg">Top scorers</h2>
            <Link to="/standings" className="text-sm font-semibold text-accent">
              Full table
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topScorers.slice(0, 5).map((scorer) => <TopScorerCard key={scorer.player._id} scorer={scorer} />)}
            {!scorers.loading && !topScorers.length ? <p className="text-sm text-muted">No goals recorded for the current season yet.</p> : null}
          </div>
        </section>


        {historicalSeason ? <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Season history</p><h2 className="font-display text-3xl text-fg">{historicalSeason.name} · Achievements</h2></div><select aria-label="Historical season" className="rounded-lg border border-line bg-surface p-2 text-sm text-fg" value={historicalSeasonId || historicalSeason._id} onChange={(event)=>setHistoricalSeasonId(event.target.value)}>{historicalSeasons.map((season)=><option key={season._id} value={season._id}>{season.name} · {season.year}</option>)}</select></div>
          {historicalAwards.loading ? <Skeleton className="h-24" /> : null}
          {historicalAwards.error ? <ErrorState message={historicalAwards.error} onRetry={historicalAwards.reload} /> : null}
          {historicalAwards.data?.data.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {historicalAwards.data.data.map((award) => <GlassCard key={award._id} className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">{award.title}</p>
              <div className="mt-3 space-y-3">{award.recipients.map((recipient) => <div key={recipient._id} className="flex items-center gap-3">
                <img src={recipient.profileImageSnapshot?.url ?? recipient.teamLogoSnapshot?.url ?? "https://placehold.co/96x96?text=CSL"} alt="" className="h-11 w-11 rounded-full object-cover" />
                <div><p className="text-sm font-semibold text-fg">{recipient.displayNameSnapshot}</p><p className="text-xs text-muted">{recipient.teamNameSnapshot}</p></div>
              </div>)}</div>
            </GlassCard>)}
          </div> : !historicalAwards.loading ? <p className="text-sm text-muted">No achievements recorded for this completed season yet.</p> : null}
        </section> : null}

        <section className="mt-10">
          <h2 className="mb-4 font-display text-3xl text-fg">Sponsors</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sponsors.data?.data.filter((sponsor) => sponsor.status === "active").map((sponsor) => (
              <SponsorCard key={sponsor._id} sponsor={sponsor} />
            ))}
          </div>
        </section>
      </PageContainer>

      <AboutSection />
    </div>
  );
}

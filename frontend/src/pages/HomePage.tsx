import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarRange, Shield, Sparkles, Swords, Users } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { AboutSection } from "@/components/home/AboutSection";
import { SeasonFixtureCard } from "@/components/matches/SeasonFixtureCard";
import { NewsArticleCard } from "@/components/news/NewsArticleCard";
import { StandingsTable } from "@/components/standings/StandingsTable";
import { TopScorerCard } from "@/components/standings/TopScorerCard";
import { Avatar } from "@/components/ui/Avatar";
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
import { getSeasonTopScorers, getSeasonStandings } from "@/services/seasonStatisticsService";
import { getSeasonMatches } from "@/services/seasonMatchService";
import { getSeasonAwards } from "@/services/seasonAwardService";
import { getOrganizers } from "@/services/organizerService";
import { getNews } from "@/services/newsService";
import type { TopScorer, GroupStanding } from "@/types/statistics.types";
import type { SeasonMatch } from "@/types/seasonMatch.types";
import { formatDateRange } from "@/utils/formatDate";

function mapStandings(groups: NonNullable<Awaited<ReturnType<typeof getSeasonStandings>>["data"]["groups"]>): GroupStanding[] {
  return groups.map((group) => ({
    groupName: group.groupName,
    rows: group.rows.map((row) => ({
      position: row.position,
      team: { _id: row.team.teamId, name: row.team.displayName, shortName: row.team.shortName, logo: row.team.logo, groupName: row.team.groupName },
      played: row.played, won: row.won, drawn: row.drawn, lost: row.lost,
      goalsFor: row.goalsScored, goalsAgainst: row.goalsConceded, goalDifference: row.goalDifference,
      points: row.points, qualified: row.qualified,
    })),
  }));
}

export function HomePage() {
  const { isAdmin } = useAuth();
  const dashboard = useServiceQuery(() => getDashboardSummary(), []);
  const seasons = useServiceQuery(() => getSeasons(), []);
  const activeSeason = seasons.data?.data.find((season) => season.status === "active") ?? seasons.data?.data[0];
  const seasonId = activeSeason?._id ?? "";

  const matches = useServiceQuery(
    () => seasonId ? getSeasonMatches(seasonId, { page: 1, limit: 100 }) : Promise.resolve({ success: true, message: "No season", data: [] as SeasonMatch[] }),
    [seasonId],
  );
  const standings = useServiceQuery(
    () => seasonId ? getSeasonStandings(seasonId) : Promise.resolve({ success: true, message: "No season", data: { season: undefined as never, groups: [] } }),
    [seasonId],
  );
  const scorers = useServiceQuery(
    () => seasonId ? getSeasonTopScorers(seasonId) : Promise.resolve({ success: true, message: "No season", data: { season: undefined as never, items: [] } }),
    [seasonId],
  );
  const latestNews = useServiceQuery(() => getNews({ page: 1, limit: 3, status: "published" }), []);
  const organizers = useServiceQuery(() => getOrganizers({ page: 1, limit: 8, status: "active" }), []);
  const sponsors = useServiceQuery(() => getSponsors({ page: 1, limit: 8, status: "active" }), []);

  const allMatches = matches.data?.data ?? [];
  const liveMatch = allMatches.filter((match) => match.status === "live").sort((a,b)=>a.kickoffAt.localeCompare(b.kickoffAt))[0];
  const upcomingMatches = allMatches.filter((match) => match.status === "scheduled").sort((a,b)=>a.kickoffAt.localeCompare(b.kickoffAt));
  const featuredMatch = liveMatch ?? upcomingMatches[0];
  const recentResults = allMatches.filter((match) => match.status === "completed").sort((a,b)=>b.kickoffAt.localeCompare(a.kickoffAt)).slice(0,3);
  const upcoming = upcomingMatches.slice(0,3);
  const topScorers: TopScorer[] = (scorers.data?.data.items ?? []).map((scorer) => ({
    rank: scorer.rank, player: scorer.player,
    team: scorer.team ? { _id: scorer.team.teamId, name: scorer.team.displayName, shortName: scorer.team.shortName, logo: scorer.team.logo, groupName: scorer.team.groupName } : null,
    goals: scorer.goals,
  }));
  const standingsGroups = mapStandings(standings.data?.data.groups ?? []);
  const data = dashboard.data?.data;
  const historicalSeasons = seasons.data?.data.filter((season) => ["completed","archived"].includes(season.status)).sort((a,b)=>b.seasonNumber-a.seasonNumber) ?? [];
  const [historicalSeasonId, setHistoricalSeasonId] = useState("");
  const historicalSeason = historicalSeasons.find((season) => season._id === historicalSeasonId) ?? historicalSeasons[0];
  const historicalAwards = useServiceQuery(
    () => historicalSeason ? getSeasonAwards(historicalSeason._id) : Promise.resolve({success:true,message:"No completed season",data:[]} as Awaited<ReturnType<typeof getSeasonAwards>>),
    [historicalSeason?._id],
  );

  return <div>
    <PageContainer className="pb-4">
      <section className="relative overflow-hidden rounded-card border border-line">
        <div className="pitch-stripes absolute inset-0" /><div className="pitch-lines absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/90 to-bg/30" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Village football · Cherukunnu</p>
            <h1 className="mt-3 max-w-xl font-display text-5xl leading-none text-fg sm:text-7xl">{data?.tournamentName ?? activeSeason?.name ?? "CSL Football Tournament"}</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-fg/90">Six teams, one community and every moment of the tournament in one place.</p>
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-gold"><CalendarRange className="h-4 w-4" />{data ? formatDateRange(data.startDate, data.endDate) : activeSeason?.startDate ? formatDateRange(activeSeason.startDate, activeSeason.endDate ?? activeSeason.startDate) : "Season dates"}</p>
            <div className="mt-6 flex flex-wrap gap-2"><Link to="/matches"><Button variant="surface">Fixtures & results</Button></Link><Link to="/standings"><Button>View standings</Button></Link></div>
          </div>
          <GlassCard className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{liveMatch ? "Live match" : "Next match"}</p>{liveMatch ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-danger"><span className="h-2 w-2 animate-pulse rounded-full bg-danger" />LIVE</span> : null}</div>
            {matches.loading ? <Skeleton className="h-36" /> : featuredMatch ? <><SeasonFixtureCard match={featuredMatch} /><Link to="/matches/$matchId" params={{matchId:featuredMatch._id}} search={{seasonId}} className="mt-3 block"><Button className="w-full">View match</Button></Link></> : <p className="py-8 text-center text-sm text-muted">No live or upcoming match is available.</p>}
          </GlassCard>
        </div>
      </section>
    </PageContainer>

    <PageContainer>
      {isAdmin ? <GlassCard className="mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-fg">You are managing this tournament.</p><div className="flex flex-wrap gap-2"><Link to="/admin/dashboard"><Button size="sm">Dashboard</Button></Link><Link to="/admin/news"><Button size="sm" variant="surface">Manage news</Button></Link><Link to="/admin/seasons"><Button size="sm" variant="surface">Manage seasons</Button></Link></div></GlassCard> : null}
      {dashboard.error ? <ErrorState message={dashboard.error} onRetry={dashboard.reload} /> : null}
      {dashboard.loading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-28" />)}</div> : null}
      {data ? <section aria-label="Tournament statistics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Swords} label="Matches played" value={data.totalMatchesPlayed} />
        <StatCard icon={Sparkles} label="Goals" value={data.totalGoals} hint="Normal goals and own goals" />
        <StatCard icon={Shield} label="Active teams" value={data.activeTeams} />
        <StatCard icon={Users} label="Active players" value={data.activePlayers} />
      </section> : null}

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div><div className="mb-4 flex items-end justify-between"><h2 className="font-display text-3xl text-fg">Upcoming fixtures</h2><Link to="/matches" className="text-sm font-semibold text-accent">All fixtures</Link></div>
          <div className="grid gap-3">{upcoming.map((match)=><SeasonFixtureCard key={match._id} match={match} />)}{!matches.loading && !upcoming.length ? <p className="text-sm text-muted">No upcoming fixtures.</p> : null}</div>
        </div>
        <div><div className="mb-4 flex items-end justify-between"><h2 className="font-display text-3xl text-fg">Recent results</h2><Link to="/matches" className="text-sm font-semibold text-accent">All results</Link></div>
          <div className="grid gap-3">{recentResults.map((match)=><SeasonFixtureCard key={match._id} match={match} />)}{!matches.loading && !recentResults.length ? <p className="text-sm text-muted">No completed matches yet.</p> : null}</div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between"><h2 className="font-display text-3xl text-fg">Standings preview</h2><Link to="/standings" className="text-sm font-semibold text-accent">Full standings</Link></div>
        {standings.loading ? <Skeleton className="h-48" /> : standings.error ? <ErrorState message={standings.error} onRetry={standings.reload} /> : standingsGroups.length ? <div className="grid gap-4 md:grid-cols-2">{standingsGroups.slice(0,2).map((group)=><GlassCard key={group.groupName} className="p-3"><h3 className="mb-2 font-display text-2xl text-fg">{group.groupName}</h3><StandingsTable group={{...group,rows:group.rows.slice(0,3)}} /></GlassCard>)}</div> : <p className="text-sm text-muted">Standings will appear when the season data is available.</p>}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between"><h2 className="font-display text-3xl text-fg">Top scorers</h2><Link to="/standings" className="text-sm font-semibold text-accent">All scorers</Link></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{topScorers.slice(0,5).map((scorer)=><TopScorerCard key={scorer.player._id} scorer={scorer} />)}{!scorers.loading && !topScorers.length ? <p className="text-sm text-muted">No goals recorded for this season yet.</p> : null}</div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">From the tournament</p><h2 className="font-display text-3xl text-fg">Latest news</h2></div><Link to="/news" className="text-sm font-semibold text-accent">All news</Link></div>
        {latestNews.loading ? <div className="grid gap-4 sm:grid-cols-3">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-72" />)}</div> : latestNews.error ? <ErrorState message={latestNews.error} onRetry={latestNews.reload} /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(latestNews.data?.data ?? []).slice(0,3).map((article)=><NewsArticleCard key={article._id} article={article} />)}{!latestNews.data?.data.length ? <p className="text-sm text-muted">Tournament news and announcements will appear here.</p> : null}</div>}
      </section>

      <section className="mt-10" aria-labelledby="home-organizers">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide text-accent">The people behind CSL</p><h2 id="home-organizers" className="font-display text-3xl text-fg">Tournament organizers</h2></div>
        {organizers.loading ? <Skeleton className="h-24" /> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(organizers.data?.data ?? []).filter((person)=>!("status" in person) || person.status==="active").map((person)=><GlassCard key={person._id} className="flex items-center gap-3 p-4"><Avatar name={person.name} asset={person.profilePic} className="h-12 w-12" /><div className="min-w-0"><p className="truncate font-semibold text-fg">{person.name}</p><p className="text-sm text-muted">{person.title}</p></div></GlassCard>)}</div>}
      </section>

      <section id="active-sponsors" className="mt-10">
        <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide text-accent">With thanks to our partners</p><h2 className="font-display text-3xl text-fg">Active sponsors</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(sponsors.data?.data ?? []).filter((sponsor)=>sponsor.status==="active").map((sponsor)=><GlassCard key={sponsor._id} className="flex h-full flex-col items-center p-5 text-center">{sponsor.logo ? <img src={sponsor.logo.url} alt="" loading="lazy" className="h-16 w-16 rounded-2xl object-contain" /> : null}<h3 className="mt-3 font-display text-2xl text-fg">{sponsor.name}</h3>{sponsor.tier ? <p className="mt-1 text-xs text-muted">{sponsor.tier}</p> : null}</GlassCard>)}</div>
      </section>

      {historicalSeason ? <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-accent">Season history</p><h2 className="font-display text-3xl text-fg">{historicalSeason.name} · Achievements</h2></div><select aria-label="Historical season" className="rounded-lg border border-line bg-surface p-2 text-sm text-fg" value={historicalSeasonId || historicalSeason._id} onChange={(event)=>setHistoricalSeasonId(event.target.value)}>{historicalSeasons.map((season)=><option key={season._id} value={season._id}>{season.name} · {season.year}</option>)}</select></div>
        {historicalAwards.loading ? <Skeleton className="h-24" /> : null}{historicalAwards.error ? <ErrorState message={historicalAwards.error} onRetry={historicalAwards.reload} /> : null}
        {historicalAwards.data?.data.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{historicalAwards.data.data.map((award)=><GlassCard key={award._id} className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-accent">{award.title}</p><div className="mt-3 space-y-3">{award.recipients.map((recipient)=><div key={recipient._id} className="flex items-center gap-3"><img src={recipient.profileImageSnapshot?.url ?? recipient.teamLogoSnapshot?.url ?? "https://placehold.co/96x96?text=CSL"} alt="" className="h-11 w-11 rounded-full object-cover" /><div><p className="text-sm font-semibold text-fg">{recipient.displayNameSnapshot}</p><p className="text-xs text-muted">{recipient.teamNameSnapshot}</p></div></div>)}</div></GlassCard>)}</div> : !historicalAwards.loading ? <p className="text-sm text-muted">No achievements recorded for this completed season yet.</p> : null}
      </section> : null}
    </PageContainer>
    <AboutSection />
  </div>;
}

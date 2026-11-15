import {useEffect,useState} from "react";
import {Link} from "@tanstack/react-router";
import {PageContainer} from "@/components/layout/PageContainer";
import {Badge} from "@/components/ui/Badge";
import {ErrorState} from "@/components/ui/ErrorState";
import {GlassCard} from "@/components/ui/GlassCard";
import {Skeleton} from "@/components/ui/Skeleton";
import {StatCard} from "@/components/ui/StatCard";
import {Select} from "@/components/ui/Select";
import {useServiceQuery} from "@/hooks/useServiceQuery";
import {getTeamById} from "@/services/teamService";
import {getSeasons} from "@/services/seasonService";
import {getSeasonTeamDashboard} from "@/services/seasonStatisticsService";
import {formatCurrency} from "@/utils/formatCurrency";
import type {ApiResponse} from "@/types/api.types";
import type {SeasonTeamDashboard} from "@/types/seasonStatistics.types";
const EMPTY_DASHBOARD:ApiResponse<SeasonTeamDashboard>={success:true,message:"",data:null as unknown as SeasonTeamDashboard};
const POSITION_LABEL:Record<string,string>={goalkeeper:"Goalkeeper",defender:"Defender",midfielder:"Midfielder",forward:"Forward"};
export function TeamDetailsPage({teamId}:{teamId:string}){
 const team=useServiceQuery(()=>getTeamById(teamId),[teamId]);
 const seasons=useServiceQuery(()=>getSeasons(),[]);
 const [seasonId,setSeasonId]=useState("");
 useEffect(()=>{if(!seasonId&&seasons.data?.data.length){const active=seasons.data.data.find(s=>s.status==="active");setSeasonId(active?active._id:seasons.data.data[0]._id);}},[seasonId,seasons.data]);
 const dashboard=useServiceQuery(()=>seasonId?getSeasonTeamDashboard(teamId,seasonId):Promise.resolve(EMPTY_DASHBOARD),[teamId,seasonId]);
 const record=team.data?.data;const data=dashboard.data?.data;
 if(team.loading)return <PageContainer><Skeleton className="h-64"/></PageContainer>;
 if(team.error||!record)return <PageContainer><ErrorState message={team.error||"Team not found"} onRetry={team.reload}/></PageContainer>;
 return <PageContainer>
  <Link to="/teams" className="text-sm font-semibold text-accent">Back to teams</Link>
  <GlassCard className="mt-4 overflow-hidden">{record.poster?<img src={record.poster.url} alt="" className="h-48 w-full object-cover"/>:null}<div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">{record.logo?<img src={record.logo.url} alt="" className="h-20 w-20 rounded-2xl object-cover"/>:null}<div><h1 className="font-display text-5xl text-fg">{record.name}</h1><div className="mt-2 flex gap-2">{record.shortName?<Badge>{record.shortName}</Badge>:null}<Badge tone="accent">Permanent team</Badge></div></div></div></GlassCard>
  <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-display text-2xl text-fg">Season performance</h2><p className="text-sm text-muted">The squad, managers and match record are specific to the selected season.</p></div><div className="w-full sm:max-w-xs"><label className="mb-1 block text-sm text-fg">Season</label><Select value={seasonId} onChange={e=>setSeasonId(e.target.value)}><option value="">Select season</option>{seasons.data?.data.map(s=><option key={s._id} value={s._id}>{s.name} · {s.year}</option>)}</Select></div></div>
  {dashboard.loading?<Skeleton className="mt-4 h-48"/>:null}{dashboard.error?<ErrorState message={dashboard.error} onRetry={dashboard.reload}/>:null}
  {data&&!data.participates?<GlassCard className="mt-4 p-5 text-sm text-muted">This permanent team did not participate in the selected season.</GlassCard>:null}
  {data?.participates?<>
   <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Played" value={data.stats.played}/><StatCard label="Points" value={data.stats.points}/><StatCard label="Goal difference" value={data.stats.goalDifference}/><StatCard label="Clean sheets" value={data.stats.cleanSheets}/><StatCard label="Won" value={data.stats.won}/><StatCard label="Drawn" value={data.stats.drawn}/><StatCard label="Lost" value={data.stats.lost}/><StatCard label="Goals scored" value={data.stats.goalsScored}/></div>
   <section className="mt-7 grid gap-4 lg:grid-cols-2"><GlassCard className="p-5"><h3 className="font-display text-2xl text-fg">Season squad</h3><p className="mb-3 text-sm text-muted">{data.squad.length} player(s) acquired through the season auction</p><div className="grid gap-2 sm:grid-cols-2">{data.squad.map(p=><div key={p.player._id} className="rounded-xl bg-surface p-3"><p className="font-semibold text-fg">{p.player.name}{p.jerseyNo?" · #"+p.jerseyNo:""}</p><p className="mt-1 text-xs text-muted">{POSITION_LABEL[p.position]}{p.isIconPlayer?" · Icon":""}{p.isGoalkeeper?" · Goalkeeper":""}</p><p className="mt-1 text-xs text-muted">{p.purchasePrice===null?"No price":formatCurrency(p.purchasePrice)}</p></div>)}</div>{!data.squad.length?<p className="text-sm text-muted">No players purchased yet.</p>:null}</GlassCard>
    <GlassCard className="p-5"><h3 className="font-display text-2xl text-fg">Managers</h3>{data.managers.length?<div className="mt-3 space-y-2">{data.managers.map(m=><div key={m._id} className="rounded-xl bg-surface p-3"><p className="font-semibold text-fg">{m.name}</p><p className="text-xs text-muted">{m.role??"Manager"}</p></div>)}</div>:<p className="mt-3 text-sm text-muted">No managers assigned to this season team.</p>}{data.stats.topScorer?<div className="mt-6 border-t border-line pt-4"><p className="text-xs text-muted">Team top scorer</p><p className="mt-1 font-semibold text-fg">{data.stats.topScorer.player.name}</p><p className="text-sm text-muted">{data.stats.topScorer.goals} normal-time goals</p></div>:null}</GlassCard></section>
   <section className="mt-8 grid gap-5 lg:grid-cols-2"><div><h3 className="mb-3 font-display text-2xl text-fg">Recent results</h3><div className="space-y-2">{data.recentFixtures.map(f=><div key={f._id} className="rounded-xl border border-line p-3"><div className="flex items-center justify-between text-xs text-muted"><span>Match {f.matchNumber} · {f.stage.replaceAll("_"," ")}</span><span>{new Date(f.kickoffAt).toLocaleDateString()}</span></div><div className="mt-2 flex items-center justify-between gap-2 text-sm"><span className="text-fg">{f.home.displayName}</span><strong className="text-fg">{f.homeScore} - {f.awayScore}</strong><span className="text-right text-fg">{f.away.displayName}</span></div></div>)}</div>{!data.recentFixtures.length?<p className="text-sm text-muted">No completed fixtures.</p>:null}</div>
    <div><h3 className="mb-3 font-display text-2xl text-fg">Upcoming fixtures</h3><div className="space-y-2">{data.upcomingFixtures.map(f=><div key={f._id} className="rounded-xl border border-line p-3"><div className="flex items-center justify-between text-xs text-muted"><span>Match {f.matchNumber} · {f.stage.replaceAll("_"," ")}</span><span>{new Date(f.kickoffAt).toLocaleString()}</span></div><div className="mt-2 flex items-center justify-between gap-2 text-sm"><span className="text-fg">{f.home.displayName}</span><span className="text-muted">vs</span><span className="text-right text-fg">{f.away.displayName}</span></div></div>)}</div>{!data.upcomingFixtures.length?<p className="text-sm text-muted">No upcoming fixtures.</p>:null}</div></section>
  </>:null}
 </PageContainer>;
}
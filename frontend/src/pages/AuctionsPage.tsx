import {useEffect,useState} from "react";
import {PageContainer} from "@/components/layout/PageContainer";
import {PageHeader} from "@/components/layout/PageHeader";
import {GlassCard} from "@/components/ui/GlassCard";
import {Select} from "@/components/ui/Select";
import {Skeleton} from "@/components/ui/Skeleton";
import {ErrorState} from "@/components/ui/ErrorState";
import {useAuth} from "@/contexts/AuthContext";
import {useServiceQuery} from "@/hooks/useServiceQuery";
import {getSeasons,getAuctionSummary} from "@/services/seasonService";
import {formatCurrency} from "@/utils/formatCurrency";
export function AuctionsPage(){
 const {isAuthenticated}=useAuth();const seasons=useServiceQuery(()=>getSeasons(),[]);const [seasonId,setSeasonId]=useState("");
 useEffect(()=>{if(!seasonId&&seasons.data?.data.length)setSeasonId(seasons.data.data.find(s=>s.status==="active")?._id??seasons.data.data[0]._id);},[seasonId,seasons.data]);
 const auction=useServiceQuery(()=>seasonId?getAuctionSummary(seasonId):Promise.reject(new Error("Select a season")), [seasonId]);
 const data=auction.data?.data;
 return <PageContainer><PageHeader eyebrow="Season auction" title="Auctions" description="Season-wise nominations, sold lots and participating team budgets."/>
 <div className="mb-5 max-w-sm"><label className="mb-2 block text-sm text-muted">Season</label><Select value={seasonId} onChange={e=>setSeasonId(e.target.value)}>{seasons.data?.data.map(s=><option key={s._id} value={s._id}>{s.name} · {s.year}</option>)}</Select></div>
 {seasons.loading?<Skeleton className="h-32"/>:null}{seasons.error?<ErrorState message={seasons.error} onRetry={seasons.reload}/>:null}
 {auction.loading?<Skeleton className="h-64"/>:null}{auction.error?<ErrorState message={auction.error} onRetry={auction.reload}/>:null}
 {data?<><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[["Teams",data.totals.participatingTeams],["Nominated",data.totals.lots],["Sold",data.totals.sold],["Pending",data.totals.pending],["Unsold",data.totals.unsold],["Sold value",formatCurrency(data.totals.totalSoldValue)]].map(([label,value])=><GlassCard key={label} className="p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold text-fg">{value}</p></GlassCard>)}</div>
 <div className="mt-6 grid gap-4 lg:grid-cols-2">{data.teams.map(team=><GlassCard key={team.seasonTeamId} className="p-5"><div className="flex items-start justify-between gap-3"><h2 className="font-display text-2xl text-fg">{team.displayName}</h2><span className="text-sm text-muted">{team.playersSigned}/{data.season.auctionSettings.teamSquadSize} players</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><div><p className="text-muted">Budget</p><p className="font-semibold text-fg">{formatCurrency(team.budget)}</p></div><div><p className="text-muted">Spent</p><p className="font-semibold text-fg">{formatCurrency(team.totalSpent)}</p></div><div><p className="text-muted">Balance</p><p className="font-semibold text-fg">{formatCurrency(team.balance)}</p></div><div><p className="text-muted">Average</p><p className="font-semibold text-fg">{formatCurrency(team.averagePrice)}</p></div><div><p className="text-muted">Icon / GK</p><p className="font-semibold text-fg">{team.iconCount} / {team.goalkeeperCount}</p></div><div><p className="text-muted">Slots left</p><p className="font-semibold text-fg">{team.remainingSlots}</p></div></div><div className="mt-4 space-y-2">{team.lots.map(lot=><div key={lot._id} className="flex items-center justify-between rounded-xl bg-surface p-3 text-sm"><span className="text-fg">{typeof lot.playerRef==="string"?lot.playerRef:lot.playerRef.name} · {lot.playerPosition}</span><span className="text-muted">{formatCurrency(lot.purchasePrice??0)}</span></div>)}</div></GlassCard>)}</div>
 {isAuthenticated?<p className="mt-5 text-sm text-muted">Administrator write controls (nomination and sale) are available through the new auction-lots API; the visual workflow is the next UI increment.</p>:null}</>:null}</PageContainer>;
}

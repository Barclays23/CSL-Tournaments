import {useEffect,useState} from "react";
import {toast} from "sonner";
import {PageContainer} from "@/components/layout/PageContainer";
import {PageHeader} from "@/components/layout/PageHeader";
import {GlassCard} from "@/components/ui/GlassCard";
import {Select} from "@/components/ui/Select";
import {Input} from "@/components/ui/Input";
import {Button} from "@/components/ui/Button";
import {Modal} from "@/components/ui/Modal";
import {Skeleton} from "@/components/ui/Skeleton";
import {ErrorState} from "@/components/ui/ErrorState";
import {useAuth} from "@/contexts/AuthContext";
import {useServiceQuery} from "@/hooks/useServiceQuery";
import {getSeasons,getAuctionSummary,getAuctionLots,nominatePlayer,sellAuctionLot,updateAuctionLotStatus} from "@/services/seasonService";
import {getPlayers} from "@/services/playerService";
import type {AuctionLot,AuctionLotStatus,SeasonPlayerPosition} from "@/types/season.types";
import type {ApiResponse} from "@/types/api.types";
import type {AdminPlayer,PublicPlayer} from "@/types/player.types";
import {formatCurrency} from "@/utils/formatCurrency";
import {errorMessage} from "@/utils/errorHandler";

const EMPTY_LOTS:ApiResponse<AuctionLot[]>={success:true,message:"",data:[]};
const EMPTY_SUMMARY:ApiResponse<null>={success:true,message:"",data:null};
const POSITIONS:Record<SeasonPlayerPosition,string>={goalkeeper:"Goalkeeper",defender:"Defender",midfielder:"Midfielder",forward:"Forward"};

export function AuctionsPage(){
  const {isAuthenticated}=useAuth();
  const seasons=useServiceQuery(()=>getSeasons(),[]);
  const [seasonId,setSeasonId]=useState("");
  useEffect(()=>{if(!seasonId&&seasons.data?.data.length){const active=seasons.data.data.find(s=>s.status==="active");setSeasonId(active?active._id:seasons.data.data[0]._id);}},[seasonId,seasons.data]);
  const [teamFilter,setTeamFilter]=useState("");
  const [statusFilter,setStatusFilter]=useState<AuctionLotStatus|"">("");
  const [positionFilter,setPositionFilter]=useState<SeasonPlayerPosition|"">("");
  const [playerName,setPlayerName]=useState("");
  const [iconFilter,setIconFilter]=useState("");
  const [goalkeeperFilter,setGoalkeeperFilter]=useState("");
  const summary=useServiceQuery(()=>seasonId?getAuctionSummary(seasonId):Promise.resolve(EMPTY_SUMMARY as unknown as Awaited<ReturnType<typeof getAuctionSummary>>),[seasonId]);
  const lots=useServiceQuery(()=>seasonId?getAuctionLots({seasonId,...(teamFilter?{seasonTeamId:teamFilter}:{}),...(statusFilter?{auctionStatus:statusFilter}:{}),...(positionFilter?{playerPosition:positionFilter}:{}),...(playerName.trim()?{playerName:playerName.trim()}:{}),...(iconFilter?{isIconPlayer:iconFilter==="true"}:{}),...(goalkeeperFilter?{isGoalkeeper:goalkeeperFilter==="true"}:{})}):Promise.resolve(EMPTY_LOTS),[seasonId,teamFilter,statusFilter,positionFilter,playerName,iconFilter,goalkeeperFilter]);
  const players=useServiceQuery(()=>getPlayers({limit:100,status:"active"}),[]);
  const data=summary.data?.data;
  const lotRows=lots.data?.data??[];
  const playerRows=(players.data?.data??[]) as Array<PublicPlayer|AdminPlayer>;
  const [nominateOpen,setNominateOpen]=useState(false);
  const [playerId,setPlayerId]=useState("");
  const [playerPosition,setPlayerPosition]=useState<SeasonPlayerPosition>("midfielder");
  const [isIconPlayer,setIsIconPlayer]=useState(false);
  const [isGoalkeeper,setIsGoalkeeper]=useState(false);
  const [saleLot,setSaleLot]=useState<AuctionLot|null>(null);
  const [saleTeamId,setSaleTeamId]=useState("");
  const [salePrice,setSalePrice]=useState("");
  const [saleJersey,setSaleJersey]=useState("");
  const [saving,setSaving]=useState(false);
  const refresh=()=>{summary.reload();lots.reload();};
  const closeSale=()=>{setSaleLot(null);setSaleTeamId("");setSalePrice("");setSaleJersey("");};
  const openSale=(lot:AuctionLot)=>{setSaleLot(lot);setSaleTeamId(data?.teams[0]?.seasonTeamId??"");setSalePrice("");setSaleJersey("");};
  const selectedTeam=data?.teams.find(t=>t.seasonTeamId===saleTeamId);
  const playerNameFor=(lot:AuctionLot)=>typeof lot.playerRef==="string"?lot.playerRef:lot.playerRef.name;
  const teamNameFor=(lot:AuctionLot)=>typeof lot.seasonTeamRef==="string"||!lot.seasonTeamRef?"Unassigned":lot.seasonTeamRef.displayName;

  return <PageContainer>
    <PageHeader eyebrow="Season auction" title="Auctions" description="Season-wise nominations, player purchases, budgets and squad composition."/>
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="w-full max-w-sm"><label className="mb-1.5 block text-sm font-medium text-fg">Season</label><Select value={seasonId} onChange={e=>{setSeasonId(e.target.value);setTeamFilter("");}}><option value="">Select season</option>{seasons.data?.data.map(s=><option key={s._id} value={s._id}>{s.name} · {s.year}</option>)}</Select></div>
      {isAuthenticated&&data&&!["completed","archived"].includes(data.season.status)?<Button onClick={()=>setNominateOpen(true)}>Nominate player</Button>:null}
    </div>
    {seasons.loading?<Skeleton className="h-24"/>:null}
    {seasons.error?<ErrorState message={seasons.error} onRetry={seasons.reload}/>:null}
    {summary.loading?<Skeleton className="h-48"/>:null}
    {summary.error?<ErrorState message={summary.error} onRetry={summary.reload}/>:null}
    {data?<>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([["Teams",data.totals.participatingTeams],["Nominated",data.totals.lots],["Sold",data.totals.sold],["Pending",data.totals.pending],["Unsold",data.totals.unsold],["Sold value",formatCurrency(data.totals.totalSoldValue)]] as Array<[string,string|number]>).map(([label,value])=><GlassCard key={label} className="p-4"><p className="text-xs text-muted">{label}</p><p className="mt-2 text-xl font-semibold text-fg">{value}</p></GlassCard>)}
      </div>
      <section className="mt-7"><h2 className="mb-3 font-display text-2xl text-fg">Team budgets and squads</h2>
        <div className="grid gap-3 lg:grid-cols-2">{data.teams.map(team=><GlassCard key={team.seasonTeamId} className="p-5">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-display text-2xl text-fg">{team.displayName}</h3><p className="text-xs text-muted">{team.status}</p></div><span className="text-sm text-muted">{team.playersSigned}/{data.season.auctionSettings.teamSquadSize} players</span></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><p className="text-muted">Budget</p><p className="font-semibold text-fg">{formatCurrency(team.budget)}</p></div>
            <div><p className="text-muted">Spent</p><p className="font-semibold text-fg">{formatCurrency(team.totalSpent)}</p></div>
            <div><p className="text-muted">Balance</p><p className="font-semibold text-fg">{formatCurrency(team.balance)}</p></div>
            <div><p className="text-muted">Average price</p><p className="font-semibold text-fg">{formatCurrency(team.averagePrice)}</p></div>
            <div><p className="text-muted">Icon / Goalkeeper</p><p className="font-semibold text-fg">{team.iconCount} / {team.goalkeeperCount}</p></div>
            <div><p className="text-muted">Slots remaining</p><p className="font-semibold text-fg">{team.remainingSlots}</p></div>
          </div>
          <div className="mt-4 space-y-2">{team.lots.length?team.lots.map(lot=><div key={lot._id} className="flex items-center justify-between gap-3 rounded-xl bg-surface p-3 text-sm"><span className="min-w-0 truncate text-fg">{playerNameFor(lot)} · {POSITIONS[lot.playerPosition]}{lot.isIconPlayer?" · Icon":""}</span><span className="shrink-0 text-muted">{formatCurrency(lot.purchasePrice??0)}</span></div>):<p className="rounded-xl bg-surface p-3 text-sm text-muted">No players purchased yet.</p>}</div>
        </GlassCard>)}</div>
      </section>
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-display text-2xl text-fg">Auction lots</h2><span className="text-xs text-muted">{lotRows.length} result(s)</span></div>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}><option value="">All teams</option>{data.teams.map(t=><option key={t.seasonTeamId} value={t.seasonTeamId}>{t.displayName}</option>)}</Select>
          <Select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as AuctionLotStatus|"")}><option value="">All statuses</option><option value="pending">Pending</option><option value="sold">Sold</option><option value="unsold">Unsold</option><option value="withdrawn">Withdrawn</option></Select>
          <Select value={positionFilter} onChange={e=>setPositionFilter(e.target.value as SeasonPlayerPosition|"")}><option value="">All positions</option>{Object.entries(POSITIONS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select>
          <Input placeholder="Player name" value={playerName} onChange={e=>setPlayerName(e.target.value)}/>
          <Select value={iconFilter} onChange={e=>setIconFilter(e.target.value)}><option value="">Icon: all</option><option value="true">Icon players</option><option value="false">Non-icon players</option></Select>
          <Select value={goalkeeperFilter} onChange={e=>setGoalkeeperFilter(e.target.value)}><option value="">Goalkeeper: all</option><option value="true">Goalkeepers</option><option value="false">Non-goalkeepers</option></Select>
        </div>
        {lots.loading?<Skeleton className="h-40"/>:null}{lots.error?<ErrorState message={lots.error} onRetry={lots.reload}/>:null}
        {!lots.loading&&!lots.error&&!lotRows.length?<GlassCard className="p-5 text-sm text-muted">No auction lots match these filters.</GlassCard>:null}
        <div className="grid gap-3">{lotRows.map(lot=><GlassCard key={lot._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-fg">{playerNameFor(lot)}</h3><span className="rounded-full bg-surface px-2 py-1 text-xs text-muted">{lot.auctionStatus}</span>{lot.isIconPlayer?<span className="rounded-full bg-surface px-2 py-1 text-xs text-gold">Icon</span>:null}{lot.isGoalkeeper?<span className="rounded-full bg-surface px-2 py-1 text-xs text-muted">Goalkeeper</span>:null}</div><p className="mt-1 text-xs text-muted">{POSITIONS[lot.playerPosition]} · {teamNameFor(lot)}{lot.jerseyNo?" · #"+lot.jerseyNo:""}</p></div>
          <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-sm font-semibold text-fg">{lot.purchasePrice===null?"—":formatCurrency(lot.purchasePrice)}</span>{isAuthenticated&&lot.auctionStatus==="pending"&&!["completed","archived"].includes(data.season.status)?<><Button size="sm" onClick={()=>openSale(lot)}>Sell</Button><Button size="sm" variant="surface" onClick={async()=>{try{await updateAuctionLotStatus(lot._id,"unsold");toast.success("Lot marked unsold");refresh();}catch(e){toast.error(errorMessage(e));}}}>Unsold</Button><Button size="sm" variant="ghost" onClick={async()=>{try{await updateAuctionLotStatus(lot._id,"withdrawn");toast.success("Lot withdrawn");refresh();}catch(e){toast.error(errorMessage(e));}}}>Withdraw</Button></>:null}</div>
        </GlassCard>)}</div>
      </section>
    </>:null}
    <Modal open={nominateOpen} title="Nominate a player" description="A player may be nominated only once in this season." onClose={()=>setNominateOpen(false)}>
      <form className="grid gap-3" onSubmit={async e=>{e.preventDefault();if(!seasonId||!playerId)return;setSaving(true);try{await nominatePlayer({seasonId,playerId,playerPosition,isIconPlayer,isGoalkeeper});toast.success("Player nominated");setNominateOpen(false);setPlayerId("");setIsIconPlayer(false);setIsGoalkeeper(false);refresh();}catch(error){toast.error(errorMessage(error));}finally{setSaving(false);}}}>
        <label className="block text-sm text-fg">Player<Select className="mt-1" required value={playerId} onChange={e=>setPlayerId(e.target.value)}><option value="">Select player</option>{playerRows.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}</Select></label>
        <label className="block text-sm text-fg">Season position<Select className="mt-1" value={playerPosition} onChange={e=>setPlayerPosition(e.target.value as SeasonPlayerPosition)}>{Object.entries(POSITIONS).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select></label>
        <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={isIconPlayer} onChange={e=>setIsIconPlayer(e.target.checked)}/> Icon player</label>
        <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={isGoalkeeper} onChange={e=>setIsGoalkeeper(e.target.checked)}/> Goalkeeper</label>
        {players.error?<p className="text-sm text-danger">{players.error}</p>:null}
        <div className="flex justify-end gap-2"><Button variant="surface" onClick={()=>setNominateOpen(false)}>Cancel</Button><Button type="submit" disabled={saving||!playerId}>{saving?"Saving…":"Nominate"}</Button></div>
      </form>
    </Modal>
    <Modal open={Boolean(saleLot)} title="Complete player sale" description="The winning team budget, squad size and jersey number are checked before saving." onClose={closeSale}>
      <form className="grid gap-3" onSubmit={async e=>{e.preventDefault();if(!saleLot)return;setSaving(true);try{await sellAuctionLot(saleLot._id,{seasonTeamId:saleTeamId,purchasePrice:Number(salePrice),jerseyNo:saleJersey?Number(saleJersey):null});toast.success("Auction sale completed");closeSale();refresh();}catch(error){toast.error(errorMessage(error));}finally{setSaving(false);}}}>
        <p className="text-sm font-semibold text-fg">{saleLot?playerNameFor(saleLot):"Player"}</p>
        <label className="block text-sm text-fg">Winning team<Select className="mt-1" value={saleTeamId} onChange={e=>setSaleTeamId(e.target.value)}>{data?.teams.map(t=><option key={t.seasonTeamId} value={t.seasonTeamId}>{t.displayName} · balance {formatCurrency(t.balance)}</option>)}</Select></label>
        <label className="block text-sm text-fg">Purchase price (INR)<Input className="mt-1" type="number" min="0" step="1" required value={salePrice} onChange={e=>setSalePrice(e.target.value)}/></label>
        <label className="block text-sm text-fg">Jersey number (optional)<Input className="mt-1" type="number" min="1" max="99" value={saleJersey} onChange={e=>setSaleJersey(e.target.value)}/></label>
        {selectedTeam?<p className="text-xs text-muted">Approximate remaining balance: {formatCurrency(selectedTeam.balance-(Number(salePrice)||0))}</p>:null}
        <div className="flex justify-end gap-2"><Button variant="surface" onClick={closeSale}>Cancel</Button><Button type="submit" disabled={saving||!saleTeamId||salePrice===""}>{saving?"Saving…":"Confirm sale"}</Button></div>
      </form>
    </Modal>
  </PageContainer>;
}
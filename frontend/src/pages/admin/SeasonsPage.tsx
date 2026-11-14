import {useEffect,useState} from "react";
import type {FormEvent} from "react";
import {toast} from "sonner";
import {AdminRoute} from "@/components/auth/AdminRoute";
import {PageContainer} from "@/components/layout/PageContainer";
import {PageHeader} from "@/components/layout/PageHeader";
import {GlassCard} from "@/components/ui/GlassCard";
import {Button} from "@/components/ui/Button";
import {Input} from "@/components/ui/Input";
import {Select} from "@/components/ui/Select";
import {Skeleton} from "@/components/ui/Skeleton";
import {ErrorState} from "@/components/ui/ErrorState";
import {useServiceQuery} from "@/hooks/useServiceQuery";
import {getSeasons,createSeason,updateSeason,getSeasonTeams,registerSeasonTeams} from "@/services/seasonService";
import {getTeams} from "@/services/teamService";
import {errorMessage} from "@/utils/errorHandler";
import type {SeasonStatus,SeasonWrite} from "@/types/season.types";

export function SeasonsPage(){return <AdminRoute><SeasonsBody/></AdminRoute>;}
function SeasonsBody(){
 const seasons=useServiceQuery(()=>getSeasons(),[]);
 const teams=useServiceQuery(()=>getTeams(),[]);
 const [selectedSeason,setSelectedSeason]=useState("");
 const seasonTeams=useServiceQuery(()=>selectedSeason?getSeasonTeams(selectedSeason):Promise.resolve({success:true,message:"",data:[]} as Awaited<ReturnType<typeof getSeasonTeams>>),[selectedSeason]);
 const [seasonNumber,setSeasonNumber]=useState(1);const [name,setName]=useState("");const [year,setYear]=useState(new Date().getFullYear());
 const [startDate,setStartDate]=useState("");const [endDate,setEndDate]=useState("");const [status,setStatus]=useState<SeasonStatus>("draft");
 const [budget,setBudget]=useState(10000);const [playersCount,setPlayersCount]=useState(54);const [teamCount,setTeamCount]=useState(6);const [squadSize,setSquadSize]=useState(9);const [iconLimit,setIconLimit]=useState(1);const [goalkeeperLimit,setGoalkeeperLimit]=useState(1);
 const [selectedTeamIds,setSelectedTeamIds]=useState<string[]>([]);const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!selectedSeason&&seasons.data?.data.length)setSelectedSeason(seasons.data.data.find(s=>s.status==="active")?._id??seasons.data.data[0]._id);},[selectedSeason,seasons.data]);
 const selected=seasons.data?.data.find(s=>s._id===selectedSeason);
 const currentTeamIds=new Set((seasonTeams.data?.data??[]).map(st=>st.teamRef));
 const toggleTeam=(id:string)=>setSelectedTeamIds(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);
 const resetForm=()=>{setSeasonNumber((seasons.data?.data.reduce((max,s)=>Math.max(max,s.seasonNumber),0)??0)+1);setName("");setYear(new Date().getFullYear());setStartDate("");setEndDate("");setStatus("draft");setBudget(10000);setPlayersCount(54);setTeamCount(6);setSquadSize(9);setIconLimit(1);setGoalkeeperLimit(1);setSelectedTeamIds([]);};
 const handleCreate=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setSaving(true);try{const payload:SeasonWrite={seasonNumber,name,year,startDate:startDate||null,endDate:endDate||null,status,timeZone:"Asia/Kolkata",auctionSettings:{currency:"INR",budgetPerTeam:budget,playersCount,seasonTeamCount:teamCount,teamSquadSize:squadSize,iconPlayerLimit:iconLimit,goalkeeperLimit},pointsRules:{win:3,draw:1,loss:0},standingsTieBreakers:["points","goalDifference","goalsScored","teamNameAsc"],matchRules:{groupStageDrawAllowed:true,knockoutDrawRequiresShootout:true,shootoutCountsForMatchScore:false,shootoutCountsForPlayerGoals:false},teamIds:selectedTeamIds};const result=await createSeason(payload);toast.success("Season created");setSelectedSeason(result.data._id);resetForm();seasons.reload();seasonTeams.reload();}catch(err){toast.error(errorMessage(err));}finally{setSaving(false);}};
 const addTeams=async()=>{if(!selectedSeason||!selectedTeamIds.length)return;setSaving(true);try{await registerSeasonTeams(selectedSeason,selectedTeamIds);toast.success("Teams registered in season");setSelectedTeamIds([]);seasonTeams.reload();seasons.reload();}catch(err){toast.error(errorMessage(err));}finally{setSaving(false);}};
 const changeStatus=async(next:SeasonStatus)=>{if(!selected)return;setSaving(true);try{await updateSeason(selected._id,{status:next});toast.success("Season status updated");seasons.reload();}catch(err){toast.error(errorMessage(err));}finally{setSaving(false);}};
 return <PageContainer>
  <PageHeader eyebrow="Admin · tournament setup" title="Season management" description="Create seasons, configure their auction rules and register participating teams. Each season keeps its own history."/>
  {seasons.loading?<Skeleton className="h-32"/>:null}{seasons.error?<ErrorState message={seasons.error} onRetry={seasons.reload}/>:null}
  <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
   <GlassCard className="p-5"><h2 className="mb-4 font-display text-2xl text-fg">Create a season</h2>
    <form className="grid gap-3" onSubmit={handleCreate}>
     <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm text-fg">Season number<Input className="mt-1" type="number" min="1" required value={seasonNumber} onChange={e=>setSeasonNumber(Number(e.target.value))}/></label><label className="text-sm text-fg">Year<Input className="mt-1" type="number" min="2000" max="2200" required value={year} onChange={e=>setYear(Number(e.target.value))}/></label><label className="text-sm text-fg">Status<Select className="mt-1" value={status} onChange={e=>setStatus(e.target.value as SeasonStatus)}><option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="active">Active</option></Select></label></div>
     <label className="text-sm text-fg">Season name<Input className="mt-1" required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="CSL Football Tournament Season 11"/></label>
     <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-fg">Start date<Input className="mt-1" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label className="text-sm text-fg">End date<Input className="mt-1" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></div>
     <h3 className="mt-2 font-semibold text-fg">Auction settings</h3>
     <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm text-fg">Budget per team (INR)<Input className="mt-1" type="number" min="0" required value={budget} onChange={e=>setBudget(Number(e.target.value))}/></label><label className="text-sm text-fg">Player nominations<Input className="mt-1" type="number" min="1" required value={playersCount} onChange={e=>setPlayersCount(Number(e.target.value))}/></label><label className="text-sm text-fg">Participating teams<Input className="mt-1" type="number" min="1" required value={teamCount} onChange={e=>setTeamCount(Number(e.target.value))}/></label></div>
     <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm text-fg">Squad size per team<Input className="mt-1" type="number" min="1" required value={squadSize} onChange={e=>setSquadSize(Number(e.target.value))}/></label><label className="text-sm text-fg">Icon player limit<Input className="mt-1" type="number" min="0" required value={iconLimit} onChange={e=>setIconLimit(Number(e.target.value))}/></label><label className="text-sm text-fg">Goalkeeper limit<Input className="mt-1" type="number" min="0" required value={goalkeeperLimit} onChange={e=>setGoalkeeperLimit(Number(e.target.value))}/></label></div>
     <div className="mt-2"><h3 className="mb-2 font-semibold text-fg">Initial participating teams</h3><p className="mb-2 text-xs text-muted">Select up to the configured participating-team count. Team participation is separate from the permanent team record.</p><div className="grid gap-2 sm:grid-cols-2">{teams.data?.data.map(team=><label key={team._id} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm text-fg"><input type="checkbox" checked={selectedTeamIds.includes(team._id)} disabled={!selectedTeamIds.includes(team._id)&&selectedTeamIds.length>=teamCount} onChange={()=>toggleTeam(team._id)}/>{team.name}</label>)}</div><p className="mt-1 text-xs text-muted">{selectedTeamIds.length} of {teamCount} selected</p></div>
     <Button type="submit" disabled={saving||!name.trim()||selectedTeamIds.length>teamCount}>{saving?"Saving…":"Create season"}</Button>
    </form>
   </GlassCard>
   <div className="grid content-start gap-5">
    <GlassCard className="p-5"><h2 className="mb-3 font-display text-2xl text-fg">Existing seasons</h2>
     {seasons.data?.data.length?<div className="grid gap-2">{seasons.data.data.map(s=><button type="button" key={s._id} onClick={()=>{setSelectedSeason(s._id);setSelectedTeamIds([]);}} className={"rounded-xl border p-3 text-left "+(selectedSeason===s._id?"border-accent bg-surface":"border-line")}><div className="flex items-center justify-between gap-2"><span className="font-semibold text-fg">{s.name}</span><span className="text-xs text-muted">{s.status}</span></div><p className="mt-1 text-xs text-muted">Season {s.seasonNumber} · {s.year} · INR {s.auctionSettings.budgetPerTeam.toLocaleString("en-IN")} budget/team</p></button>)}</div>:<p className="text-sm text-muted">No seasons created yet.</p>}
    </GlassCard>
    {selected?<GlassCard className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-2xl text-fg">{selected.name}</h2><p className="text-xs text-muted">Season {selected.seasonNumber} · {selected.year}</p></div><Select className="max-w-36" value={selected.status} disabled={saving} onChange={e=>void changeStatus(e.target.value as SeasonStatus)}><option value="draft">Draft</option><option value="upcoming">Upcoming</option><option value="active">Active</option><option value="completed">Completed</option><option value="archived">Archived</option></Select></div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted">Team limit</p><p className="font-semibold text-fg">{selected.auctionSettings.seasonTeamCount}</p></div><div><p className="text-muted">Squad size</p><p className="font-semibold text-fg">{selected.auctionSettings.teamSquadSize}</p></div><div><p className="text-muted">Player nominations</p><p className="font-semibold text-fg">{selected.auctionSettings.playersCount}</p></div><div><p className="text-muted">Budget</p><p className="font-semibold text-fg">INR {selected.auctionSettings.budgetPerTeam.toLocaleString("en-IN")}</p></div></div>
      <h3 className="mb-2 mt-5 font-semibold text-fg">Registered teams</h3>{seasonTeams.loading?<Skeleton className="h-20"/>:null}{seasonTeams.error?<ErrorState message={seasonTeams.error} onRetry={seasonTeams.reload}/>:null}
      <div className="space-y-2">{seasonTeams.data?.data.map(st=><div key={st._id} className="flex items-center justify-between gap-2 rounded-xl bg-surface p-3 text-sm"><div><p className="font-medium text-fg">{st.displayName}</p><p className="text-xs text-muted">{st.group?.groupName??"No group"} · {st.managers.length} manager(s)</p></div><span className="text-xs text-muted">{st.status}</span></div>)}</div>
      {selected.status!=="completed"&&selected.status!=="archived"?<div className="mt-4"><h3 className="mb-2 font-semibold text-fg">Register more teams</h3><div className="grid gap-2 sm:grid-cols-2">{teams.data?.data.filter(t=>!currentTeamIds.has(t._id)).map(team=><label key={team._id} className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm text-fg"><input type="checkbox" checked={selectedTeamIds.includes(team._id)} onChange={()=>toggleTeam(team._id)}/>{team.name}</label>)}</div><Button className="mt-3" size="sm" disabled={saving||!selectedTeamIds.length||((seasonTeams.data?.data.length??0)+selectedTeamIds.length)>selected.auctionSettings.seasonTeamCount} onClick={()=>void addTeams()}>Register selected teams</Button></div>:null}
    </GlassCard>:null}
   </div>
  </section>
 </PageContainer>;
}
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { SeasonMatch } from "@/types/seasonMatch.types";
type Team = { id: string; name: string }; type Player = { id: string; name: string; seasonTeamId: string };
type Shootout = NonNullable<SeasonMatch["penaltyShootout"]>;
const score = (kicks: Shootout["kicks"], id: string) => kicks.filter((kick) => kick.seasonTeamRef === id && kick.result === "scored").length;
export function PenaltyShootoutManagementDrawer({ open, onClose, home, away, shootout, players, saving, onSubmit }: {
  open: boolean; onClose: () => void; home: Team; away: Team; shootout: SeasonMatch["penaltyShootout"]; players: Player[]; saving: boolean;
  onSubmit: (value: SeasonMatch["penaltyShootout"]) => void;
}) {
  const [status, setStatus] = useState<"pending" | "completed">(shootout?.status ?? "pending");
  const [homeScore, setHomeScore] = useState(shootout?.homeTeamScore ?? 0);
  const [awayScore, setAwayScore] = useState(shootout?.awayTeamScore ?? 0);
  const [kicks, setKicks] = useState<Shootout["kicks"]>(shootout?.kicks.map((kick) => ({ ...kick })) ?? []);
  const [teamId, setTeamId] = useState(home.id); const [playerId, setPlayerId] = useState(""); const [result, setResult] = useState<"scored"|"missed"|"saved">("scored");
  const updateKicks = (next: Shootout["kicks"]) => { setKicks(next); if (next.length) { setHomeScore(score(next, home.id)); setAwayScore(score(next, away.id)); } };
  const submit = () => onSubmit({ status, homeTeamScore: kicks.length ? score(kicks, home.id) : homeScore, awayTeamScore: kicks.length ? score(kicks, away.id) : awayScore, kicks });
  return <Drawer open={open} title={shootout ? "Edit penalty shootout" : "Record penalty shootout"} description="Shootout data is separate from normal-time goals and scores." onClose={onClose}>
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <label className="grid gap-1 text-sm font-semibold text-fg">Status<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as "pending"|"completed")}><option value="pending">Pending</option><option value="completed">Completed</option></select></label>
      <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs text-muted">{home.name}<input type="number" min="0" step="1" disabled={kicks.length>0} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg" value={kicks.length ? score(kicks,home.id) : homeScore} onChange={(event)=>setHomeScore(Math.max(0,Number(event.target.value)))}/></label><label className="grid gap-1 text-xs text-muted">{away.name}<input type="number" min="0" step="1" disabled={kicks.length>0} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg" value={kicks.length ? score(kicks,away.id) : awayScore} onChange={(event)=>setAwayScore(Math.max(0,Number(event.target.value)))}/></label></div>
      <section className="grid gap-2 rounded-xl border border-line p-3"><div className="flex justify-between"><h3 className="text-sm font-semibold text-fg">Kick-by-kick</h3><span className="text-xs text-muted">{kicks.length} kicks</span></div>
        {kicks.map((kick,index)=><div key={index} className="grid gap-2 rounded-lg bg-surface p-3"><div className="flex justify-between text-xs font-semibold text-muted"><span>Kick {index+1}</span><button type="button" className="text-danger" onClick={()=>updateKicks(kicks.filter((_,i)=>i!==index))}>Remove</button></div>
          <select aria-label={`Team for kick ${index+1}`} className="rounded-lg border border-line px-2 py-2 text-xs" value={kick.seasonTeamRef} onChange={(event)=>updateKicks(kicks.map((item,i)=>i===index?{...item,seasonTeamRef:event.target.value,playerRef:null}:item))}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select>
          <select aria-label={`Player for kick ${index+1}`} className="rounded-lg border border-line px-2 py-2 text-xs" value={kick.playerRef??""} onChange={(event)=>updateKicks(kicks.map((item,i)=>i===index?{...item,playerRef:event.target.value||null}:item))}><option value="">Player not recorded</option>{players.filter(p=>p.seasonTeamId===kick.seasonTeamRef).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label={`Result for kick ${index+1}`} className="rounded-lg border border-line px-2 py-2 text-xs" value={kick.result} onChange={(event)=>updateKicks(kicks.map((item,i)=>i===index?{...item,result:event.target.value as "scored"|"missed"|"saved"}:item))}><option value="scored">Scored</option><option value="missed">Missed</option><option value="saved">Saved</option></select>
        </div>)}
        <label className="grid gap-1 text-xs text-muted">Kicking team<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg" value={teamId} onChange={(event)=>{setTeamId(event.target.value);setPlayerId("");}}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select></label>
        <label className="grid gap-1 text-xs text-muted">Player (optional)<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg" value={playerId} onChange={(event)=>setPlayerId(event.target.value)}><option value="">Player not recorded</option>{players.filter(p=>p.seasonTeamId===teamId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs text-muted">Kick result<select className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg" value={result} onChange={(event)=>setResult(event.target.value as "scored"|"missed"|"saved")}><option value="scored">Scored</option><option value="missed">Missed</option><option value="saved">Saved</option></select></label>
        <Button type="button" variant="surface" onClick={()=>{updateKicks([...kicks,{seasonTeamRef:teamId,playerRef:playerId||null,result}]);setPlayerId("");}}>Add kick</Button>
      </section>
      <div className="flex gap-2 border-t border-line pt-4">{shootout ? <Button type="button" variant="danger" className="flex-1" disabled={saving} onClick={()=>onSubmit(null)}>Clear shootout</Button> : null}<Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" disabled={saving}>{saving?"Saving…":shootout?"Save changes":"Record shootout"}</Button></div>
    </form>
  </Drawer>;
}
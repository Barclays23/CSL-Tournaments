import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ICONS, TONES, ToneHeader, ToneIcon, fieldClass } from "@/components/ui/Tones";
import type { MatchShootoutWrite, SeasonMatch } from "@/types/seasonMatch.types";
type Team = { id: string; name: string }; type Player = { id: string; name: string; seasonTeamId: string };
type Kicks = MatchShootoutWrite["kicks"];
const score = (kicks: Kicks, id: string) => kicks.filter((kick) => kick.seasonTeamRef === id && kick.result === "scored").length;
export function PenaltyShootoutManagementDrawer({ open, onClose, home, away, shootout, players, saving, onSubmit }: {
  open: boolean; onClose: () => void; home: Team; away: Team; shootout: SeasonMatch["penaltyShootout"]; players: Player[]; saving: boolean;
  onSubmit: (value: MatchShootoutWrite) => void;
}) {
  const [homeScore, setHomeScore] = useState(shootout?.homeTeamScore ?? 0);
  const [awayScore, setAwayScore] = useState(shootout?.awayTeamScore ?? 0);
  const [kicks, setKicks] = useState<Kicks>(shootout?.kicks.map((kick) => ({ ...kick })) ?? []);
  const [teamId, setTeamId] = useState(home.id); const [playerId, setPlayerId] = useState(""); const [result, setResult] = useState<"scored"|"missed"|"saved">("scored");
  const updateKicks = (next: Kicks) => { setKicks(next); if (next.length) { setHomeScore(score(next, home.id)); setAwayScore(score(next, away.id)); } };
  const submit = () => onSubmit({ homeTeamScore: kicks.length ? score(kicks, home.id) : homeScore, awayTeamScore: kicks.length ? score(kicks, away.id) : awayScore, kicks });
  const tScore = TONES.primary;
  const tKicks = TONES.accent;
  const tRow = TONES.info;
  const tNew = TONES.gold;
  const small = "rounded-lg border px-2 py-2 text-xs";
  return <Drawer open={open} title={shootout ? "Edit penalty shootout" : "Record penalty shootout"} description="Shootout kicks are separate from normal-time goals and match score. Use the phase control to complete the shootout." onClose={onClose}>
    <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <section className={`grid gap-3 rounded-2xl border p-3 backdrop-blur-xl ${tScore.section} ${tScore.labels}`}>
        <ToneHeader tone="primary" icon={<ToneIcon d={ICONS.trophy} />} title="Shootout score" />
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-xs">{home.name}<input type="number" min="0" step="1" disabled={kicks.length>0} className={fieldClass("primary", "disabled:opacity-60")} value={kicks.length ? score(kicks,home.id) : homeScore} onChange={(event)=>setHomeScore(Math.max(0,Number(event.target.value)))}/></label><label className="grid gap-1 text-xs">{away.name}<input type="number" min="0" step="1" disabled={kicks.length>0} className={fieldClass("primary", "disabled:opacity-60")} value={kicks.length ? score(kicks,away.id) : awayScore} onChange={(event)=>setAwayScore(Math.max(0,Number(event.target.value)))}/></label></div>
      </section>
      <section className={`grid gap-2 rounded-2xl border p-3 backdrop-blur-xl ${tKicks.section} ${tKicks.labels}`}><div className="flex items-center justify-between"><ToneHeader tone="accent" icon={<ToneIcon d={ICONS.target} />} title="Kick-by-kick" /><span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tKicks.pill}`}>{kicks.length} kicks</span></div>
        {kicks.map((kick,index)=><div key={index} className={`grid gap-2 rounded-xl border p-3 ${tRow.cardOff} ${tRow.labels}`}><div className={`flex justify-between text-xs font-semibold ${tRow.text}`}><span>Kick {index+1}</span><button type="button" className="text-danger" onClick={()=>updateKicks(kicks.filter((_,i)=>i!==index))}>Remove</button></div>
          <select aria-label={`Team for kick ${index+1}`} className={fieldClass("info", small)} value={kick.seasonTeamRef} onChange={(event)=>updateKicks(kicks.map((item,i)=>i===index?{...item,seasonTeamRef:event.target.value,playerRef:null}:item))}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select>
          <select aria-label={`Player for kick ${index+1}`} className={fieldClass("info", small)} value={kick.playerRef??""} onChange={(event)=>updateKicks(kicks.map((item,i)=>i===index?{...item,playerRef:event.target.value||null}:item))}><option value="">Player not recorded</option>{players.filter(p=>p.seasonTeamId===kick.seasonTeamRef).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label={`Result for kick ${index+1}`} className={fieldClass("info", small)} value={kick.result} onChange={(event)=>updateKicks(kicks.map((item,i)=>i===index?{...item,result:event.target.value as "scored"|"missed"|"saved"}:item))}><option value="scored">Scored</option><option value="missed">Missed</option><option value="saved">Saved</option></select>
        </div>)}
        <div className={`grid gap-2 rounded-xl border p-3 ${tNew.section} ${tNew.labels}`}>
          <label className="grid gap-1 text-xs">Kicking team<select className={fieldClass("gold")} value={teamId} onChange={(event)=>{setTeamId(event.target.value);setPlayerId("");}}><option value={home.id}>{home.name}</option><option value={away.id}>{away.name}</option></select></label>
          <label className="grid gap-1 text-xs">Player (optional)<select className={fieldClass("gold")} value={playerId} onChange={(event)=>setPlayerId(event.target.value)}><option value="">Player not recorded</option>{players.filter(p=>p.seasonTeamId===teamId).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs">Kick result<select className={fieldClass("gold")} value={result} onChange={(event)=>setResult(event.target.value as "scored"|"missed"|"saved")}><option value="scored">Scored</option><option value="missed">Missed</option><option value="saved">Saved</option></select></label>
          <Button type="button" variant="surface" onClick={()=>{updateKicks([...kicks,{seasonTeamRef:teamId,playerRef:playerId||null,result}]);setPlayerId("");}}>Add kick</Button>
        </div>
      </section>
      <div className="flex gap-2 border-t border-line pt-4"><Button type="button" variant="surface" className="flex-1" onClick={onClose}>Cancel</Button><Button type="submit" className="flex-1" disabled={saving}>{saving?"Saving…":shootout?"Save kicks":"Record kicks"}</Button></div>
    </form>
  </Drawer>;
}
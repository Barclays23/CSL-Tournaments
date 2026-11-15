import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/contexts/ConfirmContext";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getTeams } from "@/services/teamService";
import {
  archiveSeason, completeSeason, createSeason, deleteSeason, getAuctionLots,
  getSeasonTeams, getSeasons, registerSeasonTeams, removeSeasonTeam,
  transitionSeason, updateSeason, updateSeasonTeam, withdrawSeasonTeam,
} from "@/services/seasonService";
import {
  createSeasonGroup, deleteSeasonGroup, getSeasonGroups, getSeasonMatches, updateSeasonGroup,
} from "@/services/seasonMatchService";
import { errorMessage } from "@/utils/errorHandler";
import type { Season, SeasonPatch, SeasonStatus, SeasonWrite, SeasonTeam } from "@/types/season.types";
import type { SeasonGroup } from "@/types/seasonMatch.types";

type SeasonFormState = {
  seasonNumber: number; name: string; year: number; startDate: string; endDate: string; groupStageEnabled: boolean;
  budgetPerTeam: number; playersCount: number; seasonTeamCount: number; teamSquadSize: number; iconPlayerLimit: number; goalkeeperLimit: number;
  win: number; draw: number; loss: number; groupStageDrawAllowed: boolean; knockoutDrawRequiresShootout: boolean;
  standingsTieBreakers: Array<"points" | "goalDifference" | "goalsScored" | "teamNameAsc">;
};
const defaultForm = (seasonNumber = 1): SeasonFormState => ({
  seasonNumber, name: "", year: new Date().getFullYear(), startDate: "", endDate: "", groupStageEnabled: true,
  budgetPerTeam: 10000, playersCount: 54, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1,
  win: 3, draw: 1, loss: 0, groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true,
  standingsTieBreakers: ["points", "goalDifference", "goalsScored", "teamNameAsc"],
});
const toDateInput = (value: string | null | undefined) => value ? value.slice(0, 10) : "";
const fromSeason = (season: Season): SeasonFormState => ({
  ...defaultForm(season.seasonNumber),
  name: season.name, year: season.year, startDate: toDateInput(season.startDate), endDate: toDateInput(season.endDate),
  groupStageEnabled: season.groupStageEnabled ?? true,
  budgetPerTeam: season.auctionSettings?.budgetPerTeam ?? 10000,
  playersCount: season.auctionSettings?.playersCount ?? 54,
  seasonTeamCount: season.auctionSettings?.seasonTeamCount ?? 6,
  teamSquadSize: season.auctionSettings?.teamSquadSize ?? 9,
  iconPlayerLimit: season.auctionSettings?.iconPlayerLimit ?? 1,
  goalkeeperLimit: season.auctionSettings?.goalkeeperLimit ?? 1,
  win: season.pointsRules?.win ?? 3, draw: season.pointsRules?.draw ?? 1, loss: season.pointsRules?.loss ?? 0,
  groupStageDrawAllowed: season.matchRules?.groupStageDrawAllowed ?? true,
  knockoutDrawRequiresShootout: season.matchRules?.knockoutDrawRequiresShootout ?? true,
  standingsTieBreakers: season.standingsTieBreakers ? [...season.standingsTieBreakers] : ["points", "goalDifference", "goalsScored", "teamNameAsc"],
});
const statuses: SeasonStatus[] = ["draft", "upcoming", "active", "completed", "archived"];
const statusLabel = (status: SeasonStatus) => status.charAt(0).toUpperCase() + status.slice(1);

export function SeasonsPage() {
  return <AdminRoute><SeasonsBody /></AdminRoute>;
}

function SeasonsBody() {
  const confirm = useConfirm();
  const seasons = useServiceQuery(() => getSeasons(), []);
  const permanentTeams = useServiceQuery(() => getTeams(), []);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [createForm, setCreateForm] = useState<SeasonFormState>(() => defaultForm());
  const [editForm, setEditForm] = useState<SeasonFormState>(() => defaultForm());
  const [initialTeamIds, setInitialTeamIds] = useState<string[]>([]);
  const [registrationIds, setRegistrationIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOrder, setNewGroupOrder] = useState(0);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { groupName: string; displayOrder: number }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const list = seasons.data?.data ?? [];
    if (!selectedSeasonId && list.length) {
      const chosen = list.find((season) => season.status === "active") ?? list[0];
      setSelectedSeasonId(chosen._id);
    }
  }, [selectedSeasonId, seasons.data]);

  const selected = seasons.data?.data.find((season) => season._id === selectedSeasonId) ?? null;
  useEffect(() => {
    if (selected) setEditForm(fromSeason(selected));
  }, [selected?._id, selected?.updatedAt]);

  const seasonTeams = useServiceQuery(
    () => selectedSeasonId ? getSeasonTeams(selectedSeasonId) : Promise.resolve({ success: true, message: "", data: [] } as Awaited<ReturnType<typeof getSeasonTeams>>),
    [selectedSeasonId],
  );
  const groups = useServiceQuery(
    () => selectedSeasonId ? getSeasonGroups(selectedSeasonId) : Promise.resolve({ success: true, message: "", data: [] } as Awaited<ReturnType<typeof getSeasonGroups>>),
    [selectedSeasonId],
  );
  const fixtures = useServiceQuery(
    () => selectedSeasonId ? getSeasonMatches(selectedSeasonId, { page: 1, limit: 100 }) : Promise.resolve({ success: true, message: "", data: [] } as Awaited<ReturnType<typeof getSeasonMatches>>),
    [selectedSeasonId],
  );
  const lots = useServiceQuery(
    () => selectedSeasonId ? getAuctionLots({ seasonId: selectedSeasonId }) : Promise.resolve({ success: true, message: "", data: [] } as Awaited<ReturnType<typeof getAuctionLots>>),
    [selectedSeasonId],
  );

  const registeredTeams = seasonTeams.data?.data ?? [];
  const seasonGroups = groups.data?.data ?? [];
  const seasonFixtures = fixtures.data?.data ?? [];
  const seasonLots = lots.data?.data ?? [];
  const registeredTeamIds = useMemo(() => new Set(registeredTeams.map((item) => item.teamRef)), [registeredTeams]);
  const dependenciesExist = registeredTeams.length + seasonGroups.length + seasonLots.length + seasonFixtures.length > 0;
  const hasAuctionHistory = seasonLots.length > 0;
  const hasFixtures = seasonFixtures.length > 0;
  const preActivation = selected ? ["draft", "upcoming"].includes(selected.status) : false;
  const editable = preActivation && selected?.status !== "completed" && selected?.status !== "archived";
  const identityLocked = !selected || selected.status !== "draft" || dependenciesExist;
  const matchRulesLocked = hasFixtures || !editable;
  const auctionRulesLocked = hasAuctionHistory || !editable;
  const refreshSelected = () => { seasons.reload(); seasonTeams.reload(); groups.reload(); fixtures.reload(); lots.reload(); };
  const setCreate = <K extends keyof SeasonFormState>(key: K, value: SeasonFormState[K]) => setCreateForm((current) => ({ ...current, [key]: value }));
  const setEdit = <K extends keyof SeasonFormState>(key: K, value: SeasonFormState[K]) => setEditForm((current) => ({ ...current, [key]: value }));
  const toggleTeam = (id: string, current: string[], setter: (next: string[]) => void) => setter(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const payload = (form: SeasonFormState, teamIds: string[]): SeasonWrite => ({
    seasonNumber: form.seasonNumber, name: form.name.trim(), year: form.year,
    startDate: form.startDate || null, endDate: form.endDate || null, timeZone: "Asia/Kolkata",
    groupStageEnabled: form.groupStageEnabled,
    auctionSettings: {
      currency: "INR", budgetPerTeam: form.budgetPerTeam, playersCount: form.playersCount,
      seasonTeamCount: form.seasonTeamCount, teamSquadSize: form.teamSquadSize,
      iconPlayerLimit: form.iconPlayerLimit, goalkeeperLimit: form.goalkeeperLimit,
    },
    pointsRules: { win: form.win, draw: form.draw, loss: form.loss },
    standingsTieBreakers: form.standingsTieBreakers,
    matchRules: {
      groupStageDrawAllowed: form.groupStageDrawAllowed, knockoutDrawRequiresShootout: form.knockoutDrawRequiresShootout,
      shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false,
    },
    teamIds,
  });

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createForm.endDate && createForm.startDate && createForm.endDate < createForm.startDate) {
      toast.error("End date must be on or after start date"); return;
    }
    if (createForm.iconPlayerLimit > createForm.teamSquadSize || createForm.goalkeeperLimit > createForm.teamSquadSize) {
      toast.error("Player limits cannot exceed the team squad size"); return;
    }
    setSaving(true);
    try {
      const result = await createSeason(payload(createForm, initialTeamIds));
      toast.success("Draft season created");
      setSelectedSeasonId(result.data._id); setInitialTeamIds([]);
      setCreateForm(defaultForm((seasons.data?.data.reduce((max, season) => Math.max(max, season.seasonNumber), 0) ?? 0) + 2));
      refreshSelected(); seasons.reload();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    if (editForm.endDate && editForm.startDate && editForm.endDate < editForm.startDate) { toast.error("End date must be on or after start date"); return; }
    setSaving(true);
    const patch: SeasonPatch = {
      name: editForm.name.trim(), year: editForm.year, startDate: editForm.startDate || null, endDate: editForm.endDate || null,
      groupStageEnabled: editForm.groupStageEnabled,
      ...(identityLocked ? {} : { seasonNumber: editForm.seasonNumber }),
      ...(!auctionRulesLocked ? { auctionSettings: payload(editForm, []).auctionSettings } : {}),
      ...(!matchRulesLocked ? {
        pointsRules: { win: editForm.win, draw: editForm.draw, loss: editForm.loss },
        standingsTieBreakers: editForm.standingsTieBreakers,
        matchRules: {
          groupStageDrawAllowed: editForm.groupStageDrawAllowed, knockoutDrawRequiresShootout: editForm.knockoutDrawRequiresShootout,
          shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false,
        },
      } : {}),
    };
    try { await updateSeason(selected._id, patch); toast.success("Season configuration saved"); refreshSelected(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const runLifecycle = async (action: "upcoming" | "draft" | "active" | "complete" | "archive") => {
    if (!selected) return;
    const labels = { upcoming: "Move to Upcoming", draft: "Return to Draft", active: "Activate Season", complete: "Complete Season", archive: "Archive Season" };
    const messages = {
      upcoming: "The backend will validate the registered teams, groups and season rules before moving this Draft season to Upcoming.",
      draft: "Return this Upcoming season to Draft? This is only allowed before auction or fixture activity.",
      active: "Activate this season? Team registration and ordinary group changes will be frozen.",
      complete: "Complete this season? The backend will verify all fixtures, the final winner and auction closure.",
      archive: "Archive this completed season? It will remain available for historical viewing and become permanently read-only.",
    };
    const yes = await confirm({ title: labels[action], description: messages[action], confirmLabel: labels[action], danger: action === "complete" || action === "archive" });
    if (!yes) return;
    setSaving(true);
    try {
      if (action === "complete") await completeSeason(selected._id);
      else if (action === "archive") await archiveSeason(selected._id);
      else await transitionSeason(selected._id, action);
      toast.success(labels[action] + " successful"); refreshSelected();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const removeSelectedSeason = async () => {
    if (!selected) return;
    const yes = await confirm({
      title: "Delete empty Draft season?",
      description: "Only a Draft season with no registered teams, groups, auction lots, fixtures or other linked records can be permanently deleted. No dependent or historical data will be removed.",
      confirmLabel: "Delete season", danger: true,
    });
    if (!yes) return;
    setSaving(true);
    try { await deleteSeason(selected._id); toast.success("Empty Draft season deleted"); setSelectedSeasonId(""); seasons.reload(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const registerTeams = async () => {
    if (!selected || !registrationIds.length) return;
    setSaving(true);
    try { await registerSeasonTeams(selected._id, registrationIds); toast.success("Teams registered"); setRegistrationIds([]); refreshSelected(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const changeGroupAssignment = async (team: SeasonTeam, groupId: string) => {
    if (!selected) return;
    setSaving(true);
    try { await updateSeasonTeam(selected._id, team._id, { groupId: groupId || null }); toast.success("Group assignment updated"); refreshSelected(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected || !newGroupName.trim()) return;
    setSaving(true);
    try { await createSeasonGroup(selected._id, { groupName: newGroupName.trim(), displayOrder: newGroupOrder }); toast.success("Group created"); setNewGroupName(""); setNewGroupOrder(seasonGroups.length + 1); groups.reload(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const saveGroup = async (group: SeasonGroup) => {
    if (!selected) return;
    const draft = groupDrafts[group._id]; if (!draft) return;
    setSaving(true);
    try { await updateSeasonGroup(selected._id, group._id, draft); toast.success("Group updated"); setGroupDrafts((current) => { const next = { ...current }; delete next[group._id]; return next; }); groups.reload(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const removeGroup = async (group: SeasonGroup) => {
    if (!selected) return;
    const yes = await confirm({ title: "Delete unused group?", description: "A group can be deleted only when no SeasonTeam or fixture references it. No team or match history will be deleted.", confirmLabel: "Delete group", danger: true });
    if (!yes) return;
    setSaving(true);
    try { await deleteSeasonGroup(selected._id, group._id); toast.success("Group deleted"); refreshSelected(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const manageSeasonTeam = async (team: SeasonTeam, action: "remove" | "withdraw") => {
    if (!selected) return;
    const yes = await confirm({
      title: action === "remove" ? "Remove unused registration?" : "Withdraw this team?",
      description: action === "remove"
        ? "This permanently removes only the unused SeasonTeam registration. Teams with auction or fixture history cannot be deleted."
        : "Withdrawal preserves auction and match history. The backend will reject a live match and cancel unresolved future fixtures with an audit note.",
      confirmLabel: action === "remove" ? "Remove registration" : "Withdraw team", danger: true,
    });
    if (!yes) return;
    setSaving(true);
    try {
      if (action === "remove") await removeSeasonTeam(selected._id, team._id);
      else await withdrawSeasonTeam(selected._id, team._id);
      toast.success(action === "remove" ? "Registration removed" : "Team withdrawn");
      refreshSelected();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const filteredSeasons = (seasons.data?.data ?? []).filter((season) => {
    const matchSearch = !search.trim() || season.name.toLowerCase().includes(search.trim().toLowerCase()) || String(season.seasonNumber).includes(search.trim());
    const matchYear = yearFilter === "all" || String(season.year) === yearFilter;
    const matchStatus = statusFilter === "all" || season.status === statusFilter;
    return matchSearch && matchYear && matchStatus;
  });
  const years = [...new Set((seasons.data?.data ?? []).map((season) => season.year))].sort((a, b) => b - a);

  return (
    <PageContainer>
      <PageHeader eyebrow="Admin · tournament setup" title="Season management" description="Manage each tournament edition, its rules, participating teams, season groups and lifecycle. Season data remains isolated from permanent Team records." />
      {seasons.loading ? <Skeleton className="h-32" /> : null}
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}

      <GlassCard className="mb-5 p-5">
        <h2 className="mb-3 font-display text-2xl text-fg">Season list</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input aria-label="Search seasons" placeholder="Search season name or edition…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select aria-label="Filter by year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
          <Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSeasons.map((season) => (
            <button type="button" key={season._id} onClick={() => setSelectedSeasonId(season._id)}
              className={"rounded-xl border p-3 text-left transition " + (selectedSeasonId === season._id ? "border-accent bg-surface" : "border-line hover:border-accent")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-fg">{season.name}</span>
                <span className="rounded-full bg-surface px-2 py-1 text-xs text-muted">{statusLabel(season.status)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">Edition {season.seasonNumber} · {season.year}</p>
            </button>
          ))}
          {!filteredSeasons.length ? <p className="text-sm text-muted">No seasons match the selected filters.</p> : null}
        </div>
      </GlassCard>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="mb-4 font-display text-2xl text-fg">Create a season</h2>
          <form className="grid gap-3" onSubmit={handleCreate}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-fg">Edition number<Input className="mt-1" type="number" min="1" max="999" required value={createForm.seasonNumber} onChange={(e) => setCreate("seasonNumber", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Year<Input className="mt-1" type="number" min="2000" max="2200" required value={createForm.year} onChange={(e) => setCreate("year", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Season name<Input className="mt-1" required minLength={2} maxLength={100} value={createForm.name} onChange={(e) => setCreate("name", e.target.value)} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-fg">Start date<Input className="mt-1" type="date" value={createForm.startDate} onChange={(e) => setCreate("startDate", e.target.value)} /></label>
              <label className="text-sm text-fg">End date<Input className="mt-1" type="date" value={createForm.endDate} onChange={(e) => setCreate("endDate", e.target.value)} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={createForm.groupStageEnabled} onChange={(e) => setCreate("groupStageEnabled", e.target.checked)} /> Group stage enabled</label>
            <h3 className="mt-2 font-semibold text-fg">Auction settings</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-fg">Budget (INR)<Input className="mt-1" type="number" min="0" required value={createForm.budgetPerTeam} onChange={(e) => setCreate("budgetPerTeam", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Player nominations<Input className="mt-1" type="number" min="1" required value={createForm.playersCount} onChange={(e) => setCreate("playersCount", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Team limit<Input className="mt-1" type="number" min="2" required value={createForm.seasonTeamCount} onChange={(e) => setCreate("seasonTeamCount", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Squad size<Input className="mt-1" type="number" min="1" required value={createForm.teamSquadSize} onChange={(e) => setCreate("teamSquadSize", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Icon player limit<Input className="mt-1" type="number" min="0" required value={createForm.iconPlayerLimit} onChange={(e) => setCreate("iconPlayerLimit", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Goalkeeper limit<Input className="mt-1" type="number" min="0" required value={createForm.goalkeeperLimit} onChange={(e) => setCreate("goalkeeperLimit", Number(e.target.value))} /></label>
            </div>
            <h3 className="mt-2 font-semibold text-fg">Points and match rules</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-fg">Win points<Input className="mt-1" type="number" min="0" value={createForm.win} onChange={(e) => setCreate("win", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Draw points<Input className="mt-1" type="number" min="0" value={createForm.draw} onChange={(e) => setCreate("draw", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Loss points<Input className="mt-1" type="number" min="0" value={createForm.loss} onChange={(e) => setCreate("loss", Number(e.target.value))} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={createForm.groupStageDrawAllowed} onChange={(e) => setCreate("groupStageDrawAllowed", e.target.checked)} /> Allow draws in group-stage matches</label>
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={createForm.knockoutDrawRequiresShootout} onChange={(e) => setCreate("knockoutDrawRequiresShootout", e.target.checked)} /> Require shootout for tied knockout matches</label>
            <div className="mt-2">
              <h3 className="mb-2 font-semibold text-fg">Initial participating teams (optional)</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {permanentTeams.data?.data.filter((team) => team.status === "active").map((team) => (
                  <label key={team._id} className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm text-fg">
                    <input type="checkbox" checked={initialTeamIds.includes(team._id)} disabled={!initialTeamIds.includes(team._id) && initialTeamIds.length >= createForm.seasonTeamCount} onChange={() => toggleTeam(team._id, initialTeamIds, setInitialTeamIds)} />{team.name}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">{initialTeamIds.length} selected · a Draft season may also be created with no teams</p>
            </div>
            <Button type="submit" disabled={saving || !createForm.name.trim() || initialTeamIds.length > createForm.seasonTeamCount || createForm.iconPlayerLimit > createForm.teamSquadSize || createForm.goalkeeperLimit > createForm.teamSquadSize}>Create Draft season</Button>
          </form>
        </GlassCard>

        {selected ? (
          <div className="grid gap-5">
            <GlassCard className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className="font-display text-2xl text-fg">{selected.name}</h2><p className="text-sm text-muted">Edition {selected.seasonNumber} · {selected.year} · {statusLabel(selected.status)}</p></div>
                <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">{selected.status === "active" ? "Current Active Season" : "Season workspace"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.status === "draft" ? <Button size="sm" disabled={saving} onClick={() => void runLifecycle("upcoming")}>Move to Upcoming</Button> : null}
                {selected.status === "upcoming" ? <><Button size="sm" disabled={saving} onClick={() => void runLifecycle("draft")} variant="surface">Return to Draft</Button><Button size="sm" disabled={saving} onClick={() => void runLifecycle("active")}>Activate Season</Button></> : null}
                {selected.status === "active" ? <Button size="sm" disabled={saving} variant="danger" onClick={() => void runLifecycle("complete")}>Complete Season</Button> : null}
                {selected.status === "completed" ? <Button size="sm" disabled={saving} onClick={() => void runLifecycle("archive")}>Archive Season</Button> : null}
                {selected.status === "draft" ? <Button size="sm" disabled={saving || dependenciesExist} variant="danger" onClick={() => void removeSelectedSeason()}>Delete empty Draft</Button> : null}
              </div>
              {selected.status === "draft" && dependenciesExist ? <p className="mt-2 text-xs text-muted">Deletion is disabled because this Draft season has linked teams, groups, auction lots or fixtures. Remove only unused setup records first.</p> : null}
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="mb-3 font-display text-xl text-fg">Edit season configuration</h3>
              <form className="grid gap-3" onSubmit={handleEdit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-fg">Season number<Input type="number" min="1" max="999" value={editForm.seasonNumber} disabled={identityLocked} onChange={(e) => setEdit("seasonNumber", Number(e.target.value))} /></label>
                  <label className="text-sm text-fg">Year<Input type="number" min="2000" max="2200" value={editForm.year} disabled={identityLocked} onChange={(e) => setEdit("year", Number(e.target.value))} /></label>
                </div>
                {identityLocked ? <p className="text-xs text-muted">Season number and year are locked after the season leaves Draft or dependent setup records exist.</p> : null}
                <label className="text-sm text-fg">Season name<Input value={editForm.name} disabled={!editable} onChange={(e) => setEdit("name", e.target.value)} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-fg">Start date<Input type="date" value={editForm.startDate} disabled={!editable} onChange={(e) => setEdit("startDate", e.target.value)} /></label>
                  <label className="text-sm text-fg">End date<Input type="date" value={editForm.endDate} disabled={!editable} onChange={(e) => setEdit("endDate", e.target.value)} /></label>
                </div>
                <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={editForm.groupStageEnabled} disabled={matchRulesLocked} onChange={(e) => setEdit("groupStageEnabled", e.target.checked)} /> Group stage enabled</label>
                <p className="mt-1 text-sm font-semibold text-fg">Auction settings</p>
                {auctionRulesLocked ? <p className="text-xs text-muted">Auction fields are locked because at least one AuctionLot exists in this season (including pending or unsold lots).</p> : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ["budgetPerTeam","Budget (INR)"],["playersCount","Player nominations"],["seasonTeamCount","Team limit"],
                    ["teamSquadSize","Squad size"],["iconPlayerLimit","Icon player limit"],["goalkeeperLimit","Goalkeeper limit"],
                  ] as const).map(([key,label]) => <label key={key} className="text-sm text-fg">{label}<Input className="mt-1" type="number" min="0" value={editForm[key]} disabled={auctionRulesLocked} onChange={(e) => setEdit(key, Number(e.target.value))} /></label>)}
                </div>
                <p className="mt-1 text-sm font-semibold text-fg">Points, standings and match rules</p>
                {matchRulesLocked ? <p className="text-xs text-muted">Points, tiebreaker, match and group-stage rules are locked because fixtures already exist.</p> : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-sm text-fg">Win points<Input className="mt-1" type="number" min="0" value={editForm.win} disabled={matchRulesLocked} onChange={(e) => setEdit("win", Number(e.target.value))} /></label>
                  <label className="text-sm text-fg">Draw points<Input className="mt-1" type="number" min="0" value={editForm.draw} disabled={matchRulesLocked} onChange={(e) => setEdit("draw", Number(e.target.value))} /></label>
                  <label className="text-sm text-fg">Loss points<Input className="mt-1" type="number" min="0" value={editForm.loss} disabled={matchRulesLocked} onChange={(e) => setEdit("loss", Number(e.target.value))} /></label>
                </div>
                <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={editForm.groupStageDrawAllowed} disabled={matchRulesLocked} onChange={(e) => setEdit("groupStageDrawAllowed", e.target.checked)} /> Allow group-stage draws</label>
                <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={editForm.knockoutDrawRequiresShootout} disabled={matchRulesLocked} onChange={(e) => setEdit("knockoutDrawRequiresShootout", e.target.checked)} /> Require knockout shootout</label>
                <Button type="submit" disabled={saving || !editable}>Save configuration</Button>
              </form>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="mb-3 font-display text-xl text-fg">Participating teams</h3>
              <p className="mb-3 text-xs text-muted">Permanent Teams stay separate. Registration is available in Draft and Upcoming; it freezes when the season becomes Active.</p>
              {seasonTeams.loading ? <Skeleton className="h-20" /> : null}
              {seasonTeams.error ? <ErrorState message={seasonTeams.error} onRetry={seasonTeams.reload} /> : null}
              <div className="space-y-2">
                {registeredTeams.map((team) => {
                  const linked = seasonLots.some((lot) => typeof lot.seasonTeamRef === "object" && lot.seasonTeamRef?._id === team._id) || seasonFixtures.some((match) => {
                    const home = typeof match.homeSeasonTeamRef === "object" ? match.homeSeasonTeamRef._id : match.homeSeasonTeamRef;
                    const away = typeof match.awaySeasonTeamRef === "object" ? match.awaySeasonTeamRef._id : match.awaySeasonTeamRef;
                    return home === team._id || away === team._id;
                  });
                  return <div key={team._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3 text-sm">
                    <div><p className="font-medium text-fg">{team.displayName}</p><p className="text-xs text-muted">{team.group?.groupName ?? "No group"} · {team.managers.length} manager(s) · {team.status}</p></div>
                    <div className="flex items-center gap-2">
                      <Select className="max-w-40" value={team.groupRef ?? ""} disabled={!preActivation || hasFixtures || team.status === "withdrawn"} onChange={(e) => void changeGroupAssignment(team, e.target.value)}>
                        <option value="">Unassigned group</option>{seasonGroups.map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
                      </Select>
                      {preActivation && team.status !== "withdrawn" ? <Button size="sm" variant="danger" disabled={saving || linked} onClick={() => void manageSeasonTeam(team,"remove")}>Remove</Button> : null}
                      {selected.status === "active" && team.status !== "withdrawn" ? <Button size="sm" variant="danger" disabled={saving} onClick={() => void manageSeasonTeam(team,"withdraw")}>Withdraw</Button> : null}
                    </div>
                  </div>;
                })}
                {!registeredTeams.length ? <p className="text-sm text-muted">No teams are registered in this season yet.</p> : null}
              </div>
              {preActivation ? <div className="mt-4">
                <h4 className="mb-2 font-semibold text-fg">Register teams</h4>
                <div className="grid gap-2 sm:grid-cols-2">{permanentTeams.data?.data.filter((team) => team.status === "active" && !registeredTeamIds.has(team._id)).map((team) => <label key={team._id} className="flex items-center gap-2 rounded-xl border border-line p-2 text-sm text-fg"><input type="checkbox" checked={registrationIds.includes(team._id)} onChange={() => toggleTeam(team._id,registrationIds,setRegistrationIds)} />{team.name}</label>)}</div>
                <Button className="mt-3" size="sm" disabled={saving || !registrationIds.length || registeredTeams.length + registrationIds.length > (selected.auctionSettings?.seasonTeamCount ?? 0)} onClick={() => void registerTeams()}>Register selected teams</Button>
              </div> : null}
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="mb-3 font-display text-xl text-fg">Season groups</h3>
              <p className="mb-3 text-xs text-muted">Groups belong to this Season only. Assign participants before creating group-stage fixtures. Group names can be reused in other seasons.</p>
              {preActivation && !hasFixtures ? <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_7rem_auto]" onSubmit={createGroup}>
                <Input aria-label="New group name" placeholder="Group A" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                <Input aria-label="Display order" type="number" min="0" value={newGroupOrder} onChange={(e) => setNewGroupOrder(Number(e.target.value))} />
                <Button type="submit" size="sm" disabled={saving || !newGroupName.trim()}>Add group</Button>
              </form> : <p className="mb-3 text-xs text-muted">Group creation and editing are frozen after activation or fixture creation.</p>}
              <div className="space-y-2">
                {seasonGroups.map((group) => {
                  const draft = groupDrafts[group._id] ?? { groupName: group.groupName, displayOrder: group.displayOrder };
                  const assignedCount = registeredTeams.filter((team) => team.groupRef === group._id).length;
                  return <div key={group._id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_7rem_auto_auto]">
                    <Input aria-label={group.groupName + " name"} value={draft.groupName} disabled={!preActivation || hasFixtures} onChange={(e) => setGroupDrafts((current) => ({...current,[group._id]:{...draft,groupName:e.target.value}}))} />
                    <Input aria-label={group.groupName + " order"} type="number" min="0" value={draft.displayOrder} disabled={!preActivation || hasFixtures} onChange={(e) => setGroupDrafts((current) => ({...current,[group._id]:{...draft,displayOrder:Number(e.target.value)}}))} />
                    <Button size="sm" variant="surface" disabled={saving || !preActivation || hasFixtures} onClick={() => void saveGroup(group)}>Save</Button>
                    <Button size="sm" variant="danger" disabled={saving || assignedCount > 0 || hasFixtures} onClick={() => void removeGroup(group)}>Delete</Button>
                    <p className="text-xs text-muted sm:col-span-4">{assignedCount} team(s) assigned</p>
                  </div>;
                })}
                {!seasonGroups.length ? <p className="text-sm text-muted">No groups created for this season.</p> : null}
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="mb-2 font-display text-xl text-fg">Dependency and lock summary</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted">SeasonTeams</p><p className="font-semibold text-fg">{registeredTeams.length}</p></div>
                <div><p className="text-muted">Groups</p><p className="font-semibold text-fg">{seasonGroups.length}</p></div>
                <div><p className="text-muted">AuctionLots</p><p className="font-semibold text-fg">{seasonLots.length}</p></div>
                <div><p className="text-muted">Fixtures</p><p className="font-semibold text-fg">{seasonFixtures.length}</p></div>
              </div>
              <p className="mt-3 text-xs text-muted">Auction rules lock on the first AuctionLot. Points, tiebreakers, match rules and group format lock on the first fixture. Completed and Archived seasons are read-only; Archived seasons are never deletable.</p>
            </GlassCard>
          </div>
        ) : (
          <GlassCard className="p-5"><h2 className="font-display text-2xl text-fg">Season workspace</h2><p className="mt-2 text-sm text-muted">Select an existing season above, or create a new Draft season.</p></GlassCard>
        )}
      </div>
    </PageContainer>
  );
}

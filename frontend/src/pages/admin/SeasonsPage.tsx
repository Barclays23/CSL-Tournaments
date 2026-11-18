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
import { getManagers } from "@/services/managerService";
import { getSeasonAwards, createSeasonAward, updateSeasonAward, deleteSeasonAward } from "@/services/seasonAwardService";
import {
  archiveSeason, completeSeason, createSeason, deleteSeason, getAuctionLots,
  getSeasonTeams, getSeasons, registerSeasonTeams, removeSeasonTeam,
  transitionSeason, updateSeason, updateSeasonTeam, withdrawSeasonTeam, recallSeasonTeam,
} from "@/services/seasonService";
import {
  createSeasonGroup, deleteSeasonGroup, getSeasonGroups, getSeasonMatches, updateSeasonGroup,
} from "@/services/seasonMatchService";
import { errorMessage } from "@/utils/errorHandler";
import type { Season, SeasonPatch, SeasonStatus, SeasonWrite, SeasonTeam } from "@/types/season.types";
import type { SeasonGroup } from "@/types/seasonMatch.types";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CalendarDays, Layers3, Plus, Settings2, ShieldCheck, Trophy, Users } from "lucide-react";

type SeasonFormState = {
  seasonNumber: number; name: string; year: number; startDate: string; endDate: string; groupStageEnabled: boolean; homeAndAwayFixtures: boolean;
  budgetPerTeam: number; playersCount: number; seasonTeamCount: number; teamSquadSize: number; iconPlayerLimit: number; goalkeeperLimit: number;
  win: number; draw: number; loss: number; groupStageDrawAllowed: boolean; knockoutDrawRequiresShootout: boolean;
  standingsTieBreakers: Array<"points" | "goalDifference" | "goalsScored" | "teamNameAsc">;
};
const defaultForm = (seasonNumber = 1): SeasonFormState => ({
  seasonNumber, name: "", year: new Date().getFullYear(), startDate: "", endDate: "", groupStageEnabled: true, homeAndAwayFixtures: false,
  budgetPerTeam: 10000, playersCount: 54, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1,
  win: 3, draw: 1, loss: 0, groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true,
  standingsTieBreakers: ["points", "goalDifference", "goalsScored", "teamNameAsc"],
});
const toDateInput = (value: string | null | undefined) => value ? value.slice(0, 10) : "";
const fromSeason = (season: Season): SeasonFormState => ({
  ...defaultForm(season.seasonNumber),
  name: season.name, year: season.year, startDate: toDateInput(season.startDate), endDate: toDateInput(season.endDate),
  groupStageEnabled: season.groupStageEnabled ?? true,
  homeAndAwayFixtures: season.homeAndAwayFixtures ?? false,
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
const TIE_BREAKER_LABELS: Record<"points" | "goalDifference" | "goalsScored" | "teamNameAsc", string> = {
  points: "Points",
  goalDifference: "Goal difference",
  goalsScored: "Goals scored",
  teamNameAsc: "Team name (A–Z)",
};
const formatInr = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
}).format(value);

function ConfigurationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right text-xs font-semibold text-fg">{value}</span>
    </div>
  );
}

const statuses: SeasonStatus[] = ["draft", "upcoming", "active", "completed", "archived"];
const statusLabel = (status: SeasonStatus) => status.charAt(0).toUpperCase() + status.slice(1);

export function SeasonsPage() {
  return <AdminRoute><SeasonsBody /></AdminRoute>;
}

function SeasonsBody() {
  const confirm = useConfirm();
  const seasons = useServiceQuery(() => getSeasons(), []);
  const permanentTeams = useServiceQuery(() => getTeams(), []);
  const managersQuery = useServiceQuery(() => getManagers({page:1,limit:100,status:"active"}), []);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SeasonFormState>(() => defaultForm());
  const [editForm, setEditForm] = useState<SeasonFormState>(() => defaultForm());
  const [initialTeamIds, setInitialTeamIds] = useState<string[]>([]);
  const [registrationIds, setRegistrationIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOrder, setNewGroupOrder] = useState(1);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { groupName: string; displayOrder: number }>>({});
  const [saving, setSaving] = useState(false);
  const [optionalAwardType, setOptionalAwardType] = useState<"golden_boot"|"golden_glove"|"player_of_the_season"|"best_young_player"|"best_defender"|"best_midfielder">("golden_boot");
  const [optionalAwardLotId, setOptionalAwardLotId] = useState("");
  const [optionalAwardLotIds, setOptionalAwardLotIds] = useState<string[]>([]);
  const [completionBlockers, setCompletionBlockers] = useState<string[]>([]);

  useEffect(() => {
    const list = seasons.data?.data ?? [];
    if (!selectedSeasonId && list.length) {
      const chosen = list.find((season) => season.status === "active") ?? list[0];
      // The selected season is derived from asynchronously loaded server data.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedSeasonId(chosen._id);
    }
  }, [selectedSeasonId, seasons.data]);

  const selected = seasons.data?.data.find((season) => season._id === selectedSeasonId) ?? null;
  useEffect(() => {
    // Group edit drafts and form values belong to one selected season only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroupDrafts({});
    setNewGroupName("");
    setNewGroupOrder(1);
  }, [selectedSeasonId]);
  useEffect(() => {
    // Reset the edit draft when the server record changes or another season is selected.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    () => selectedSeasonId ? getSeasonMatches(selectedSeasonId, { page: 1, limit: 100 }) : Promise.resolve({
      success: true,
      message: "No season selected",
      data: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    } as Awaited<ReturnType<typeof getSeasonMatches>>),
    [selectedSeasonId],
  );
  const awardsQuery = useServiceQuery(() => selectedSeasonId ? getSeasonAwards(selectedSeasonId) : Promise.resolve({success:true,message:"",data:[]} as Awaited<ReturnType<typeof getSeasonAwards>>), [selectedSeasonId]);
  const lots = useServiceQuery(
    () => selectedSeasonId ? getAuctionLots({ seasonId: selectedSeasonId }) : Promise.resolve({ success: true, message: "", data: [] } as Awaited<ReturnType<typeof getAuctionLots>>),
    [selectedSeasonId],
  );

  const registeredTeams = (seasonTeams.data?.data ?? []).filter((team) => team.seasonRef === selectedSeasonId);
  const seasonGroups = useMemo(() => {
    const currentSeasonGroups = (groups.data?.data ?? []).filter((group) => group.seasonRef === selectedSeasonId);
    return Array.from(new Map(currentSeasonGroups.map((group) => [group._id, group])).values())
      .sort((a, b) => a.displayOrder - b.displayOrder || a.groupName.localeCompare(b.groupName) || a._id.localeCompare(b._id));
  }, [groups.data, selectedSeasonId]);
  useEffect(() => {
    if (groups.loading || groups.error || !groups.data) return;
    const maxOrder = seasonGroups.reduce((max, group) => Math.max(max, group.displayOrder), 0);
    // Suggest a useful next value without making the user choose it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewGroupOrder((current) => Math.max(current, maxOrder + 1));
  }, [groups.loading, groups.error, groups.data, seasonGroups]);
  const seasonFixtures = fixtures.data?.data ?? [];
  const seasonLots = lots.data?.data ?? [];
  const seasonAwards = Array.isArray(awardsQuery.data?.data) ? awardsQuery.data.data.filter((award) => award && Array.isArray(award.recipients)) : [];
  const registeredTeamIds = useMemo(() => new Set(registeredTeams.map((item) => item.teamRef)), [registeredTeams]);
  const awardReadinessBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (seasonFixtures.length === 0) blockers.push("Create fixtures before assigning honours");
    for (const match of seasonFixtures) {
      if (["live", "scheduled", "postponed", "abandoned"].includes(match.status)) blockers.push("Match " + match.matchNumber + " is " + match.status);
      if (match.status === "cancelled" && !match.resolutionHistory?.some((entry) => entry.status === "cancelled" && entry.reason.trim().length >= 3 && Boolean(entry.decidedAt))) blockers.push("Match " + match.matchNumber + " needs an audited cancellation reason");
      if (match.status === "completed" && match.stage !== "group") {
        const home = typeof match.homeSeasonTeamRef === "object" ? match.homeSeasonTeamRef._id : match.homeSeasonTeamRef;
        const away = typeof match.awaySeasonTeamRef === "object" ? match.awaySeasonTeamRef._id : match.awaySeasonTeamRef;
        const winner = typeof match.winnerSeasonTeamRef === "object" ? match.winnerSeasonTeamRef._id : match.winnerSeasonTeamRef;
        if (!winner || (winner !== home && winner !== away)) blockers.push("Knockout match " + match.matchNumber + " has no valid winner");
      }
    }
    const pendingLots = seasonLots.filter((lot) => lot.auctionStatus === "pending").length;
    if (pendingLots) blockers.push(pendingLots + " pending auction lot(s) remain");
    return blockers;
  }, [seasonFixtures, seasonLots]);
  const awardsEditable = selected?.status === "active" && awardReadinessBlockers.length === 0;

  const fixtureCount = fixtures.data?.pagination?.total ?? seasonFixtures.length;
  const dependenciesExist = registeredTeams.length + seasonGroups.length + seasonLots.length + fixtureCount > 0;
  const hasAuctionHistory = seasonLots.length > 0;
  const hasFixtures = fixtureCount > 0;
  const preActivation = selected ? ["draft", "upcoming"].includes(selected.status) : false;
  const editable = preActivation && selected?.status !== "completed" && selected?.status !== "archived";
  const identityLocked = !selected || selected.status !== "draft" || dependenciesExist;
  const matchRulesLocked = hasFixtures || !editable;
  const auctionRulesLocked = hasAuctionHistory || !editable;
  const refreshSelected = () => { seasons.reload(); seasonTeams.reload(); groups.reload(); fixtures.reload(); lots.reload(); awardsQuery.reload(); };
  const setCreate = <K extends keyof SeasonFormState>(key: K, value: SeasonFormState[K]) => setCreateForm((current) => ({ ...current, [key]: value }));
  const setEdit = <K extends keyof SeasonFormState>(key: K, value: SeasonFormState[K]) => setEditForm((current) => ({ ...current, [key]: value }));
  const toggleTeam = (id: string, current: string[], setter: (next: string[]) => void) => setter(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const payload = (form: SeasonFormState, teamIds: string[]): SeasonWrite => ({
    seasonNumber: form.seasonNumber, name: form.name.trim(), year: form.year,
    startDate: form.startDate || null, endDate: form.endDate || null, timeZone: "Asia/Kolkata",
    groupStageEnabled: form.groupStageEnabled,
    homeAndAwayFixtures: form.homeAndAwayFixtures,
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
      setCreateOpen(false);
      setCreateForm(defaultForm((seasons.data?.data.reduce((max, season) => Math.max(max, season.seasonNumber), 0) ?? 0) + 1));
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
      ...(editForm.name.trim() !== selected.name ? { name: editForm.name.trim() } : {}), startDate: editForm.startDate || null, endDate: editForm.endDate || null,
      ...(identityLocked ? {} : { ...(editForm.seasonNumber !== selected.seasonNumber ? { seasonNumber: editForm.seasonNumber } : {}), ...(editForm.year !== selected.year ? { year: editForm.year } : {}) }),
      ...(!matchRulesLocked ? { groupStageEnabled: editForm.groupStageEnabled } : {}),
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
    try { await updateSeason(selected._id, patch); toast.success("Season configuration saved"); setEditOpen(false); refreshSelected(); }
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
      complete: "Complete this season? The backend will verify all matches, knockout winners, auction closure, Champion and Runner-up. A Final fixture is not required.",
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
    } catch (error) {
      toast.error(errorMessage(error));
      const response = (error as { response?: { data?: { fieldErrors?: Record<string,string> } } }).response?.data;
      setCompletionBlockers(Object.values(response?.fieldErrors ?? {}).filter((value): value is string => typeof value === "string"));
    } finally { setSaving(false); }
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

  const assignManagers = async (team: SeasonTeam, managerIds: string[]) => {
    if (!selected) return; setSaving(true);
    try { await updateSeasonTeam(selected._id, team._id, { managerIds }); toast.success("Managers updated"); seasonTeams.reload(); }
    catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };

  const assignOptionalAward = async () => {
    if (!selected || !optionalAwardLotIds.length) return;
    const selectedLots = seasonLots.filter((lot) => optionalAwardLotIds.includes(lot._id));
    if (!selectedLots.length || selectedLots.some((lot) => typeof lot.playerRef !== "object" || !lot.seasonTeamRef || typeof lot.seasonTeamRef !== "object")) { toast.error("Select sold player lots"); return; }
    const existing = seasonAwards.find((award) => award.awardType === optionalAwardType);
    const recipients = selectedLots.map((lot) => ({ seasonTeamId: (lot.seasonTeamRef as { _id:string })._id, playerId: (lot.playerRef as { _id:string })._id }));
    setSaving(true);
    try {
      if (existing) await updateSeasonAward(selected._id, existing._id, { recipients });
      else await createSeasonAward(selected._id, { awardType: optionalAwardType, recipients });
      toast.success("Optional award saved"); setOptionalAwardLotIds([]); setOptionalAwardLotId(""); awardsQuery.reload();
    } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };

  const assignTeamAward = async (awardType: "champions" | "runner_up", seasonTeamId: string) => {
    if (!selected || !seasonTeamId) return; setSaving(true);
    try {
      const existing = seasonAwards.find((award) => award.awardType === awardType);
      const payload = { awardType, recipients: [{ seasonTeamId }] };
      if (existing) await updateSeasonAward(selected._id, existing._id, { recipients: payload.recipients });
      else await createSeasonAward(selected._id, payload);
      toast.success(awardType === "champions" ? "Champion saved" : "Runner-up saved"); setCompletionBlockers([]); awardsQuery.reload();
    } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };

  const createGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const groupName = newGroupName.trim().replace(/\s+/g, " ");
    if (!groupName) { toast.error("Enter a group name"); return; }
    if (groupName.length > 40) { toast.error("Group name must be 40 characters or fewer"); return; }
    if (!Number.isInteger(newGroupOrder) || newGroupOrder < 0 || newGroupOrder > 1000) {
      toast.error("Display order must be a whole number between 0 and 1000"); return;
    }
    if (!registeredTeams.length) { toast.error("Register participating teams before creating groups"); return; }
    if (selected.groupStageEnabled === false) { toast.error("Groups are disabled for this season"); return; }
    setSaving(true);
    try {
      await createSeasonGroup(selected._id, { groupName, displayOrder: newGroupOrder });
      toast.success("Group created");
      setNewGroupName("");
      setNewGroupOrder(Math.max(newGroupOrder, ...seasonGroups.map((group) => group.displayOrder), 0) + 1);
      groups.reload();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const editGroup = (group: SeasonGroup) => {
    setGroupDrafts((current) => ({ ...current, [group._id]: { groupName: group.groupName, displayOrder: group.displayOrder } }));
  };

  const cancelGroupEdit = (groupId: string) => {
    setGroupDrafts((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });
  };

  const saveGroup = async (group: SeasonGroup) => {
    if (!selected) return;
    const draft = groupDrafts[group._id];
    if (!draft) return;
    const groupName = draft.groupName.trim().replace(/\s+/g, " ");
    if (!groupName) { toast.error("Group name cannot be empty"); return; }
    if (groupName.length > 40) { toast.error("Group name must be 40 characters or fewer"); return; }
    if (!Number.isInteger(draft.displayOrder) || draft.displayOrder < 0 || draft.displayOrder > 1000) {
      toast.error("Display order must be a whole number between 0 and 1000"); return;
    }
    const patch: { groupName?: string; displayOrder?: number } = {};
    if (groupName !== group.groupName) patch.groupName = groupName;
    if (draft.displayOrder !== group.displayOrder) patch.displayOrder = draft.displayOrder;
    if (!Object.keys(patch).length) { toast.info("There are no changes to save"); return; }
    setSaving(true);
    try {
      await updateSeasonGroup(selected._id, group._id, patch);
      toast.success("Group updated");
      cancelGroupEdit(group._id);
      groups.reload();
    } catch (error) { toast.error(errorMessage(error)); }
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

  const manageSeasonTeam = async (team: SeasonTeam, action: "remove" | "withdraw" | "recall") => {
    if (!selected) return;
    const yes = await confirm({
      title: action === "remove" ? "Remove unused registration?" : action === "withdraw" ? "Withdraw this team?" : "Recall this team?",
      description: action === "remove"
        ? "This permanently removes only the unused SeasonTeam registration. Teams with auction or fixture history cannot be deleted."
        : action === "withdraw" ? "Withdrawal is not permanent removal. The SeasonTeam record, auction history and completed match history are preserved. This team cannot participate in future auction sales or fixtures. Finish live matches, reschedule or cancel scheduled/postponed fixtures, and record a reason for every cancelled or abandoned fixture before withdrawing." : "Reinstate this withdrawn team. Its historical auction and completed match records remain unchanged. A recall reason is required, and unresolved fixtures prevent reinstatement.",
      confirmLabel: action === "remove" ? "Remove registration" : action === "withdraw" ? "Withdraw team" : "Recall team", danger: action !== "recall",
    });
    if (!yes) return;
    setSaving(true);
    try {
      if (action === "remove") await removeSeasonTeam(selected._id, team._id);
      else if (action === "withdraw") await withdrawSeasonTeam(selected._id, team._id);
      else {
        const reason = window.prompt("Why is this team being recalled?", "Recalled by tournament administrator after review");
        if (!reason || reason.trim().length < 3) { toast.error("A recall reason of at least 3 characters is required"); return; }
        await recallSeasonTeam(selected._id, team._id, reason.trim());
      }
      toast.success(action === "remove" ? "Registration removed" : action === "withdraw" ? "Team withdrawn" : "Team recalled");
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
      <PageHeader
        eyebrow="Admin · tournament setup"
        title="Seasons"
        description="A dedicated workspace for each tournament edition, from initial setup through completion and archive."
        actions={
          <Button onClick={() => {
            const nextNumber = (seasons.data?.data.reduce((max, season) => Math.max(max, season.seasonNumber), 0) ?? 0) + 1;
            setCreateForm(defaultForm(nextNumber));
            setInitialTeamIds([]);
            setCreateOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Create season
          </Button>
        }
      />
      {seasons.loading ? <Skeleton className="h-32" /> : null}
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}

      <GlassCard className="mb-6 overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your tournament editions</p>
            <h2 className="mt-1 font-display text-2xl text-fg">Season library</h2>
            <p className="mt-1 text-sm text-muted">{seasons.data?.data.length ?? 0} season(s) · Select an edition to manage its setup and history.</p>
          </div>
          <Badge>{filteredSeasons.length} shown</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)]">
          <Input aria-label="Search seasons" placeholder="Search season name or edition…" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select aria-label="Filter by year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
          <Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSeasons.map((season) => (
            <button type="button" key={season._id} onClick={() => setSelectedSeasonId(season._id)}
              className={"group rounded-2xl border p-4 text-left transition duration-200 " + (selectedSeasonId === season._id ? "border-accent bg-primary/10 shadow-glass" : "border-line bg-surface/60 hover:border-accent hover:bg-surface")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + (selectedSeasonId === season._id ? "bg-primary text-primary-fg" : "bg-glass-strong text-accent")}>
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-fg">{season.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Edition {season.seasonNumber} · {season.year}</span>
                  </div>
                </div>
                <Badge tone={season.status === "active" ? "accent" : season.status === "completed" ? "gold" : season.status === "archived" ? "neutral" : "info"}>{statusLabel(season.status)}</Badge>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                <span>{season.startDate ? toDateInput(season.startDate) : "No start date"}</span>
                <span>{season.endDate ? toDateInput(season.endDate) : "No end date"}</span>
              </div>
            </button>
          ))}
          {!filteredSeasons.length ? <p className="text-sm text-muted">No seasons match the selected filters.</p> : null}
        </div>
      </GlassCard>

      <div className="space-y-5">
        {selected ? (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <GlassCard className="p-5 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-accent">
                    <Trophy className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-2xl text-fg sm:text-3xl">{selected.name}</h2>
                      <Badge tone={selected.status === "active" ? "accent" : selected.status === "completed" ? "gold" : selected.status === "archived" ? "neutral" : "info"}>{statusLabel(selected.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">Edition {selected.seasonNumber} · {selected.year}</p>
                    <p className="mt-1 text-xs text-muted">{selected.startDate ? toDateInput(selected.startDate) : "Start date not set"} – {selected.endDate ? toDateInput(selected.endDate) : "End date not set"}</p>
                  </div>
                </div>
                <Button variant="surface" size="sm" disabled={!editable} onClick={() => { setEditForm(fromSeason(selected)); setEditOpen(true); }}>
                  <Settings2 className="h-4 w-4" /> Edit configuration
                </Button>
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl text-fg">Current configuration</h3>
                    <p className="mt-1 text-xs text-muted">Saved rules and limits currently applied to this season.</p>
                  </div>
                  <Badge tone="info">Saved settings</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <section className="rounded-2xl border border-line bg-surface/60 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-accent"><Layers3 className="h-4 w-4" /></span>
                      <h4 className="text-sm font-semibold text-fg">Competition format</h4>
                    </div>
                    <ConfigurationRow label="Group stage" value={selected.groupStageEnabled === false ? "Disabled" : "Enabled"} />
                    <ConfigurationRow label="Fixture pairing" value={selected.homeAndAwayFixtures ? "Home and away" : "One fixture per pair"} />
                    <ConfigurationRow label="Maximum meetings per pair" value={selected.homeAndAwayFixtures ? "2 (reverse home/away)" : "1"} />
                  </section>

                  <section className="rounded-2xl border border-line bg-surface/60 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-accent"><ShieldCheck className="h-4 w-4" /></span>
                      <h4 className="text-sm font-semibold text-fg">Auction settings</h4>
                    </div>
                    {selected.auctionSettings ? (
                      <>
                        <ConfigurationRow label="Budget per team" value={formatInr(selected.auctionSettings.budgetPerTeam)} />
                        <ConfigurationRow label="Player nominations" value={String(selected.auctionSettings.playersCount)} />
                        <ConfigurationRow label="Team limit" value={String(selected.auctionSettings.seasonTeamCount)} />
                        <ConfigurationRow label="Squad size per team" value={String(selected.auctionSettings.teamSquadSize)} />
                        <ConfigurationRow label="Icon player limit" value={String(selected.auctionSettings.iconPlayerLimit)} />
                        <ConfigurationRow label="Goalkeeper limit" value={String(selected.auctionSettings.goalkeeperLimit)} />
                      </>
                    ) : <p className="py-2 text-xs text-muted">Auction settings are not configured for this season.</p>}
                  </section>

                  <section className="rounded-2xl border border-line bg-surface/60 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-accent"><Trophy className="h-4 w-4" /></span>
                      <h4 className="text-sm font-semibold text-fg">Points system</h4>
                    </div>
                    {selected.pointsRules ? (
                      <>
                        <ConfigurationRow label="Win" value={`${selected.pointsRules.win} points`} />
                        <ConfigurationRow label="Draw" value={`${selected.pointsRules.draw} points`} />
                        <ConfigurationRow label="Loss" value={`${selected.pointsRules.loss} points`} />
                      </>
                    ) : <p className="py-2 text-xs text-muted">Points rules are not configured for this season.</p>}
                  </section>

                  <section className="rounded-2xl border border-line bg-surface/60 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-accent"><CalendarDays className="h-4 w-4" /></span>
                      <h4 className="text-sm font-semibold text-fg">Match and standings rules</h4>
                    </div>
                    {selected.matchRules ? (
                      <>
                        <ConfigurationRow label="Group-stage draws" value={selected.matchRules.groupStageDrawAllowed ? "Allowed" : "Not allowed"} />
                        <ConfigurationRow label="Knockout draw" value={selected.matchRules.knockoutDrawRequiresShootout ? "Requires shootout" : "Draw allowed"} />
                        <ConfigurationRow label="Shootout in match score" value={selected.matchRules.shootoutCountsForMatchScore ? "Included" : "Not included"} />
                        <ConfigurationRow label="Shootout in player goals" value={selected.matchRules.shootoutCountsForPlayerGoals ? "Included" : "Not included"} />
                      </>
                    ) : <p className="py-2 text-xs text-muted">Match rules are not configured for this season.</p>}
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="mb-2 text-xs font-semibold text-fg">Standings tiebreaker order</p>
                      {selected.standingsTieBreakers?.length ? (
                        <ol className="space-y-1.5">
                          {selected.standingsTieBreakers.map((rule, index) => (
                            <li key={rule} className="flex items-center gap-2 text-xs text-muted">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface font-semibold tabular text-fg">{index + 1}</span>
                              {TIE_BREAKER_LABELS[rule]}
                            </li>
                          ))}
                        </ol>
                      ) : <p className="text-xs text-muted">No tiebreaker order configured.</p>}
                    </div>
                  </section>
                </div>
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
            <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 lg:col-span-2">
              {[
                { label: "Participating teams", value: registeredTeams.length, icon: Users },
                { label: "Season groups", value: seasonGroups.length, icon: Layers3 },
                { label: "Auction lots", value: seasonLots.length, icon: ShieldCheck },
                { label: "Fixtures", value: fixtureCount, icon: CalendarDays },
              ].map(({ label, value, icon: Icon }) => (
                <GlassCard key={label} className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-accent"><Icon className="h-5 w-5" /></span>
                  <div><p className="text-xs text-muted">{label}</p><p className="mt-0.5 font-display text-2xl text-fg">{value}</p></div>
                </GlassCard>
              ))}
            </div>

            <GlassCard className="p-5 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-accent"><Users className="h-5 w-5" /></span>
                <div><h3 className="font-display text-xl text-fg">Participating teams</h3>
                <p className="mt-1 text-xs text-muted">Season-only registrations, group assignments and managers.</p></div>
              </div>
              <p className="mb-3 text-xs text-muted">Permanent Teams stay separate. Registration is available in Draft and Upcoming; it freezes when the season becomes Active.</p>
              {seasonTeams.loading ? <Skeleton className="h-20" /> : null}              {seasonTeams.error ? <ErrorState message={seasonTeams.error} onRetry={seasonTeams.reload} /> : null}
              {seasonTeams.error ? <ErrorState message={seasonTeams.error} onRetry={seasonTeams.reload} /> : null}
              <div className="space-y-2">
                {registeredTeams.map((team) => {
                  const linked = seasonLots.some((lot) => typeof lot.seasonTeamRef === "object" && lot.seasonTeamRef?._id === team._id) || seasonFixtures.some((match) => {
                    const home = typeof match.homeSeasonTeamRef === "object" ? match.homeSeasonTeamRef._id : match.homeSeasonTeamRef;
                    const away = typeof match.awaySeasonTeamRef === "object" ? match.awaySeasonTeamRef._id : match.awaySeasonTeamRef;
                    return home === team._id || away === team._id;
                  });
                  return <div key={team._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface p-3 text-sm">
                    <div className="min-w-40"><p className="font-medium text-fg">{team.displayName}</p><p className="text-xs text-muted">{team.group?.groupName ?? "No group"} · {team.managers.length} manager(s) · {team.status}</p><div className="mt-1 flex flex-wrap gap-1">{team.managers.map((manager) => <span key={manager._id} className="rounded-full bg-surface px-2 py-1 text-xs text-muted">{manager.name}</span>)}</div></div>
                    <div className="flex items-center gap-2">
                      <select aria-label={"Managers for "+team.displayName} multiple className="min-h-20 max-w-52 rounded-lg border border-line bg-surface p-2 text-xs text-fg" value={team.managerRefs} disabled={saving || !["draft","upcoming","active"].includes(selected.status)} onChange={(event) => void assignManagers(team, Array.from(event.target.selectedOptions).map((option) => option.value))}>{(managersQuery.data?.data ?? []).filter((manager) => manager.status === "active").map((manager) => <option key={manager._id} value={manager._id}>{manager.name}</option>)}</select>
                      <Select className="max-w-40" value={team.groupRef ?? ""} disabled={!preActivation || hasFixtures || team.status === "withdrawn" || selected.groupStageEnabled === false} onChange={(e) => void changeGroupAssignment(team, e.target.value)}>
                        <option value="">Unassigned group</option>{seasonGroups.map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
                      </Select>
                      {preActivation && team.status !== "withdrawn" ? <Button size="sm" variant="danger" disabled={saving || linked} onClick={() => void manageSeasonTeam(team,"remove")}>Remove</Button> : null}
                      {preActivation && linked ? <span className="text-xs text-muted">Has auction/fixture history; use withdrawal only after activation</span> : null}
                      {selected.status === "active" && ["registered","active"].includes(team.status) ? <Button size="sm" variant="danger" disabled={saving} onClick={() => void manageSeasonTeam(team,"withdraw")}>Withdraw</Button> : null}
                       {selected.status === "active" && team.status === "withdrawn" ? <Button size="sm" disabled={saving} onClick={() => void manageSeasonTeam(team,"recall")}>Recall / Reinstate</Button> : null}
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


            <GlassCard className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Season honours</p><h3 className="mt-1 font-display text-2xl text-fg">Achievements & awards</h3><p className="mt-1 max-w-2xl text-sm text-muted">Celebrate the teams and players who defined this season. Champions and Runner-up are required to complete the season; individual awards are optional.</p></div><Badge tone={seasonAwards.some((award)=>award.awardType==="champions")&&seasonAwards.some((award)=>award.awardType==="runner_up")?"gold":"danger"}>{seasonAwards.some((award)=>award.awardType==="champions")&&seasonAwards.some((award)=>award.awardType==="runner_up")?"Team honours complete":"Team honours pending"}</Badge></div>
              {awardsQuery.loading?<div className="mt-4 grid gap-3 sm:grid-cols-2"><Skeleton className="h-24"/><Skeleton className="h-24"/></div>:null}
              {awardsQuery.error?<div className="mt-4"><ErrorState message={awardsQuery.error} onRetry={awardsQuery.reload}/></div>:null}
              {!awardsQuery.loading&&!awardsQuery.error&&awardsQuery.data?<div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">{(["champions","runner_up"] as const).map((type)=>{const award=seasonAwards.find((item)=>item.awardType===type);const chosen=award?.recipients?.[0]?.seasonTeamRef??"";return <div key={type} className="rounded-2xl border border-line bg-surface p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted">{type==="champions"?"Season champions":"Runner-up"}</p>{award?<div className="mt-3 flex items-center gap-3"><img src={award.recipients[0]?.teamLogoSnapshot?.url??"https://placehold.co/96x96?text=CSL"} alt="" className="h-12 w-12 rounded-xl object-cover"/><div className="min-w-0"><p className="truncate font-semibold text-fg">{award.recipients[0]?.displayNameSnapshot??"Team not available"}</p><p className="text-xs text-muted">{award.title}</p></div></div>:<p className="mt-3 text-sm text-muted">Not assigned yet</p>}{awardsEditable?<select aria-label={type==="champions"?"Select champion":"Select runner-up"} className="mt-3 w-full rounded-lg border border-line bg-canvas p-2 text-sm text-fg" value={chosen} disabled={saving} onChange={(event)=>void assignTeamAward(type,event.target.value)}><option value="">Select participating team</option>{registeredTeams.filter((team)=>["registered","active"].includes(team.status)).map((team)=><option key={team._id} value={team._id}>{team.displayName}</option>)}</select>:null}</div>;})}</div>
                {awardsEditable?<div className="rounded-2xl border border-line p-4"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><label className="text-sm font-medium text-fg">Individual award<select className="mt-1 w-full rounded-lg border border-line bg-surface p-2" value={optionalAwardType} onChange={(event)=>setOptionalAwardType(event.target.value as typeof optionalAwardType)}><option value="golden_boot">Golden Boot / Top Scorer</option><option value="golden_glove">Golden Glove / Best Goalkeeper</option><option value="player_of_the_season">Player of the Season / Best Player</option><option value="best_young_player">Best Young Player</option><option value="best_defender">Best Defender</option><option value="best_midfielder">Best Midfielder</option></select></label><label className="text-sm font-medium text-fg">Winner(s) <span className="font-normal text-muted">· Ctrl/Cmd-click for tied winners</span><select multiple className="mt-1 min-h-28 w-full rounded-lg border border-line bg-surface p-2 text-sm" value={optionalAwardLotIds} onChange={(event)=>setOptionalAwardLotIds(Array.from(event.target.selectedOptions).map((option)=>option.value))}>{seasonLots.filter((lot)=>lot.auctionStatus==="sold"&&typeof lot.playerRef==="object"&&typeof lot.seasonTeamRef==="object").map((lot)=><option key={lot._id} value={lot._id}>{(lot.playerRef as {name:string}).name} · {(lot.seasonTeamRef as {displayName:string}).displayName}</option>)}</select></label></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">Only players sold to a SeasonTeam in this season are eligible.</p><Button size="sm" disabled={saving||!optionalAwardLotIds.length} onClick={()=>void assignOptionalAward()}>{seasonAwards.some((award)=>award.awardType===optionalAwardType)?"Replace winner(s)":"Save award"}</Button></div></div>:null}
                <div><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold text-fg">Recorded honours</h4><span className="text-xs text-muted">{seasonAwards.length} award(s)</span></div>{seasonAwards.length?<div className="grid gap-3 sm:grid-cols-2">{seasonAwards.map((award)=><div key={award._id} className="rounded-xl border border-line p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-fg">{award.title}</p><p className="text-xs text-muted">{award.awardType.replaceAll("_"," ")}</p></div>{selected.status==="active"&&!["champions","runner_up"].includes(award.awardType)?<Button size="sm" variant="danger" disabled={saving} onClick={async()=>{const yes=await confirm({title:"Remove optional award?",description:"This removes the optional award record for this active season.",confirmLabel:"Remove award",danger:true});if(!yes)return;setSaving(true);try{await deleteSeasonAward(selected._id,award._id);awardsQuery.reload();toast.success("Award removed");}catch(error){toast.error(errorMessage(error));}finally{setSaving(false);}}}>Remove</Button>:null}</div><div className="mt-3 flex flex-wrap gap-2">{award.recipients.map((recipient)=><div key={recipient._id} className="flex min-w-0 items-center gap-2 rounded-lg bg-surface px-2 py-2"><img src={recipient.profileImageSnapshot?.url??recipient.teamLogoSnapshot?.url??"https://placehold.co/64x64?text=CSL"} alt="" className="h-8 w-8 rounded-full object-cover"/><div className="min-w-0"><p className="max-w-44 truncate text-sm font-medium text-fg">{recipient.displayNameSnapshot}</p><p className="max-w-44 truncate text-xs text-muted">{recipient.teamNameSnapshot}</p></div></div>)}</div></div>)}</div>:<p className="rounded-xl bg-surface p-4 text-sm text-muted">No achievements have been recorded yet. Assign the Champion and Runner-up to prepare this season for completion.</p>}</div>
              </div>:null}
              {awardReadinessBlockers.length>0 && selected.status === "active" ? <div role="status" className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-sm font-semibold text-fg">Achievements & awards are locked until the competition is finalized</p><ul className="mt-2 list-disc pl-5 text-sm text-muted">{awardReadinessBlockers.map((item,index)=><li key={index}>{item}</li>)}</ul></div> : null}
              {completionBlockers.length>0?<div role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3"><p className="text-sm font-semibold text-fg">Season cannot be completed yet</p><ul className="mt-2 list-disc pl-5 text-sm text-muted">{completionBlockers.map((item,index)=><li key={index}>{item}</li>)}</ul></div>:null}
              <p className="mt-4 text-xs text-muted">Award records are saved against this season. Completed and archived seasons remain available as read-only history.</p>
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-accent"><Layers3 className="h-5 w-5" /></span>
                <div><h3 className="font-display text-xl text-fg">Season groups</h3>
                <p className="mt-1 text-xs text-muted">Configure groups and assign teams before fixtures are created.</p></div>
              </div>
              <p className="mb-3 text-xs text-muted">Groups belong to this Season only. Counts are based on this season's SeasonTeam registrations. Historical assignments remain included so their group references are not hidden.</p>
              {preActivation && !hasFixtures && selected.groupStageEnabled !== false ? (
                <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end" onSubmit={createGroup}>
                  <label className="block text-sm font-medium text-fg" htmlFor="season-group-name">
                    Group Name
                    <Input id="season-group-name" className="mt-1" placeholder="For example, Group A" maxLength={40} required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                  </label>
                  <label className="block text-sm font-medium text-fg" htmlFor="season-group-order">
                    Display Order
                    <Input id="season-group-order" className="mt-1" type="number" min="0" max="1000" step="1" required value={newGroupOrder} onChange={(e) => setNewGroupOrder(Number(e.target.value))} />
                  </label>
                  <Button type="submit" size="sm" disabled={saving || !newGroupName.trim() || !registeredTeams.length}>Add Group</Button>
                </form>
              ) : selected.groupStageEnabled === false ? (
                <p className="mb-3 text-xs text-muted">Group management is disabled for this season's format.</p>
              ) : (
                <p className="mb-3 text-xs text-muted">Group creation and editing are frozen after activation or fixture creation.</p>
              )}
              {preActivation && !hasFixtures && selected.groupStageEnabled !== false && !registeredTeams.length ? (
                <p className="mb-3 text-xs text-muted">Register participating teams before creating groups.</p>
              ) : null}
              {groups.loading ? <Skeleton className="mb-3 h-20" /> : null}
              {groups.error ? <ErrorState message={groups.error} onRetry={groups.reload} /> : null}
              {!groups.loading && !groups.error && groups.data ? (
                <div className="space-y-2">
                  {seasonGroups.map((group) => {
                    const draft = groupDrafts[group._id];
                    const assigned = registeredTeams.filter((team) => team.groupRef === group._id);
                    const participatingCount = assigned.filter((team) => ["registered", "active"].includes(team.status)).length;
                    const historicalCount = assigned.length - participatingCount;
                    return (
                      <div key={group._id} className="rounded-xl border border-line p-3">
                        {!draft ? (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-fg">{group.groupName}</p>
                              <p className="mt-1 text-xs text-muted">Display order: {group.displayOrder}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="surface" disabled={saving || !preActivation || hasFixtures || selected.groupStageEnabled === false} onClick={() => editGroup(group)}>Edit</Button>
                              <Button size="sm" variant="danger" disabled={saving || assigned.length > 0 || hasFixtures || !preActivation || selected.groupStageEnabled === false} onClick={() => void removeGroup(group)}>Delete</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto_auto] sm:items-end">
                            <label className="block text-sm font-medium text-fg">
                              Group Name
                              <Input className="mt-1" maxLength={40} value={draft.groupName} disabled={saving} onChange={(e) => setGroupDrafts((current) => ({ ...current, [group._id]: { ...draft, groupName: e.target.value } }))} />
                            </label>
                            <label className="block text-sm font-medium text-fg">
                              Display Order
                              <Input className="mt-1" type="number" min="0" max="1000" step="1" value={draft.displayOrder} disabled={saving} onChange={(e) => setGroupDrafts((current) => ({ ...current, [group._id]: { ...draft, displayOrder: Number(e.target.value) } }))} />
                            </label>
                            <Button size="sm" disabled={saving} onClick={() => void saveGroup(group)}>{saving ? "Saving…" : "Save"}</Button>
                            <Button size="sm" variant="surface" disabled={saving} onClick={() => cancelGroupEdit(group._id)}>Cancel</Button>
                          </div>
                        )}
                        <p className="mt-2 text-xs text-muted">
                          {assigned.length} {assigned.length === 1 ? "team" : "teams"} assigned · {participatingCount} currently participating
                          {historicalCount > 0 ? " · " + historicalCount + " historical (withdrawn, eliminated or completed)" : ""}
                        </p>
                        {assigned.length > 0 ? <p className="mt-1 text-xs text-muted">Delete is unavailable while any SeasonTeam record refers to this group, including withdrawn or completed registrations.</p> : null}
                        {hasFixtures ? <p className="mt-1 text-xs text-muted">Groups are locked because this season already has fixtures.</p> : null}
                      </div>
                    );
                  })}
                  {!seasonGroups.length ? <p className="text-sm text-muted">No groups created for this season.</p> : null}
                </div>
              ) : null}
            </GlassCard>

            <GlassCard className="p-5 sm:p-6">
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-accent"><ShieldCheck className="h-5 w-5" /></span>
                <div><h3 className="font-display text-xl text-fg">Setup status & locks</h3>
                <p className="mt-1 text-xs text-muted">Live dependency counts and configuration lock rules.</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted">SeasonTeams</p><p className="font-semibold text-fg">{registeredTeams.length}</p></div>
                <div><p className="text-muted">Groups</p><p className="font-semibold text-fg">{seasonGroups.length}</p></div>
                <div><p className="text-muted">AuctionLots</p><p className="font-semibold text-fg">{seasonLots.length}</p></div>
                <div><p className="text-muted">Fixtures</p><p className="font-semibold text-fg">{fixtureCount}</p></div>
              </div>
              <p className="mt-3 text-xs text-muted">Auction rules lock on the first AuctionLot. Points, tiebreakers, match rules and group format lock on the first fixture. Completed and Archived seasons are read-only; Archived seasons are never deletable.</p>
            </GlassCard>
          </div>
        ) : (
          <GlassCard className="p-5"><h2 className="font-display text-2xl text-fg">Season workspace</h2><p className="mt-2 text-sm text-muted">Select an existing season above, or create a new Draft season.</p></GlassCard>
        )}
      </div>
      <Modal
        open={createOpen}
        title="Create a season"
        description="Set up a new Draft edition. You can register teams now or complete setup later."
        onClose={() => setCreateOpen(false)}
      >
        <form className="grid gap-3" onSubmit={handleCreate}>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm text-fg">Edition number<Input className="mt-1" type="number" min="1" required value={createForm.seasonNumber} onChange={(e) => setCreate("seasonNumber", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Year<Input className="mt-1" type="number" min="2000" max="2200" required value={createForm.year} onChange={(e) => setCreate("year", Number(e.target.value))} /></label>
              <label className="text-sm text-fg">Season name<Input className="mt-1" required minLength={2} maxLength={100} value={createForm.name} onChange={(e) => setCreate("name", e.target.value)} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-fg">Start date<Input className="mt-1" type="date" value={createForm.startDate} onChange={(e) => setCreate("startDate", e.target.value)} /></label>
              <label className="text-sm text-fg">End date<Input className="mt-1" type="date" value={createForm.endDate} onChange={(e) => setCreate("endDate", e.target.value)} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={createForm.groupStageEnabled} onChange={(e) => setCreate("groupStageEnabled", e.target.checked)} /> Group stage enabled</label>
            <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={createForm.homeAndAwayFixtures} onChange={(e) => setCreate("homeAndAwayFixtures", e.target.checked)} /> Home and away fixtures (maximum two meetings per team pair)</label>
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
      </Modal>
      <Modal
        open={editOpen && Boolean(selected)}
        title="Edit season configuration"
        description={selected ? "Update " + selected.name + ". Fields are locked automatically when dependent season activity exists." : undefined}
        onClose={() => setEditOpen(false)}
      >
        <form className="grid gap-3" onSubmit={handleEdit}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-fg">Season number<Input type="number" min="1" value={editForm.seasonNumber} disabled={identityLocked} onChange={(e) => setEdit("seasonNumber", Number(e.target.value))} /></label>
                  <label className="text-sm text-fg">Year<Input type="number" min="2000" max="2200" value={editForm.year} disabled={identityLocked} onChange={(e) => setEdit("year", Number(e.target.value))} /></label>
                </div>
                {identityLocked ? <p className="text-xs text-muted">Season number and year are locked after the season leaves Draft or dependent setup records exist.</p> : null}
                <label className="text-sm text-fg">Season name<Input value={editForm.name} disabled={!editable} onChange={(e) => setEdit("name", e.target.value)} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-fg">Start date<Input type="date" value={editForm.startDate} disabled={!editable} onChange={(e) => setEdit("startDate", e.target.value)} /></label>
                  <label className="text-sm text-fg">End date<Input type="date" value={editForm.endDate} disabled={!editable} onChange={(e) => setEdit("endDate", e.target.value)} /></label>
                </div>
                <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={editForm.groupStageEnabled} disabled={matchRulesLocked} onChange={(e) => setEdit("groupStageEnabled", e.target.checked)} /> Group stage enabled</label>
                <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={editForm.homeAndAwayFixtures} disabled={matchRulesLocked} onChange={(e) => setEdit("homeAndAwayFixtures", e.target.checked)} /> Home and away fixtures (maximum two meetings per team pair)</label>
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
                <div className="grid gap-2 rounded-xl border border-line p-3">
                  <p className="text-sm font-semibold text-fg">Standings tiebreaker order</p>
                  {([
                    ["points", "Points"], ["goalDifference", "Goal difference"], ["goalsScored", "Goals scored"], ["teamNameAsc", "Team name (A–Z)"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-fg">
                      <input type="checkbox" checked={editForm.standingsTieBreakers.includes(key)} disabled={matchRulesLocked}
                        onChange={(event) => setEdit("standingsTieBreakers", event.target.checked
                          ? [...editForm.standingsTieBreakers, key]
                          : editForm.standingsTieBreakers.filter((value) => value !== key))} />
                      {label}
                    </label>
                  ))}
                  <p className="text-xs text-muted">Choose the rules used to rank teams when points are tied. At least one rule is required and each rule can appear once.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={editForm.groupStageDrawAllowed} disabled={matchRulesLocked} onChange={(e) => setEdit("groupStageDrawAllowed", e.target.checked)} /> Allow group-stage draws</label>
                <label className="flex items-center gap-2 text-sm text-fg"><input type="checkbox" checked={editForm.knockoutDrawRequiresShootout} disabled={matchRulesLocked} onChange={(e) => setEdit("knockoutDrawRequiresShootout", e.target.checked)} /> Require knockout shootout</label>
                <Button type="submit" disabled={saving || !editable}>Save configuration</Button>
              </form>
      </Modal>
    </PageContainer>
  );
}

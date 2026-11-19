import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
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
import { SeasonConfigurationForm, type SeasonFormState } from "@/components/forms/SeasonConfigurationForm";
import type { SeasonGroup } from "@/types/seasonMatch.types";
import {
  Award, CalendarDays, Check, Layers3, Lock, Medal, Plus, Search, Settings2, ShieldCheck, Trophy, Users,
} from "lucide-react";

/* ───────────────────────── helpers ───────────────────────── */

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

const statuses: SeasonStatus[] = ["draft", "upcoming", "active", "completed", "archived"];
const statusLabel = (status: SeasonStatus) => status.charAt(0).toUpperCase() + status.slice(1);
const statusTone = (status: SeasonStatus) =>
  status === "active" ? "accent" : status === "completed" ? "gold" : status === "archived" ? "neutral" : "info";

type OptionalAwardType = "golden_boot" | "golden_glove" | "player_of_the_season" | "best_young_player" | "best_defender" | "best_midfielder";
const OPTIONAL_AWARDS: { value: OptionalAwardType; label: string }[] = [
  { value: "golden_boot", label: "Golden Boot / Top Scorer" },
  { value: "golden_glove", label: "Golden Glove / Best Goalkeeper" },
  { value: "player_of_the_season", label: "Player of the Season / Best Player" },
  { value: "best_young_player", label: "Best Young Player" },
  { value: "best_defender", label: "Best Defender" },
  { value: "best_midfielder", label: "Best Midfielder" },
];

/* Shared glass utility strings (all colours come from styles.css tokens) */
const panel = "rounded-2xl border border-line bg-surface/40 backdrop-blur-md";
const nativeField =
  "w-full rounded-xl border border-line bg-surface/60 px-3 py-2 text-sm text-fg backdrop-blur-md outline-none transition focus:border-accent";

/* ───────────────────────── presentational pieces ───────────────────────── */

function IconTile({ icon: Icon, tone = "surface" }: { icon: typeof Users; tone?: "surface" | "primary" }) {
  return (
    <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line backdrop-blur-md " + (tone === "primary" ? "bg-primary text-primary-fg" : "bg-surface/60 text-accent")}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

function SectionHeader({ icon, title, hint, aside }: { icon: typeof Users; title: string; hint?: string; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <IconTile icon={icon} />
        <div>
          <h3 className="font-display text-xl text-fg">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
        </div>
      </div>
      {aside}
    </div>
  );
}

function Note({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "warning" | "danger" }) {
  const styles = {
    muted: "border-line bg-surface/40 text-muted",
    warning: "border-warning/40 bg-warning/10 text-fg",
    danger: "border-danger/40 bg-danger/10 text-fg",
  }[tone];
  return <div className={"rounded-xl border px-3 py-2 text-xs backdrop-blur-md " + styles}>{children}</div>;
}

function ConfigurationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/70 py-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right text-xs font-semibold text-fg">{value}</span>
    </div>
  );
}

function ConfigCard({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: ReactNode }) {
  return (
    <section className={panel + " p-4"}>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-accent"><Icon className="h-4 w-4" /></span>
        <h4 className="text-sm font-semibold text-fg">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <IconTile icon={icon} />
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-display text-2xl leading-tight tabular text-fg">{value}</p>
      </div>
    </GlassCard>
  );
}

/** Real sequence → numbered/connected steps are meaningful here. */
function LifecycleStepper({ current }: { current: SeasonStatus }) {
  const currentIndex = statuses.indexOf(current);
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Season lifecycle">
      {statuses.map((status, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={status} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={"flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition " +
                (active ? "border-accent bg-accent text-accent-fg" : done ? "border-primary/60 bg-primary/20 text-fg" : "border-line bg-surface/40 text-faint")}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : <span className="tabular">{index + 1}</span>}
              {statusLabel(status)}
            </span>
            {index < statuses.length - 1 ? <span className={"h-px w-4 sm:w-6 " + (done ? "bg-primary" : "bg-line")} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Chip({ selected, disabled, onClick, children }: { selected: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-md transition disabled:opacity-50 " +
        (selected ? "border-accent bg-accent/20 text-fg" : "border-line bg-surface/50 text-muted hover:border-accent hover:text-fg")}
    >
      {selected ? <Check className="h-3 w-3 text-accent" /> : null}
      {children}
    </button>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function SeasonsPage() {
  return <AdminRoute><SeasonsBody /></AdminRoute>;
}

function SeasonsBody() {
  const confirm = useConfirm();
  const seasons = useServiceQuery(() => getSeasons(), []);
  const permanentTeams = useServiceQuery(() => getTeams(), []);
  const managersQuery = useServiceQuery(() => getManagers({ page: 1, limit: 100, status: "active" }), []);
  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SeasonFormState>(() => defaultForm());
  const [editForm, setEditForm] = useState<SeasonFormState>(() => defaultForm());
  const [registrationIds, setRegistrationIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOrder, setNewGroupOrder] = useState(1);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { groupName: string; displayOrder: number }>>({});
  const [saving, setSaving] = useState(false);
  const [optionalAwardType, setOptionalAwardType] = useState<OptionalAwardType>("golden_boot");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const awardsQuery = useServiceQuery(() => selectedSeasonId ? getSeasonAwards(selectedSeasonId) : Promise.resolve({ success: true, message: "", data: [] } as Awaited<ReturnType<typeof getSeasonAwards>>), [selectedSeasonId]);
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
        const winner = typeof match.winnerSeasonTeamRef === "object" ? match.winnerSeasonTeamRef?._id : match.winnerSeasonTeamRef;
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
  const toggleTeam = (id: string, current: string[], setter: (next: string[]) => void) => setter(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const hasChampion = seasonAwards.some((award) => award.awardType === "champions");
  const hasRunnerUp = seasonAwards.some((award) => award.awardType === "runner_up");
  const teamHonoursComplete = hasChampion && hasRunnerUp;

  const payload = (form: SeasonFormState): SeasonWrite => ({
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
  });

  /* ── handlers (logic unchanged) ── */

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
      const result = await createSeason(payload(createForm));
      toast.success("Draft season created");
      setSelectedSeasonId(result.data._id);
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
    if (editForm.iconPlayerLimit > editForm.teamSquadSize || editForm.goalkeeperLimit > editForm.teamSquadSize) {
      toast.error("Player limits cannot exceed the team squad size"); return;
    }
    setSaving(true);
    const patch: SeasonPatch = {
      ...(editForm.name.trim() !== selected.name ? { name: editForm.name.trim() } : {}), startDate: editForm.startDate || null, endDate: editForm.endDate || null,
      ...(identityLocked ? {} : { ...(editForm.seasonNumber !== selected.seasonNumber ? { seasonNumber: editForm.seasonNumber } : {}), ...(editForm.year !== selected.year ? { year: editForm.year } : {}) }),
      ...(!matchRulesLocked ? { groupStageEnabled: editForm.groupStageEnabled, homeAndAwayFixtures: editForm.homeAndAwayFixtures } : {}),
      ...(!auctionRulesLocked ? { auctionSettings: payload(editForm).auctionSettings } : {}),
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
      const response = (error as { response?: { data?: { fieldErrors?: Record<string, string> } } }).response?.data;
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
    if (!selected) return;
    setSaving(true);
    try { await updateSeasonTeam(selected._id, team._id, { managerIds }); toast.success("Managers updated"); seasonTeams.reload(); }
    catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };

  const assignOptionalAward = async () => {
    if (!selected || !optionalAwardLotIds.length) return;
    const selectedLots = seasonLots.filter((lot) => optionalAwardLotIds.includes(lot._id));
    if (!selectedLots.length || selectedLots.some((lot) => typeof lot.playerRef !== "object" || !lot.seasonTeamRef || typeof lot.seasonTeamRef !== "object")) { toast.error("Select sold player lots"); return; }
    const existing = seasonAwards.find((award) => award.awardType === optionalAwardType);
    const recipients = selectedLots.map((lot) => ({ seasonTeamId: (lot.seasonTeamRef as { _id: string })._id, playerId: (lot.playerRef as { _id: string })._id }));
    setSaving(true);
    try {
      if (existing) await updateSeasonAward(selected._id, existing._id, { recipients });
      else await createSeasonAward(selected._id, { awardType: optionalAwardType, recipients });
      toast.success("Optional award saved"); setOptionalAwardLotIds([]); awardsQuery.reload();
    } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };

  const assignTeamAward = async (awardType: "champions" | "runner_up", seasonTeamId: string) => {
    if (!selected || !seasonTeamId) return;
    setSaving(true);
    try {
      const existing = seasonAwards.find((award) => award.awardType === awardType);
      const body = { awardType, recipients: [{ seasonTeamId }] };
      if (existing) await updateSeasonAward(selected._id, existing._id, { recipients: body.recipients });
      else await createSeasonAward(selected._id, body);
      toast.success(awardType === "champions" ? "Champion saved" : "Runner-up saved"); setCompletionBlockers([]); awardsQuery.reload();
    } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };

  const removeAward = async (awardId: string) => {
    if (!selected) return;
    const yes = await confirm({ title: "Remove optional award?", description: "This removes the optional award record for this active season.", confirmLabel: "Remove award", danger: true });
    if (!yes) return;
    setSaving(true);
    try { await deleteSeasonAward(selected._id, awardId); awardsQuery.reload(); toast.success("Award removed"); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
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

  const availableManagers = (managersQuery.data?.data ?? []).filter((manager) => manager.status === "active");
  const soldLots = seasonLots.filter((lot) => lot.auctionStatus === "sold" && typeof lot.playerRef === "object" && typeof lot.seasonTeamRef === "object");

  /* ── render ── */

  return (
    <PageContainer>
      {/* ambient glass backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-20 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-info/10 blur-3xl" />
      </div>

      <PageHeader
        eyebrow="Admin · tournament setup"
        title="Seasons"
        description="A dedicated workspace for each tournament edition, from initial setup through completion and archive."
        actions={
          <Button onClick={() => {
            const nextNumber = (seasons.data?.data.reduce((max, season) => Math.max(max, season.seasonNumber), 0) ?? 0) + 1;
            setCreateForm(defaultForm(nextNumber));
            setCreateOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Create season
          </Button>
        }
      />
      {seasons.loading ? <Skeleton className="h-32" /> : null}
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}

      {/* ───── Season library ───── */}
      <GlassCard className="mb-6 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-fg">Season library</h2>
            <p className="mt-1 text-sm text-muted">{seasons.data?.data.length ?? 0} season(s). Select an edition to manage its setup and history.</p>
          </div>
          <Badge>{filteredSeasons.length} shown</Badge>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input className="pl-9" aria-label="Search seasons" placeholder="Search season name or edition…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select aria-label="Filter by year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">All years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}
          </Select>
          <Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSeasons.map((season) => {
            const isSelected = selectedSeasonId === season._id;
            return (
              <button
                type="button" key={season._id} onClick={() => setSelectedSeasonId(season._id)} aria-pressed={isSelected}
                className={"group relative overflow-hidden rounded-2xl border p-4 text-left backdrop-blur-md transition duration-200 " +
                  (isSelected ? "border-accent bg-primary/15 shadow-glass" : "border-line bg-surface/40 hover:border-accent/70 hover:bg-surface/70")}
              >
                {isSelected ? <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-accent" /> : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconTile icon={CalendarDays} tone={isSelected ? "primary" : "surface"} />
                    <div className="min-w-0">
                      <span className="block truncate font-semibold text-fg">{season.name}</span>
                      <span className="mt-0.5 block text-xs text-muted">Edition {season.seasonNumber} · {season.year}</span>
                    </div>
                  </div>
                  <Badge tone={statusTone(season.status)}>{statusLabel(season.status)}</Badge>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                  <span>{season.startDate ? toDateInput(season.startDate) : "No start date"}</span>
                  <span>{season.endDate ? toDateInput(season.endDate) : "No end date"}</span>
                </div>
              </button>
            );
          })}
          {!filteredSeasons.length ? <p className="text-sm text-muted">No seasons match these filters. Clear a filter or create a new season.</p> : null}
        </div>
      </GlassCard>

      {/* ───── Workspace ───── */}
      <div className="space-y-5">
        {selected ? (
          <>
            {/* Hero */}
            <GlassCard className="relative overflow-hidden p-5 sm:p-6">
              <div aria-hidden className="pitch-stripes pointer-events-none absolute inset-x-0 top-0 h-28 opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
              <div aria-hidden className="pitch-lines pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-primary/25 text-accent backdrop-blur-md">
                    <Trophy className="h-7 w-7" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-3xl text-fg sm:text-4xl">{selected.name}</h2>
                      <Badge tone={statusTone(selected.status)}>{statusLabel(selected.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">Edition {selected.seasonNumber} · {selected.year}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {selected.startDate ? toDateInput(selected.startDate) : "Start date not set"} – {selected.endDate ? toDateInput(selected.endDate) : "End date not set"}
                    </p>
                  </div>
                </div>
                <Button variant="surface" size="sm" disabled={!editable} onClick={() => { setEditForm(fromSeason(selected)); setEditOpen(true); }}>
                  <Settings2 className="h-4 w-4" /> Edit configuration
                </Button>
              </div>

              <div className="relative mt-6"><LifecycleStepper current={selected.status} /></div>

              <div className="relative mt-4 flex flex-wrap gap-2">
                {selected.status === "draft" ? <Button size="sm" disabled={saving} onClick={() => void runLifecycle("upcoming")}>Move to Upcoming</Button> : null}
                {selected.status === "upcoming" ? <><Button size="sm" disabled={saving} onClick={() => void runLifecycle("draft")} variant="surface">Return to Draft</Button><Button size="sm" disabled={saving} onClick={() => void runLifecycle("active")}>Activate Season</Button></> : null}
                {selected.status === "active" ? <Button size="sm" disabled={saving} variant="danger" onClick={() => void runLifecycle("complete")}>Complete Season</Button> : null}
                {selected.status === "completed" ? <Button size="sm" disabled={saving} onClick={() => void runLifecycle("archive")}>Archive Season</Button> : null}
                {selected.status === "draft" ? <Button size="sm" disabled={saving || dependenciesExist} variant="danger" onClick={() => void removeSelectedSeason()}>Delete empty Draft</Button> : null}
              </div>
              {selected.status === "draft" && dependenciesExist ? (
                <p className="relative mt-3 text-xs text-muted">Delete is unavailable because this Draft has linked teams, groups, auction lots or fixtures. Remove the unused setup records first.</p>
              ) : null}

              {/* Configuration */}
              <div className="relative mt-6 border-t border-line pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl text-fg">Current configuration</h3>
                    <p className="mt-0.5 text-xs text-muted">Saved rules and limits applied to this season.</p>
                  </div>
                  <Badge tone="info">Saved settings</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ConfigCard icon={Layers3} title="Competition format">
                    <ConfigurationRow label="Group stage" value={selected.groupStageEnabled === false ? "Disabled" : "Enabled"} />
                    <ConfigurationRow label="Fixture pairing" value={selected.homeAndAwayFixtures ? "Home and away" : "One fixture per pair"} />
                    <ConfigurationRow label="Maximum meetings per pair" value={selected.homeAndAwayFixtures ? "2 (reverse home/away)" : "1"} />
                  </ConfigCard>

                  <ConfigCard icon={ShieldCheck} title="Auction settings">
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
                  </ConfigCard>

                  <ConfigCard icon={Trophy} title="Points system">
                    {selected.pointsRules ? (
                      <>
                        <ConfigurationRow label="Win" value={`${selected.pointsRules.win} points`} />
                        <ConfigurationRow label="Draw" value={`${selected.pointsRules.draw} points`} />
                        <ConfigurationRow label="Loss" value={`${selected.pointsRules.loss} points`} />
                      </>
                    ) : <p className="py-2 text-xs text-muted">Points rules are not configured for this season.</p>}
                  </ConfigCard>

                  <ConfigCard icon={CalendarDays} title="Match and standings rules">
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
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/20 font-semibold tabular text-fg">{index + 1}</span>
                              {TIE_BREAKER_LABELS[rule]}
                            </li>
                          ))}
                        </ol>
                      ) : <p className="text-xs text-muted">No tiebreaker order configured.</p>}
                    </div>
                  </ConfigCard>
                </div>
              </div>
            </GlassCard>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatTile label="Participating teams" value={registeredTeams.length} icon={Users} />
              <StatTile label="Season groups" value={seasonGroups.length} icon={Layers3} />
              <StatTile label="Auction lots" value={seasonLots.length} icon={ShieldCheck} />
              <StatTile label="Fixtures" value={fixtureCount} icon={CalendarDays} />
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-5">
              {/* ───── Teams ───── */}
              <GlassCard className="p-5 sm:p-6 lg:col-span-3">
                <SectionHeader
                  icon={Users}
                  title="Participating teams"
                  hint="Season-only registrations, group assignments and managers."
                  aside={<Badge>{registeredTeams.length} / {selected.auctionSettings?.seasonTeamCount ?? 0}</Badge>}
                />
                <p className="mb-3 text-xs text-muted">Permanent teams stay separate. Registration is open in Draft and Upcoming, and freezes when the season becomes Active.</p>
                {seasonTeams.loading ? <Skeleton className="h-20" /> : null}
                {seasonTeams.error ? <ErrorState message={seasonTeams.error} onRetry={seasonTeams.reload} /> : null}

                <div className="space-y-3">
                  {registeredTeams.map((team) => {
                    const linked = seasonLots.some((lot) => typeof lot.seasonTeamRef === "object" && lot.seasonTeamRef?._id === team._id) || seasonFixtures.some((match) => {
                      const home = typeof match.homeSeasonTeamRef === "object" ? match.homeSeasonTeamRef._id : match.homeSeasonTeamRef;
                      const away = typeof match.awaySeasonTeamRef === "object" ? match.awaySeasonTeamRef._id : match.awaySeasonTeamRef;
                      return home === team._id || away === team._id;
                    });
                    const managersLocked = saving || !["draft", "upcoming", "active"].includes(selected.status);
                    return (
                      <div key={team._id} className={panel + " p-4"}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-fg">{team.displayName}</p>
                            <p className="mt-0.5 text-xs text-muted">{team.group?.groupName ?? "No group"} · {team.managers.length} manager(s)</p>
                          </div>
                          <Badge tone={team.status === "withdrawn" ? "danger" : "accent"}>{team.status}</Badge>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
                          <details className="group rounded-xl border border-line bg-surface/40 px-3 py-2">
                            <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-fg">
                              Managers
                              <span className="text-muted">{team.managerRefs.length} selected</span>
                            </summary>
                            <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pb-1" aria-label={"Managers for " + team.displayName}>
                              {availableManagers.map((manager) => (
                                <Chip
                                  key={manager._id}
                                  selected={team.managerRefs.includes(manager._id)}
                                  disabled={managersLocked}
                                  onClick={() => void assignManagers(team, team.managerRefs.includes(manager._id) ? team.managerRefs.filter((id) => id !== manager._id) : [...team.managerRefs, manager._id])}
                                >
                                  {manager.name}
                                </Chip>
                              ))}
                              {!availableManagers.length ? <span className="text-xs text-muted">No active managers available.</span> : null}
                            </div>
                          </details>
                          <Select
                            aria-label={"Group for " + team.displayName}
                            value={team.groupRef ?? ""}
                            disabled={!preActivation || hasFixtures || team.status === "withdrawn" || selected.groupStageEnabled === false}
                            onChange={(e) => void changeGroupAssignment(team, e.target.value)}
                          >
                            <option value="">Unassigned group</option>
                            {seasonGroups.map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
                          </Select>
                        </div>

                        {team.managers.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {team.managers.map((manager) => <span key={manager._id} className="rounded-full border border-line bg-surface/50 px-2 py-0.5 text-xs text-muted">{manager.name}</span>)}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {preActivation && team.status !== "withdrawn" ? <Button size="sm" variant="danger" disabled={saving || linked} onClick={() => void manageSeasonTeam(team, "remove")}>Remove</Button> : null}
                          {selected.status === "active" && ["registered", "active"].includes(team.status) ? <Button size="sm" variant="danger" disabled={saving} onClick={() => void manageSeasonTeam(team, "withdraw")}>Withdraw</Button> : null}
                          {selected.status === "active" && team.status === "withdrawn" ? <Button size="sm" disabled={saving} onClick={() => void manageSeasonTeam(team, "recall")}>Recall / Reinstate</Button> : null}
                          {preActivation && linked ? <span className="flex items-center gap-1 text-xs text-muted"><Lock className="h-3 w-3" /> Has auction or fixture history. Use withdrawal after activation.</span> : null}
                        </div>
                      </div>
                    );
                  })}
                  {!registeredTeams.length ? <p className="text-sm text-muted">No teams are registered in this season yet. Pick teams below to get started.</p> : null}
                </div>

                {preActivation ? (
                  <div className="mt-5 border-t border-line pt-4">
                    <h4 className="mb-2 font-semibold text-fg">Register teams</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {permanentTeams.data?.data.filter((team) => team.status === "active" && !registeredTeamIds.has(team._id)).map((team) => {
                        const checked = registrationIds.includes(team._id);
                        return (
                          <label key={team._id} className={"flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm text-fg backdrop-blur-md transition " + (checked ? "border-accent bg-accent/10" : "border-line bg-surface/40 hover:border-accent/60")}>
                            <input type="checkbox" className="h-4 w-4 accent-[var(--csl-accent)]" checked={checked} onChange={() => toggleTeam(team._id, registrationIds, setRegistrationIds)} />
                            {team.name}
                          </label>
                        );
                      })}
                    </div>
                    <Button className="mt-3" size="sm" disabled={saving || !registrationIds.length || registeredTeams.length + registrationIds.length > (selected.auctionSettings?.seasonTeamCount ?? 0)} onClick={() => void registerTeams()}>
                      Register selected teams
                    </Button>
                  </div>
                ) : null}
              </GlassCard>

              {/* ───── Right column ───── */}
              <div className="space-y-5 lg:col-span-2">
                <GlassCard className="p-5 sm:p-6">
                  <SectionHeader icon={Layers3} title="Season groups" hint="Set up groups before fixtures are created." />
                  <p className="mb-3 text-xs text-muted">Groups belong to this season only. Counts come from this season's team registrations, and historical assignments stay visible.</p>

                  {preActivation && !hasFixtures && selected.groupStageEnabled !== false ? (
                    <form className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end" onSubmit={createGroup}>
                      <label className="block text-sm font-medium text-fg" htmlFor="season-group-name">
                        Group name
                        <Input id="season-group-name" className="mt-1" placeholder="For example, Group A" maxLength={40} required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                      </label>
                      <label className="block text-sm font-medium text-fg" htmlFor="season-group-order">
                        Display order
                        <Input id="season-group-order" className="mt-1" type="number" min="0" max="1000" step="1" required value={newGroupOrder} onChange={(e) => setNewGroupOrder(Number(e.target.value))} />
                      </label>
                      <Button type="submit" size="sm" disabled={saving || !newGroupName.trim() || !registeredTeams.length}>Add group</Button>
                    </form>
                  ) : selected.groupStageEnabled === false ? (
                    <div className="mb-3"><Note>Group management is disabled for this season's format.</Note></div>
                  ) : (
                    <div className="mb-3"><Note>Group creation and editing are frozen after activation or fixture creation.</Note></div>
                  )}
                  {preActivation && !hasFixtures && selected.groupStageEnabled !== false && !registeredTeams.length ? (
                    <div className="mb-3"><Note>Register participating teams before creating groups.</Note></div>
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
                          <div key={group._id} className={panel + " p-3"}>
                            {!draft ? (
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-semibold text-fg">{group.groupName}</p>
                                  <p className="mt-0.5 text-xs text-muted">Display order {group.displayOrder}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="surface" disabled={saving || !preActivation || hasFixtures || selected.groupStageEnabled === false} onClick={() => editGroup(group)}>Edit</Button>
                                  <Button size="sm" variant="danger" disabled={saving || assigned.length > 0 || hasFixtures || !preActivation || selected.groupStageEnabled === false} onClick={() => void removeGroup(group)}>Delete</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end">
                                <label className="block text-sm font-medium text-fg">
                                  Group name
                                  <Input className="mt-1" maxLength={40} value={draft.groupName} disabled={saving} onChange={(e) => setGroupDrafts((current) => ({ ...current, [group._id]: { ...draft, groupName: e.target.value } }))} />
                                </label>
                                <label className="block text-sm font-medium text-fg">
                                  Display order
                                  <Input className="mt-1" type="number" min="0" max="1000" step="1" value={draft.displayOrder} disabled={saving} onChange={(e) => setGroupDrafts((current) => ({ ...current, [group._id]: { ...draft, displayOrder: Number(e.target.value) } }))} />
                                </label>
                                <div className="flex gap-2 sm:col-span-2">
                                  <Button size="sm" disabled={saving} onClick={() => void saveGroup(group)}>{saving ? "Saving…" : "Save"}</Button>
                                  <Button size="sm" variant="surface" disabled={saving} onClick={() => cancelGroupEdit(group._id)}>Cancel</Button>
                                </div>
                              </div>
                            )}
                            <p className="mt-2 text-xs text-muted">
                              {assigned.length} {assigned.length === 1 ? "team" : "teams"} assigned · {participatingCount} currently participating
                              {historicalCount > 0 ? " · " + historicalCount + " historical (withdrawn, eliminated or completed)" : ""}
                            </p>
                            {assigned.length > 0 ? <p className="mt-1 text-xs text-faint">Delete is unavailable while any team registration, including withdrawn or completed ones, refers to this group.</p> : null}
                            {hasFixtures ? <p className="mt-1 text-xs text-faint">Groups are locked because this season already has fixtures.</p> : null}
                          </div>
                        );
                      })}
                      {!seasonGroups.length ? <p className="text-sm text-muted">No groups created for this season.</p> : null}
                    </div>
                  ) : null}
                </GlassCard>

                <GlassCard className="p-5 sm:p-6">
                  <SectionHeader icon={Lock} title="Setup status & locks" hint="Live dependency counts and lock rules." />
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Season teams", registeredTeams.length],
                      ["Groups", seasonGroups.length],
                      ["Auction lots", seasonLots.length],
                      ["Fixtures", fixtureCount],
                    ].map(([label, value]) => (
                      <div key={label} className={panel + " px-3 py-2"}>
                        <p className="text-xs text-muted">{label}</p>
                        <p className="font-display text-lg tabular text-fg">{value}</p>
                      </div>
                    ))}
                  </div>
                  <ul className="mt-4 space-y-1.5 text-xs text-muted">
                    <li className="flex gap-2"><Lock className="mt-0.5 h-3 w-3 shrink-0 text-accent" />Auction rules lock on the first auction lot.</li>
                    <li className="flex gap-2"><Lock className="mt-0.5 h-3 w-3 shrink-0 text-accent" />Points, tiebreakers, match rules and group format lock on the first fixture.</li>
                    <li className="flex gap-2"><Lock className="mt-0.5 h-3 w-3 shrink-0 text-accent" />Completed and Archived seasons are read-only. Archived seasons can never be deleted.</li>
                  </ul>
                </GlassCard>
              </div>
            </div>

            {/* ───── Awards ───── */}
            <GlassCard className="relative overflow-hidden p-5 sm:p-6">
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/15 blur-3xl" />
              <div className="relative">
                <SectionHeader
                  icon={Medal}
                  title="Achievements & awards"
                  hint="Champion and Runner-up are required to complete the season. Individual awards are optional."
                  aside={<Badge tone={teamHonoursComplete ? "gold" : "danger"}>{teamHonoursComplete ? "Team honours complete" : "Team honours pending"}</Badge>}
                />

                {awardsQuery.loading ? <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div> : null}
                {awardsQuery.error ? <ErrorState message={awardsQuery.error} onRetry={awardsQuery.reload} /> : null}

                {!awardsQuery.loading && !awardsQuery.error && awardsQuery.data ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["champions", "runner_up"] as const).map((type) => {
                        const award = seasonAwards.find((item) => item.awardType === type);
                        const chosen = award?.recipients?.[0]?.seasonTeamRef ?? "";
                        return (
                          <div key={type} className={panel + " p-4"}>
                            <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                              {type === "champions" ? <Trophy className="h-4 w-4 text-gold" /> : <Medal className="h-4 w-4 text-info" />}
                              {type === "champions" ? "Season champions" : "Runner-up"}
                            </p>
                            {award ? (
                              <div className="mt-3 flex items-center gap-3">
                                <img src={award.recipients[0]?.teamLogoSnapshot?.url ?? "https://placehold.co/96x96?text=CSL"} alt="" className="h-12 w-12 rounded-xl border border-line object-cover" />
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-fg">{award.recipients[0]?.displayNameSnapshot ?? "Team not available"}</p>
                                  <p className="text-xs text-muted">{award.title}</p>
                                </div>
                              </div>
                            ) : <p className="mt-3 text-sm text-muted">Not assigned yet</p>}
                            {awardsEditable ? (
                              <select aria-label={type === "champions" ? "Select champion" : "Select runner-up"} className={nativeField + " mt-3"} value={chosen} disabled={saving} onChange={(event) => void assignTeamAward(type, event.target.value)}>
                                <option value="">Select participating team</option>
                                {registeredTeams.filter((team) => ["registered", "active"].includes(team.status)).map((team) => <option key={team._id} value={team._id}>{team.displayName}</option>)}
                              </select>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {awardsEditable ? (
                      <div className={panel + " p-4"}>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                          <label className="text-sm font-medium text-fg">
                            Individual award
                            <select className={nativeField + " mt-1"} value={optionalAwardType} onChange={(event) => setOptionalAwardType(event.target.value as OptionalAwardType)}>
                              {OPTIONAL_AWARDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                            </select>
                          </label>
                          <div>
                            <p className="text-sm font-medium text-fg">Winner(s) <span className="font-normal text-muted">· select several for a tie</span></p>
                            <div className="mt-1 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-line bg-surface/40 p-2">
                              {soldLots.map((lot) => (
                                <Chip key={lot._id} selected={optionalAwardLotIds.includes(lot._id)} onClick={() => toggleTeam(lot._id, optionalAwardLotIds, setOptionalAwardLotIds)}>
                                  {(lot.playerRef as { name: string }).name} · {(lot.seasonTeamRef as { displayName: string }).displayName}
                                </Chip>
                              ))}
                              {!soldLots.length ? <span className="text-xs text-muted">No sold players are available yet.</span> : null}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-muted">Only players sold to a team in this season are eligible.</p>
                          <Button size="sm" disabled={saving || !optionalAwardLotIds.length} onClick={() => void assignOptionalAward()}>
                            {seasonAwards.some((award) => award.awardType === optionalAwardType) ? "Replace winner(s)" : "Save award"}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-semibold text-fg">Recorded honours</h4>
                        <span className="text-xs text-muted">{seasonAwards.length} award(s)</span>
                      </div>
                      {seasonAwards.length ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {seasonAwards.map((award) => (
                            <div key={award._id} className={panel + " p-3"}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2">
                                  <Award className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                                  <div>
                                    <p className="font-semibold text-fg">{award.title}</p>
                                    <p className="text-xs text-muted">{award.awardType.replaceAll("_", " ")}</p>
                                  </div>
                                </div>
                                {selected.status === "active" && !["champions", "runner_up"].includes(award.awardType) ? (
                                  <Button size="sm" variant="danger" disabled={saving} onClick={() => void removeAward(award._id)}>Remove</Button>
                                ) : null}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {award.recipients.map((recipient) => (
                                  <div key={recipient._id} className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface/50 px-2 py-1.5">
                                    <img src={recipient.profileImageSnapshot?.url ?? recipient.teamLogoSnapshot?.url ?? "https://placehold.co/64x64?text=CSL"} alt="" className="h-8 w-8 rounded-full object-cover" />
                                    <div className="min-w-0">
                                      <p className="max-w-40 truncate text-sm font-medium text-fg">{recipient.displayNameSnapshot}</p>
                                      <p className="max-w-40 truncate text-xs text-muted">{recipient.teamNameSnapshot}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <Note>No achievements recorded yet. Assign the Champion and Runner-up to prepare this season for completion.</Note>}
                    </div>
                  </div>
                ) : null}

                {awardReadinessBlockers.length > 0 && selected.status === "active" ? (
                  <div role="status" className="mt-4">
                    <Note tone="warning">
                      <p className="text-sm font-semibold">Awards unlock once the competition is finalized</p>
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted">{awardReadinessBlockers.map((item, index) => <li key={index}>{item}</li>)}</ul>
                    </Note>
                  </div>
                ) : null}
                {completionBlockers.length > 0 ? (
                  <div role="alert" className="mt-4">
                    <Note tone="danger">
                      <p className="text-sm font-semibold">This season can't be completed yet</p>
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted">{completionBlockers.map((item, index) => <li key={index}>{item}</li>)}</ul>
                    </Note>
                  </div>
                ) : null}
                <p className="mt-4 text-xs text-faint">Awards are saved against this season. Completed and archived seasons stay available as read-only history.</p>
              </div>
            </GlassCard>
          </>
        ) : (
          <GlassCard className="p-8 text-center">
            <div className="mx-auto mb-3 flex w-fit"><IconTile icon={Trophy} tone="primary" /></div>
            <h2 className="font-display text-2xl text-fg">Season workspace</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">Select a season above, or create a new Draft season to start setting up your tournament.</p>
          </GlassCard>
        )}
      </div>

      <Modal
        open={createOpen}
        title="Create a season"
        description="Create a Draft season first. Participating teams can be registered separately from the season workspace."
        onClose={() => setCreateOpen(false)}
      >
        <SeasonConfigurationForm
          value={createForm}
          mode="create"
          disabled={saving}
          onChange={(key, value) => setCreateForm((current) => ({ ...current, [key]: value }))}
          onSubmit={handleCreate}
          submitLabel="Create Draft season"
          submitDisabled={!createForm.name.trim() || !createForm.standingsTieBreakers.length || createForm.iconPlayerLimit > createForm.teamSquadSize || createForm.goalkeeperLimit > createForm.teamSquadSize}
        />
      </Modal>
      <Modal
        open={editOpen && Boolean(selected)}
        title="Edit season configuration"
        description={selected ? "Update " + selected.name + ". Locked settings are explained in their respective sections." : undefined}
        onClose={() => setEditOpen(false)}
      >
        <SeasonConfigurationForm
          value={editForm}
          mode="edit"
          disabled={!editable || saving}
          identityLocked={identityLocked}
          auctionLocked={auctionRulesLocked}
          matchRulesLocked={matchRulesLocked}
          onChange={(key, value) => setEditForm((current) => ({ ...current, [key]: value }))}
          onSubmit={handleEdit}
          submitLabel="Save configuration"
          submitDisabled={!editForm.standingsTieBreakers.length || editForm.iconPlayerLimit > editForm.teamSquadSize || editForm.goalkeeperLimit > editForm.teamSquadSize}
        />
      </Modal>
    </PageContainer>
  );
}
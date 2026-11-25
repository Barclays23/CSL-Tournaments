import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { useConfirm } from "@/contexts/ConfirmContext";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getTeams } from "@/services/teamService";
import { getManagers } from "@/services/managerService";
import { getSeasonAwards, createSeasonAward, updateSeasonAward, deleteSeasonAward } from "@/services/seasonAwardService";
import {
  archiveSeason, completeSeasonAuction, reopenSeasonAuction, completeSeason, deleteSeason, getAuctionLots,
  getSeasonById, getSeasonTeams, registerSeasonTeams, removeSeasonTeam,
  transitionSeason, updateSeason, updateSeasonTeam, withdrawSeasonTeam, recallSeasonTeam,
} from "@/services/seasonService";
import {
  createSeasonGroup, deleteSeasonGroup, getSeasonGroups, getSeasonMatches, updateSeasonGroup,
} from "@/services/seasonMatchService";
import { errorMessage } from "@/utils/errorHandler";
import { canEditSeasonTeamManagers, canToggleSeasonTeamManagerAssignment, getSeasonTeamManagerOptions } from "@/utils/seasonTeamPermissions";
import type { Season, SeasonPatch, SeasonStatus, SeasonWrite, SeasonTeam } from "@/types/season.types";
import { SeasonConfigurationForm, type SeasonFormState } from "@/components/forms/SeasonConfigurationForm";
import type { SeasonGroup } from "@/types/seasonMatch.types";
import {
  Award, CalendarDays, Check, Layers3, Lock, Medal, Plus, Search, Settings2, ShieldCheck, Trophy, UserPlus, Users, X,
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

function SectionHeader({ icon, title, hint, aside }: { icon: typeof Users; title: string; hint?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <IconTile icon={icon} />
        <div>
          <h3 className="font-display text-xl text-fg">{title}</h3>
          {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
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

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";

function TeamAvatar({ name, muted = false }: { name: string; muted?: boolean }) {
  return (
    <span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-xs font-bold " + (muted ? "bg-surface/60 text-faint" : "bg-primary/25 text-accent")}>
      {initials(name)}
    </span>
  );
}

/* ───────────────────────── page ───────────────────────── */

export function SeasonDetailsPage({ seasonId }: { seasonId: string }) {
  return <SeasonDetailsBody seasonId={seasonId} />;
}

function SeasonDetailsBody({ seasonId }: { seasonId: string }) {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const selectedSeasonQuery = useServiceQuery(() => getSeasonById(seasonId), [seasonId]);
  const permanentTeams = useServiceQuery(() => getTeams(), []);
  const managersQuery = useServiceQuery(() => getManagers({ page: 1, limit: 100 }), []);
  const selectedSeasonId = seasonId;
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<SeasonFormState>(() => defaultForm());
  const [registrationIds, setRegistrationIds] = useState<string[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupOrder, setNewGroupOrder] = useState(1);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, { groupName: string; displayOrder: number }>>({});
  const [saving, setSaving] = useState(false);
  const [optionalAwardType, setOptionalAwardType] = useState<OptionalAwardType>("golden_boot");
  const [optionalAwardLotIds, setOptionalAwardLotIds] = useState<string[]>([]);
  const [completionBlockers, setCompletionBlockers] = useState<string[]>([]);
  const [teamsTab, setTeamsTab] = useState<"registered" | "add">("registered");
  const [teamSearch, setTeamSearch] = useState("");
  const [recallTarget, setRecallTarget] = useState<SeasonTeam | null>(null);
  const [recallReason, setRecallReason] = useState("Recalled by tournament administrator after review");

  const selected = selectedSeasonQuery.data?.data ?? null;
  useEffect(() => {
    // Group edit drafts and form values belong to one selected season only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroupDrafts({});
    setNewGroupName("");
    setNewGroupOrder(1);
    setRegistrationIds([]);
    setTeamSearch("");
    setTeamsTab("registered");
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

  const eligibleSeasonTeams = registeredTeams.filter((team) => team.status === "registered" || team.status === "active");
  const expectedSeasonTeams = selected?.auctionSettings?.seasonTeamCount ?? 0;
  const groupTeamCounts = seasonGroups.map((group) => ({
    groupName: group.groupName,
    count: eligibleSeasonTeams.filter((team) => team.groupRef === group._id).length,
  }));
  const groupReadinessBlockers = selected?.groupStageEnabled === false ? [] : [
    ...(seasonGroups.length === 0 ? ["Create at least one group."] : []),
    ...(eligibleSeasonTeams.filter((team) => !team.groupRef).length > 0 ? [`${eligibleSeasonTeams.filter((team) => !team.groupRef).length} participating team(s) still need a group assignment.`] : []),
    ...groupTeamCounts.filter((group) => group.count > 0 && group.count < 2).map((group) => `${group.groupName} needs at least two participating teams.`),
  ];
  const upcomingReadinessBlockers = [
    ...(!selected?.auctionSettings || !selected.pointsRules || !selected.standingsTieBreakers?.length || !selected.matchRules
      ? ["Complete all season rules and auction settings."] : []),
    ...(eligibleSeasonTeams.length < 2 ? ["Register at least two eligible teams."] : []),
    ...(expectedSeasonTeams > 0 && eligibleSeasonTeams.length > expectedSeasonTeams
      ? [`Reduce registrations to the configured limit of ${expectedSeasonTeams} teams.`] : []),
    ...groupReadinessBlockers,
  ];
  const activationReadinessBlockers = [
    ...(selected?.auctionLifecycleStatus !== "completed" ? ["Complete the auction and validate every team roster."] : []),
    ...(expectedSeasonTeams > 0 && eligibleSeasonTeams.length !== expectedSeasonTeams
      ? [`Register exactly ${expectedSeasonTeams} eligible teams (currently ${eligibleSeasonTeams.length}).`] : []),
    ...groupReadinessBlockers,
    ...(selected?.auctionLifecycleStatus === "completed" && selected.groupStageEnabled !== false
      ? groupTeamCounts.filter((group) => group.count === 0).map((group) => `${group.groupName} is empty. Remove the unused group or assign a team before activation.`)
      : []),
  ];
  const fixtureCount = fixtures.data?.pagination?.total ?? seasonFixtures.length;
  const dependenciesExist = registeredTeams.length + seasonGroups.length + seasonLots.length + fixtureCount > 0;
  const hasAuctionHistory = seasonLots.length > 0;
  const hasFixtures = fixtureCount > 0;
  const preActivation = selected ? ["draft", "upcoming"].includes(selected.status) : false;
  const editable = preActivation && selected?.status !== "completed" && selected?.status !== "archived";
  const identityLocked = !selected || selected.status !== "draft" || dependenciesExist;
  const matchRulesLocked = hasFixtures || !editable;
  const auctionRulesLocked = hasAuctionHistory || !editable;
  const refreshSelected = () => { selectedSeasonQuery.reload(); seasonTeams.reload(); groups.reload(); fixtures.reload(); lots.reload(); awardsQuery.reload(); };
  const toggleTeam = (id: string, current: string[], setter: (next: string[]) => void) => setter(current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const hasChampion = seasonAwards.some((award) => award.awardType === "champions");
  const hasRunnerUp = seasonAwards.some((award) => award.awardType === "runner_up");
  const teamHonoursComplete = hasChampion && hasRunnerUp;
  const completionReadinessBlockers = [
    ...(selected?.auctionLifecycleStatus !== "completed" ? ["Complete the season auction before completing the season."] : []),
    ...awardReadinessBlockers,
    ...(!hasChampion ? ["Assign the Season Champions award."] : []),
    ...(!hasRunnerUp ? ["Assign the Runner-up award."] : []),
  ];

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
      const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
      const blockers = Object.values(fieldErrors ?? {}).filter((value): value is string => typeof value === "string");
      if (blockers.length) setCompletionBlockers(blockers);
      else if (action === "complete") setCompletionBlockers([errorMessage(error)]);
    } finally { setSaving(false); }
  };

  const completeAuction = async () => {
    if (!selected) return;
    const yes = await confirm({
      title: "Complete season auction?",
      description: "The server will validate pending lots, team assignments, player rosters, squad size, budget, Icon Player and Goalkeeper limits. The auction will remain in progress if any validation fails.",
      confirmLabel: "Validate and complete auction",
    });
    if (!yes) return;
    setSaving(true);
    try {
      await completeSeasonAuction(selected._id);
      toast.success("Season auction completed");
      refreshSelected();
    } catch (error) {
      toast.error(errorMessage(error));
      const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
      const blockers = Object.values(fieldErrors ?? {}).filter((value): value is string => typeof value === "string");
      if (blockers.length) setCompletionBlockers(blockers);
      else setCompletionBlockers([errorMessage(error)]);
    } finally {
      setSaving(false);
    }
  };

  const reopenAuction = async () => {
    if (!selected) return;
    const yes = await confirm({
      title: "Resume season auction?",
      description: "The existing sold, unsold and withdrawn lot data will be preserved. Auction reopening is allowed only before fixtures have been created.",
      confirmLabel: "Resume auction",
    });
    if (!yes) return;
    setSaving(true);
    try {
      await reopenSeasonAuction(selected._id);
      toast.success("Season auction resumed");
      refreshSelected();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
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
    try { await deleteSeason(selected._id); toast.success("Empty Draft season deleted"); await navigate({ to: "/admin/seasons" }); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const registerTeams = async () => {
    if (!selected || !registrationIds.length) return;
    setSaving(true);
    try { await registerSeasonTeams(selected._id, registrationIds); toast.success("Teams registered"); setRegistrationIds([]); setTeamsTab("registered"); refreshSelected(); }
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
        setRecallTarget(team);
        setRecallReason("Recalled by tournament administrator after review");
        return;
      }
      toast.success(action === "remove" ? "Registration removed" : action === "withdraw" ? "Team withdrawn" : "Team recalled");
      refreshSelected();
    } catch (error) { toast.error(errorMessage(error)); }
    finally { setSaving(false); }
  };

  const submitRecall = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !recallTarget) return;
    if (recallReason.trim().length < 3) {
      toast.error("A recall reason of at least 3 characters is required.");
      return;
    }
    setSaving(true);
    try {
      await recallSeasonTeam(selected._id, recallTarget._id, recallReason.trim());
      toast.success("Team recalled");
      setRecallTarget(null);
      setRecallReason("Recalled by tournament administrator after review");
      refreshSelected();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const managerDirectory = managersQuery.data?.data ?? [];
  const groupsLocked = !preActivation || hasFixtures || selected?.groupStageEnabled === false;
  const assignableTeams = registeredTeams.filter((team) => team.status !== "withdrawn");
  const unassignedTeams = assignableTeams.filter((team) => !team.groupRef);
  const assignedTeamCount = assignableTeams.length - unassignedTeams.length;
  const teamCap = selected?.auctionSettings?.seasonTeamCount ?? 0;
  const slotsLeft = Math.max(teamCap - registeredTeams.length, 0);
  const activeTeamsTab = preActivation ? teamsTab : "registered";
  const allCandidates = (permanentTeams.data?.data ?? []).filter((team) => team.status === "active" && !registeredTeamIds.has(team._id));
  const candidateTeams = allCandidates.filter((team) => !teamSearch.trim() || team.name.toLowerCase().includes(teamSearch.trim().toLowerCase()));
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

      <AdminPageBanner
        breadcrumb="Seasons / Workspace"
        title={selected?.name ?? "Season Details"}
        description="Manage this season's configuration, registered teams, groups, auction and competition lifecycle."
      />
      {selectedSeasonQuery.loading ? <Skeleton className="h-32" /> : null}
      {selectedSeasonQuery.error ? <ErrorState message={selectedSeasonQuery.error} onRetry={selectedSeasonQuery.reload} /> : null}

      {/* ───── Workspace ───── */}
      <div className="space-y-5">
        {selected ? (
          <>
            {/* Hero */}
            <GlassCard className="relative overflow-hidden p-5 sm:p-6">
              <div aria-hidden className="pitch-stripes pointer-events-none absolute inset-x-0 top-0 h-28 opacity-20 mask-[linear-gradient(to_bottom,black,transparent)]" />
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
                {selected.status === "upcoming" ? <>
                  <Button size="sm" disabled={saving || hasAuctionHistory || hasFixtures} onClick={() => void runLifecycle("draft")} variant="surface">Return to Draft</Button>
                  {selected.auctionLifecycleStatus === "in_progress" ? (
                    <Button size="sm" disabled={saving} onClick={() => void completeAuction()}>Complete Auction</Button>
                  ) : null}
                  {selected.auctionLifecycleStatus === "completed" ? <>
                    <Badge tone="gold">Auction completed</Badge>
                    <Button size="sm" variant="surface" disabled={saving || hasFixtures} onClick={() => void reopenAuction()}>Reopen Auction</Button>
                  </> : null}
                  <Button size="sm" disabled={saving || activationReadinessBlockers.length > 0} onClick={() => void runLifecycle("active")}>Activate Season</Button>
                </> : null}
                {selected.status === "active" ? <Button size="sm" disabled={saving} variant="danger" onClick={() => void runLifecycle("complete")}>Complete Season</Button> : null}
                {selected.status === "completed" ? <Button size="sm" disabled={saving} onClick={() => void runLifecycle("archive")}>Archive Season</Button> : null}
                {selected.status === "draft" ? <Button size="sm" disabled={saving || dependenciesExist} variant="danger" onClick={() => void removeSelectedSeason()}>Delete empty Draft</Button> : null}
              </div>
              {selected.status === "draft" && dependenciesExist ? (
                <p className="relative mt-3 text-xs text-muted">Delete is unavailable because this Draft has linked teams, groups, auction lots or fixtures. Remove the unused setup records first.</p>
              ) : null}
              {selected.status === "draft" ? (
                <div className="relative mt-3">
                  <Note tone={upcomingReadinessBlockers.length ? "warning" : "muted"}>
                    <p className="font-semibold text-fg">To move this season to Upcoming</p>
                    <p className="mt-1">Complete the season rules, register at least two teams within the configured team limit, and finish all required group assignments.</p>
                    {upcomingReadinessBlockers.length ? <ul className="mt-2 list-disc space-y-0.5 pl-5">{upcomingReadinessBlockers.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2">The visible setup checks are complete.</p>}
                  </Note>
                </div>
              ) : null}
              {selected.status === "upcoming" ? (
                <div className="relative mt-3">
                  <Note tone={activationReadinessBlockers.length ? "warning" : "muted"}>
                    <p className="font-semibold text-fg">To activate this season</p>
                    <p className="mt-1">The auction must be completed, the exact configured number of teams must be eligible, and every participating team must belong to a valid group.</p>
                    {activationReadinessBlockers.length ? <ul className="mt-2 list-disc space-y-0.5 pl-5">{activationReadinessBlockers.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2">The visible activation checks are complete.</p>}
                  </Note>
                </div>
              ) : null}
              {selected.status === "active" ? (
                <div className="relative mt-3">
                  <Note tone={completionReadinessBlockers.length ? "warning" : "muted"}>
                    <p className="font-semibold text-fg">To complete this season</p>
                    <p className="mt-1">Resolve all fixtures and required audit details, close pending auction work, and assign both Champions and Runner-up honours.</p>
                    {completionReadinessBlockers.length ? <ul className="mt-2 list-disc space-y-0.5 pl-5">{completionReadinessBlockers.map((item, index) => <li key={item + index}>{item}</li>)}</ul> : <p className="mt-2">The visible completion checks are complete.</p>}
                  </Note>
                </div>
              ) : null}
              {selected.status === "completed" ? (
                <div className="relative mt-3">
                  <Note>Archive this season after its final review. Archived seasons remain available as historical records and are permanently read-only.</Note>
                </div>
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

              {/* ───── Teams ───── */}
              <GlassCard className="p-5 sm:p-6">
                <SectionHeader
                  icon={Users}
                  title="Participating teams"
                  hint="Team registration closes at activation. Managers can be reassigned until completion, including after fixtures exist. Group assignments lock after the first fixture."
                  aside={<Badge tone={teamCap > 0 && slotsLeft === 0 ? "accent" : "info"}>{registeredTeams.length} / {teamCap} slots</Badge>}
                />
                {managersQuery.loading ? <p className="mb-3 text-xs text-muted">Loading manager options…</p> : null}
                {managersQuery.error ? <ErrorState message={"Could not load managers: " + managersQuery.error} onRetry={managersQuery.reload} /> : null}

                {/* slot meter for team registration*/}
                <div className="mb-4">
                  <div className="flex gap-1" role="img" aria-label={registeredTeams.length + " of " + teamCap + " team slots filled"}>
                    {Array.from({ length: Math.min(Math.max(teamCap, 1), 24) }, (_, index) => (
                      <span
                        key={index}
                        className={"h-1.5 flex-1 rounded-full transition-colors duration-300 " +
                          (index < registeredTeams.length ? "bg-accent" : activeTeamsTab === "add" && index < registeredTeams.length + registrationIds.length ? "bg-accent/40" : "bg-line")}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {teamCap > 0 ? (slotsLeft ? slotsLeft + " slot(s) left. " : "All slots are filled. ") : "Set a team limit in the auction settings. "}
                    Registration is open in Draft and Upcoming, and freezes when the season becomes Active.
                  </p>
                </div>

                {preActivation ? (
                  <div role="tablist" aria-label="Team registration" className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface/40 p-1 backdrop-blur-md">
                    {([["registered", "Registered", registeredTeams.length], ["add", "Add teams", allCandidates.length]] as const).map(([key, label, count]) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={activeTeamsTab === key}
                        onClick={() => setTeamsTab(key)}
                        className={"flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                          (activeTeamsTab === key ? "bg-primary text-primary-fg shadow-glass" : "text-muted hover:text-fg")}
                      >
                        {label}
                        <span className="rounded-full bg-bg/40 px-1.5 text-xs tabular">{count}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Registered Teams List */}
                {activeTeamsTab === "registered" ? (
                  <>
                    {seasonTeams.loading ? <Skeleton className="h-20" /> : null}
                    {seasonTeams.error ? <ErrorState message={seasonTeams.error} onRetry={seasonTeams.reload} /> : null}
                    <ul className="space-y-2">
                      {registeredTeams.map((team) => {
                        const linked = seasonLots.some((lot) => typeof lot.seasonTeamRef === "object" && lot.seasonTeamRef?._id === team._id) || seasonFixtures.some((match) => {
                          const home = typeof match.homeSeasonTeamRef === "object" ? match.homeSeasonTeamRef._id : match.homeSeasonTeamRef;
                          const away = typeof match.awaySeasonTeamRef === "object" ? match.awaySeasonTeamRef._id : match.awaySeasonTeamRef;
                          return home === team._id || away === team._id;
                        });
                        const managersAssignedElsewhere = registeredTeams
                          .filter((otherTeam) => otherTeam._id !== team._id)
                          .flatMap((otherTeam) => otherTeam.managerRefs);
                        const teamManagerOptions = getSeasonTeamManagerOptions(
                          managerDirectory, team.managerRefs, managersAssignedElsewhere,
                        );
                        const withdrawn = team.status === "withdrawn";
                        return (
                          <li key={team._id} className={panel + " group overflow-hidden transition duration-200 hover:border-accent/40 hover:bg-surface/30"}>
                            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <Avatar
                                  name={team.displayName}
                                  asset={team.team?.logo ?? team.logoSnapshot}
                                  className={"h-14 w-14 shrink-0 rounded-2xl border border-line bg-surface/70 object-cover shadow-sm " + (withdrawn ? "grayscale opacity-60" : "transition-transform duration-200 group-hover:scale-[1.03]")}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className={"min-w-0 wrap-break-word text-sm font-semibold leading-tight " + (withdrawn ? "text-muted" : "text-fg")}>{team.displayName}</p>
                                    {preActivation && linked ? <Lock className="h-3.5 w-3.5 shrink-0 text-faint" aria-label="Has auction or fixture history" /> : null}
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                    <Badge tone={withdrawn ? "danger" : "accent"} className="px-2 py-0.5 text-[10px] uppercase tracking-wide">{team.status}</Badge>
                                    {team.group ? <Badge tone="neutral" className="px-2 py-0.5 text-[10px]">{team.group.groupName}</Badge> : null}
                                    <span className="text-[11px] text-muted">{team.managers.length} {team.managers.length === 1 ? "manager" : "managers"}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">

                                {preActivation && !withdrawn ? <Button size="sm" variant="danger" disabled={saving || linked} onClick={() => void manageSeasonTeam(team, "remove")}>Remove</Button> : null}
                                {selected.status === "active" && ["registered", "active"].includes(team.status) ? <Button size="sm" variant="danger" disabled={saving} onClick={() => void manageSeasonTeam(team, "withdraw")}>Withdraw</Button> : null}
                                {selected.status === "active" && withdrawn ? <Button size="sm" disabled={saving} onClick={() => void manageSeasonTeam(team, "recall")}>Recall / Reinstate</Button> : null}
                              </div>
                            </div>

                            <div className="border-t border-line bg-surface/25 px-4 py-4">
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-xs font-semibold text-fg">Team managers</p>
                                  <p className="mt-0.5 text-[11px] text-muted">Select a manager to assign or remove them from this team.</p>
                                </div>
                                <Badge tone="neutral" className="px-2 py-0.5 text-[10px]">{team.managers.length} assigned</Badge>
                              </div>
                              {team.managers.length ? (
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {team.managers.map((manager) => (
                                    <span key={manager._id} className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface/70 py-1 pl-1 pr-3 shadow-sm">
                                      <Avatar name={manager.name} asset={manager.profilePic} className="h-7 w-7 shrink-0 border border-line bg-surface object-cover" />
                                      <span className="max-w-48 truncate text-xs font-medium text-fg">{manager.name}</span>
                                      {manager.role ? <span className="hidden border-l border-line pl-2 text-[10px] text-muted sm:inline">{manager.role}</span> : null}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mb-3 rounded-xl border border-dashed border-line bg-surface/40 px-3 py-2 text-xs text-muted">No managers assigned to this team yet.</p>
                              )}
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Available managers</p>
                                <span className="text-[11px] text-muted">Tap to add · tap again to remove</span>
                              </div>
                              {managersQuery.error ? (
                                <p className="text-xs text-danger">Manager options could not be loaded. Retry the manager list above.</p>
                              ) : managersQuery.loading ? (
                                <p className="text-xs text-muted">Loading manager options…</p>
                              ) : (
                                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pb-1" aria-label={"Managers for " + team.displayName}>
                                  {teamManagerOptions.map((manager) => {
                                    const assigned = team.managerRefs.includes(manager._id);
                                    return (
                                      <Chip
                                        key={manager._id}
                                        selected={assigned}
                                        disabled={!canToggleSeasonTeamManagerAssignment(selected.status, manager.status, assigned) || saving}
                                        onClick={() => void assignManagers(team, assigned ? team.managerRefs.filter((id) => id !== manager._id) : [...team.managerRefs, manager._id])}
                                      >
                                        <Avatar name={manager.name} asset={manager.profilePic} className="h-7 w-7 shrink-0 border border-line bg-surface object-cover" />
                                        <span className="max-w-40 truncate">{manager.name}</span>
                                        {manager.status !== "active" ? <span className="text-[10px] text-muted">(Inactive)</span> : null}
                                      </Chip>
                                    );
                                  })}
                                  {!teamManagerOptions.length ? <span className="text-xs text-muted">No eligible managers are available for this team. Create or activate managers, or remove an existing assignment from another team.</span> : null}
                                </div>
                              )}
                              {!canEditSeasonTeamManagers(selected.status) ? <p className="mt-2 text-xs text-muted">Manager assignments are read-only after the season is completed.</p> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {!registeredTeams.length && !seasonTeams.loading ? (
                      <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center">
                        <p className="text-sm text-muted">No teams are registered in this season yet.</p>
                        {preActivation ? <Button className="mt-3" size="sm" onClick={() => setTeamsTab("add")}><Plus className="h-4 w-4" /> Add teams</Button> : null}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div>
                    <div className="relative mb-3">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                      <Input className="pl-9" aria-label="Search permanent teams" placeholder="Search teams…" value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} />
                    </div>
                    {allCandidates.length ? (
                      candidateTeams.length ? (
                        <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                          {candidateTeams.map((team) => {
                            const checked = registrationIds.includes(team._id);
                            const blocked = !checked && registrationIds.length >= slotsLeft;
                            return (
                              <button
                                key={team._id}
                                type="button"
                                role="checkbox"
                                aria-checked={checked}
                                disabled={blocked}
                                onClick={() => toggleTeam(team._id, registrationIds, setRegistrationIds)}
                                className={"flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-45 " +
                                  (checked ? "border-accent bg-accent/10 text-fg" : "border-line bg-surface/40 text-fg hover:border-accent/60")}
                              >
                                <TeamAvatar name={team.name} />
                                <span className="min-w-0 flex-1 truncate font-medium">{team.name}</span>
                                <span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition " + (checked ? "border-accent bg-accent text-accent-fg" : "border-line text-transparent")}>
                                  <Check className="h-3 w-3" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">No teams match your search.</p>
                    ) : <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">All active teams are already registered in this season.</p>}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/40 p-3 backdrop-blur-md">
                      <p className="text-xs text-muted">
                        <span className="font-semibold tabular text-fg">{registrationIds.length}</span> selected · {Math.max(slotsLeft - registrationIds.length, 0)} slot(s) left
                      </p>
                      <div className="flex gap-2">
                        {registrationIds.length ? <Button size="sm" variant="surface" disabled={saving} onClick={() => setRegistrationIds([])}>Clear</Button> : null}
                        <Button size="sm" disabled={saving || !registrationIds.length || registeredTeams.length + registrationIds.length > teamCap} onClick={() => void registerTeams()}>
                          Register selected teams
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>

            <div className="grid items-start gap-5 lg:grid-cols-5">
              {/* ───── Season groups ───── */}
              <GlassCard className="p-5 sm:p-6 lg:col-span-3">
                <SectionHeader
                  icon={Layers3}
                  title="Season groups"
                  hint={
                    <div className="space-y-0.5">
                      <p>Create groups and assign teams to them before fixtures are created.</p>
                      <p>Delete is unavailable while any team registration, including withdrawn or completed ones, refers to this group.</p>
                      {hasFixtures ? <p>Groups are locked because this season already has fixtures.</p> : null}
                    </div>
                  }
                  aside={<Badge tone={assignableTeams.length > 0 && unassignedTeams.length === 0 ? "accent" : "info"}>{assignedTeamCount} / {assignableTeams.length} assigned</Badge>}
                />

                {/* slot meter for the season groups assignment */}
                {assignableTeams.length > 0 ? (
                  <div className={panel + " mb-4 p-3"}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-fg">
                        {unassignedTeams.length ? `${unassignedTeams.length} team(s) waiting for a group` : "Every team has a group"}
                      </span>
                      <span className="tabular text-muted">{assignedTeamCount} of {assignableTeams.length}</span>
                    </div>
                    <div
                      className="mt-2 flex gap-1"
                      role="img"
                      aria-label={`${assignedTeamCount} of ${assignableTeams.length} teams assigned to groups`}
                    >
                      {Array.from({ length: Math.min(assignableTeams.length, 24) }, (_, index) => (
                        <span
                          key={index}
                          className={
                            "h-1.5 flex-1 rounded-full transition-colors duration-300 " +
                            (index < assignedTeamCount ? "bg-accent" : "bg-line")
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

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
                  <div className="mb-3"><Note>Group creation, editing and team assignment are frozen after activation or fixture creation.</Note></div>
                )}
                {preActivation && !hasFixtures && selected.groupStageEnabled !== false && !registeredTeams.length ? (
                  <div className="mb-3"><Note>Register participating teams before creating groups.</Note></div>
                ) : null}

                {groups.loading ? <Skeleton className="mb-3 h-20" /> : null}
                {groups.error ? <ErrorState message={groups.error} onRetry={groups.reload} /> : null}
                {!groups.loading && !groups.error && groups.data ? (
                  <div className="space-y-4">
                    {seasonGroups.map((group) => {
                      const draft = groupDrafts[group._id];
                      const assigned = registeredTeams.filter((team) => team.groupRef === group._id);
                      const historicalCount = assigned.filter((team) => !["registered", "active"].includes(team.status)).length;
                      return (
                        <div key={group._id} className={panel + " overflow-hidden"}>
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-primary/10 px-4 py-3">
                            {!draft ? (
                              <>
                                <div className="flex min-w-0 items-center gap-3">
                                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-lg text-primary-fg">{group.groupName.charAt(0).toUpperCase()}</span>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-fg">{group.groupName}</p>
                                    <p className="text-xs text-muted">Display order {group.displayOrder} · {assigned.length} {assigned.length === 1 ? "team" : "teams"}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="surface" disabled={saving || groupsLocked} onClick={() => editGroup(group)}>Edit</Button>
                                  <Button size="sm" variant="danger" disabled={saving || assigned.length > 0 || groupsLocked} onClick={() => void removeGroup(group)}>Delete</Button>
                                </div>
                              </>
                            ) : (
                              <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1fr)_7rem] sm:items-end">
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
                          </div>

                          <div className="space-y-4 p-4">
                            <div>
                              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg"><Users className="h-3.5 w-3.5 text-accent" /> Teams in this group</p>
                              {assigned.length ? (
                                <ul className="grid gap-2 sm:grid-cols-2">
                                  {assigned.map((team) => {
                                    const withdrawn = team.status === "withdrawn";
                                    return (
                                      <li key={team._id} className="flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-2.5 py-2 backdrop-blur-md">
                                        <TeamAvatar name={team.displayName} muted={withdrawn} />
                                        <div className="min-w-0 flex-1">
                                          <p className={"truncate text-sm font-medium " + (withdrawn ? "text-muted" : "text-fg")}>{team.displayName}</p>
                                          {!["registered", "active"].includes(team.status) ? <p className="text-xs capitalize text-faint">{team.status}</p> : null}
                                        </div>
                                        {!groupsLocked && !withdrawn ? (
                                          <button
                                            type="button"
                                            aria-label={"Remove " + team.displayName + " from " + group.groupName}
                                            title="Remove from group"
                                            disabled={saving}
                                            onClick={() => void changeGroupAssignment(team, "")}
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line text-muted transition hover:border-danger hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
                                  No teams in this group yet.{!groupsLocked && unassignedTeams.length ? " Add teams from the list below." : ""}
                                </p>
                              )}
                              {historicalCount > 0 ? <p className="mt-2 text-xs text-faint">{historicalCount} historical (withdrawn, eliminated or completed)</p> : null}
                            </div>

                            {!groupsLocked ? (
                              <div className="border-t border-line pt-3">
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-fg">
                                  <UserPlus className="h-3.5 w-3.5 text-accent" /> Add teams
                                  <span className="font-normal text-muted">· {unassignedTeams.length} available</span>
                                </p>
                                {unassignedTeams.length ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {unassignedTeams.map((team) => (
                                      <button
                                        key={team._id}
                                        type="button"
                                        disabled={saving}
                                        aria-label={"Add " + team.displayName + " to " + group.groupName}
                                        onClick={() => void changeGroupAssignment(team, group._id)}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/50 py-1 pl-1.5 pr-3 text-xs font-medium text-muted backdrop-blur-md transition hover:border-accent hover:bg-accent/10 hover:text-fg disabled:opacity-50"
                                      >
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/30 text-accent"><Plus className="h-3 w-3" /></span>
                                        {team.displayName}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted">{registeredTeams.length ? "All teams are assigned. Remove a team from a group to make it available again." : "Register teams to add them here."}</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {!seasonGroups.length ? <p className="text-sm text-muted">No groups created for this season.</p> : null}
                  </div>
                ) : null}
              </GlassCard>

                <GlassCard className="p-5 sm:p-6 lg:col-span-2">
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
            <h2 className="font-display text-2xl text-fg">Season not found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">This season could not be loaded. Return to the Season Library and choose an available season.</p>
            <Link to="/admin/seasons" className="mt-4 inline-flex"><Button variant="surface">Back to Season Library</Button></Link>
          </GlassCard>
        )}
      </div>

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
      <Modal
        open={Boolean(recallTarget)}
        title="Recall / reinstate team"
        description={recallTarget ? `Enter the reason for reinstating ${recallTarget.displayName}. This reason will be saved in the team's participation history.` : undefined}
        onClose={() => setRecallTarget(null)}
      >
        <form className="grid gap-3" onSubmit={submitRecall}>
          <label className="grid gap-1.5 text-sm text-fg">
            Recall reason
            <Input
              autoFocus
              value={recallReason}
              onChange={(event) => setRecallReason(event.target.value)}
              placeholder="Enter a reason for recalling this team"
              required
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="surface" disabled={saving} onClick={() => setRecallTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={saving || recallReason.trim().length < 3}>{saving ? "Saving…" : "Recall team"}</Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
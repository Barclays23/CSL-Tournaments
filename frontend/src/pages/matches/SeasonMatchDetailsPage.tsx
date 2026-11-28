import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Drawer } from "@/components/ui/Drawer";
import { ICONS, TONES, ToneHeader, ToneIcon, pillClass, type Tone } from "@/components/ui/Tones";
import { GoalManagementDrawer } from "@/components/matches/GoalManagementDrawer";
import { CardManagementDrawer } from "@/components/matches/CardManagementDrawer";
import { PenaltyShootoutManagementDrawer } from "@/components/matches/PenaltyShootoutManagementDrawer";
import { CompletedMatchCorrectionDrawer } from "@/components/matches/CompletedMatchCorrectionDrawer";
import { MatchStatusManager } from "@/components/matches/MatchStatusManager";
import { MatchDecidingRulesSection } from "@/components/matches/MatchDecidingRulesSection";
import { MatchEngineCorrectionSection } from "@/components/matches/MatchEngineCorrectionSection";
import {
  MatchEventIcon,
  type MatchEventKind,
} from "@/components/matches/MatchEventIcon";
import { SeasonMatchForm } from "@/components/forms/SeasonMatchForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import {
  addSeasonMatchGoal,
  addSeasonMatchCard,
  correctCompletedSeasonMatch,
  deleteSeasonMatchGoal,
  deleteSeasonMatchCard,
  getSeasonMatchById,
  updateSeasonMatch,
  updateSeasonMatchGoal,
  updateSeasonMatchShootout,
  updateSeasonMatchCard,
} from "@/services/seasonMatchService";
import {
  getSeasonById,
  getSeasonTeams,
  getAuctionLots,
} from "@/services/seasonService";
import { getVenues } from "@/services/venueService";
import type {
  SeasonMatch,
  SeasonMatchCardType,
  SeasonMatchTeamRef,
  SeasonMatchWrite,
  SeasonMatchCorrectionWrite,
  MatchTimedPeriod,
  MatchShootoutWrite,
  MatchEventAuditValue,
} from "@/types/seasonMatch.types";
import type { AuctionLot } from "@/types/season.types";
import { formatDate, formatTime } from "@/utils/formatDate";
import { refId } from "@/utils/refs";
import { canEditSeasonMatch } from "@/utils/seasonMatchPermissions";
import { formatMatchEventTime, getAvailableEventPeriods, getDefaultEventTiming, getPeriodBoundaryMinute, isEventTimeAheadOfClock, MATCH_TIMED_PERIODS } from "@/utils/matchTiming";

const STAGE_LABEL: Record<SeasonMatch["stage"], string> = {
  group: "Group stage",
  round_of_16: "Round of 16",
  quarter_final: "Quarter-final",
  semi_final: "Semi-final",
  third_place: "Third-place playoff",
  final: "Final",
};
const STATUS_LABEL: Record<SeasonMatch["status"], string> = {
  scheduled: "Upcoming",
  live: "Live",
  completed: "Full time",
  postponed: "Postponed",
  cancelled: "Cancelled",
  abandoned: "Abandoned",
};
const STATUS_TONE: Record<SeasonMatch["status"], string> = {
  scheduled: "bg-info/15 text-info",
  live: "bg-success/15 text-success",
  completed: "bg-fg/10 text-muted",
  postponed: "bg-warning/15 text-warning",
  cancelled: "bg-danger/15 text-danger",
  abandoned: "bg-danger/15 text-danger",
};

// Tone per match-event kind (ring around the timeline icon + action buttons)
const EVENT_TONE: Record<MatchEventKind, Tone> = {
  goal: "success",
  own_goal: "accent",
  yellow_card: "gold",
  second_yellow: "gold",
  red_card: "info",
} as Record<MatchEventKind, Tone>;

function getEventAuditSummary(value: MatchEventAuditValue | null): string {
  if (!value) return "No event";
  const time = formatMatchEventTime(value.period, value.minute, value.addedMinutes);
  if (value.eventType === "goal") {
    return `Goal · ${value.goalType === "own_goal" ? "Own goal" : "Normal"} · ${time} · Team ${value.scoringSeasonTeamRef}`;
  }
  return `Card · ${value.cardType.replaceAll("_", " ")} · ${time} · Team ${value.seasonTeamRef}`;
}

type MatchEvent = {
  id: string;
  kind: MatchEventKind;
  teamId: string;
  playerName: string;
  period: MatchTimedPeriod | null;
  minute: number | null;
  addedMinutes: number;
  goalId?: string;
  cardId?: string;
};

function teamDetails(ref: SeasonMatchTeamRef) {
  if (typeof ref === "string")
    return { id: ref, teamId: null as string | null, name: "Team", logo: null };
  return {
    id: ref._id,
    teamId: ref.team?._id ?? null,
    name: ref.displayName,
    logo: ref.logoSnapshot ?? ref.team?.logo ?? null,
  };
}
function lotTeamId(lot: AuctionLot) {
  return typeof lot.seasonTeamRef === "string"
    ? lot.seasonTeamRef
    : (lot.seasonTeamRef?._id ?? "");
}
function lotPlayer(lot: AuctionLot) {
  return typeof lot.playerRef === "string" ? null : lot.playerRef;
}

function buildEvents(
  goals: SeasonMatch["goals"],
  cards: NonNullable<SeasonMatch["cards"]> = [],
): MatchEvent[] {
  const goalEvents: MatchEvent[] = goals.map((goal) => {
    const scorer = goal.scorerPlayerRef && typeof goal.scorerPlayerRef !== "string"
      ? goal.scorerPlayerRef.name : null;
    return {
      id: `goal-${goal._id}`,
      kind: goal.goalType === "own_goal" ? "own_goal" : "goal",
      teamId: refId(goal.scoringSeasonTeamRef) ?? "",
      playerName: scorer ?? (goal.goalType === "own_goal" ? "Player" : "Scorer not recorded"),
      period: goal.period ?? null,
      minute: goal.minute ?? null,
      addedMinutes: goal.addedMinutes ?? 0,
      goalId: goal._id,
    };
  });
  const cardEvents: MatchEvent[] = cards.map((card) => ({
    id: `card-${card._id}`,
    kind: card.cardType,
    teamId: refId(card.seasonTeamRef) ?? "",
    playerName: typeof card.playerRef === "string" ? "Player" : card.playerRef.name,
    period: card.period ?? null,
    minute: card.minute ?? null,
    addedMinutes: card.addedMinutes ?? 0,
    cardId: card._id,
  }));
  const periodOrder = (period: MatchTimedPeriod | null) => period ? MATCH_TIMED_PERIODS.indexOf(period) : 99;
  // Event chronology is derived only from period/minute/added time. createdAt is not match time.
  return [...goalEvents, ...cardEvents].sort((a, b) =>
    periodOrder(a.period) - periodOrder(b.period)
    || (a.minute ?? Number.MAX_SAFE_INTEGER) - (b.minute ?? Number.MAX_SAFE_INTEGER)
    || a.addedMinutes - b.addedMinutes
    || a.id.localeCompare(b.id),
  );
}

const CalendarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </svg>
);
const PinIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
const PencilIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
  </svg>
);
const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

const iconBtnBase =
  "inline-flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md transition-colors";

function TeamSide({
  team,
  side,
  adminMode,
}: {
  team: ReturnType<typeof teamDetails>;
  side: "home" | "away";
  adminMode: boolean;
}) {
  // Home = primary, Away = info, so the two sides are told apart at a glance
  const content = (
    <div
      className={`flex min-w-0 flex-col items-center gap-3 text-center ${
        side === "home"
          ? "sm:flex-row-reverse sm:justify-start sm:text-right"
          : "sm:flex-row sm:justify-start sm:text-left"
      }`}
    >
      <Avatar
        name={team.name}
        asset={team.logo}
        className={`h-14 w-14 shrink-0 rounded-xl ring-2 sm:h-16 sm:w-16 ${side === "home" ? "ring-primary/50" : "ring-info/50"}`}
      />
      <p className="min-w-0 wrap-break-word font-display text-lg leading-tight text-fg sm:text-2xl">
        {team.name}
      </p>
    </div>
  );

  if (!team.teamId) return content;

  return (
    <Link
      to={adminMode ? "/admin/teams/$teamId" : "/teams/$teamId"}
      params={{ teamId: team.teamId }}
      aria-label={"View " + team.name + " team details"}
      className={`rounded-xl p-2 transition hover:bg-glass focus-visible:outline-2 focus-visible:outline-accent ${side === "home" ? "hover:text-success" : "hover:text-info"}`}
    >
      {content}
    </Link>
  );
}

function EventText({
  event,
  side,
  canManageEvents,
  onEditGoal,
  onDeleteGoal,
  onEditCard,
  onDeleteCard,
}: {
  event: MatchEvent;
  side: "home" | "away";
  canManageEvents: boolean;
  onEditGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onEditCard: (id: string) => void;
  onDeleteCard: (id: string) => void;
}) {
  const manage = canManageEvents && Boolean(event.goalId || event.cardId);
  const t = TONES[EVENT_TONE[event.kind] ?? "info"];
  const title =
    event.kind === "yellow_card"
      ? "Yellow card"
      : event.kind === "red_card"
        ? "Red card"
        : event.kind === "second_yellow"
          ? "Second yellow card"
          : event.kind === "own_goal"
            ? "Own goal"
            : "Goal";
  const content = (
    <div className={`min-w-0 ${side === "home" ? "text-right" : "text-left"}`}>
      <p className="truncate text-sm font-semibold text-fg">
        {event.playerName}
        {event.kind === "own_goal" ? (
          <span className="ml-1 font-medium text-danger">(OG)</span>
        ) : null}
      </p>
      <p className={`text-xs font-medium ${t.text}`}>{title}</p>
      <p className="text-xs tabular text-faint">{formatMatchEventTime(event.period, event.minute, event.addedMinutes)}</p>
    </div>
  );
  const actions = manage ? (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        className={`${iconBtnBase} ${t.iconBtn}`}
        aria-label={`Edit ${title} for ${event.playerName}`}
        onClick={() =>
          event.goalId ? onEditGoal(event.goalId) : onEditCard(event.cardId!)
        }
      >
        <PencilIcon />
      </button>
      <button
        type="button"
        className={`${iconBtnBase} border-line bg-surface/60 text-muted hover:bg-glass-strong hover:text-danger`}
        aria-label={`Delete ${title} for ${event.playerName}`}
        onClick={() =>
          event.goalId
            ? onDeleteGoal(event.goalId)
            : onDeleteCard(event.cardId!)
        }
      >
        <TrashIcon />
      </button>
    </div>
  ) : null;

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${side === "home" ? "justify-end" : "justify-start"}`}
    >
      {side === "home" ? (
        <>
          {actions}
          {content}
        </>
      ) : (
        <>
          {content}
          {actions}
        </>
      )}
    </div>
  );
}

export function SeasonMatchDetailsPage(props: {
  seasonId: string;
  matchId: string;
  adminMode?: boolean;
}) {
  const { seasonId, matchId } = props;
  const adminMode = props.adminMode ?? false;
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [goalTeamId, setGoalTeamId] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalType, setGoalType] = useState<"normal" | "own_goal">("normal");
  const [goalReason, setGoalReason] = useState("");
  const [goalPlayerId, setGoalPlayerId] = useState("");
  const [goalPeriod, setGoalPeriod] = useState<MatchTimedPeriod | null>(null);
  const [goalMinute, setGoalMinute] = useState(1);
  const [goalAddedMinutes, setGoalAddedMinutes] = useState(0);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [cardTeamId, setCardTeamId] = useState("");
  const [cardType, setCardType] = useState<SeasonMatchCardType>("yellow_card");
  const [cardReason, setCardReason] = useState("");
  const [cardPlayerId, setCardPlayerId] = useState("");
  const [cardPeriod, setCardPeriod] = useState<MatchTimedPeriod | null>(null);
  const [cardMinute, setCardMinute] = useState(1);
  const [cardAddedMinutes, setCardAddedMinutes] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [shootoutOpen, setShootoutOpen] = useState(false);
  const [savingShootout, setSavingShootout] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);

  const matchQuery = useServiceQuery(
    () => getSeasonMatchById(seasonId, matchId),
    [seasonId, matchId],
  );
  const seasonQuery = useServiceQuery(
    () => getSeasonById(seasonId),
    [seasonId],
  );
  const teamsQuery = useServiceQuery(
    () => getSeasonTeams(seasonId),
    [seasonId],
  );
  const groupsQuery = useServiceQuery(
    () =>
      import("@/services/seasonMatchService").then(({ getSeasonGroups }) =>
        getSeasonGroups(seasonId),
      ),
    [seasonId],
  );
  const venuesQuery = useServiceQuery(() => getVenues("all"), []);
  const lotsQuery = useServiceQuery(
    () => getAuctionLots({ seasonId, auctionStatus: "sold" }),
    [seasonId],
  );
  const match = matchQuery.data?.data;
  const selectedSeason = seasonQuery.data?.data;
  const canManageActiveSeason = isAdmin && selectedSeason?.status === "active";
  const canChangeFixtures =
    canManageActiveSeason &&
    selectedSeason?.auctionLifecycleStatus === "completed";
  const fixtureManagementHint = !selectedSeason
    ? null
    : selectedSeason.status === "upcoming"
      ? "This season is Upcoming. Fixture details can only be created, edited or deleted after the season becomes Active. Complete the auction and activate the season from the Seasons page. You can still view this match and its history."
      : selectedSeason.status === "draft"
        ? "This season is still in Draft. Complete the season setup, move it to Upcoming, finish the auction, and activate it before managing fixtures."
        : selectedSeason.status === "completed" ||
            selectedSeason.status === "archived"
          ? "This season is read-only. Fixture creation, editing and deletion are available only while the season is Active."
          : selectedSeason.auctionLifecycleStatus !== "completed"
            ? "The auction must be completed before fixture details can be changed. Existing match results and incident history remain available."
            : null;

  const dateLabel = (value?: string | null) => {
    if (!value) return "Not configured";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not configured";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(date);
  };
  const seasonDateRange = `${dateLabel(selectedSeason?.startDate)} – ${dateLabel(selectedSeason?.endDate)}`;

  if (matchQuery.loading)
    return (
      <PageContainer>
        <Skeleton className="h-64" />
      </PageContainer>
    );
  if (matchQuery.error || !match) {
    return (
      <PageContainer>
        <ErrorState
          message={matchQuery.error || "Fixture not found"}
          onRetry={matchQuery.reload}
        />
      </PageContainer>
    );
  }

  const home = teamDetails(match.homeSeasonTeamRef);
  const away = teamDetails(match.awaySeasonTeamRef);
  const homeScore = match.goals.filter(
    (goal) => refId(goal.scoringSeasonTeamRef) === home.id,
  ).length;
  const awayScore = match.goals.filter(
    (goal) => refId(goal.scoringSeasonTeamRef) === away.id,
  ).length;
  const winnerId = refId(match.winnerSeasonTeamRef);
  const scoringTeamId = goalTeamId || home.id;
  const playerTeamId =
    goalType === "normal"
      ? scoringTeamId
      : scoringTeamId === home.id
        ? away.id
        : home.id;
  const eligibleGoalPlayers = (lotsQuery.data?.data ?? []).filter(
    (lot) => lotTeamId(lot) === playerTeamId && lotPlayer(lot),
  );
  const canManageGoals = canManageActiveSeason && match.status === "live";
  const canManageCards = canManageActiveSeason && match.status === "live";
  const canManageShootout =
    canManageActiveSeason && match.stage !== "group" && match.status === "live" && match.phase === "penalty_shootout";
  const showScore =
    match.status === "live" ||
    match.status === "completed" ||
    (match.status !== "scheduled" && match.goals.length > 0);
  const hasPreMatchGoals =
    match.status === "scheduled" && match.goals.length > 0;
  const events = buildEvents(match.goals, match.cards ?? []);
  const availableEventPeriods = getAvailableEventPeriods(match);
  const goalStoppageTimeAllowed = Boolean(goalPeriod && goalMinute === getPeriodBoundaryMinute(match, goalPeriod));
  const cardStoppageTimeAllowed = Boolean(cardPeriod && cardMinute === getPeriodBoundaryMinute(match, cardPeriod));
  const eligibleCardPlayers = (lotsQuery.data?.data ?? []).filter(
    (lot) => lotTeamId(lot) === (cardTeamId || home.id) && lotPlayer(lot),
  );
  const shootoutPlayers = (lotsQuery.data?.data ?? []).flatMap((lot) => {
    const player = lotPlayer(lot);
    return player
      ? [{ id: player._id, name: player.name, seasonTeamId: lotTeamId(lot) }]
      : [];
  });

  // Group name (only meaningful in the group stage). Adjust the field name if your type differs.
  const rawGroup = (
    match as unknown as {
      groupRef?: string | { _id: string; name?: string } | null;
    }
  ).groupRef;
  const groupId = typeof rawGroup === "string" ? rawGroup : rawGroup?._id;
  const groupName =
    match.stage === "group"
      ? (typeof rawGroup === "object" && rawGroup?.name) ||
        (
          groupsQuery.data?.data as unknown as
            | { _id: string; name?: string }[]
            | undefined
        )?.find((g) => g._id === groupId)?.name ||
        null
      : null;
  const venueName =
    match.venueRef && typeof match.venueRef === "object"
      ? match.venueRef.name
      : match.venue || null;

  const showEdit = canChangeFixtures && canEditSeasonMatch(match);

  const saveGoal = async () => {
    if (!canManageGoals) {
      toast.error(
        "Goals can only be managed by an admin while the match is Live.",
      );
      return;
    }
    if (!scoringTeamId || (!goalPlayerId && goalType === "normal")) {
      toast.error("Choose the credited team and goal scorer");
      return;
    }
    setSavingGoal(true);
    try {
      if (!goalPeriod || isEventTimeAheadOfClock(match, goalPeriod, goalMinute, goalAddedMinutes, Date.now())) {
        toast.error("Choose an available period and an event time that is not ahead of the Match clock.");
        return;
      }
      const payload = {
        scoringSeasonTeamRef: scoringTeamId,
        scorerPlayerRef: goalPlayerId || null,
        goalType,
        period: goalPeriod,
        minute: goalMinute,
        addedMinutes: goalAddedMinutes,
        ...(goalReason.trim() ? { reason: goalReason.trim() } : {}),
      };
      if (editingGoalId)
        await updateSeasonMatchGoal(seasonId, matchId, editingGoalId, payload);
      else await addSeasonMatchGoal(seasonId, matchId, payload);
      toast.success(editingGoalId ? "Goal updated" : "Goal added");
      setEditingGoalId(null);
      setGoalTeamId("");
      setGoalType("normal");
      setGoalPlayerId("");
      setGoalReason("");
      setGoalOpen(false);
      matchQuery.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save goal",
      );
    } finally {
      setSavingGoal(false);
    }
  };

  const beginGoalEdit = (goalId: string) => {
    if (!canManageGoals) return;
    const goal = match.goals.find((g) => g._id === goalId);
    if (!goal) return;
    const timing = getDefaultEventTiming(match);
    setEditingGoalId(goal._id);
    setGoalTeamId(refId(goal.scoringSeasonTeamRef) ?? home.id);
    setGoalType(goal.goalType);
    setGoalPlayerId(refId(goal.scorerPlayerRef) ?? "");
    setGoalReason("");
    setGoalPeriod(goal.period ?? timing.period);
    setGoalMinute(goal.minute ?? timing.minute);
    setGoalAddedMinutes(goal.addedMinutes ?? timing.addedMinutes);
    setGoalOpen(true);
  };

  const removeGoal = async (goalId: string) => {
    if (!canManageGoals) {
      toast.error(
        "Goals can only be managed by an admin while the match is Live.",
      );
      return;
    }
    const yes = await confirm({
      title: "Remove this goal?",
      description:
        "The score, standings, winner and top-scorer statistics will be recalculated.",
      confirmLabel: "Remove goal",
      danger: true,
    });
    if (!yes) return;
    try {
      await deleteSeasonMatchGoal(seasonId, matchId, goalId, goalReason.trim() || undefined);
      toast.success("Goal removed");
      if (editingGoalId === goalId) setEditingGoalId(null);
      matchQuery.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove goal",
      );
    }
  };

  const saveCard = async () => {
    if (!canManageCards) {
      toast.error(
        "Cards can only be managed by an admin while the match is Live.",
      );
      return;
    }
    if (!cardTeamId || !cardPlayerId) {
      toast.error("Choose the team and player receiving the card.");
      return;
    }
    setSavingCard(true);
    try {
      if (!cardPeriod || isEventTimeAheadOfClock(match, cardPeriod, cardMinute, cardAddedMinutes, Date.now())) {
        toast.error("Choose an available period and an event time that is not ahead of the Match clock.");
        return;
      }
      const payload = {
        seasonTeamRef: cardTeamId,
        playerRef: cardPlayerId,
        cardType,
        period: cardPeriod,
        minute: cardMinute,
        addedMinutes: cardAddedMinutes,
        ...(cardReason.trim() ? { reason: cardReason.trim() } : {}),
      };
      if (editingCardId)
        await updateSeasonMatchCard(seasonId, matchId, editingCardId, payload);
      else await addSeasonMatchCard(seasonId, matchId, payload);
      toast.success(editingCardId ? "Card updated" : "Card recorded");
      setEditingCardId(null);
      setCardTeamId("");
      setCardPlayerId("");
      setCardType("yellow_card");
      setCardReason("");
      setCardOpen(false);
      matchQuery.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save card",
      );
    } finally {
      setSavingCard(false);
    }
  };
  const beginCardEdit = (cardId: string) => {
    if (!canManageCards) return;
    const card = (match.cards ?? []).find((item) => item._id === cardId);
    if (!card) return;
    const timing = getDefaultEventTiming(match);
    setEditingCardId(card._id);
    setCardTeamId(refId(card.seasonTeamRef) ?? home.id);
    setCardType(card.cardType);
    setCardPlayerId(refId(card.playerRef) ?? "");
    setCardReason("");
    setCardPeriod(card.period ?? timing.period);
    setCardMinute(card.minute ?? timing.minute);
    setCardAddedMinutes(card.addedMinutes ?? timing.addedMinutes);
    setCardOpen(true);
  };
  const removeCard = async (cardId: string) => {
    if (!canManageCards) return;
    const reason = window.prompt("Reason for deleting this card (minimum 3 characters):");
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error("A deletion reason with at least 3 characters is required."); return; }
    const yes = await confirm({
      title: "Remove this card?",
      description:
        "This removes the incident from the match timeline. The normal-time score and goals are unchanged.",
      confirmLabel: "Remove card",
      danger: true,
    });
    if (!yes) return;
    try {
      await deleteSeasonMatchCard(seasonId, matchId, cardId, reason.trim());
      toast.success("Card removed");
      matchQuery.reload();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to remove card",
      );
    }
  };
  const saveShootout = async (value: MatchShootoutWrite) => {
    if (!canManageShootout) return;
    setSavingShootout(true);
    try {
      const response = await updateSeasonMatchShootout(seasonId, matchId, value);
      matchQuery.setData((current) => current ? { ...current, data: response.data } : current);
      toast.success("Penalty shootout kicks saved");
      setShootoutOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save penalty shootout");
    } finally {
      setSavingShootout(false);
    }
  };

  // Section tones for this page
  const tCorrection = TONES.gold; // completed result correction banner
  const tSeason = TONES.gold; // season info
  const tHint = TONES.info; // fixture-management hint
  const tEventAudit = TONES.accent; // goal & card audit history
  const tCorrAudit = TONES.gold; // correction audit history
  const tFixture = TONES.primary; // edit-fixture card + match header
  const tShootout = TONES.accent; // shootout strip
  const tResolution = TONES.gold; // resolution history

  return (
    <PageContainer>
      {/* Link to Matches Page */}
      <Link
        to={adminMode ? "/admin/matches" : "/matches"}
        search={{ seasonId }}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Back to Matches
      </Link>

      {/* Season Info Banner */}
      {selectedSeason ? (
        <section
          aria-label="Selected season information"
          className={`relative mb-5 mt-3 overflow-hidden rounded-2xl border p-4 sm:p-5 ${tSeason.glass}`}
        >
          <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${tSeason.glow}`} />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tSeason.chip}`}><ToneIcon d={ICONS.trophy} /></span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${tSeason.text}`}>
                  Season {selectedSeason.year} <span aria-hidden="true">·</span>{" "}
                  Edition {selectedSeason.seasonNumber}
                </p>
                <h2 className="mt-1 truncate font-display text-xl text-fg sm:text-2xl">
                  {selectedSeason.name}
                </h2>
                <p className="mt-2 text-sm text-muted">{seasonDateRange}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-line bg-surface px-3 py-1.5">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  selectedSeason.status === "active"
                    ? "bg-success"
                    : selectedSeason.status === "upcoming"
                      ? "bg-info"
                      : selectedSeason.status === "completed"
                        ? "bg-muted"
                        : selectedSeason.status === "archived"
                          ? "bg-warning"
                          : "bg-line"
                }`}
              />
              <span className="text-xs font-semibold capitalize text-fg">
                Status: {selectedSeason.status}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Fixture Management Hint (For Admin) */}
      {adminMode && isAdmin && fixtureManagementHint ? (
        <GlassCard
          className={`mt-3 border p-4 ${tHint.glass}`}
          role="status"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tHint.chip}`}><ToneIcon d={ICONS.info} /></span>
              <div>
                <p className={`font-semibold ${tHint.text}`}>
                  Fixture management is currently unavailable
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {fixtureManagementHint}
                </p>
              </div>
            </div>
            {selectedSeason && selectedSeason.status !== "active" ? (
              <Link
                to="/admin/seasons/$seasonId"
                params={{ seasonId: selectedSeason._id }}
                className="shrink-0 text-sm font-semibold text-accent underline-offset-4 hover:underline"
              >
                Go to Selected Season
              </Link>
            ) : null}
          </div>
        </GlassCard>
      ) : null}

      {/* Edit Fixture */}
      {showEdit ? (
        <GlassCard className={`mt-3 flex flex-wrap items-center justify-between gap-3 border p-4 ${tFixture.glass}`}>
          <ToneHeader
            as="h2"
            tone="primary"
            icon={<ToneIcon d={ICONS.edit} />}
            title="Fixture Details"
            description="Update venue, participants or other fixture information."
          />
          <Button size="sm" variant="surface" onClick={() => setEditing(true)}>
            Edit Fixture
          </Button>
        </GlassCard>
      ) : null}

      {/* Completed Result Correction Section */}
      {canManageActiveSeason && match.status === "completed" ? (
        <GlassCard className={`mt-3 flex flex-wrap items-center justify-between gap-3 border p-4 ${tCorrection.glass}`}>
          <ToneHeader
            as="h2"
            tone="gold"
            icon={<ToneIcon d={ICONS.alert} />}
            title="Completed Result Correction"
            description="Use the audited correction workflow to amend the official result. Ordinary goal editing is disabled."
          />
          <Button
            size="sm"
            variant="surface"
            onClick={() => setCorrectionOpen(true)}
          >
            Correct Completed Result
          </Button>
        </GlassCard>
      ) : null}


      {/* Match Engine Corrections Section */}
      <MatchEngineCorrectionSection
        key={`${match._id}:corrections:${match.updatedAt}`}
        seasonId={seasonId}
        match={match}
        isAdmin={canManageActiveSeason}
        onMatchUpdated={(updatedMatch) => {
          matchQuery.setData((current) => current ? { ...current, data: updatedMatch } : current);
        }}
      />

      {/* Match Deciding Rules Section */}
      {selectedSeason ? (
        <MatchDecidingRulesSection
          key={`${match._id}:${match.updatedAt}`}
          seasonId={seasonId}
          season={selectedSeason}
          match={match}
          isAdmin={canManageActiveSeason}
          onMatchUpdated={(updatedMatch) => {
            matchQuery.setData((current) => current ? { ...current, data: updatedMatch } : current);
          }}
        />
      ) : null}


      {/* Match Status Manager (Match Status & Clock) */}
      <MatchStatusManager
        seasonId={seasonId}
        match={match}
        isAdmin={canManageActiveSeason}
        onMatchUpdated={(updatedMatch) => {
          matchQuery.setData((current) =>
            current ? { ...current, data: updatedMatch } : current,
          );
        }}
      />


      {/* Match Header / Match Score Card */}
      <GlassCard className={`relative mt-4 overflow-hidden border p-5 sm:p-8 ${tFixture.glass}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 0% 0%, color-mix(in oklab, var(--csl-primary) 30%, transparent), transparent 65%), radial-gradient(ellipse 50% 60% at 100% 0%, color-mix(in oklab, var(--csl-info) 18%, transparent), transparent 65%), radial-gradient(ellipse 60% 40% at 50% 100%, color-mix(in oklab, var(--csl-accent) 10%, transparent), transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pitch-lines pointer-events-none absolute inset-0 opacity-20"
        />

        <div className="relative">
          {/* Date, round, group, venue */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-center font-display text-lg text-fg sm:text-xl">
              {STAGE_LABEL[match.stage]}
              {groupName ? ` · ${groupName}` : ""}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className={pillClass("primary")}>Match {match.matchNumber}</span>
              <span className={pillClass("info")}>Round {match.roundNumber}</span>
              <span className={pillClass("gold")}>
                <CalendarIcon />
                {formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}
              </span>
              {venueName ? (
                <span className={pillClass("accent")}>
                  <PinIcon />
                  {venueName}
                </span>
              ) : null}
            </div>
          </div>

          {/* Teams + score */}
          <div
            className={`mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 ${match.penaltyShootout ? "pb-20" : "pb-10"}`}
          >
            <TeamSide team={home} side="home" adminMode={adminMode} />
            {/* Only the score is in the flow, so it centres on the team row.
                Status (and penalties) hang below it without shifting it. */}
            <div className="relative flex justify-center">
              <p className="rounded-2xl border border-line bg-glass px-4 py-1 font-display text-4xl tabular text-fg backdrop-blur-md sm:px-6 sm:text-6xl">
                {showScore ? `${homeScore} - ${awayScore}` : "vs"}
              </p>
              <div className="absolute left-1/2 top-full mt-2 flex -translate-x-1/2 flex-col items-center gap-2 whitespace-nowrap">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[match.status]}`}
                >
                  {match.status === "live" ? (
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-success"
                      aria-hidden="true"
                    />
                  ) : null}
                  {STATUS_LABEL[match.status]}
                </span>
                {match.penaltyShootout ? (
                  <p className="text-center text-xs font-semibold text-gold">
                    Pens {match.penaltyShootout.homeTeamScore} -{" "}
                    {match.penaltyShootout.awayTeamScore}
                    {winnerId
                      ? ` · ${winnerId === home.id ? home.name : away.name} win`
                      : ""}
                  </p>
                ) : null}
              </div>
            </div>
            <TeamSide team={away} side="away" adminMode={adminMode} />
          </div>

          {match.notes ? (
            <p className="mt-5 text-center text-sm text-muted">{match.notes}</p>
          ) : null}
          {hasPreMatchGoals ? (
            <p className={`mt-4 rounded-xl border px-3 py-2 text-center text-xs ${TONES.gold.note}`} role="status">
              This Upcoming fixture contains {match.goals.length} previously
              saved goal event(s). They are preserved for review, but cannot be
              edited or removed until the match is Live.
            </p>
          ) : null}

          {/* Events under each team, icon on the centre line */}
          <div className={`mt-8 border-t pt-5 ${tFixture.divider}`}>
            {events.length === 0 ? (
              <p className="text-center text-sm text-muted">
                No match events recorded.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {events.map((event) => {
                  const side = event.teamId === away.id ? "away" : "home";
                  const et = TONES[EVENT_TONE[event.kind] ?? "info"];
                  return (
                    <li
                      key={event.id}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6"
                    >
                      {side === "home" ? (
                        <EventText
                          event={event}
                          side="home"
                          canManageEvents={canManageGoals || canManageCards}
                          onEditGoal={beginGoalEdit}
                          onDeleteGoal={(goalId) => void removeGoal(goalId)}
                          onEditCard={beginCardEdit}
                          onDeleteCard={(cardId) => void removeCard(cardId)}
                        />
                      ) : (
                        <span />
                      )}
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md ${et.pill}`}>
                        <MatchEventIcon kind={event.kind} className="h-5 w-5" />
                      </span>
                      {side === "away" ? (
                        <EventText
                          event={event}
                          side="away"
                          canManageEvents={canManageGoals || canManageCards}
                          onEditGoal={beginGoalEdit}
                          onDeleteGoal={(goalId) => void removeGoal(goalId)}
                          onEditCard={beginCardEdit}
                          onDeleteCard={(cardId) => void removeCard(cardId)}
                        />
                      ) : (
                        <span />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {canManageGoals || canManageCards ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {canManageGoals ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingGoalId(null);
                      setGoalTeamId(home.id);
                      setGoalType("normal");
                      setGoalPlayerId("");
                      const timing = getDefaultEventTiming(match, Date.now());
                      setGoalPeriod(timing.period);
                      setGoalMinute(timing.minute);
                      setGoalAddedMinutes(timing.addedMinutes);
                      setGoalOpen(true);
                    }}
                  >
                    Add goal
                  </Button>
                ) : null}
                {canManageCards ? (
                  <Button
                    size="sm"
                    variant="surface"
                    onClick={() => {
                      setEditingCardId(null);
                      setCardTeamId(home.id);
                      setCardPlayerId("");
                      setCardType("yellow_card");
                      const timing = getDefaultEventTiming(match, Date.now());
                      setCardPeriod(timing.period);
                      setCardMinute(timing.minute);
                      setCardAddedMinutes(timing.addedMinutes);
                      setCardOpen(true);
                    }}
                  >
                    Add card
                  </Button>
                ) : null}
              </div>
            ) : null}
            {canManageShootout ? (
              <div className={`mt-5 flex flex-wrap items-center justify-center gap-3 rounded-xl border p-3 backdrop-blur-md ${tShootout.section}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tShootout.chip}`}><ToneIcon d={ICONS.target} /></span>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${tShootout.text}`}>
                    Penalty shootout
                  </p>
                  <p className="text-xs text-muted">
                    {match.penaltyShootout
                      ? `Pens ${match.penaltyShootout.homeTeamScore} - ${match.penaltyShootout.awayTeamScore} · ${match.penaltyShootout.status}`
                      : "No shootout recorded"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="surface"
                  onClick={() => setShootoutOpen(true)}
                >
                  {match.penaltyShootout ? "Edit shootout" : "Record shootout"}
                </Button>
              </div>
            ) : null}
          </div>

          {match.resolutionHistory?.length ? (
            <div className={`mt-6 border-t pt-4 ${tResolution.divider}`}>
              <h3 className={`text-sm font-semibold ${tResolution.text}`}>
                Fixture resolution history
              </h3>
              <ul className="mt-2 space-y-2">
                {match.resolutionHistory.map((entry, index) => (
                  <li
                    key={entry.decidedAt + entry.status + index}
                    className={`rounded-control border p-3 text-sm backdrop-blur-md ${tResolution.cardOff}`}
                  >
                    <p className="font-medium text-fg">
                      {entry.status === "cancelled" ? "Cancelled" : "Abandoned"}{" "}
                      · {formatDate(entry.decidedAt)}
                    </p>
                    <p className="mt-1 text-muted">{entry.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </GlassCard>


      {/* ============== AUDIT HISTORIES ======================= */}

      {/* Goal & Card Audit History */}
      {match.eventAuditHistory?.length ? (
        <GlassCard className={`mt-3 border p-4 ${tEventAudit.glass}`}>
          <ToneHeader
            as="h2"
            tone="accent"
            icon={<ToneIcon d={ICONS.list} />}
            title="Goal And Card Audit History"
            description="Event timestamps below are record/audit times. The match-event position is shown separately using the stored period, minute and added time."
          />
          <ul className="mt-3 space-y-3">
            {[...match.eventAuditHistory].reverse().map((entry, index) => (
              <li key={`${entry.eventId}:${entry.timestamp}:${index}`} className={`rounded-xl border p-3 text-sm backdrop-blur-md ${tEventAudit.cardOff}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className={tEventAudit.text}>{entry.eventType === "goal" ? "Goal" : "Card"} {entry.operation}</strong>
                  <span className="text-xs text-muted">{formatDate(entry.timestamp)} · {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1 text-xs text-muted">Event ID: {entry.eventId} · Admin: {entry.actor}</p>
                {entry.previousValue ? <p className="mt-2 text-xs text-muted">Previous: {getEventAuditSummary(entry.previousValue)}</p> : null}
                {entry.newValue ? <p className="mt-1 text-xs text-fg">New: {getEventAuditSummary(entry.newValue)}</p> : null}
                {entry.reason ? <p className="mt-2 text-xs text-muted">Reason: {entry.reason}</p> : null}
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      {/* Match Correction Audit History */}
      {match.correctionHistory?.length ? (
        <GlassCard className={`mt-3 border p-4 ${tCorrAudit.glass}`}>
          <ToneHeader
            as="h2"
            tone="gold"
            icon={<ToneIcon d={ICONS.shield} />}
            title="Correction audit history"
          />
          <ul className="mt-3 space-y-3">
            {match.correctionHistory.map((entry, index) => (
              <li
                key={entry.correctedAt + index}
                className={`rounded-xl border p-3 text-sm backdrop-blur-md ${tCorrAudit.cardOff}`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className={tCorrAudit.text}>Correction {index + 1}</strong>
                  <span className="text-muted">
                    {formatDate(entry.correctedAt)} ·{" "}
                    {new Date(entry.correctedAt).toLocaleTimeString("en-IN", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 text-muted">{entry.reason}</p>
                <p className="mt-2 text-xs text-muted">
                  Original: {entry.originalResult.homeScore} -{" "}
                  {entry.originalResult.awayScore} · Corrected:{" "}
                  {entry.correctedResult.homeScore} -{" "}
                  {entry.correctedResult.awayScore} · Admin: {entry.correctedBy}
                </p>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}


      {/* ============== DRAWERS & MODALS ======================= */}

      <GoalManagementDrawer
        open={goalOpen}
        onClose={() => {
          setGoalReason("");
          setGoalOpen(false);
          setEditingGoalId(null);
          setGoalTeamId("");
          setGoalPlayerId("");
          setGoalType("normal");
          setGoalPeriod(null);
          setGoalAddedMinutes(0);
        }}
        editing={editingGoalId !== null}
        home={home}
        away={away}
        scoringTeamId={scoringTeamId}
        onScoringTeamChange={(id) => {
          setGoalTeamId(id);
          setGoalPlayerId("");
        }}
        goalType={goalType}
        onGoalTypeChange={(type) => {
          setGoalType(type);
          setGoalPlayerId("");
        }}
        selectedPlayerId={goalPlayerId}
        onPlayerChange={setGoalPlayerId}
        period={goalPeriod}
        periodOptions={availableEventPeriods}
        onPeriodChange={(value) => { const timing = getDefaultEventTiming(match, Date.now()); setGoalPeriod(value); setGoalMinute(value === timing.period ? timing.minute : getPeriodBoundaryMinute(match, value)); setGoalAddedMinutes(0); }}
        minute={goalMinute}
        onMinuteChange={(value) => { setGoalMinute(value); setGoalAddedMinutes(0); }}
        addedMinutes={goalAddedMinutes}
        onAddedMinutesChange={setGoalAddedMinutes}
        reason={goalReason}
        onReasonChange={setGoalReason}
        match={match}
        stoppageTimeAllowed={goalStoppageTimeAllowed}
        players={eligibleGoalPlayers
          .map((lot) => {
            const player = lotPlayer(lot);
            return player
              ? {
                  id: player._id,
                  name: player.name,
                  profilePic: player.profilePic,
                  jerseyNo: lot.jerseyNo,
                }
              : null;
          })
          .filter(
            (player): player is NonNullable<typeof player> => player !== null,
          )}
        saving={savingGoal}
        error={lotsQuery.error}
        onSubmit={saveGoal}
      />

      <CardManagementDrawer
        open={cardOpen}
        onClose={() => {
          setCardReason("");
          setCardOpen(false);
          setEditingCardId(null);
          setCardTeamId("");
          setCardPlayerId("");
          setCardType("yellow_card");
          setCardPeriod(null);
          setCardAddedMinutes(0);
        }}
        editing={editingCardId !== null}
        home={{ id: home.id, name: home.name }}
        away={{ id: away.id, name: away.name }}
        teamId={cardTeamId || home.id}
        onTeamChange={setCardTeamId}
        cardType={cardType}
        onCardTypeChange={setCardType}
        playerId={cardPlayerId}
        onPlayerChange={setCardPlayerId}
        period={cardPeriod}
        periodOptions={availableEventPeriods}
        onPeriodChange={(value) => { const timing = getDefaultEventTiming(match, Date.now()); setCardPeriod(value); setCardMinute(value === timing.period ? timing.minute : getPeriodBoundaryMinute(match, value)); setCardAddedMinutes(0); }}
        minute={cardMinute}
        onMinuteChange={(value) => { setCardMinute(value); setCardAddedMinutes(0); }}
        addedMinutes={cardAddedMinutes}
        onAddedMinutesChange={setCardAddedMinutes}
        reason={cardReason}
        onReasonChange={setCardReason}
        match={match}
        stoppageTimeAllowed={cardStoppageTimeAllowed}
        players={eligibleCardPlayers
          .map((lot) => {
            const player = lotPlayer(lot);
            return player
              ? { id: player._id, name: player.name, jerseyNo: lot.jerseyNo }
              : null;
          })
          .filter(
            (player): player is NonNullable<typeof player> => player !== null,
          )}
        saving={savingCard}
        error={lotsQuery.error}
        onSubmit={saveCard}
      />

      <PenaltyShootoutManagementDrawer
        key={shootoutOpen ? "open" : "closed"}
        open={shootoutOpen}
        onClose={() => setShootoutOpen(false)}
        home={{ id: home.id, name: home.name }}
        away={{ id: away.id, name: away.name }}
        shootout={match.penaltyShootout}
        players={shootoutPlayers}
        saving={savingShootout}
        onSubmit={(value) => void saveShootout(value)}
      />

      {correctionOpen ? (
        <CompletedMatchCorrectionDrawer
          open={true}
          onClose={() => setCorrectionOpen(false)}
          match={match}
          home={{ id: home.id, name: home.name }}
          away={{ id: away.id, name: away.name }}
          players={(lotsQuery.data?.data ?? []).flatMap((lot) => {
            const player = lotPlayer(lot);
            return player
              ? [
                  {
                    id: player._id,
                    name: player.name,
                    seasonTeamId: lotTeamId(lot),
                  },
                ]
              : [];
          })}
          saving={savingCorrection}
          onSubmit={async (data: SeasonMatchCorrectionWrite) => {
            setSavingCorrection(true);
            try {
              await correctCompletedSeasonMatch(seasonId, matchId, data);
              toast.success(
                "Completed match result corrected and audit history recorded",
              );
              setCorrectionOpen(false);
              matchQuery.reload();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to correct completed match",
              );
            } finally {
              setSavingCorrection(false);
            }
          }}
        />
      ) : null}

      <Drawer
        open={editing}
        title="Edit fixture"
        onClose={() => setEditing(false)}
        loading={savingMatch}
        loadingLabel="Saving fixture..."
      >
        <SeasonMatchForm
          season={selectedSeason}
          seasonTeams={teamsQuery.data?.data ?? []}
          groups={groupsQuery.data?.data ?? []}
          venues={venuesQuery.data?.data ?? []}
          match={match}
          submitting={savingMatch}
          onSubmit={async (values: SeasonMatchWrite) => {
            setSavingMatch(true);
            try {
              await updateSeasonMatch(seasonId, matchId, values);
              toast.success("Fixture updated");
              setEditing(false);
              matchQuery.reload();
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Unable to update fixture",
              );
              throw error;
            } finally {
              setSavingMatch(false);
            }
          }}
        />
      </Drawer>

    </PageContainer>
  );
}
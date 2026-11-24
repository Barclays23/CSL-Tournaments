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
import { GoalManagementDrawer } from "@/components/matches/GoalManagementDrawer";
import { CardManagementDrawer } from "@/components/matches/CardManagementDrawer";
import { PenaltyShootoutManagementDrawer } from "@/components/matches/PenaltyShootoutManagementDrawer";
import { CompletedMatchCorrectionDrawer } from "@/components/matches/CompletedMatchCorrectionDrawer";
import { MatchStatusManager } from "@/components/matches/MatchStatusManager";
import { MatchEventIcon, type MatchEventKind } from "@/components/matches/MatchEventIcon";
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
  updateSeasonMatchCard,
} from "@/services/seasonMatchService";
import { getSeasonTeams, getAuctionLots } from "@/services/seasonService";
import { getVenues } from "@/services/venueService";
import type { SeasonMatch, SeasonMatchCardType, SeasonMatchTeamRef, SeasonMatchWrite, SeasonMatchCorrectionWrite } from "@/types/seasonMatch.types";
import type { AuctionLot } from "@/types/season.types";
import { formatDate, formatTime } from "@/utils/formatDate";
import { refId } from "@/utils/refs";
import { canEditSeasonMatch } from "@/utils/seasonMatchPermissions";

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

type MatchEvent = {
  id: string; kind: MatchEventKind; teamId: string; playerName: string; at: string;
  goalId?: string; cardId?: string;
};

function teamDetails(ref: SeasonMatchTeamRef) {
  if (typeof ref === "string") return { id: ref, teamId: null as string | null, name: "Team", logo: null };
  return { id: ref._id, teamId: ref.team?._id ?? null, name: ref.displayName, logo: ref.logoSnapshot ?? ref.team?.logo ?? null };
}
function lotTeamId(lot: AuctionLot) {
  return typeof lot.seasonTeamRef === "string" ? lot.seasonTeamRef : lot.seasonTeamRef?._id ?? "";
}
function lotPlayer(lot: AuctionLot) {
  return typeof lot.playerRef === "string" ? null : lot.playerRef;
}

function buildEvents(goals: SeasonMatch["goals"], cards: NonNullable<SeasonMatch["cards"]> = []): MatchEvent[] {
  const goalEvents: MatchEvent[] = goals.map((goal) => {
    const scorer = goal.scorerPlayerRef && typeof goal.scorerPlayerRef !== "string" ? goal.scorerPlayerRef.name : null;
    return { id: `goal-${goal._id}`, kind: goal.goalType === "own_goal" ? "own_goal" : "goal",
      teamId: refId(goal.scoringSeasonTeamRef) ?? "", playerName: scorer ?? (goal.goalType === "own_goal" ? "Player" : "Scorer not recorded"),
      at: goal.createdAt, goalId: goal._id };
  });
  const cardEvents: MatchEvent[] = cards.map((card) => ({
    id: `card-${card._id}`, kind: card.cardType, teamId: refId(card.seasonTeamRef) ?? "",
    playerName: typeof card.playerRef === "string" ? "Player" : card.playerRef.name, at: card.createdAt, cardId: card._id,
  }));
  return [...goalEvents, ...cardEvents].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function eventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M8 3v4M16 3v4M3.5 10h17" />
  </svg>
);
const PinIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
const PencilIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-glass px-3 py-1 text-xs font-semibold text-muted backdrop-blur-md";
const iconBtnClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface/60 text-muted backdrop-blur-md transition-colors hover:bg-glass-strong hover:text-fg";

function TeamSide({
  team,
  side,
  adminMode,
}: {
  team: ReturnType<typeof teamDetails>;
  side: "home" | "away";
  adminMode: boolean;
}) {
  const content = (
    <div
      className={`flex min-w-0 flex-col items-center gap-3 text-center ${
        side === "home" ? "sm:flex-row-reverse sm:justify-start sm:text-right" : "sm:flex-row sm:justify-start sm:text-left"
      }`}
    >
      <Avatar name={team.name} asset={team.logo} className="h-14 w-14 shrink-0 rounded-xl ring-0 ring-line sm:h-16 sm:w-16" />
      <p className="min-w-0 wrap-break-word font-display text-lg leading-tight text-fg sm:text-2xl">{team.name}</p>
    </div>
  );
  if (!team.teamId) return content;
  return (
    <Link
      to={adminMode ? "/admin/teams/$teamId" : "/teams/$teamId"}
      params={{ teamId: team.teamId }}
      aria-label={"View " + team.name + " team details"}
      className="rounded-xl transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {content}
    </Link>
  );
}

function EventText({
  event, side, canManageEvents, onEditGoal, onDeleteGoal, onEditCard, onDeleteCard,
}: {
  event: MatchEvent; side: "home" | "away"; canManageEvents: boolean;
  onEditGoal: (id: string) => void; onDeleteGoal: (id: string) => void;
  onEditCard: (id: string) => void; onDeleteCard: (id: string) => void;
}) {
  const manage = canManageEvents && Boolean(event.goalId || event.cardId);
  const title = event.kind === "yellow_card" ? "Yellow card" : event.kind === "red_card" ? "Red card"
    : event.kind === "second_yellow" ? "Second yellow card" : event.kind === "own_goal" ? "Own goal" : "Goal";
  const content = (
    <div className={`min-w-0 ${side === "home" ? "text-right" : "text-left"}`}>
      <p className="truncate text-sm font-semibold text-fg">{event.playerName}{event.kind === "own_goal" ? <span className="ml-1 font-medium text-danger">(OG)</span> : null}</p>
      <p className="text-xs text-muted">{title}</p><p className="text-xs tabular text-faint">{eventTime(event.at)}</p>
    </div>
  );
  const actions = manage ? (
    <div className="flex shrink-0 items-center gap-1.5">
      <button type="button" className={iconBtnClass} aria-label={`Edit ${title} for ${event.playerName}`} onClick={() => event.goalId ? onEditGoal(event.goalId) : onEditCard(event.cardId!)}><PencilIcon /></button>
      <button type="button" className={`${iconBtnClass} hover:text-danger`} aria-label={`Delete ${title} for ${event.playerName}`} onClick={() => event.goalId ? onDeleteGoal(event.goalId) : onDeleteCard(event.cardId!)}><TrashIcon /></button>
    </div>
  ) : null;
  return <div className={`flex min-w-0 items-center gap-2 ${side === "home" ? "justify-end" : "justify-start"}`}>{side === "home" ? <>{actions}{content}</> : <>{content}{actions}</>}</div>;
}

export function SeasonMatchDetailsPage(props: { seasonId: string; matchId: string; adminMode?: boolean }) {
  const { seasonId, matchId } = props;
  const adminMode = props.adminMode ?? false;
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [goalTeamId, setGoalTeamId] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalType, setGoalType] = useState<"normal" | "own_goal">("normal");
  const [goalPlayerId, setGoalPlayerId] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [cardTeamId, setCardTeamId] = useState("");
  const [cardType, setCardType] = useState<SeasonMatchCardType>("yellow_card");
  const [cardPlayerId, setCardPlayerId] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [savingCard, setSavingCard] = useState(false);
  const [shootoutOpen, setShootoutOpen] = useState(false);
  const [savingShootout, setSavingShootout] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);

  const matchQuery = useServiceQuery(() => getSeasonMatchById(seasonId, matchId), [seasonId, matchId]);
  const teamsQuery = useServiceQuery(() => getSeasonTeams(seasonId), [seasonId]);
  const groupsQuery = useServiceQuery(() => import("@/services/seasonMatchService").then(({ getSeasonGroups }) => getSeasonGroups(seasonId)), [seasonId]);
  const venuesQuery = useServiceQuery(() => getVenues("all"), []);
  const lotsQuery = useServiceQuery(() => getAuctionLots({ seasonId, auctionStatus: "sold" }), [seasonId]);
  const match = matchQuery.data?.data;

  if (matchQuery.loading) return <PageContainer><Skeleton className="h-64" /></PageContainer>;
  if (matchQuery.error || !match) {
    return <PageContainer><ErrorState message={matchQuery.error || "Fixture not found"} onRetry={matchQuery.reload} /></PageContainer>;
  }

  const home = teamDetails(match.homeSeasonTeamRef);
  const away = teamDetails(match.awaySeasonTeamRef);
  const homeScore = match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === home.id).length;
  const awayScore = match.goals.filter((goal) => refId(goal.scoringSeasonTeamRef) === away.id).length;
  const winnerId = refId(match.winnerSeasonTeamRef);
  const scoringTeamId = goalTeamId || home.id;
  const playerTeamId = goalType === "normal" ? scoringTeamId : scoringTeamId === home.id ? away.id : home.id;
  const eligibleGoalPlayers = (lotsQuery.data?.data ?? []).filter((lot) => lotTeamId(lot) === playerTeamId && lotPlayer(lot));
  const canManageGoals = isAdmin && match.status === "live";
  const canManageCards = isAdmin && match.status === "live";
  const canManageShootout = isAdmin && match.stage !== "group" && match.status === "live";
  const showScore = match.status === "live"
    || match.status === "completed"
    || (match.status !== "scheduled" && match.goals.length > 0);
  const hasPreMatchGoals = match.status === "scheduled" && match.goals.length > 0;
  const events = buildEvents(match.goals, match.cards ?? []);
  const eligibleCardPlayers = (lotsQuery.data?.data ?? []).filter((lot) => lotTeamId(lot) === (cardTeamId || home.id) && lotPlayer(lot));
  const shootoutPlayers = (lotsQuery.data?.data ?? []).flatMap((lot) => { const player = lotPlayer(lot); return player ? [{ id: player._id, name: player.name, seasonTeamId: lotTeamId(lot) }] : []; });

  // Group name (only meaningful in the group stage). Adjust the field name if your type differs.
  const rawGroup = (match as unknown as { groupRef?: string | { _id: string; name?: string } | null }).groupRef;
  const groupId = typeof rawGroup === "string" ? rawGroup : rawGroup?._id;
  const groupName =
    match.stage === "group"
      ? (typeof rawGroup === "object" && rawGroup?.name) ||
        (groupsQuery.data?.data as unknown as { _id: string; name?: string }[] | undefined)?.find((g) => g._id === groupId)?.name ||
        null
      : null;
  const venueName = match.venueRef && typeof match.venueRef === "object" ? match.venueRef.name : match.venue || null;

  const showEdit = isAdmin && canEditSeasonMatch(match);

  const saveGoal = async () => {
    if (!canManageGoals) {
      toast.error("Goals can only be managed by an admin while the match is Live.");
      return;
    }
    if (!scoringTeamId || (!goalPlayerId && goalType === "normal")) {
      toast.error("Choose the credited team and goal scorer");
      return;
    }
    setSavingGoal(true);
    try {
      const payload = {
        scoringSeasonTeamRef: scoringTeamId,
        scorerPlayerRef: goalPlayerId || null,
        goalType,
      };
      if (editingGoalId) await updateSeasonMatchGoal(seasonId, matchId, editingGoalId, payload);
      else await addSeasonMatchGoal(seasonId, matchId, payload);
      toast.success(editingGoalId ? "Goal updated" : "Goal added");
      setEditingGoalId(null);
      setGoalTeamId("");
      setGoalType("normal");
      setGoalPlayerId("");
      setGoalOpen(false);
      matchQuery.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save goal");
    } finally {
      setSavingGoal(false);
    }
  };

  const beginGoalEdit = (goalId: string) => {
    if (!canManageGoals) return;
    const goal = match.goals.find((g) => g._id === goalId);
    if (!goal) return;
    setEditingGoalId(goal._id);
    setGoalTeamId(refId(goal.scoringSeasonTeamRef) ?? home.id);
    setGoalType(goal.goalType);
    setGoalPlayerId(refId(goal.scorerPlayerRef) ?? "");
    setGoalOpen(true);
  };

  const removeGoal = async (goalId: string) => {
    if (!canManageGoals) {
      toast.error("Goals can only be managed by an admin while the match is Live.");
      return;
    }
    const yes = await confirm({
      title: "Remove this goal?",
      description: "The score, standings, winner and top-scorer statistics will be recalculated.",
      confirmLabel: "Remove goal",
      danger: true,
    });
    if (!yes) return;
    try {
      await deleteSeasonMatchGoal(seasonId, matchId, goalId);
      toast.success("Goal removed");
      if (editingGoalId === goalId) setEditingGoalId(null);
      matchQuery.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove goal");
    }
  };

  const saveCard = async () => {
    if (!canManageCards) { toast.error("Cards can only be managed by an admin while the match is Live."); return; }
    if (!cardTeamId || !cardPlayerId) { toast.error("Choose the team and player receiving the card."); return; }
    setSavingCard(true);
    try {
      const payload = { seasonTeamRef: cardTeamId, playerRef: cardPlayerId, cardType };
      if (editingCardId) await updateSeasonMatchCard(seasonId, matchId, editingCardId, payload);
      else await addSeasonMatchCard(seasonId, matchId, payload);
      toast.success(editingCardId ? "Card updated" : "Card recorded");
      setEditingCardId(null); setCardTeamId(""); setCardPlayerId(""); setCardType("yellow_card"); setCardOpen(false); matchQuery.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save card"); }
    finally { setSavingCard(false); }
  };
  const beginCardEdit = (cardId: string) => {
    if (!canManageCards) return;
    const card = (match.cards ?? []).find((item) => item._id === cardId);
    if (!card) return;
    setEditingCardId(card._id); setCardTeamId(refId(card.seasonTeamRef) ?? home.id);
    setCardType(card.cardType); setCardPlayerId(refId(card.playerRef) ?? ""); setCardOpen(true);
  };
  const removeCard = async (cardId: string) => {
    if (!canManageCards) return;
    const yes = await confirm({ title: "Remove this card?", description: "This removes the incident from the match timeline. The normal-time score and goals are unchanged.", confirmLabel: "Remove card", danger: true });
    if (!yes) return;
    try { await deleteSeasonMatchCard(seasonId, matchId, cardId); toast.success("Card removed"); matchQuery.reload(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to remove card"); }
  };
  const saveShootout = async (value: SeasonMatch["penaltyShootout"]) => {
    if (!canManageShootout) return;
    setSavingShootout(true);
    try {
      await updateSeasonMatch(seasonId, matchId, { penaltyShootout: value });
      toast.success(value ? "Penalty shootout saved" : "Penalty shootout cleared");
      setShootoutOpen(false); matchQuery.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save penalty shootout"); }
    finally { setSavingShootout(false); }
  };


  return (
    <PageContainer>
      <Link to={adminMode ? "/admin/matches" : "/matches"} search={{ seasonId }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        Back to matches
      </Link>

      {isAdmin && match.status === "completed" ? (
        <GlassCard className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-warning/30 p-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-fg">Completed result correction</h2>
            <p className="mt-0.5 text-sm text-muted">Use the audited correction workflow to amend the official result. Ordinary goal editing is disabled.</p>
          </div>
          <Button size="sm" variant="surface" onClick={() => setCorrectionOpen(true)}>Correct completed result</Button>
        </GlassCard>
      ) : null}
      {match.correctionHistory?.length ? (
        <GlassCard className="mt-3 p-4">
          <h2 className="font-display text-lg text-fg">Correction audit history</h2>
          <ul className="mt-3 space-y-3">
            {match.correctionHistory.map((entry, index) => (
              <li key={entry.correctedAt + index} className="rounded-lg border border-line bg-surface p-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><strong className="text-fg">Correction {index + 1}</strong><span className="text-muted">{formatDate(entry.correctedAt)} · {new Date(entry.correctedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span></div>
                <p className="mt-1 text-muted">{entry.reason}</p>
                <p className="mt-2 text-xs text-muted">Original: {entry.originalResult.homeScore} - {entry.originalResult.awayScore} · Corrected: {entry.correctedResult.homeScore} - {entry.correctedResult.awayScore} · Admin: {entry.correctedBy}</p>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}
      <MatchStatusManager
        seasonId={seasonId}
        match={match}
        isAdmin={isAdmin}
        onMatchUpdated={(updatedMatch) => {
          matchQuery.setData((current) => current ? { ...current, data: updatedMatch } : current);
        }}
      />
      {showEdit ? (
        <GlassCard className="mt-3 flex flex-wrap items-center justify-between gap-3 p-4 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-fg">Fixture details</h2>
            <p className="mt-0.5 text-sm text-muted">Update venue, participants or other fixture information.</p>
          </div>
          <Button size="sm" variant="surface" onClick={() => setEditing(true)}>Edit fixture</Button>
        </GlassCard>
      ) : null}

      {/* Match header */}
      <GlassCard className="relative mt-4 overflow-hidden p-5 backdrop-blur-xl sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 70% at 0% 0%, color-mix(in oklab, var(--csl-primary) 30%, transparent), transparent 65%), radial-gradient(ellipse 50% 60% at 100% 0%, color-mix(in oklab, var(--csl-accent) 12%, transparent), transparent 65%)",
          }}
        />
        <div aria-hidden="true" className="pitch-lines pointer-events-none absolute inset-0 opacity-20" />

        <div className="relative">
          {/* Date, round, group, venue */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-center font-display text-lg text-fg sm:text-xl">
              {STAGE_LABEL[match.stage]}
              {groupName ? ` · ${groupName}` : ""}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className={chipClass}>Match {match.matchNumber}</span>
              <span className={chipClass}>Round {match.roundNumber}</span>
              <span className={chipClass}><CalendarIcon />{formatDate(match.kickoffAt)} · {formatTime(match.kickoffAt)}</span>
              {venueName ? <span className={chipClass}><PinIcon />{venueName}</span> : null}
            </div>
          </div>

          {/* Teams + score */}
          <div className={`mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6 ${match.penaltyShootout ? "pb-20" : "pb-10"}`}>
            <TeamSide team={home} side="home" adminMode={adminMode} />
            {/* Only the score is in the flow, so it centres on the team row.
                Status (and penalties) hang below it without shifting it. */}
            <div className="relative flex justify-center">
              <p className="font-display text-4xl tabular text-fg sm:text-6xl">
                {showScore ? `${homeScore} - ${awayScore}` : "vs"}
              </p>
              <div className="absolute left-1/2 top-full mt-2 flex -translate-x-1/2 flex-col items-center gap-2 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${STATUS_TONE[match.status]}`}>
                  {match.status === "live" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" /> : null}
                  {STATUS_LABEL[match.status]}
                </span>
                {match.penaltyShootout ? (
                  <p className="text-center text-xs font-semibold text-gold">
                    Pens {match.penaltyShootout.homeTeamScore} - {match.penaltyShootout.awayTeamScore}
                    {winnerId ? ` · ${winnerId === home.id ? home.name : away.name} win` : ""}
                  </p>
                ) : null}
              </div>
            </div>
            <TeamSide team={away} side="away" adminMode={adminMode} />
          </div>

          {match.notes ? <p className="mt-5 text-center text-sm text-muted">{match.notes}</p> : null}
          {hasPreMatchGoals ? (
            <p className="mt-4 text-center text-xs text-warning" role="status">
              This Upcoming fixture contains {match.goals.length} previously saved goal event(s). They are preserved for review, but cannot be edited or removed until the match is Live.
            </p>
          ) : null}

          {/* Events under each team, icon on the centre line */}
          <div className="mt-8 border-t border-line pt-5">
            {events.length === 0 ? (
              <p className="text-center text-sm text-muted">No match events recorded.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {events.map((event) => {
                  const side = event.teamId === away.id ? "away" : "home";
                  return (
                    <li key={event.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                      {side === "home" ? <EventText event={event} side="home" canManageEvents={canManageGoals || canManageCards} onEditGoal={beginGoalEdit} onDeleteGoal={(goalId) => void removeGoal(goalId)} onEditCard={beginCardEdit} onDeleteCard={(cardId) => void removeCard(cardId)} /> : <span />}
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-glass backdrop-blur-md"><MatchEventIcon kind={event.kind} className="h-5 w-5" /></span>
                      {side === "away" ? <EventText event={event} side="away" canManageEvents={canManageGoals || canManageCards} onEditGoal={beginGoalEdit} onDeleteGoal={(goalId) => void removeGoal(goalId)} onEditCard={beginCardEdit} onDeleteCard={(cardId) => void removeCard(cardId)} /> : <span />}
                    </li>
                  );
                })}
              </ul>
            )}
            {(canManageGoals || canManageCards) ? (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {canManageGoals ? <Button size="sm" onClick={() => { setEditingGoalId(null); setGoalTeamId(home.id); setGoalType("normal"); setGoalPlayerId(""); setGoalOpen(true); }}>Add goal</Button> : null}
                {canManageCards ? <Button size="sm" variant="surface" onClick={() => { setEditingCardId(null); setCardTeamId(home.id); setCardPlayerId(""); setCardType("yellow_card"); setCardOpen(true); }}>Add card</Button> : null}
              </div>
            ) : null}
            {canManageShootout ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3 border-t border-line pt-4">
                <div className="text-center"><p className="text-sm font-semibold text-fg">Penalty shootout</p><p className="text-xs text-muted">{match.penaltyShootout ? `Pens ${match.penaltyShootout.homeTeamScore} - ${match.penaltyShootout.awayTeamScore} · ${match.penaltyShootout.status}` : "No shootout recorded"}</p></div>
                <Button size="sm" variant="surface" onClick={() => setShootoutOpen(true)}>{match.penaltyShootout ? "Edit shootout" : "Record shootout"}</Button>
              </div>
            ) : null}
          </div>

          {match.resolutionHistory?.length ? (
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-semibold text-fg">Fixture resolution history</h3>
              <ul className="mt-2 space-y-2">
                {match.resolutionHistory.map((entry, index) => (
                  <li key={entry.decidedAt + entry.status + index} className="rounded-control border border-line bg-glass p-3 text-sm backdrop-blur-md">
                    <p className="font-medium text-fg">{entry.status === "cancelled" ? "Cancelled" : "Abandoned"} · {formatDate(entry.decidedAt)}</p>
                    <p className="mt-1 text-muted">{entry.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </GlassCard>

      <GoalManagementDrawer
        open={goalOpen}
        onClose={() => { setGoalOpen(false); setEditingGoalId(null); setGoalTeamId(""); setGoalPlayerId(""); setGoalType("normal"); }}
        editing={editingGoalId !== null}
        home={home}
        away={away}
        scoringTeamId={scoringTeamId}
        onScoringTeamChange={(id) => { setGoalTeamId(id); setGoalPlayerId(""); }}
        goalType={goalType}
        onGoalTypeChange={(type) => { setGoalType(type); setGoalPlayerId(""); }}
        selectedPlayerId={goalPlayerId}
        onPlayerChange={setGoalPlayerId}
        players={eligibleGoalPlayers.map((lot) => {
          const player = lotPlayer(lot);
          return player ? { id: player._id, name: player.name, profilePic: player.profilePic, jerseyNo: lot.jerseyNo } : null;
        }).filter((player): player is NonNullable<typeof player> => player !== null)}
        saving={savingGoal}
        error={lotsQuery.error}
        onSubmit={saveGoal}
      />
      <CardManagementDrawer
        open={cardOpen} onClose={() => { setCardOpen(false); setEditingCardId(null); setCardTeamId(""); setCardPlayerId(""); setCardType("yellow_card"); }}
        editing={editingCardId !== null} home={{ id: home.id, name: home.name }} away={{ id: away.id, name: away.name }}
        teamId={cardTeamId || home.id} onTeamChange={setCardTeamId} cardType={cardType} onCardTypeChange={setCardType}
        playerId={cardPlayerId} onPlayerChange={setCardPlayerId}
        players={eligibleCardPlayers.map((lot) => { const player = lotPlayer(lot); return player ? { id: player._id, name: player.name, jerseyNo: lot.jerseyNo } : null; }).filter((player): player is NonNullable<typeof player> => player !== null)}
        saving={savingCard} error={lotsQuery.error} onSubmit={saveCard}
      />
      <PenaltyShootoutManagementDrawer key={shootoutOpen ? "open" : "closed"} open={shootoutOpen} onClose={() => setShootoutOpen(false)}
        home={{ id: home.id, name: home.name }} away={{ id: away.id, name: away.name }}
        shootout={match.penaltyShootout} players={shootoutPlayers} saving={savingShootout}
        onSubmit={(value) => void saveShootout(value)}
      />
      {correctionOpen ? <CompletedMatchCorrectionDrawer
        open={true}
        onClose={() => setCorrectionOpen(false)}
        match={match}
        home={{ id: home.id, name: home.name }}
        away={{ id: away.id, name: away.name }}
        players={(lotsQuery.data?.data ?? []).flatMap((lot) => {
          const player = lotPlayer(lot);
          return player ? [{ id: player._id, name: player.name, seasonTeamId: lotTeamId(lot) }] : [];
        })}
        saving={savingCorrection}
        onSubmit={async (data: SeasonMatchCorrectionWrite) => {
          setSavingCorrection(true);
          try {
            await correctCompletedSeasonMatch(seasonId, matchId, data);
            toast.success("Completed match result corrected and audit history recorded");
            setCorrectionOpen(false);
            matchQuery.reload();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Unable to correct completed match");
          } finally {
            setSavingCorrection(false);
          }
        }}
      /> : null}
      <Drawer open={editing} title="Edit fixture" onClose={() => setEditing(false)}>
        <SeasonMatchForm
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
              toast.error(error instanceof Error ? error.message : "Unable to update fixture");
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
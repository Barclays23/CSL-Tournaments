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
import { FixtureResolutionModal } from "@/components/matches/FixtureResolutionModal";
import { MatchEventIcon, type MatchEventKind } from "@/components/matches/MatchEventIcon";
import { SeasonMatchForm } from "@/components/forms/SeasonMatchForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import {
  addSeasonMatchGoal,
  deleteSeasonMatchGoal,
  getSeasonMatchById,
  updateSeasonMatch,
  updateSeasonMatchGoal,
  updateSeasonMatchResolution,
} from "@/services/seasonMatchService";
import { getSeasonTeams, getAuctionLots } from "@/services/seasonService";
import { getVenues } from "@/services/venueService";
import type { SeasonMatch, SeasonMatchTeamRef, SeasonMatchWrite } from "@/types/seasonMatch.types";
import type { AuctionLot } from "@/types/season.types";
import { formatDate, formatTime } from "@/utils/formatDate";
import { refId } from "@/utils/refs";

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

/**
 * One row in the centre timeline. Goals are built from match.goals today.
 * When cards are implemented, map them into this same shape
 * (kind: "yellow_card" | "red_card" | "second_yellow") and append them in buildEvents().
 */
type MatchEvent = {
  id: string;
  kind: MatchEventKind;
  teamId: string; // the side the event is displayed under
  playerName: string;
  at: string; // ISO timestamp, used for ordering + the small time label
  goalId?: string; // present for goal events so admins can edit / delete
};

function teamDetails(ref: SeasonMatchTeamRef) {
  if (typeof ref === "string") return { id: ref, name: "Team", logo: null };
  return { id: ref._id, name: ref.displayName, logo: ref.logoSnapshot ?? ref.team?.logo ?? null };
}
function lotTeamId(lot: AuctionLot) {
  return typeof lot.seasonTeamRef === "string" ? lot.seasonTeamRef : lot.seasonTeamRef?._id ?? "";
}
function lotPlayer(lot: AuctionLot) {
  return typeof lot.playerRef === "string" ? null : lot.playerRef;
}

function buildEvents(goals: SeasonMatch["goals"]): MatchEvent[] {
  const events: MatchEvent[] = goals.map((goal) => {
    const scorer = goal.scorerPlayerRef && typeof goal.scorerPlayerRef !== "string" ? goal.scorerPlayerRef.name : null;
    return {
      id: `goal-${goal._id}`,
      kind: goal.goalType === "own_goal" ? "own_goal" : "goal",
      teamId: refId(goal.scoringSeasonTeamRef) ?? "",
      playerName: scorer ?? (goal.goalType === "own_goal" ? "Player" : "Scorer not recorded"),
      at: goal.createdAt,
      goalId: goal._id,
    };
  });
  // FUTURE: events.push(...match.cards.map(card => ({ kind: card.type === "red" ? "red_card" : "yellow_card", ... })))
  return events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
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

export function SeasonMatchDetailsPage({ seasonId, matchId }: { seasonId: string; matchId: string }) {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
  const [resolutionStatus, setResolutionStatus] = useState<"cancelled" | "abandoned">("cancelled");
  const [resolutionReason, setResolutionReason] = useState("");
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [savingResolution, setSavingResolution] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);
  const [goalTeamId, setGoalTeamId] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalType, setGoalType] = useState<"normal" | "own_goal">("normal");
  const [goalPlayerId, setGoalPlayerId] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

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
  const canManageGoals = isAdmin && !["cancelled", "abandoned"].includes(match.status);
  const showScore = match.status === "live" || match.status === "completed" || match.goals.length > 0;
  const events = buildEvents(match.goals);

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

  const showDecision =
    isAdmin &&
    match.status !== "completed" &&
    (!(match.status === "cancelled" || match.status === "abandoned") ||
      !match.resolutionHistory?.some((entry) => entry.status === match.status && entry.reason.trim().length >= 3));
  const showEdit = isAdmin && !["completed", "cancelled", "abandoned"].includes(match.status);

  const saveResolution = async () => {
    const reason = resolutionReason.trim();
    if (reason.length < 3) { toast.error("Enter a resolution reason"); return; }
    setSavingResolution(true);
    try {
      await updateSeasonMatchResolution(seasonId, matchId, { status: resolutionStatus, resolutionReason: reason });
      toast.success("Fixture resolution saved");
      setResolutionReason("");
      setResolutionOpen(false);
      matchQuery.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save fixture resolution");
    } finally {
      setSavingResolution(false);
    }
  };

  const saveGoal = async () => {
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
    const goal = match.goals.find((g) => g._id === goalId);
    if (!goal) return;
    setEditingGoalId(goal._id);
    setGoalTeamId(refId(goal.scoringSeasonTeamRef) ?? home.id);
    setGoalType(goal.goalType);
    setGoalPlayerId(refId(goal.scorerPlayerRef) ?? "");
    setGoalOpen(true);
  };

  const removeGoal = async (goalId: string) => {
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

  /** Team name + crest on either side of the score. */
  const TeamSide = ({ team, side }: { team: ReturnType<typeof teamDetails>; side: "home" | "away" }) => (
    <div
      className={`flex min-w-0 flex-col items-center gap-3 text-center ${
        side === "home" ? "sm:flex-row-reverse sm:justify-start sm:text-right" : "sm:flex-row sm:justify-start sm:text-left"
      }`}
    >
      <Avatar name={team.name} asset={team.logo} className="h-14 w-14 shrink-0 rounded-xl ring-1 ring-line sm:h-16 sm:w-16" />
      <p className="min-w-0 wrap-break-word font-display text-lg leading-tight text-fg sm:text-2xl">{team.name}</p>
    </div>
  );

  /** One event, shown under its team. Admin controls sit on the outer edge. */
  const EventText = ({ event, side }: { event: MatchEvent; side: "home" | "away" }) => {
    const manage = canManageGoals && event.goalId;
    const text = (
      <div className={`min-w-0 ${side === "home" ? "text-right" : "text-left"}`}>
        <p className="truncate text-sm font-semibold text-fg">
          {event.playerName}
          {event.kind === "own_goal" ? <span className="ml-1 font-medium text-danger">(OG)</span> : null}
        </p>
        <p className="text-xs tabular text-faint">{eventTime(event.at)}</p>
      </div>
    );
    const actions = manage ? (
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" className={iconBtnClass} aria-label={`Edit goal by ${event.playerName}`} onClick={() => beginGoalEdit(event.goalId!)}><PencilIcon /></button>
        <button type="button" className={`${iconBtnClass} hover:text-danger`} aria-label={`Delete goal by ${event.playerName}`} onClick={() => void removeGoal(event.goalId!)}><TrashIcon /></button>
      </div>
    ) : null;
    return (
      <div className={`flex min-w-0 items-center gap-2 ${side === "home" ? "justify-end" : "justify-start"}`}>
        {side === "home" ? <>{actions}{text}</> : <>{text}{actions}</>}
      </div>
    );
  };

  return (
    <PageContainer>
      <Link to="/matches" search={{ seasonId }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        Back to matches
      </Link>

      {/* Admin actions: on top */}
      {showEdit || showDecision ? (
        <GlassCard className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4 backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg text-fg">Fixture decision</h2>
            <p className="mt-0.5 text-sm text-muted">Edit the fixture, or record an audited reason if it must be cancelled or abandoned.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {showEdit ? <Button size="sm" variant="surface" onClick={() => setEditing(true)}>Edit fixture</Button> : null}
            {showDecision ? <>
              <Button size="sm" variant="danger" onClick={() => { setResolutionStatus("cancelled"); setResolutionReason(""); setResolutionOpen(true); }}>Cancel match</Button>
              <Button size="sm" variant="surface" onClick={() => { setResolutionStatus("abandoned"); setResolutionReason(""); setResolutionOpen(true); }}>Abandon match</Button>
            </> : null}
          </div>
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
            <TeamSide team={home} side="home" />
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
            <TeamSide team={away} side="away" />
          </div>

          {match.notes ? <p className="mt-5 text-center text-sm text-muted">{match.notes}</p> : null}

          {/* Events under each team, icon on the centre line */}
          <div className="mt-8 border-t border-line pt-5">
            {events.length === 0 ? (
              <p className="text-center text-sm text-muted">No goals recorded.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {events.map((event) => {
                  const side = event.teamId === away.id ? "away" : "home";
                  return (
                    <li key={event.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
                      {side === "home" ? <EventText event={event} side="home" /> : <span />}
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-glass backdrop-blur-md">
                        <MatchEventIcon kind={event.kind} className="h-5 w-5" />
                      </span>
                      {side === "away" ? <EventText event={event} side="away" /> : <span />}
                    </li>
                  );
                })}
              </ul>
            )}
            {canManageGoals ? (
              <div className="mt-5 flex justify-center">
                <Button size="sm" onClick={() => { setEditingGoalId(null); setGoalTeamId(home.id); setGoalType("normal"); setGoalPlayerId(""); setGoalOpen(true); }}>Add goal</Button>
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
      <FixtureResolutionModal
        open={resolutionOpen}
        status={resolutionStatus}
        reason={resolutionReason}
        saving={savingResolution}
        onClose={() => setResolutionOpen(false)}
        onStatusChange={setResolutionStatus}
        onReasonChange={setResolutionReason}
        onSubmit={saveResolution}
      />
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
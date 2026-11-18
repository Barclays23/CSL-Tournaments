import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SeasonMatchForm } from "@/components/forms/SeasonMatchForm";
import { SearchBar } from "@/components/forms/SearchBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { SeasonFixtureCard } from "@/components/matches/SeasonFixtureCard";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getSeasons, getSeasonTeams } from "@/services/seasonService";
import { createSeasonMatch, getSeasonGroups, getSeasonMatches, updateSeasonMatch } from "@/services/seasonMatchService";
import type { SeasonMatch, SeasonMatchStage, SeasonMatchStatus, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { errorMessage } from "@/utils/errorHandler";
import { getVenues } from "@/services/venueService";

const TABS: { value: SeasonMatchStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "scheduled", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Results" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "abandoned", label: "Abandoned" },
];

const STAGES: Array<{ value: SeasonMatchStage; label: string }> = [
  { value: "group", label: "Group stage" },
  { value: "round_of_16", label: "Round of 16" },
  { value: "quarter_final", label: "Quarter-final" },
  { value: "semi_final", label: "Semi-final" },
  { value: "third_place", label: "Third-place playoff" },
  { value: "final", label: "Final" },
];

const EMPTY_MATCH_RESPONSE = {
  success: true,
  message: "No season selected",
  data: [],
  pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
};

export function MatchesPage({ initialSeasonId }: { initialSeasonId?: string }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<SeasonMatchStatus | "">("");
  const [stage, setStage] = useState<SeasonMatchStage | "">("");
  const [groupRef, setGroupRef] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<SeasonMatch | null>(null);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(search);

  const seasons = useServiceQuery(() => getSeasons(), []);
  const availableSeasons = seasons.data?.data ?? [];
  const seasonFromUrl = availableSeasons.find((season) => season._id === initialSeasonId);
  const selectedSeason = seasonFromUrl
    ?? availableSeasons.find((season) => season.status === "active")
    ?? [...availableSeasons].sort((a, b) => b.seasonNumber - a.seasonNumber)[0]
    ?? null;
  const seasonId = selectedSeason?._id ?? "";

  const groups = useServiceQuery(
    () => seasonId
      ? getSeasonGroups(seasonId)
      : Promise.resolve({ success: true, message: "No season selected", data: [] }),
    [seasonId],
  );
  const venues = useServiceQuery(() => getVenues("all"), []);
  const seasonTeams = useServiceQuery(
    () => seasonId
      ? getSeasonTeams(seasonId)
      : Promise.resolve({ success: true, message: "No season selected", data: [] }),
    [seasonId],
  );
  const matches = useServiceQuery(
    () => seasonId
      ? getSeasonMatches(seasonId, {
          page,
          limit: 8,
          ...(status ? { status } : {}),
          ...(stage ? { stage } : {}),
          ...(groupRef ? { groupRef } : {}),
          ...(debounced.trim() ? { search: debounced.trim() } : {}),
        })
      : Promise.resolve(EMPTY_MATCH_RESPONSE),
    [seasonId, page, status, stage, groupRef, debounced],
  );

  const eligibleSeasonTeams = (seasonTeams.data?.data ?? []).filter((team) => ["registered", "active"].includes(team.status));
  const activeVenueCount = (venues.data?.data ?? []).filter((venue) => venue.status === "active").length;
  const fixtureBlockReason = !selectedSeason
    ? "Select a season to manage fixtures."
    : !["upcoming", "active"].includes(selectedSeason.status)
      ? "Fixtures can only be created for upcoming or active seasons."
      : !selectedSeason.matchRules
        ? "Match rules are not configured for this season."
        : eligibleSeasonTeams.length < 2
          ? "At least two eligible participating teams are required."
          : !venues.loading && activeVenueCount === 0
            ? "Create at least one active venue before creating fixtures."
            : null;
  const fixtureCreationAllowed = Boolean(!seasons.loading && !seasonTeams.loading && !venues.loading && !fixtureBlockReason);
  const canCreateFixture = Boolean(isAdmin && fixtureCreationAllowed);
  const pagination = matches.data?.pagination;
  const resultStart = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const resultEnd = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;
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

  const resetFilters = () => {
    setStatus("");
    setStage("");
    setGroupRef("");
    setSearch("");
    setPage(1);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Calendar"
        title="Fixtures"
        description="Choose a season to view its fixtures, match results and penalty shootouts."
        actions={isAdmin ? <div className="flex flex-wrap gap-2"><Button variant="surface" onClick={() => void navigate({ to: "/admin/venues" })}>Manage venues</Button>{canCreateFixture ? <Button onClick={() => { setEditingMatch(null); setOpen(true); }}>Create fixture</Button> : null}</div> : null}
      />
      <div className="mb-4 max-w-sm">
        <Select
          value={seasonId}
          aria-label="Season"
          disabled={seasons.loading || availableSeasons.length === 0}
          onChange={(event) => {
            resetFilters();
            void navigate({ to: "/matches", search: { seasonId: event.target.value || undefined }, replace: true });
          }}
        >
          {availableSeasons.length === 0 ? <option value="">No seasons available</option> : null}
          {availableSeasons.map((season) => (
            <option key={season._id} value={season._id}>{season.name} ({season.year})</option>
          ))}
        </Select>
        {selectedSeason ? <p className="mt-1 text-xs text-muted">Showing fixtures for {selectedSeason.name}.</p> : null}
      </div>
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}
      {selectedSeason ? (
        <section
          aria-label="Selected season information"
          className="mb-5 rounded-2xl border border-line bg-glass p-4 shadow-sm sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Season {selectedSeason.year} <span aria-hidden="true">·</span> Edition {selectedSeason.seasonNumber}
              </p>
              <h2 className="mt-1 truncate font-display text-xl text-fg sm:text-2xl">
                {selectedSeason.name}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {seasonDateRange}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-line bg-surface px-3 py-1.5">
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${
                  selectedSeason.status === "active" ? "bg-success"
                    : selectedSeason.status === "upcoming" ? "bg-info"
                      : selectedSeason.status === "completed" ? "bg-muted"
                        : selectedSeason.status === "archived" ? "bg-warning"
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
      <Tabs tabs={TABS} value={status} onChange={(value) => { setStatus(value as SeasonMatchStatus | ""); setPage(1); }} />
      <div className="my-4 grid gap-3 md:grid-cols-3">
        <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search match number or team" />
        <Select value={stage} aria-label="Stage" onChange={(event) => { setStage(event.target.value as SeasonMatchStage | ""); setPage(1); }}>
          <option value="">All stages</option>
          {STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
        <Select value={groupRef} aria-label="Group" onChange={(event) => { setGroupRef(event.target.value); setPage(1); }}>
          <option value="">All groups</option>
          {(groups.data?.data ?? []).map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
        </Select>
      </div>
      {groups.error ? <ErrorState message={groups.error} onRetry={groups.reload} /> : null}
      {matches.loading ? <Skeleton className="h-40" /> : null}
      {matches.error ? <ErrorState message={matches.error} onRetry={matches.reload} /> : null}
      {!matches.loading && !matches.error && matches.data?.data.length === 0 ? (
        <EmptyState title="No fixtures" description={seasonId ? "No matches in this season match these filters." : "Create a season and add its participating teams first."} />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {matches.data?.data.map((match) => (
          <SeasonFixtureCard
            key={match._id}
            match={match}
            groupName={(groups.data?.data ?? []).find((group) => group._id === match.groupRef)?.groupName ?? null}
            onEdit={isAdmin && ["upcoming", "active"].includes(selectedSeason?.status ?? "") ? (fixture) => { setEditingMatch(fixture); setOpen(true); } : undefined}
          />
        ))}
      </div>
      <Pagination pagination={matches.data?.pagination} onPage={setPage} />
      <Drawer open={open} title={`${editingMatch ? "Edit fixture" : "Create fixture"} · ${selectedSeason?.name ?? ""}`} onClose={() => { setOpen(false); setEditingMatch(null); }}>
        <SeasonMatchForm
          seasonTeams={seasonTeams.data?.data ?? []}
          groups={groups.data?.data ?? []}
          venues={venues.data?.data ?? []}
          match={editingMatch}
          submitting={saving}
          onSubmit={async (values: SeasonMatchWrite) => {
            if (!seasonId) return;
            setSaving(true);
            try {
              if (editingMatch) {
                await updateSeasonMatch(seasonId, editingMatch._id, values);
                toast.success("Season fixture updated");
              } else {
                await createSeasonMatch(seasonId, values);
                toast.success("Season fixture created");
              }
              setOpen(false);
              setEditingMatch(null);
              setPage(1);
              matches.reload();
            } catch (error) {
              toast.error(errorMessage(error));
              throw error;
            } finally {
              setSaving(false);
            }
          }}
        />
      </Drawer>
    </PageContainer>
  );
}

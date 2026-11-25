import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SeasonMatchForm } from "@/components/forms/SeasonMatchForm";
import { SearchBar } from "@/components/forms/SearchBar";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { SeasonFixtureCard } from "@/components/matches/SeasonFixtureCard";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getSeasons, getSeasonTeams } from "@/services/seasonService";
import { createSeasonMatch, deleteSeasonMatch, getSeasonGroups, getSeasonMatches, updateSeasonMatch } from "@/services/seasonMatchService";
import type { SeasonMatch, SeasonMatchStage, SeasonMatchStatus, SeasonMatchWrite } from "@/types/seasonMatch.types";
import { errorMessage } from "@/utils/errorHandler";
import { getVenues } from "@/services/venueService";
import { canEditSeasonMatch } from "@/utils/seasonMatchPermissions";
import { getDefaultSeason } from "@/utils/defaultSeason";

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

const SEASON_DOT: Record<string, string> = {
  active: "bg-success",
  upcoming: "bg-info",
  completed: "bg-muted",
  archived: "bg-warning",
};

/** Shared glass surface used across the page so every panel feels like one system. */
const GLASS = "border border-line bg-glass shadow-glass backdrop-blur-xl";

function Stat({ label, value, loading }: { label: string; value: number | string; loading?: boolean }) {
  return (
    <div className="rounded-control border border-line bg-surface/60 px-4 py-3 backdrop-blur-md">
      <p className="text-xs text-muted">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-10" />
      ) : (
        <p className="tabular mt-0.5 font-display text-2xl leading-none text-fg">{value}</p>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`Remove filter: ${label}`}
      className="group inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/70 py-1 pl-3 pr-2 text-xs font-semibold text-fg backdrop-blur-md transition-colors hover:border-accent hover:text-accent"
    >
      <span className="max-w-40 truncate">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted group-hover:text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

export function MatchesPage({ initialSeasonId, managementMode = false }: { initialSeasonId?: string; managementMode?: boolean }) {
  const { isAdmin } = useAuth();
  const confirm = useConfirm();
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
  const selectedSeason = seasonFromUrl ?? getDefaultSeason(availableSeasons);
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
    : selectedSeason.status !== "active"
      ? "Activate the season before creating or changing fixtures."
      : selectedSeason.auctionLifecycleStatus !== "completed"
        ? "Complete the auction before creating or changing fixtures."
        : !selectedSeason.matchRules
          ? "Match rules are not configured for this season."
          : eligibleSeasonTeams.length < 2
            ? "At least two eligible participating teams are required."
            : !venues.loading && activeVenueCount === 0
              ? "Create at least one active venue before creating fixtures."
              : null;
  const fixtureManagementHint = !selectedSeason
    ? null
    : selectedSeason.status === "upcoming"
      ? "This season is Upcoming. Fixture creation, editing and deletion are available only in an Active season. Complete the auction and activate this season from the Seasons page. Existing fixtures remain available for viewing."
      : selectedSeason.status === "draft"
        ? "This season is still in Draft. Complete its configuration, move it to Upcoming, finish the auction, then activate it before managing fixtures."
        : selectedSeason.status === "completed" || selectedSeason.status === "archived"
          ? "This season is read-only. Fixture creation, editing and deletion are available only while the season is Active."
          : selectedSeason.auctionLifecycleStatus !== "completed"
            ? "The auction must be completed before fixtures can be created, edited or deleted. Existing fixtures remain available for viewing."
            : null;
  const fixtureCreationAllowed = Boolean(!seasons.loading && !seasonTeams.loading && !venues.loading && !fixtureBlockReason);
  const canCreateFixture = Boolean(isAdmin && fixtureCreationAllowed);
  const fixturesEditable = Boolean(isAdmin && selectedSeason?.auctionLifecycleStatus === "completed" && selectedSeason?.status === "active");

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

  const openCreate = () => {
    setEditingMatch(null);
    setOpen(true);
  };

  const handleDelete = async (fixture: SeasonMatch) => {
    const yes = await confirm({ title: "Delete this fixture?", description: "Delete match " + fixture.matchNumber + "?", confirmLabel: "Delete fixture", danger: true });
    if (!yes) return;
    try {
      await deleteSeasonMatch(seasonId, fixture._id);
      toast.success("Fixture deleted");
      matches.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  // Active filter chips
  const groupList = groups.data?.data ?? [];
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (status) activeFilters.push({ key: "status", label: TABS.find((t) => t.value === status)?.label ?? status, clear: () => { setStatus(""); setPage(1); } });
  if (stage) activeFilters.push({ key: "stage", label: STAGES.find((s) => s.value === stage)?.label ?? stage, clear: () => { setStage(""); setPage(1); } });
  if (groupRef) activeFilters.push({ key: "group", label: groupList.find((g) => g._id === groupRef)?.groupName ?? "Group", clear: () => { setGroupRef(""); setPage(1); } });
  if (search.trim()) activeFilters.push({ key: "search", label: `“${search.trim()}”`, clear: () => { setSearch(""); setPage(1); } });

  const totalFixtures = matches.data?.pagination?.total ?? 0;
  const hasFilters = activeFilters.length > 0;

  return (
    <PageContainer>
      {managementMode ? (
        <AdminPageBanner
          breadcrumb="Admin / Competition management"
          title="Matches"
          description="Manage season fixtures, results, match status and venue assignments."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="surface" onClick={() => void navigate({ to: "/admin/venues" })}>Manage venues</Button>
              {canCreateFixture ? (
                <Button onClick={openCreate}>
                  <span className="inline-flex items-center gap-1.5"><PlusIcon />Create fixture</span>
                </Button>
              ) : null}
            </div>
          }
        />
      ) : (
        <PageHeader
          eyebrow="Calendar"
          title="Fixtures"
          description="Choose a season to view its fixtures, match results and penalty shootouts."
          actions={canCreateFixture ? <Button onClick={openCreate}><span className="inline-flex items-center gap-1.5"><PlusIcon />Create fixture</span></Button> : undefined}
        />
      )}

      {seasons.error ? <div className="mb-5"><ErrorState message={seasons.error} onRetry={seasons.reload} /></div> : null}

      {/* Season hero */}
      <section
        aria-label="Selected season"
        className={`relative mb-5 overflow-hidden rounded-card ${GLASS}`}
      >
        {/* decorative glow + pitch markings, theme-aware */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-1/3 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div
          aria-hidden="true"
          className="pitch-lines pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 mask-[linear-gradient(to_left,black,transparent)] sm:block"
        />

        <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            {selectedSeason ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-semibold capitalize text-fg backdrop-blur-md">
                    <span className="relative flex h-2 w-2">
                      {selectedSeason.status === "active" ? (
                        <span aria-hidden="true" className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                      ) : null}
                      <span aria-hidden="true" className={`relative inline-flex h-2 w-2 rounded-full ${SEASON_DOT[selectedSeason.status] ?? "bg-line"}`} />
                    </span>
                    {selectedSeason.status}
                  </span>
                  <span className="text-xs text-muted">Edition {selectedSeason.seasonNumber}</span>
                </div>
                <h2 className="mt-3 truncate font-display text-2xl text-fg sm:text-3xl">{selectedSeason.name}</h2>
                <p className="mt-1 text-sm text-muted">
                  {selectedSeason.year} season · {seasonDateRange}
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-2xl text-fg sm:text-3xl">{seasons.loading ? "Loading seasons…" : "No season selected"}</h2>
                <p className="mt-1 text-sm text-muted">Create a season and add its participating teams to start scheduling fixtures.</p>
              </>
            )}

            <div className="mt-4 max-w-sm">
              <Select
                value={seasonId}
                aria-label="Season"
                disabled={seasons.loading || availableSeasons.length === 0}
                onChange={(event) => {
                  resetFilters();
                  void navigate({ to: managementMode ? "/admin/matches" : "/matches", search: { seasonId: event.target.value || undefined }, replace: true });
                }}
              >
                {availableSeasons.length === 0 ? <option value="">No seasons available</option> : null}
                {availableSeasons.map((season) => (
                  <option key={season._id} value={season._id}>{season.name} ({season.year})</option>
                ))}
              </Select>
            </div>
          </div>

          {selectedSeason ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <Stat label={hasFilters ? "Matching" : "Fixtures"} value={totalFixtures} loading={matches.loading && !matches.data} />
              <Stat label="Teams" value={eligibleSeasonTeams.length} loading={seasonTeams.loading} />
              <Stat label="Venues" value={activeVenueCount} loading={venues.loading} />
            </div>
          ) : null}
        </div>
      </section>

      {/* Admin hint */}
      {managementMode && isAdmin && fixtureManagementHint ? (
        <GlassCard className="mb-5 border border-info/30 bg-info/10 p-4 backdrop-blur-xl" role="status">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info text-sm font-bold text-info-fg">i</span>
              <div className="min-w-0">
                <p className="font-semibold text-fg">Fixture management is currently unavailable</p>
                <p className="mt-1 text-sm leading-6 text-muted">{fixtureManagementHint}</p>
              </div>
            </div>
            {selectedSeason && selectedSeason.status !== "active" ? (
              <Link
                to="/admin/seasons/$seasonId"
                params={{ seasonId: selectedSeason._id }}
                className="shrink-0 rounded-control border border-line bg-surface/70 px-4 py-2 text-sm font-semibold text-accent backdrop-blur-md transition-colors hover:border-accent"
              >
                Go to selected season
              </Link>
            ) : null}
          </div>
        </GlassCard>
      ) : null}

      {/* Filter toolbar */}
      <section aria-label="Filter fixtures" className={`sticky top-2 z-10 mb-5 rounded-card p-3 sm:p-4 ${GLASS}`}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <Tabs
            tabs={TABS}
            value={status}
            onChange={(value) => { setStatus(value as SeasonMatchStatus | ""); setPage(1); }}
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search match number or team" />
          <Select value={stage} aria-label="Stage" onChange={(event) => { setStage(event.target.value as SeasonMatchStage | ""); setPage(1); }}>
            <option value="">All stages</option>
            {STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Select value={groupRef} aria-label="Group" onChange={(event) => { setGroupRef(event.target.value); setPage(1); }}>
            <option value="">All groups</option>
            {groupList.map((group) => <option key={group._id} value={group._id}>{group.groupName}</option>)}
          </Select>
        </div>

        {hasFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs text-muted">Filters</span>
            {activeFilters.map((filter) => <FilterChip key={filter.key} label={filter.label} onRemove={filter.clear} />)}
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-surface/70"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </section>

      {groups.error ? <div className="mb-5"><ErrorState message={groups.error} onRetry={groups.reload} /></div> : null}

      {/* Results */}
      {matches.loading ? (
        <div className="grid gap-3 lg:grid-cols-2" aria-busy="true" aria-label="Loading fixtures">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-card" />
          ))}
        </div>
      ) : null}
      {matches.error ? <ErrorState message={matches.error} onRetry={matches.reload} /> : null}
      {!matches.loading && !matches.error && matches.data?.data.length === 0 ? (
        <div className={`rounded-card p-2 ${GLASS}`}>
          <EmptyState
            title="No fixtures"
            description={seasonId ? "No matches in this season match these filters." : "Create a season and add its participating teams first."}
          />
          {hasFilters ? (
            <div className="pb-4 text-center">
              <Button variant="surface" onClick={resetFilters}>Clear filters</Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!matches.loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {matches.data?.data.map((match) => (
            <div
              key={match._id}
              className="rounded-card border border-transparent transition-transform duration-200 hover:-translate-y-0.5 motion-reduce:transform-none"
            >
              <SeasonFixtureCard
                match={match}
                groupName={groupList.find((group) => group._id === match.groupRef)?.groupName ?? null}
                managementMode={managementMode}
                onEdit={fixturesEditable && canEditSeasonMatch(match) ? (fixture) => { setEditingMatch(fixture); setOpen(true); } : undefined}
                onDelete={fixturesEditable ? handleDelete : undefined}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <Pagination pagination={matches.data?.pagination} onPage={setPage} />
      </div>

      <Drawer
        open={open}
        title={`${editingMatch ? "Edit fixture" : "Create fixture"} · ${selectedSeason?.name ?? ""}`}
        onClose={() => { setOpen(false); setEditingMatch(null); }}
      >
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
                if (!values.kickoffAt) throw new Error("Kick-off date and time are required to create a fixture.");
                await createSeasonMatch(seasonId, { ...values, kickoffAt: values.kickoffAt });
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
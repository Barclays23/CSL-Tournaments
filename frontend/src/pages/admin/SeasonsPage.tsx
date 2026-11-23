import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Search, CalendarDays, Plus } from "lucide-react";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { createSeason, getSeasons } from "@/services/seasonService";
import { SeasonConfigurationForm, type SeasonFormState } from "@/components/forms/SeasonConfigurationForm";
import type { SeasonStatus, SeasonWrite } from "@/types/season.types";
import { errorMessage } from "@/utils/errorHandler";
import { getDefaultSeason } from "@/utils/defaultSeason";

const defaultForm = (seasonNumber = 1): SeasonFormState => ({
  seasonNumber, name: "", year: new Date().getFullYear(), startDate: "", endDate: "", groupStageEnabled: true, homeAndAwayFixtures: false,
  budgetPerTeam: 10000, playersCount: 54, seasonTeamCount: 6, teamSquadSize: 9, iconPlayerLimit: 1, goalkeeperLimit: 1,
  win: 3, draw: 1, loss: 0, groupStageDrawAllowed: true, knockoutDrawRequiresShootout: true,
  standingsTieBreakers: ["points", "goalDifference", "goalsScored", "teamNameAsc"],
});

const toPayload = (form: SeasonFormState): SeasonWrite => ({
  seasonNumber: form.seasonNumber, name: form.name.trim(), year: form.year,
  startDate: form.startDate || null, endDate: form.endDate || null, timeZone: "Asia/Kolkata",
  groupStageEnabled: form.groupStageEnabled, homeAndAwayFixtures: form.homeAndAwayFixtures,
  auctionSettings: {
    currency: "INR", budgetPerTeam: form.budgetPerTeam, playersCount: form.playersCount,
    seasonTeamCount: form.seasonTeamCount, teamSquadSize: form.teamSquadSize,
    iconPlayerLimit: form.iconPlayerLimit, goalkeeperLimit: form.goalkeeperLimit,
  },
  pointsRules: { win: form.win, draw: form.draw, loss: form.loss },
  standingsTieBreakers: form.standingsTieBreakers,
  matchRules: {
    groupStageDrawAllowed: form.groupStageDrawAllowed,
    knockoutDrawRequiresShootout: form.knockoutDrawRequiresShootout,
    shootoutCountsForMatchScore: false, shootoutCountsForPlayerGoals: false,
  },
});

const statuses: SeasonStatus[] = ["draft", "upcoming", "active", "completed", "archived"];
const statusLabel = (status: SeasonStatus) => status.charAt(0).toUpperCase() + status.slice(1);
const statusTone = (status: SeasonStatus) =>
  status === "active" ? "accent" : status === "completed" ? "gold" : status === "archived" ? "neutral" : "info";

export function SeasonsPage() {
  const navigate = useNavigate();
  const seasons = useServiceQuery(() => getSeasons(), []);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SeasonFormState>(() => defaultForm());
  const [saving, setSaving] = useState(false);

  const years = useMemo(
    () => [...new Set((seasons.data?.data ?? []).map((season) => season.year))].sort((a, b) => b - a),
    [seasons.data],
  );
  const defaultSeasonId = getDefaultSeason(seasons.data?.data ?? [])?._id ?? null;
  const filteredSeasons = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (seasons.data?.data ?? [])
      .filter((season) => {
        const matchesSearch = !term || season.name.toLowerCase().includes(term) || String(season.seasonNumber).includes(term);
        const matchesYear = yearFilter === "all" || String(season.year) === yearFilter;
        const matchesStatus = statusFilter === "all" || season.status === statusFilter;
        return matchesSearch && matchesYear && matchesStatus;
      })
      .sort((left, right) => Number(right._id === defaultSeasonId) - Number(left._id === defaultSeasonId));
  }, [seasons.data, search, yearFilter, statusFilter, defaultSeasonId]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createForm.endDate && createForm.startDate && createForm.endDate < createForm.startDate) {
      toast.error("End date must be on or after start date");
      return;
    }
    if (createForm.iconPlayerLimit > createForm.teamSquadSize || createForm.goalkeeperLimit > createForm.teamSquadSize) {
      toast.error("Player limits cannot exceed the team squad size");
      return;
    }
    setSaving(true);
    try {
      const result = await createSeason(toPayload(createForm));
      toast.success("Draft season created");
      setCreateOpen(false);
      await navigate({ to: "/admin/seasons/$seasonId", params: { seasonId: result.data._id } });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
      seasons.reload();
    }
  };

  const openCreate = () => {
    const nextNumber = (seasons.data?.data.reduce((max, season) => Math.max(max, season.seasonNumber), 0) ?? 0) + 1;
    setCreateForm(defaultForm(nextNumber));
    setCreateOpen(true);
  };

  return (
    <PageContainer>
      <AdminPageBanner
        breadcrumb="Admin / Tournament setup"
        title="Season Library"
        description="Browse tournament editions, create new seasons and open an individual workspace to manage its lifecycle."
        actions={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Create season</Button>}
      />

      {seasons.loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div> : null}
      {seasons.error ? <ErrorState message={seasons.error} onRetry={seasons.reload} /> : null}

      {/* ───── Season library ───── */}
      <GlassCard className="mb-6 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl text-fg">Season library</h2>
            <p className="mt-1 text-sm text-muted">{seasons.data?.data.length ?? 0} season(s). Open an edition to manage its setup and history.</p>
          </div>
          <Badge>{filteredSeasons.length} shown</Badge>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input className="pl-9" aria-label="Search seasons" placeholder="Search season name or edition…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select aria-label="Filter by year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="all">All years</option>{years.map((year) => <option key={year} value={String(year)}>{year}</option>)}
          </Select>
          <Select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSeasons.map((season) => (
            <div key={season._id} className="relative overflow-hidden rounded-2xl border border-line bg-surface/40 p-4 backdrop-blur-md transition hover:border-accent/70 hover:bg-surface/70">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface/60 text-accent"><CalendarDays className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <span className="block truncate font-semibold text-fg">{season.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Edition {season.seasonNumber} · {season.year}</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {season._id === defaultSeasonId ? <Badge tone="accent">Default season</Badge> : null}
                  <Badge tone={statusTone(season.status)}>{statusLabel(season.status)}</Badge>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                <span>{season.startDate ? season.startDate.slice(0, 10) : "No start date"}</span>
                <span>{season.endDate ? season.endDate.slice(0, 10) : "No end date"}</span>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="surface" onClick={() => void navigate({ to: "/admin/seasons/$seasonId", params: { seasonId: season._id } })}>View season</Button>
              </div>
            </div>
          ))}
          {!filteredSeasons.length && !seasons.loading ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <EmptyState title="No seasons found" description="Try changing the search or filters, or create a new Draft season." />
            </div>
          ) : null}
        </div>
      </GlassCard>

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
    </PageContainer>
  );
}

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { TeamForm } from "@/components/forms/TeamForm";
import { SearchBar } from "@/components/forms/SearchBar";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import type { TeamFormValues } from "@/schemas/team.schema";
import { createTeam, deleteTeam, getTeams, updateTeam } from "@/services/teamService";
import type { Asset } from "@/types/api.types";
import type { Team } from "@/types/team.types";
import { errorMessage } from "@/utils/errorHandler";

function TeamCardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-64 rounded-3xl" />
      ))}
    </div>
  );
}

export function TeamsPage() {
  const isAdmin = true;
  const confirm = useConfirm();
  const teams = useServiceQuery(() => getTeams(), []);
  const [search, setSearch] = useState("");
  const filteredTeams = (teams.data?.data ?? []).filter((team) => !search.trim() || team.name.toLowerCase().includes(search.trim().toLowerCase()));
  const totalTeams = teams.data?.data.length ?? 0;
  const [editing, setEditing] = useState<Team | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const save = async (values: TeamFormValues, logo: Asset | null, poster: Asset | null) => {
    setSaving(true);
    try {
      const payload = { ...values, logo, poster };
      if (editing) await updateTeam(editing._id, payload);
      else await createTeam(payload);
      toast.success(editing ? "Team updated" : "Team created");
      setEditing(undefined);
      teams.reload();
    } catch (error) {
      toast.error(errorMessage(error));
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (team: Team) => {
    const confirmed = await confirm({
      title: `Delete ${team.name}?`,
      description: "Historical season participation must be preserved. The server will prevent deletion when the team is referenced.",
      confirmLabel: "Delete team",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteTeam(team._id);
      toast.success("Team deleted");
      teams.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <PageContainer>
      <AdminPageBanner
        breadcrumb="Admin / Team directory"
        title="Teams"
        description="Manage permanent team identities, logos and descriptions. Season squads, auction spending and match statistics remain season-specific."
        actions={<Button onClick={() => setEditing(null)}>Add team</Button>}
      />

      {/* --------------------------- Toolbar --------------------------- */}
      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-line bg-glass p-3 shadow-glass backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="w-full sm:max-w-md">
          <SearchBar value={search} onChange={setSearch} placeholder="Search teams" />
        </div>
        {teams.data ? (
          <p className="px-1 text-sm text-muted tabular">
            Showing <strong className="text-fg">{filteredTeams.length}</strong> of{" "}
            <strong className="text-fg">{totalTeams}</strong> team(s)
          </p>
        ) : null}
      </div>

      {teams.loading ? <TeamCardSkeleton /> : null}
      {teams.error ? <ErrorState message={teams.error} onRetry={teams.reload} /> : null}
      {teams.data && filteredTeams.length === 0 ? (
        <EmptyState title="No teams found" description="Teams registered for the tournament will appear here." />
      ) : null}

      {/* ----------------------------- Grid ----------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredTeams.map((team) => (
          <GlassCard
            key={team._id}
            className="group relative flex flex-col overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:border-accent hover:bg-glass-strong"
          >
            {/* Poster banner */}
            <div className="relative h-28 w-full sm:h-32">
              {team.poster ? (
                <img src={team.poster.url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <div className="pitch-stripes h-full w-full" />
              )}
              <div className="pitch-lines absolute inset-0" />
              <div className="absolute inset-0 bg-linear-to-t from-bg/80 via-bg/20 to-transparent" />
              <div className="absolute right-3 top-3">
                <Badge tone={team.status === "active" ? "accent" : "neutral"}>{team.status}</Badge>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col px-5 pb-5">
              <div className="-mt-9 flex items-end gap-3">
                <div className="shrink-0 rounded-2xl border border-line bg-glass-strong p-1 shadow-glass backdrop-blur-xl">
                  <Avatar name={team.name} asset={team.logo} className="h-16 w-16 rounded-xl" />
                </div>
                {team.shortName ? (
                  <span className="mb-1 rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted ring-1 ring-line">
                    {team.shortName}
                  </span>
                ) : null}
              </div>

              <h2 className="mt-3 font-display text-2xl leading-tight text-fg">
                {/* Stretched link: the whole card opens the team page */}
                <Link
                  to="/admin/teams/$teamId"
                  params={{ teamId: team._id }}
                  className="transition-colors after:absolute after:inset-0 after:content-[''] group-hover:text-accent"
                >
                  {team.name}
                </Link>
              </h2>

              {team.description ? (
                <p className="mt-2 line-clamp-3 text-sm text-muted">{team.description}</p>
              ) : (
                <p className="mt-2 text-sm text-faint">No description added.</p>
              )}

              {/* Actions sit above the stretched link */}
              <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-5">
                <span className="mr-auto text-xs font-semibold text-accent opacity-80 transition group-hover:translate-x-0.5 group-hover:opacity-100">
                  View details →
                </span>
                {isAdmin ? (
                  <>
                    <Button size="sm" variant="surface" onClick={() => setEditing(team)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(team)}>Delete</Button>
                  </>
                ) : null}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <Drawer open={editing !== undefined} title={editing ? "Edit Team" : "Add Team"} onClose={() => setEditing(undefined)}>
        <TeamForm team={editing} submitting={saving} onSubmit={save} />
      </Drawer>
    </PageContainer>
  );
}
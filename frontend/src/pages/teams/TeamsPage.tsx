import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { TeamForm } from "@/components/forms/TeamForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import type { TeamFormValues } from "@/schemas/team.schema";
import { createTeam, deleteTeam, getTeams, updateTeam } from "@/services/teamService";
import type { Asset } from "@/types/api.types";
import type { Team } from "@/types/team.types";
import { errorMessage } from "@/utils/errorHandler";

export function TeamsPage() {
  const { isAuthenticated } = useAuth();
  const confirm = useConfirm();
  const teams = useServiceQuery(() => getTeams(), []);
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
      <PageHeader
        eyebrow="Tournament directory"
        title="Teams"
        description="Permanent team identities, logos and descriptions. Season squads, auction spending and match statistics are shown in season-specific views."
        actions={isAuthenticated ? <Button onClick={() => setEditing(null)}>Add team</Button> : null}
      />
      {teams.loading ? <Skeleton className="h-40" /> : null}
      {teams.error ? <ErrorState message={teams.error} onRetry={teams.reload} /> : null}
      {teams.data && teams.data.data.length === 0 ? (
        <EmptyState title="No teams found" description="Teams registered for the tournament will appear here." />
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.data?.data.map((team) => (
          <GlassCard key={team._id} className="overflow-hidden p-5">
            <div className="flex items-center gap-3">
              {team.logo ? <img src={team.logo.url} alt={`${team.name} logo`} className="h-14 w-14 rounded-xl object-cover" /> : null}
              <div className="min-w-0">
                <h2 className="font-display text-2xl text-fg">{team.name}</h2>
                <div className="mt-1 flex flex-wrap gap-2">
                  {team.shortName ? <Badge>{team.shortName}</Badge> : null}
                  <Badge tone={team.status === "active" ? "accent" : "neutral"}>{team.status}</Badge>
                </div>
              </div>
            </div>
            {team.description ? <p className="mt-4 text-sm text-muted">{team.description}</p> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/teams/$teamId" params={{ teamId: team._id }}>
                <Button size="sm" variant="surface">Team details</Button>
              </Link>
              {isAuthenticated ? (
                <>
                  <Button size="sm" variant="surface" onClick={() => setEditing(team)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(team)}>Delete</Button>
                </>
              ) : null}
            </div>
          </GlassCard>
        ))}
      </div>
      <Drawer open={editing !== undefined} title={editing ? "Edit team" : "Add team"} onClose={() => setEditing(undefined)}>
        <TeamForm team={editing} submitting={saving} onSubmit={save} />
      </Drawer>
    </PageContainer>
  );
}

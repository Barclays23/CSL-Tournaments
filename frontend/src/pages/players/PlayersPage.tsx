import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/PageContainer";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { PlayerForm } from "@/components/forms/PlayerForm";
import { SearchBar } from "@/components/forms/SearchBar";
import { PlayerCard } from "@/components/players/PlayerCard";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { CardSkeletonGrid } from "@/components/ui/Skeleton";
import { PLAYER_STATUSES } from "@/constants/football.constants";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import type { PlayerFormValues } from "@/schemas/player.schema";
import { createPlayer, deletePlayer, getPlayers, updatePlayer } from "@/services/playerService";
import type { Asset } from "@/types/api.types";
import type { PlayerStatus, PublicPlayer } from "@/types/player.types";
import { errorMessage } from "@/utils/errorHandler";

export function PlayersPage() {
  const isAdmin = true;
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PlayerStatus | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<PublicPlayer | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(search);
  const players = useServiceQuery(() => getPlayers({
    page, limit: 12, search: debounced, status: isAdmin ? status : "",
  }), [page, debounced, status, isAdmin]);

  const save = async (values: PlayerFormValues, photo: Asset | null) => {
    setSaving(true);
    try {
      const payload = { ...values, profilePic: photo };
      if (editing) await updatePlayer(editing._id, payload);
      else await createPlayer(payload);
      toast.success(editing ? "Player updated" : "Player created");
      setEditing(undefined);
      players.reload();
    } catch (error) { toast.error(errorMessage(error)); throw error; }
    finally { setSaving(false); }
  };

  const remove = async (player: PublicPlayer) => {
    const yes = await confirm({
      title: `Delete ${player.name}?`,
      description: "A player with auction, match, or award history cannot be hard-deleted. Deactivate the player to preserve their history.",
      confirmLabel: "Delete player", danger: true,
    });
    if (!yes) return;
    try { await deletePlayer(player._id); toast.success("Player deleted"); players.reload(); }
    catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <PageContainer>
      <AdminPageBanner breadcrumb="Admin / Player directory" title="Players" description="Manage permanent player profiles, player status and contact information." actions={<Button onClick={() => setEditing(null)}>Add player</Button>} />
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search by player name or mobile number" />
        {isAdmin ? <Select value={status} onChange={(event) => { setStatus(event.target.value as PlayerStatus | ""); setPage(1); }} aria-label="Player status">
          <option value="">Any status</option>
          {PLAYER_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select> : null}
        <Button variant="ghost" onClick={() => { setSearch(""); setStatus(""); setPage(1); }}>Clear filters</Button>
      </div>
      {players.loading ? <CardSkeletonGrid /> : null}
      {players.error ? <ErrorState message={players.error} onRetry={players.reload} /> : null}
      {players.data && players.data.data.length === 0 ? <EmptyState title="No players found" description="Try another player name or mobile number, or add a player if you are the admin." /> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.data?.data.map((player) => <div key={player._id} className="grid gap-2">
          <PlayerCard player={player} />
          {isAdmin ? <div className="flex gap-2">
            <Link to="/admin/players/$playerId" params={{ playerId: player._id }}><Button size="sm" variant="surface">View</Button></Link>
            <Button size="sm" variant="surface" onClick={() => setEditing(player)}>Edit</Button>
            <Button size="sm" variant="danger" onClick={() => void remove(player)}>Delete</Button>
          </div> : null}
        </div>)}
      </div>
      <Pagination pagination={players.data?.pagination} onPage={setPage} />
      <Drawer open={editing !== undefined} title={editing ? "Edit player" : "Add player"} onClose={() => setEditing(undefined)}>
        <PlayerForm player={editing} submitting={saving} onSubmit={save} />
      </Drawer>
    </PageContainer>
  );
}

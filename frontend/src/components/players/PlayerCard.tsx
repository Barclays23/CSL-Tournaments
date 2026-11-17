import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import type { PublicPlayer } from "@/types/player.types";

export function PlayerCard({ player }: { player: PublicPlayer }) {
  return (
    <Link to="/players/$playerId" params={{ playerId: player._id }} className="block">
      <GlassCard className="h-full p-3 transition duration-200 hover:-translate-y-0.5 hover:border-accent">
        <div className="flex items-center gap-3">
          <Avatar name={player.name} asset={player.profilePic} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-fg">{player.name}</p>
            <p className="text-xs text-muted">Player profile</p>
          </div>
          <Badge tone={player.status === "active" ? "success" : "neutral"}>{player.status}</Badge>
        </div>
      </GlassCard>
    </Link>
  );
}

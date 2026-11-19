import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { GlassCard } from "@/components/ui/GlassCard";
import type { PublicManager } from "@/types/manager.types";

export function ManagerCard({ manager }: { manager: PublicManager }) {
  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <Avatar name={manager.name} asset={manager.profilePic} className="h-14 w-14" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-fg">{manager.name}</p>
        <p className="truncate text-sm text-muted">Tournament manager</p>
        {manager.role ? <Badge className="mt-2">{manager.role}</Badge> : null}
      </div>
    </GlassCard>
  );
}

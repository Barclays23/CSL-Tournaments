import type { ReactNode } from "react";
import { Star, ShieldCheck, Shirt, Tag, Users } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { Asset } from "@/types/api.types";

interface AuctionLotPreviewProps {
  playerName: string;
  playerImage: Asset | null;
  status: string;
  lotNumber?: number | null;
  positionLabel: string;
  teamName: string | null;
  teamLogo: Asset | null;
  jerseyNo: string | number | null;
  iconPlayer: boolean;
  goalkeeper: boolean;
  price: string | number | null;
  pricePlaceholder?: string;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line/80 bg-surface/45 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 min-w-0 text-xs font-semibold text-fg">{children}</div>
    </div>
  );
}

function formatPrice(price: string | number | null, fallback: string): string {
  if (price === null || String(price).trim() === "") return fallback;
  const value = Number(price);
  return Number.isFinite(value) ? "₹" + value.toLocaleString("en-IN") : String(price);
}

export function AuctionLotPreview({
  playerName,
  playerImage,
  status,
  lotNumber,
  positionLabel,
  teamName,
  teamLogo,
  jerseyNo,
  iconPlayer,
  goalkeeper,
  price,
  pricePlaceholder = "—",
}: AuctionLotPreviewProps) {
  const statusTone = status.toLowerCase() === "sold"
    ? "bg-success/10 text-success"
    : status.toLowerCase() === "pending"
      ? "bg-warning/10 text-warning"
      : "bg-primary/10 text-accent";

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-accent/20 bg-linear-to-r from-primary/10 via-glass to-accent/10 p-3 sm:p-4"
      aria-label="Auction lot summary preview"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar
          name={playerName}
          asset={playerImage}
          className="h-14 w-14 shrink-0 rounded-2xl border border-line shadow-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-fg">{playerName}</p>
            {iconPlayer ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
                <Star className="h-3 w-3 fill-current" />
                Icon player
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={"rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize " + statusTone}>{status}</span>
            {lotNumber !== undefined && lotNumber !== null ? (
              <span className="text-[10px] text-muted">Lot #{lotNumber}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Detail label="Position">
          <span className="block truncate">{positionLabel || "Not selected"}</span>
        </Detail>

        <Detail label="Season team">
          {teamName ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <Avatar name={teamName} asset={teamLogo} className="h-6 w-6 shrink-0 rounded-md border border-line" />
              <span className="truncate">{teamName}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted">
              <Users className="h-3.5 w-3.5 shrink-0" />
              Not assigned
            </span>
          )}
        </Detail>

        <Detail label="Jersey number">
          <span className="flex items-center gap-1.5">
            <Shirt className="h-3.5 w-3.5 shrink-0 text-muted" />
            {jerseyNo !== null && String(jerseyNo).trim() !== "" ? "#" + jerseyNo : "—"}
          </span>
        </Detail>

        <Detail label="Auction price">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 shrink-0 text-muted" />
            {formatPrice(price, pricePlaceholder)}
          </span>
        </Detail>
      </div>

      {goalkeeper ? (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-info/25 bg-info/10 px-2.5 py-1 text-[10px] font-semibold text-info">
          <ShieldCheck className="h-3 w-3" />
          Goalkeeper
        </div>
      ) : null}
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AuctionsPage } from "@/pages/AuctionsPage";

export const Route = createFileRoute("/admin/auctions")({
  component: AuctionsPage,
});

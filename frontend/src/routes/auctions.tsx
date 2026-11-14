import {createFileRoute} from "@tanstack/react-router";
import {AuctionsPage} from "@/pages/AuctionsPage";
export const Route=createFileRoute("/auctions")({component:AuctionsPage});

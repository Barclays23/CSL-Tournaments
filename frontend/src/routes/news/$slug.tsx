import { createFileRoute } from "@tanstack/react-router";
import { NewsDetailsPage } from "@/pages/news/NewsDetailsPage";
export const Route = createFileRoute("/news/$slug")({
  component: function NewsArticleRoute() {
    const { slug } = Route.useParams();
    return <NewsDetailsPage slug={slug} />;
  },
});

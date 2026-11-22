import { Link } from "@tanstack/react-router";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { NewsArticle } from "@/types/news.types";

export function NewsArticleCard({ article }: { article: NewsArticle }) {
  return (
    <Link to="/news/$slug" params={{ slug: article.slug }} className="group block h-full">
      <GlassCard className="h-full overflow-hidden transition duration-200 group-hover:border-accent">
        {article.coverImage ? <img src={article.coverImage.url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" /> : <div className="pitch-stripes aspect-[16/9] w-full" />}
        <div className="p-4">
          <p className="flex items-center gap-2 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" />{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Not published"}</p>
          <h3 className="mt-3 line-clamp-2 font-display text-2xl leading-tight text-fg group-hover:text-accent">{article.title}</h3>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{article.excerpt}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">Read article <ArrowUpRight className="h-4 w-4" /></span>
        </div>
      </GlassCard>
    </Link>
  );
}

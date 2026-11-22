import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getNewsBySlug } from "@/services/newsService";
import { useAuth } from "@/contexts/AuthContext";

export function NewsDetailsPage({ slug }: { slug: string }) {
  const { isAdmin } = useAuth();
  const article = useServiceQuery(() => getNewsBySlug(slug), [slug, isAdmin]);
  const item = article.data?.data;
  if (article.loading) return <PageContainer><Skeleton className="h-[28rem]" /></PageContainer>;
  if (article.error || !item) return <PageContainer><ErrorState message={article.error ?? "News article not found"} onRetry={article.reload} /><Link to="/news"><Button variant="surface" className="mt-4"><ArrowLeft className="h-4 w-4" />Back to news</Button></Link></PageContainer>;
  return <PageContainer className="max-w-4xl">
    <Link to="/news" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-accent"><ArrowLeft className="h-4 w-4" />All news</Link>
    {item.coverImage ? <img src={item.coverImage.url} alt="" className="mb-7 aspect-[16/9] w-full rounded-card border border-line object-cover" /> : null}
    <div className="flex flex-wrap items-center gap-2">{item.status !== "published" ? <Badge tone="gold">{item.status}</Badge> : null}{item.tags.map((tag)=><Badge key={tag}>{tag}</Badge>)}</div>
    <h1 className="mt-4 font-display text-4xl leading-tight text-fg sm:text-6xl">{item.title}</h1>
    <p className="mt-4 text-lg leading-8 text-muted">{item.excerpt}</p>
    <p className="mt-5 flex items-center gap-2 border-b border-line pb-6 text-sm text-muted"><CalendarDays className="h-4 w-4" />{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" }) : "Unpublished"}</p>
    <article className="prose-csl mt-8 whitespace-pre-wrap text-base leading-8 text-fg">{item.content}</article>
  </PageContainer>;
}

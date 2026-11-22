import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { NewsArticleCard } from "@/components/news/NewsArticleCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { getNews } from "@/services/newsService";
import { useAuth } from "@/contexts/AuthContext";

export function NewsPage() {
  const [page, setPage] = useState(1);
  const { isAdmin } = useAuth();
  const news = useServiceQuery(() => getNews({ page, limit: 9, status: "published" }), [page]);
  const articles = news.data?.data ?? [];
  return <PageContainer>
    <PageHeader eyebrow="CSL updates" title="News" description="Announcements, tournament updates and stories from the CSL Cherukunnu football community." />
    {isAdmin ? <div className="mb-5 flex justify-end"><Link to="/admin/news"><Button variant="surface">Manage news</Button></Link></div> : null}
    {news.loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-80" />)}</div> : null}
    {news.error ? <ErrorState message={news.error} onRetry={news.reload} /> : null}
    {news.data && !articles.length ? <EmptyState title="No news published yet" description="Tournament announcements and updates will appear here." /> : null}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{articles.map((article)=><NewsArticleCard key={article._id} article={article} />)}</div>
    <Pagination pagination={news.data?.pagination} onPage={setPage} />
  </PageContainer>;
}

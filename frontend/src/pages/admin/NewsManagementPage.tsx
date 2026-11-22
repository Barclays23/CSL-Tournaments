import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { NewsForm } from "@/components/forms/NewsForm";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { SearchBar } from "@/components/forms/SearchBar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useServiceQuery } from "@/hooks/useServiceQuery";
import { createNews, deleteNews, getNews, updateNews } from "@/services/newsService";
import type { Asset } from "@/types/api.types";
import type { NewsArticle, NewsStatus, NewsWrite } from "@/types/news.types";
import type { NewsFormValues } from "@/schemas/news.schema";
import { errorMessage } from "@/utils/errorHandler";

const statusTone: Record<NewsStatus, "neutral" | "accent" | "gold"> = { draft: "neutral", published: "accent", archived: "gold" };

export function NewsManagementPage() {
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<NewsStatus | "">("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<NewsArticle | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const debounced = useDebounce(search);
  const news = useServiceQuery(() => getNews({ page, limit: 12, search: debounced, ...(status ? { status } : {}) }), [page, debounced, status]);
  const records = news.data?.data ?? [];

  const save = async (values: NewsWrite, coverImage: Asset | null) => {
    setSaving(true);
    try {
      const payload = { ...values, coverImage };
      if (editing) await updateNews(editing._id, payload);
      else await createNews(payload);
      toast.success(editing ? "News article updated" : "News article created");
      setEditing(undefined); news.reload();
    } catch (error) { toast.error(errorMessage(error)); throw error; }
    finally { setSaving(false); }
  };

  const archive = async (article: NewsArticle) => {
    const yes = await confirm({ title: `Archive “${article.title}”?`, description: "Archived articles are hidden from the public news pages. You can still edit or delete them here.", confirmLabel: "Archive article", danger: true });
    if (!yes) return;
    try { await updateNews(article._id, { status: "archived" }); toast.success("Article archived"); news.reload(); }
    catch (error) { toast.error(errorMessage(error)); }
  };

  const remove = async (article: NewsArticle) => {
    const yes = await confirm({ title: `Delete “${article.title}” permanently?`, description: "This action cannot be undone. Archive the article if you may need it later.", confirmLabel: "Delete permanently", danger: true });
    if (!yes) return;
    try { await deleteNews(article._id); toast.success("Article deleted"); news.reload(); }
    catch (error) { toast.error(errorMessage(error)); }
  };

  return <section>
    <AdminPageBanner breadcrumb="Admin / Content management" title="News" description="Create announcements and publish updates for the CSL community." actions={<Button onClick={() => setEditing(null)}>Create article</Button>} />
    <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
      <SearchBar value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search article titles" />
      <Select value={status} onChange={(event) => { setStatus(event.target.value as NewsStatus | ""); setPage(1); }} aria-label="Filter news status">
        <option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
      </Select>
    </div>
    {news.loading ? <div className="grid gap-3 md:grid-cols-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-52" />)}</div> : null}
    {news.error ? <ErrorState message={news.error} onRetry={news.reload} /> : null}
    {news.data && !records.length ? <EmptyState title="No news articles found" description="Create a draft or publish your first tournament update." /> : null}
    <div className="grid gap-3 md:grid-cols-2">
      {records.map((article) => <GlassCard key={article._id} className="overflow-hidden p-4">
        <div className="flex gap-3">
          {article.coverImage ? <img src={article.coverImage.url} alt="" className="h-24 w-28 shrink-0 rounded-xl object-cover" /> : <div className="pitch-stripes h-24 w-28 shrink-0 rounded-xl" />}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone[article.status]}>{article.status}</Badge><span className="text-xs text-muted">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString("en-IN") : "Not published"}</span></div>
            <h2 className="mt-2 line-clamp-2 font-display text-xl text-fg">{article.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{article.excerpt}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
          <Link to="/news/$slug" params={{ slug: article.slug }}><Button size="sm" variant="surface">View</Button></Link>
          <Button size="sm" variant="surface" onClick={() => setEditing(article)}>Edit</Button>
          {article.status !== "archived" ? <Button size="sm" variant="surface" onClick={() => void archive(article)}>Archive</Button> : null}
          <Button size="sm" variant="danger" onClick={() => void remove(article)}>Delete</Button>
        </div>
      </GlassCard>)}
    </div>
    <Pagination pagination={news.data?.pagination} onPage={setPage} />
    <Drawer open={editing !== undefined} title={editing ? "Edit article" : "Create article"} description="Drafts stay private until you publish them." onClose={() => setEditing(undefined)}>
      <NewsForm key={editing?._id ?? "new-news"} article={editing} submitting={saving} onSubmit={save} />
    </Drawer>
  </section>;
}

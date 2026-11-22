import { useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { newsFormSchema, type NewsFormValues } from "@/schemas/news.schema";
import type { Asset } from "@/types/api.types";
import type { NewsArticle, NewsWrite } from "@/types/news.types";

export function NewsForm({ article, submitting, onSubmit }: {
  article?: NewsArticle | null; submitting: boolean; onSubmit: (values: NewsWrite, coverImage: Asset | null) => Promise<void>;
}) {
  const [coverImage, setCoverImage] = useState<Asset | null>(article?.coverImage ?? null);
  const form = useForm<NewsFormValues>({
    resolver: zodResolver(newsFormSchema) as Resolver<NewsFormValues>,
    defaultValues: {
      title: article?.title ?? "", slug: article?.slug ?? "", excerpt: article?.excerpt ?? "",
      content: article?.content ?? "", tags: article?.tags.join(", ") ?? "", status: article?.status ?? "draft",
      publishedAt: article?.publishedAt ? new Date(new Date(article.publishedAt).getTime() - new Date(article.publishedAt).getTimezoneOffset() * 60000).toISOString().slice(0,16) : "",
    },
  });
  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(async (values) => {
      await onSubmit({
        title: values.title, slug: values.slug.trim() || undefined, excerpt: values.excerpt,
        content: values.content, tags: values.tags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean),
        status: values.status,
        publishedAt: values.publishedAt ? new Date(values.publishedAt).toISOString() : null,
      }, coverImage);
    })}>
      <FormField label="Title" required error={form.formState.errors.title?.message}><Input {...form.register("title")} placeholder="Article headline" /></FormField>
      <FormField label="URL slug" hint="Leave empty to generate it from the title." error={form.formState.errors.slug?.message}><Input {...form.register("slug")} placeholder="article-url-slug" /></FormField>
      <FormField label="Summary / excerpt" required error={form.formState.errors.excerpt?.message}><Textarea rows={3} {...form.register("excerpt")} placeholder="A short summary for article cards." /></FormField>
      <FormField label="Article content" required error={form.formState.errors.content?.message}><Textarea rows={12} {...form.register("content")} placeholder="Write the full article here. Separate paragraphs with a blank line." /></FormField>
      <FormField label="Tags" hint="Separate tags with commas."><Input {...form.register("tags")} placeholder="Tournament, Teams, Updates" /></FormField>
      <div className="grid gap-3 sm:grid-cols-2"><FormField label="Publication status"><Select {...form.register("status")}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></Select></FormField><FormField label="Publication date" hint="Leave empty to use the current date when publishing."><Input type="datetime-local" {...form.register("publishedAt")} /></FormField></div>
      <ImageUploader label="Cover image" purpose="news-cover" value={coverImage} onChange={setCoverImage} />
      <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : article ? "Save changes" : "Create article"}</Button>
    </form>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { AdminPageBanner } from "@/components/admin/AdminPageBanner";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";

function AdminNewsPage() {
  return (
    <PageContainer>
      <AdminPageBanner
        breadcrumb="Admin / Content management"
        title="News"
        description="Manage tournament announcements and news updates."
      />
      <EmptyState
        title="News management is not configured yet"
        description="This route is ready for the news module when its service and content workflow are introduced."
      />
    </PageContainer>
  );
}

export const Route = createFileRoute("/admin/news")({
  component: AdminNewsPage,
});

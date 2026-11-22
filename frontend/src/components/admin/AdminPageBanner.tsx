import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";

export interface AdminPageBannerProps {
  title: string;
  description?: string;
  breadcrumb?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function AdminPageBanner({
  title,
  description,
  breadcrumb,
  eyebrow,
  actions,
}: AdminPageBannerProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      eyebrow={breadcrumb ?? eyebrow}
      actions={actions}
    />
  );
}

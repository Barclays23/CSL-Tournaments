import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
  loading = false,
  loadingLabel = "Loading...",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && !loading) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-busy={loading}
          onEscapeKeyDown={(event) => { if (loading) event.preventDefault(); }}
          onInteractOutside={(event) => { if (loading) event.preventDefault(); }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-hidden border-l border-line bg-glass-strong p-5 shadow-glass"
        >
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-3xl leading-none text-fg">{title}</Dialog.Title>
              {description ? <Dialog.Description className="mt-2 text-sm text-muted">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <IconButton aria-label="Close" disabled={loading}>
                <X className="h-4 w-4" />
              </IconButton>
            </Dialog.Close>
          </div>
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{children}</div>
          {loading ? <LoadingSpinner label={loadingLabel} size="lg" mode="cover" /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

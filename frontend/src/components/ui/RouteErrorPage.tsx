import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageContainer } from "@/components/layout/PageContainer";

type RouteErrorPageProps = {
  error: Error;
  reset: () => void;
};

export function RouteErrorPage({ error, reset }: RouteErrorPageProps) {
  const isDevelopment = import.meta.env.DEV;
  const message = error instanceof Error ? error.message : "Unknown application error";

  return (
    <PageContainer>
      <GlassCard className="mx-auto max-w-2xl px-6 py-12 text-center sm:px-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-danger/20 bg-danger/10 text-danger">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-danger">
          {isDevelopment ? "Development error" : "Unexpected error"}
        </p>
        <h1 className="mt-2 font-display text-3xl text-fg sm:text-4xl">
          {isDevelopment ? "This page could not be displayed" : "Something went wrong"}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
          {isDevelopment
            ? "A runtime error interrupted this page. Review the technical details below, fix the issue, and try again."
            : "We couldn't load this page. Please try again, or return to the home page. The issue has been safely hidden from this view."}
        </p>

        {isDevelopment ? (
          <div className="mt-6 rounded-xl border border-danger/20 bg-danger/5 p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-danger">Error details</p>
            <p className="mt-2 break-words font-mono text-sm text-fg">{message}</p>
            {error.stack ? (
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-danger/15 pt-3 font-mono text-xs leading-5 text-muted">{error.stack}</pre>
            ) : null}
          </div>
        ) : null}

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link to="/">
            <Button variant="surface">Back to home</Button>
          </Link>
        </div>
      </GlassCard>
    </PageContainer>
  );
}

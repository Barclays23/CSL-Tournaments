export function LoadingSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex min-h-20 w-full items-center justify-center gap-3 text-sm text-muted" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

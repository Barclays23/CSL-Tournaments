import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "@/utils/errorHandler";

interface ServiceQueryOptions {
  refreshIntervalMs?: number;
  keepPreviousDataOnRefresh?: boolean;
}

export function useServiceQuery<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  options: ServiceQueryOptions = {},
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (options.keepPreviousDataOnRefresh) setData(null);
    // Clear old query data when the caller's query dependencies change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, options.keepPreviousDataOnRefresh]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (!options.keepPreviousDataOnRefresh) setData(null);
    loader()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Loader identity is controlled by the caller through deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!options.refreshIntervalMs || options.refreshIntervalMs <= 0) return;
    const intervalId = window.setInterval(reload, options.refreshIntervalMs);
    return () => window.clearInterval(intervalId);
  }, [options.refreshIntervalMs, reload]);

  return { data, error, loading, reload, setData };
}

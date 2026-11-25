"use client";

import { useCallback, useRef, useState } from "react";
import { ApiResponse } from "../lib/api";

export interface AsyncResourceState<T> {
  data: T | null;
  loading: boolean;
  status: number | null;
  ok: boolean;
  error: string | null;
  run: <R = T>(
    fetcher: () => Promise<ApiResponse<R>>,
    extractData: (body: R) => T,
    formatError?: (status: number, body: R) => string
  ) => Promise<ApiResponse<R> | null>;
  reset: (nextStatus?: number | null) => void;
}

export function useAsyncResource<T>(initialStatus: number | null = null): AsyncResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<number | null>(initialStatus);
  const [ok, setOk] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reset = useCallback((nextStatus: number | null = null) => {
    requestIdRef.current += 1;
    setData(null);
    setLoading(false);
    setStatus(nextStatus);
    setOk(false);
    setError(null);
  }, []);

  const run = useCallback(
    async <R = T>(
      fetcher: () => Promise<ApiResponse<R>>,
      extractData: (body: R) => T,
      formatError?: (status: number, body: R) => string
    ): Promise<ApiResponse<R> | null> => {
      const requestId = ++requestIdRef.current;
      await Promise.resolve();
      if (requestId !== requestIdRef.current) return null;

      setLoading(true);
      try {
        const res = await fetcher();
        if (requestId !== requestIdRef.current) return null;

        setStatus(res.status);
        setOk(res.ok);
        if (res.ok) {
          setData(extractData(res.data));
          setError(null);
        } else {
          setData(null);
          setError(
            formatError
              ? formatError(res.status, res.data)
              : `Request failed with HTTP ${res.status}`
          );
        }
        return res;
      } catch {
        if (requestId !== requestIdRef.current) return null;
        setStatus(500);
        setOk(false);
        setData(null);
        setError("Network error while contacting backend API.");
        return null;
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  return {
    data,
    loading,
    status,
    ok,
    error,
    run,
    reset,
  };
}

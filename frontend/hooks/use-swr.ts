"use client";

import useSWR, { SWRConfiguration } from "swr";
import { apiJson } from "../lib/api";

export function useApi<T = unknown>(path: string, options?: SWRConfiguration) {
  return useSWR<T>(path, () => apiJson<T>(path), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    refreshInterval: 0,
    ...options,
  });
}

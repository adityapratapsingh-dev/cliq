"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

/**
 * Global SWR configuration.
 *
 * `keepPreviousData` means a feed renders its cached posts immediately on
 * navigation instead of flashing a spinner, then revalidates in the background.
 * Failed requests are not retried aggressively so the UI never stalls.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        keepPreviousData: true,
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        errorRetryCount: 2,
        dedupingInterval: 2000,
      }}
    >
      {children}
    </SWRConfig>
  );
}

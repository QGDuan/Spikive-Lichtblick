// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useEffect } from "react";
import { create } from "zustand";

const DEFAULT_TICK_MS = 1000; // Reduced from 200ms to 1s

type NowStore = {
  now: number;
};

const useNowStore = create<NowStore>(() => ({
  now: Date.now(),
}));

// Single global interval that updates the store
let globalIntervalId: ReturnType<typeof setInterval> | undefined;
let subscriberCount = 0;

function startGlobalTicker(tickMs: number): void {
  if (globalIntervalId != null) {
    return;
  }
  globalIntervalId = setInterval(() => {
    useNowStore.setState({ now: Date.now() });
  }, tickMs);
}

function stopGlobalTicker(): void {
  if (globalIntervalId != null) {
    clearInterval(globalIntervalId);
    globalIntervalId = undefined;
  }
}

/**
 * Returns Date.now() that re-renders the caller every {@link tickMs}.
 *
 * Optimized: uses a single global interval shared across all components,
 * reducing from N×5 renders/sec to 1 render/sec for all N components.
 *
 * Used by RobotCard to make stale-detection (manager offline at 4s)
 * responsive without depending on the underlying status topic actually firing.
 */
export function useNowMs(tickMs: number = DEFAULT_TICK_MS): number {
  const now = useNowStore((state) => state.now);

  useEffect(() => {
    subscriberCount++;
    if (subscriberCount === 1) {
      startGlobalTicker(tickMs);
    }
    return () => {
      subscriberCount--;
      if (subscriberCount === 0) {
        stopGlobalTicker();
      }
    };
  }, [tickMs]);

  return now;
}

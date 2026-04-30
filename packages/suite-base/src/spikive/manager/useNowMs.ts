// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useSyncExternalStore } from "react";

let currentNowMs = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer == undefined) {
    timer = setInterval(() => {
      currentNowMs = Date.now();
      for (const cb of listeners) {
        cb();
      }
    }, 1000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer != undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number {
  return currentNowMs;
}

export function useNowMs(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}


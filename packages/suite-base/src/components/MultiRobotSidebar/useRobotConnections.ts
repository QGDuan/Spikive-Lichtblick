// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import { MultiRobotStore } from "./types";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function generateId(): string {
  return `robot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useRobotConnectionsStore = create<MultiRobotStore>((set, get) => ({
  robots: [],

  hasDuplicate: (url: string): boolean => {
    const normalized = normalizeUrl(url);
    return get().robots.some((r) => normalizeUrl(r.url) === normalized);
  },

  addRobot: (url: string): { success: boolean; error?: string } => {
    const trimmedUrl = url.trim();
    const normalized = normalizeUrl(trimmedUrl);
    if (get().robots.some((r) => normalizeUrl(r.url) === normalized)) {
      return { success: false, error: "This rosbridge address already exists" };
    }

    const id = generateId();
    const isFirst = get().robots.length === 0;
    set((state) => ({
      robots: [
        ...state.robots,
        {
          id,
          url: trimmedUrl,
          status: "connected",
          isActive: isFirst,
          isVisible: true,
        },
      ],
    }));

    return { success: true };
  },

  removeRobot: (id: string) => {
    set((state) => ({
      robots: state.robots.filter((r) => r.id !== id),
    }));
  },

  setActive: (id: string) => {
    set((state) => ({
      robots: state.robots.map((r) => ({ ...r, isActive: r.id === id })),
    }));
  },

  toggleVisibility: (id: string) => {
    set((state) => ({
      robots: state.robots.map((r) => (r.id === id ? { ...r, isVisible: !r.isVisible } : r)),
    }));
  },
}));

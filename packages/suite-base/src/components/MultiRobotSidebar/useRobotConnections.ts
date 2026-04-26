// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import { ConnectionStatus, MultiRobotStore } from "./types";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function generateId(): string {
  return `robot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useRobotConnectionsStore = create<MultiRobotStore>((set, get) => ({
  robots: [],

  addRobot: (url: string, droneId: string): { success: boolean; error?: string } => {
    const trimmedUrl = url.trim();
    const trimmedDroneId = droneId.trim();
    const normalized = normalizeUrl(trimmedUrl);

    if (get().robots.some((r) => normalizeUrl(r.url) === normalized)) {
      return { success: false, error: "This Foxglove Bridge address already exists" };
    }
    if (get().robots.some((r) => r.droneId === trimmedDroneId)) {
      return { success: false, error: `Drone ID ${trimmedDroneId} already exists` };
    }

    const id = generateId();
    const isFirst = get().robots.length === 0;
    set((state) => ({
      robots: [
        ...state.robots,
        {
          id,
          droneId: trimmedDroneId,
          url: trimmedUrl,
          status: "connected" as const,
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
    set((state) => {
      const currentActive = state.robots.find((r) => r.isActive);
      // Skip if already active
      if (currentActive?.id === id) {
        return state;
      }
      return {
        robots: state.robots.map((r) => ({ ...r, isActive: r.id === id })),
      };
    });
  },

  toggleVisibility: (id: string) => {
    set((state) => ({
      robots: state.robots.map((r) => (r.id === id ? { ...r, isVisible: !r.isVisible } : r)),
    }));
  },

  updateStatus: (id: string, status: ConnectionStatus, latencyMs?: number) => {
    set((state) => {
      const robot = state.robots.find((r) => r.id === id);
      // Skip update if status and latency haven't changed
      if (robot && robot.status === status && robot.latencyMs === latencyMs) {
        return state;
      }
      return {
        robots: state.robots.map((r) =>
          r.id === id ? { ...r, status, latencyMs } : r,
        ),
      };
    });
  },
}));

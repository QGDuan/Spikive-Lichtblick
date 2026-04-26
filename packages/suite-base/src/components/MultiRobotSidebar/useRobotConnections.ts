// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import type { ConnectionStatus, MultiRobotStore } from "./types";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

function generateConnectionId(): string {
  return `robot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useRobotConnectionsStore = create<MultiRobotStore>((set, get) => ({
  robots: [],
  activeDroneId: undefined,
  visualDroneId: undefined,
  visualConnectionId: undefined,
  visualRouteVersion: 0,

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

    const connectionId = generateConnectionId();
    set((state) => ({
      robots: [
        ...state.robots,
        {
          connectionId,
          droneId: trimmedDroneId,
          url: trimmedUrl,
          status: "connected" as const,
        },
      ],
      // Spikive: visualization is always enabled in the current single-drone
      // workflow. Keep this separate from active/select so 3D routing has a
      // target without making the card/control panel selected.
      visualDroneId: state.visualDroneId ?? trimmedDroneId,
      visualConnectionId: state.visualConnectionId ?? connectionId,
      visualRouteVersion:
        state.visualDroneId == undefined ? state.visualRouteVersion + 1 : state.visualRouteVersion,
    }));

    return { success: true };
  },

  removeRobot: (connectionId: string) => {
    set((state) => {
      const removed = state.robots.find((r) => r.connectionId === connectionId);
      if (removed == undefined) {
        return state;
      }

      const robots = state.robots.filter((r) => r.connectionId !== connectionId);
      const removedVisual = removed.droneId === state.visualDroneId;
      const removedActive = removed.droneId === state.activeDroneId;
      const nextVisual = removedVisual ? robots[0] : undefined;
      const visualPatch = removedVisual
        ? {
            visualDroneId: nextVisual?.droneId,
            visualConnectionId: nextVisual?.connectionId,
            visualRouteVersion: state.visualRouteVersion + 1,
          }
        : {};
      const activePatch = removedActive
        ? {
            activeDroneId: undefined,
          }
        : {};

      return {
        robots,
        ...activePatch,
        ...visualPatch,
      };
    });
  },

  setActiveDroneId: (droneId: string) => {
    set((state) => {
      if (state.activeDroneId === droneId) {
        return state;
      }

      return { activeDroneId: droneId };
    });
  },

  updateStatus: (connectionId: string, status: ConnectionStatus, latencyMs?: number) => {
    set((state) => {
      const robot = state.robots.find((r) => r.connectionId === connectionId);
      if (robot?.status === status && robot.latencyMs === latencyMs) {
        return state;
      }
      return {
        robots: state.robots.map((r) =>
          r.connectionId === connectionId ? { ...r, status, latencyMs } : r,
        ),
      };
    });
  },
}));

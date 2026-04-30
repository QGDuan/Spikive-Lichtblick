// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import { extractManagerCommandRequestId } from "./datatypes";
import type { AutoManagerMessage, ManagerModuleStatus, ManagerStatusSnapshot } from "./types";

function normalizeModuleStatus(value: unknown): ManagerModuleStatus {
  return value === 1 || value === 2 ? value : 0;
}

function snapshotEqual(a: ManagerStatusSnapshot | undefined, b: ManagerStatusSnapshot): boolean {
  return (
    a != undefined &&
    a.droneId === b.droneId &&
    a.mode === b.mode &&
    a.isActive === b.isActive &&
    a.starting === b.starting &&
    a.stopping === b.stopping &&
    a.armed === b.armed &&
    a.lastError === b.lastError &&
    a.lastErrorSeq === b.lastErrorSeq &&
    a.mavrosStatus === b.mavrosStatus &&
    a.lidarStatus === b.lidarStatus &&
    a.slamStatus === b.slamStatus &&
    a.plannerStatus === b.plannerStatus &&
    a.lastCommandType === b.lastCommandType &&
    a.lastCommandRequestId === b.lastCommandRequestId
  );
}

type ManagerStatusStore = {
  snapshots: Record<string, ManagerStatusSnapshot | undefined>;
  setSnapshotFromMessage: (droneId: string, message: AutoManagerMessage, nowMs?: number) => boolean;
  clearSnapshot: (droneId: string) => void;
};

export const useManagerStatusStore = create<ManagerStatusStore>((set) => ({
  snapshots: {},

  setSnapshotFromMessage: (droneId, message, nowMs = Date.now()) => {
    const messageDroneId = String(message.drone_id ?? "").trim();
    if (messageDroneId !== droneId) {
      return false;
    }

    const mode = message.mode ?? "idle";
    const snapshot: ManagerStatusSnapshot = {
      droneId,
      mode,
      isActive: message.is_active === true,
      starting: message.starting === true,
      stopping: message.stopping === true || mode === "stopping",
      armed: message.armed === true,
      lastError: message.last_error ?? "",
      lastErrorSeq: Number(message.last_error_seq ?? 0),
      mavrosStatus: normalizeModuleStatus(message.mavros_status),
      lidarStatus: normalizeModuleStatus(message.lidar_driver_status),
      slamStatus: normalizeModuleStatus(message.slam_status),
      plannerStatus: normalizeModuleStatus(message.planner_status),
      lastCommandType: message.command?.command_type ?? "",
      lastCommandRequestId: extractManagerCommandRequestId(message.command?.extra_data),
      lastUpdateMs: nowMs,
    };

    set((state) => {
      const prev = state.snapshots[droneId];
      if (snapshotEqual(prev, snapshot)) {
        return {
          snapshots: {
            ...state.snapshots,
            [droneId]: snapshot,
          },
        };
      }
      return {
        snapshots: {
          ...state.snapshots,
          [droneId]: snapshot,
        },
      };
    });
    return true;
  },

  clearSnapshot: (droneId) => {
    set((state) => {
      if (state.snapshots[droneId] == undefined) {
        return state;
      }
      const next = { ...state.snapshots };
      delete next[droneId];
      return { snapshots: next };
    });
  },
}));

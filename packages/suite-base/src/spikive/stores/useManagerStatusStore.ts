// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

/** 0=未执行 1=不完整（部分节点在跑） 2=完整（全部节点在跑） */
export type SubsystemStatus = 0 | 1 | 2;

export type ManagerSnapshot = {
  isActive: boolean;
  starting: boolean;
  armed: boolean;
  drivers: { mavros: SubsystemStatus; lidar: SubsystemStatus; cam: SubsystemStatus };
  algo: { slam: SubsystemStatus; planner: SubsystemStatus };
  mode: string;
  lastError: string;
  lastErrorSeq: number;
  /** Wall-clock ms when the snapshot was received. */
  lastUpdateMs: number;
};

type ManagerStatusState = {
  byDroneId: Record<string, ManagerSnapshot | undefined>;
  setSnapshot: (droneId: string, snap: ManagerSnapshot) => void;
  clear: (droneId: string) => void;
};

export const useManagerStatusStore = create<ManagerStatusState>((set) => ({
  byDroneId: {},
  setSnapshot: (droneId: string, snap: ManagerSnapshot) => {
    set((state) => {
      const prev = state.byDroneId[droneId];
      // Skip update if snapshot hasn't changed
      if (
        prev &&
        prev.isActive === snap.isActive &&
        prev.starting === snap.starting &&
        prev.armed === snap.armed &&
        prev.drivers.mavros === snap.drivers.mavros &&
        prev.drivers.lidar === snap.drivers.lidar &&
        prev.drivers.cam === snap.drivers.cam &&
        prev.algo.slam === snap.algo.slam &&
        prev.algo.planner === snap.algo.planner &&
        prev.mode === snap.mode &&
        prev.lastError === snap.lastError &&
        prev.lastErrorSeq === snap.lastErrorSeq
      ) {
        return state;
      }
      return { byDroneId: { ...state.byDroneId, [droneId]: snap } };
    });
  },
  clear: (droneId: string) => {
    set((state) => {
      const next = { ...state.byDroneId };
      delete next[droneId];
      return { byDroneId: next };
    });
  },
}));

// ---------------------------------------------------------------------------
// Derived: Start/Stop button state
// ---------------------------------------------------------------------------
export type ButtonState =
  | "no-data"
  | "manager-offline"
  | "disabled-armed"
  | "starting"
  | "start"
  | "stop";

/** Manager publishes at 1Hz. 4s without an update = offline. */
export const STALE_THRESHOLD_MS = 4000;

export function deriveButtonState(
  snap: ManagerSnapshot | undefined,
  nowMs: number,
): ButtonState {
  if (!snap) {
    return "no-data";
  }
  if (nowMs - snap.lastUpdateMs > STALE_THRESHOLD_MS) {
    return "manager-offline";
  }
  if (snap.armed) {
    return "disabled-armed";
  }
  if (snap.starting) {
    return "starting";
  }
  return snap.isActive ? "stop" : "start";
}

// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

export type Waypoint = {
  idx: number;
  x: number;
  y: number;
  z: number;
};

export type OdomPosition = {
  x: number;
  y: number;
  z: number;
};

/** Z-axis adjustment mode: none = raw z, override = fixed value */
export type ZMode = "none" | "override";

/** Waypoint execution state published by the backend. */
export type ExecState = "idle" | "executing";

export type DroneWaypointState = {
  waypoints: Waypoint[];
  zMode: ZMode;
  overrideZValue: number;
};

function defaultDroneState(): DroneWaypointState {
  return {
    waypoints: [],
    zMode: "none",
    overrideZValue: 1.5,
  };
}

/**
 * Apply Z adjustments.
 */
export function applyZ(actualZ: number, state: DroneWaypointState): number {
  switch (state.zMode) {
    case "override":
      return state.overrideZValue;
    default:
      return actualZ;
  }
}

type WaypointStore = {
  tables: Record<string, DroneWaypointState>;
  latestOdom: Record<string, OdomPosition>;
  projectLists: Record<string, string[]>;
  execStates: Record<string, ExecState>;

  getOrCreate: (droneId: string) => DroneWaypointState;
  /** Replace the waypoint list for a drone (driven by backend /waypoint_markers). */
  setWaypointsFromMarkers: (droneId: string, waypoints: Waypoint[]) => void;
  updateZSettings: (
    droneId: string,
    settings: Partial<Pick<DroneWaypointState, "zMode" | "overrideZValue">>,
  ) => void;
  updateOdom: (droneId: string, pos: OdomPosition) => void;
  setProjectList: (droneId: string, list: string[]) => void;
  setExecState: (droneId: string, state: ExecState) => void;
};

export const useWaypointStore = create<WaypointStore>((set, get) => ({
  tables: {},
  latestOdom: {},
  projectLists: {},
  execStates: {},

  getOrCreate: (droneId: string): DroneWaypointState => {
    const existing = get().tables[droneId];
    if (existing) {
      return existing;
    }
    const fresh = defaultDroneState();
    set((s) => ({ tables: { ...s.tables, [droneId]: fresh } }));
    return fresh;
  },

  setWaypointsFromMarkers: (droneId: string, waypoints: Waypoint[]) => {
    set((s) => {
      const state = s.tables[droneId] ?? defaultDroneState();
      return {
        tables: {
          ...s.tables,
          [droneId]: { ...state, waypoints },
        },
      };
    });
  },

  updateZSettings: (
    droneId: string,
    settings: Partial<Pick<DroneWaypointState, "zMode" | "overrideZValue">>,
  ) => {
    set((s) => {
      const state = s.tables[droneId] ?? defaultDroneState();
      return {
        tables: {
          ...s.tables,
          [droneId]: { ...state, ...settings },
        },
      };
    });
  },

  updateOdom: (droneId: string, pos: OdomPosition) => {
    set((s) => ({ latestOdom: { ...s.latestOdom, [droneId]: pos } }));
  },

  setProjectList: (droneId: string, list: string[]) => {
    set((s) => ({ projectLists: { ...s.projectLists, [droneId]: list } }));
  },

  setExecState: (droneId: string, state: ExecState) => {
    set((s) => ({ execStates: { ...s.execStates, [droneId]: state } }));
  },
}));

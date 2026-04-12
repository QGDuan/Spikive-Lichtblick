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

/** Z-axis adjustment mode: none = raw z, override = fixed value, offset = add delta */
export type ZMode = "none" | "override" | "offset";

export type DroneWaypointState = {
  waypoints: Waypoint[];
  zMode: ZMode;
  overrideZValue: number;
  zOffsetValue: number;
};

function defaultDroneState(): DroneWaypointState {
  return {
    waypoints: [],
    zMode: "none",
    overrideZValue: 1.5,
    zOffsetValue: 0.0,
  };
}

/**
 * Apply Z adjustments following waypoint_recorder.py logic.
 */
function applyZ(actualZ: number, state: DroneWaypointState): number {
  switch (state.zMode) {
    case "override":
      return state.overrideZValue;
    case "offset":
      return actualZ + state.zOffsetValue;
    default:
      return actualZ;
  }
}

type WaypointStore = {
  tables: Record<string, DroneWaypointState>;
  latestOdom: Record<string, OdomPosition>;

  getOrCreate: (droneId: string) => DroneWaypointState;
  addWaypoint: (droneId: string, x: number, y: number, z: number) => void;
  removeWaypoint: (droneId: string, idx: number) => void;
  deleteLast: (droneId: string) => void;
  updateZSettings: (
    droneId: string,
    settings: Partial<Pick<DroneWaypointState, "zMode" | "overrideZValue" | "zOffsetValue">>,
  ) => void;
  clearWaypoints: (droneId: string) => void;
  updateOdom: (droneId: string, pos: OdomPosition) => void;
};

export const useWaypointStore = create<WaypointStore>((set, get) => ({
  tables: {},
  latestOdom: {},

  getOrCreate: (droneId: string): DroneWaypointState => {
    const existing = get().tables[droneId];
    if (existing) {
      return existing;
    }
    const fresh = defaultDroneState();
    set((s) => ({ tables: { ...s.tables, [droneId]: fresh } }));
    return fresh;
  },

  addWaypoint: (droneId: string, x: number, y: number, z: number) => {
    set((s) => {
      const state = s.tables[droneId] ?? defaultDroneState();
      const adjustedZ = applyZ(z, state);
      const idx = state.waypoints.length + 1;
      const wp: Waypoint = {
        idx,
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        z: Math.round(adjustedZ * 1000) / 1000,
      };
      return {
        tables: {
          ...s.tables,
          [droneId]: { ...state, waypoints: [...state.waypoints, wp] },
        },
      };
    });
  },

  removeWaypoint: (droneId: string, idx: number) => {
    set((s) => {
      const state = s.tables[droneId];
      if (!state) {
        return s;
      }
      const filtered = state.waypoints
        .filter((wp) => wp.idx !== idx)
        .map((wp, i) => ({ ...wp, idx: i + 1 }));
      return {
        tables: {
          ...s.tables,
          [droneId]: { ...state, waypoints: filtered },
        },
      };
    });
  },

  deleteLast: (droneId: string) => {
    set((s) => {
      const state = s.tables[droneId];
      if (!state || state.waypoints.length === 0) {
        return s;
      }
      return {
        tables: {
          ...s.tables,
          [droneId]: { ...state, waypoints: state.waypoints.slice(0, -1) },
        },
      };
    });
  },

  updateZSettings: (
    droneId: string,
    settings: Partial<Pick<DroneWaypointState, "zMode" | "overrideZValue" | "zOffsetValue">>,
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

  clearWaypoints: (droneId: string) => {
    set((s) => {
      const state = s.tables[droneId];
      if (!state) {
        return s;
      }
      return {
        tables: {
          ...s.tables,
          [droneId]: { ...state, waypoints: [] },
        },
      };
    });
  },

  updateOdom: (droneId: string, pos: OdomPosition) => {
    set((s) => ({ latestOdom: { ...s.latestOdom, [droneId]: pos } }));
  },
}));

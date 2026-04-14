// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

export type BatteryState = {
  voltage: number;
  percentage: number; // 0-100, derived from 6S voltage thresholds
  level: "good" | "warning" | "critical";
};

type DroneTelemetryState = {
  battery: BatteryState | undefined;
  updateBattery: (voltage: number) => void;
};

/**
 * 6S LiPo voltage thresholds:
 *   Full:    25.2V (4.2V/cell)
 *   Nominal: 22.2V (3.7V/cell)
 *   Warning: 21.0V (3.5V/cell)
 *   Critical: 19.8V (3.3V/cell)
 *   Empty:   18.0V (3.0V/cell)
 */
const V_FULL = 25.2;
const V_EMPTY = 18.0;
const V_WARNING = 21.0;
const V_CRITICAL = 19.8;

function voltageToBattery(voltage: number): BatteryState {
  const pct = Math.max(0, Math.min(100, ((voltage - V_EMPTY) / (V_FULL - V_EMPTY)) * 100));

  let level: BatteryState["level"];
  if (voltage <= V_CRITICAL) {
    level = "critical";
  } else if (voltage <= V_WARNING) {
    level = "warning";
  } else {
    level = "good";
  }

  return { voltage, percentage: Math.round(pct), level };
}

export const useDroneTelemetryStore = create<DroneTelemetryState>((set) => ({
  battery: undefined,

  updateBattery: (voltage: number) => {
    set({ battery: voltageToBattery(voltage) });
  },
}));

// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

export type ColorMode = "flat" | "gradient" | "colormap" | "rgb";
export type ColorMap = "turbo" | "rainbow";

export interface VisualizationSettings {
  decayTime: number;
  colorMode: ColorMode;
  colorMap: ColorMap;
  explicitAlpha: number;
  pointSize: number;
}

interface VisualizationState extends VisualizationSettings {
  updateSettings: (patch: Partial<VisualizationSettings>) => void;
}

const VISUALIZATION_SETTING_KEYS: (keyof VisualizationSettings)[] = [
  "decayTime",
  "colorMode",
  "colorMap",
  "explicitAlpha",
  "pointSize",
];

export const useVisualizationStore = create<VisualizationState>()((set) => ({
  // Defaults: "中" performance + colormap rainbow
  decayTime: 45,
  colorMode: "colormap",
  colorMap: "rainbow",
  explicitAlpha: 0.15,
  pointSize: 0.5,

  updateSettings: (patch) => {
    set((state) => {
      const changed = VISUALIZATION_SETTING_KEYS.some((key) => {
        const nextValue = patch[key];
        return nextValue != undefined && state[key] !== nextValue;
      });

      return changed ? patch : state;
    });
  },
}));

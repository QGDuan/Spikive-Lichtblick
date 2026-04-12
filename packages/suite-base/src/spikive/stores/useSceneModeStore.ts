// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

export type SceneMode = "autonomous-flight" | "mapping-waypoint";

type SceneModeState = {
  sceneMode: SceneMode | undefined;
  setSceneMode: (mode: SceneMode) => void;
};

export const useSceneModeStore = create<SceneModeState>((set) => ({
  sceneMode: undefined,
  setSceneMode: (mode) => {
    set({ sceneMode: mode });
  },
}));

// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useRef } from "react";

import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useRobotConnectionsStore } from "@lichtblick/suite-base/components/MultiRobotSidebar/useRobotConnections";
import {
  droneBodyFrame,
  droneTopics,
  DEFAULT_DRONE_ID,
  type DroneTopics,
} from "@lichtblick/suite-base/spikive/config/topicConfig";

const PANEL_ID = "3D!spikive3d";

/** All field keys of DroneTopics – used to iterate over topic pairs. */
const TOPIC_FIELDS: (keyof DroneTopics)[] = [
  "pointCloud",
  "optimalTrajectory",
  "goalPoint",
  "robotModel",
  "path",
];

/**
 * Re-key topic settings from one droneId to another.
 *
 * Takes the existing `topics` record from the 3D panel config,
 * replaces keys belonging to `fromId` with keys for `toId`,
 * and preserves all render settings (color, alpha, etc.).
 * Non-drone keys are kept as-is.
 */
function remapTopics(
  oldTopics: Record<string, unknown>,
  fromId: string,
  toId: string,
): Record<string, unknown> {
  const from = droneTopics(fromId);
  const to = droneTopics(toId);

  // Build a mapping: old topic name → new topic name
  const keyMap = new Map<string, string>();
  for (const field of TOPIC_FIELDS) {
    keyMap.set(from[field], to[field]);
  }

  const result: Record<string, unknown> = {};
  for (const [key, settings] of Object.entries(oldTopics)) {
    const newKey = keyMap.get(key);
    if (newKey != undefined) {
      result[newKey] = settings;
    } else {
      // Keep non-drone or unrecognized keys unchanged.
      result[key] = settings;
    }
  }

  // Ensure all target topics exist (in case the old config was missing some).
  for (const field of TOPIC_FIELDS) {
    if (!(to[field] in result)) {
      result[to[field]] = { visible: true };
    }
  }

  return result;
}

/**
 * Watches the active robot's droneId in the Zustand store.
 * When it changes, rewrites the 3D Panel's topic subscriptions
 * and followTf to match the new drone.
 */
export function useActiveDroneRouting(): void {
  const { savePanelConfigs, getCurrentLayoutState } = useCurrentLayoutActions();

  const activeDroneId = useRobotConnectionsStore(
    (s) => s.robots.find((r) => r.isActive)?.droneId,
  );

  const prevDroneIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (activeDroneId == undefined) {
      return;
    }

    const prevId = prevDroneIdRef.current;
    if (prevId === activeDroneId) {
      return;
    }
    prevDroneIdRef.current = activeDroneId;

    // Determine what droneId the current panel config is based on.
    // On first activation, the layout is initialized from DEFAULT_DRONE_ID.
    const fromId = prevId ?? DEFAULT_DRONE_ID;

    // If the target is the same as the source, no rewrite needed.
    if (fromId === activeDroneId) {
      return;
    }

    const layoutState = getCurrentLayoutState();
    const currentConfig = layoutState.selectedLayout?.data?.configById?.[PANEL_ID] as
      | Record<string, unknown>
      | undefined;
    if (!currentConfig) {
      return;
    }

    const oldTopics = (currentConfig.topics ?? {}) as Record<string, unknown>;
    const newTopics = remapTopics(oldTopics, fromId, activeDroneId);
    const newFollowTf = droneBodyFrame(activeDroneId);

    savePanelConfigs({
      configs: [
        {
          id: PANEL_ID,
          override: true,
          config: { ...currentConfig, topics: newTopics, followTf: newFollowTf },
        },
      ],
    });
  }, [activeDroneId, savePanelConfigs, getCurrentLayoutState]);
}

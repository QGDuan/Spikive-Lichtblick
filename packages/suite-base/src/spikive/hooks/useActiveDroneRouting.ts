// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useRef } from "react";

import { useRobotConnectionsStore } from "@lichtblick/suite-base/components/MultiRobotSidebar/useRobotConnections";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import {
  droneBodyFrame,
  droneTopics,
  DEFAULT_DRONE_ID,
  extractDroneIdFromRobotModelTopic,
  type DroneTopics,
} from "@lichtblick/suite-base/spikive/config/topicConfig";
import { useVisualizationStore } from "@lichtblick/suite-base/spikive/stores/useVisualizationStore";

const PANEL_ID = "3D!spikive3d";

/** All field keys of DroneTopics – used to iterate over topic pairs. */
const TOPIC_FIELDS: (keyof DroneTopics)[] = [
  "pointCloud",
  "optimalTrajectory",
  "goalPoint",
  "robotModel",
  "path",
  "waypointMarkers",
];

/** Fields that should NOT be pickable (everything except robotModel). */
const NON_PICKABLE_FIELDS: ReadonlySet<keyof DroneTopics> = new Set([
  "pointCloud",
  "optimalTrajectory",
  "goalPoint",
  "path",
  "waypointMarkers",
]);

const CORE_DRONE_TOPIC_RE =
  /^\/drone_(\d+)_(cloud_registered|ego_planner_node\/optimal_list|ego_planner_node\/goal_point|odom_visualization\/robot|odom_visualization\/path|waypoint_markers)$/;

const DEFAULT_TOPIC_SETTINGS: Partial<Record<keyof DroneTopics, Record<string, unknown>>> = {
  optimalTrajectory: { visible: true, pickable: false },
  goalPoint: { visible: true, pickable: false },
  robotModel: { visible: true },
  path: { visible: true, pickable: false },
  waypointMarkers: { visible: true, pickable: false },
  odom: {},
  addWaypoint: {},
  removeWaypoint: {},
  clearWaypoints: {},
  saveWaypoints: {},
  loadWaypoints: {},
  deleteProject: {},
  reorderWaypoints: {},
  waypointProjectList: {},
  startWaypointExec: {},
  stopWaypointExec: {},
  waypointExecState: {},
};

function defaultTopicSettings(field: keyof DroneTopics): Record<string, unknown> {
  if (field === "pointCloud") {
    const viz = useVisualizationStore.getState();
    return {
      visible: true,
      pickable: false,
      colorField: "intensity",
      colorMode: viz.colorMode,
      colorMap: viz.colorMap,
      decayTime: viz.decayTime,
      explicitAlpha: viz.explicitAlpha,
      pointSize: viz.pointSize,
    };
  }

  return DEFAULT_TOPIC_SETTINGS[field] ?? {};
}

function normalizeTopicSettings(
  field: keyof DroneTopics,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const defaults = defaultTopicSettings(field);
  const merged = { ...defaults, ...(existing ?? {}) };

  merged.visible = true;

  if (NON_PICKABLE_FIELDS.has(field)) {
    merged.pickable = false;
  } else if (field === "robotModel" && merged.pickable === false) {
    delete merged.pickable;
  }

  return merged;
}

function topicSettingsEqual(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown>,
): boolean {
  if (a == undefined) {
    return false;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

/**
 * Ensure every drone topic in `topics` has the correct `pickable` flag.
 * Returns a patched copy only if something changed, otherwise returns undefined.
 */
function ensurePickableFlags(
  topics: Record<string, Record<string, unknown>>,
  droneId: string,
): Record<string, Record<string, unknown>> | undefined {
  const dt = droneTopics(droneId);
  let changed = false;
  const patched = { ...topics };

  for (const field of TOPIC_FIELDS) {
    const topicName = dt[field];
    const existing = patched[topicName] as Record<string, unknown> | undefined;
    const shouldBePickable = !NON_PICKABLE_FIELDS.has(field);

    if (existing == undefined) {
      continue; // topic not in config yet, nothing to patch
    }
    if (shouldBePickable && existing.pickable != undefined) {
      // robotModel shouldn't have pickable: false
      if (existing.pickable === false) {
        const patchedTopic = { ...existing };
        delete patchedTopic.pickable;
        patched[topicName] = patchedTopic;
        changed = true;
      }
    } else if (!shouldBePickable && existing.pickable !== false) {
      patched[topicName] = { ...existing, pickable: false };
      changed = true;
    }
  }

  return changed ? patched : undefined;
}

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
      result[to[field]] = normalizeTopicSettings(field, undefined);
    }
  }

  return result;
}

function ensureVisibleTargetTopics(
  topics: Record<string, unknown>,
  droneId: string,
): { topics: Record<string, unknown>; changed: boolean } {
  const target = droneTopics(droneId);
  let changed = false;
  const result: Record<string, unknown> = {};

  for (const [topicName, settings] of Object.entries(topics)) {
    const match = CORE_DRONE_TOPIC_RE.exec(topicName);
    if (match?.[1] != undefined && match[1] !== droneId) {
      changed = true;
      continue;
    }
    result[topicName] = settings;
  }

  for (const field of TOPIC_FIELDS) {
    const topicName = target[field];
    const existing = result[topicName] as Record<string, unknown> | undefined;
    const normalized = normalizeTopicSettings(field, existing);
    if (!topicSettingsEqual(existing, normalized)) {
      result[topicName] = normalized;
      changed = true;
    }
  }

  return { topics: result, changed };
}

function inferDroneIdFromConfig(config: Record<string, unknown>): string {
  const topics = config.topics as Record<string, unknown> | undefined;
  if (topics != undefined) {
    for (const topic of Object.keys(topics)) {
      const droneId = extractDroneIdFromRobotModelTopic(topic);
      if (droneId != undefined) {
        return droneId;
      }
    }
  }

  const followTf = config.followTf;
  if (typeof followTf === "string") {
    const match = /^base(\d+)$/.exec(followTf);
    if (match?.[1] != undefined) {
      return match[1];
    }
  }

  return DEFAULT_DRONE_ID;
}

export function buildActiveDronePanelConfig(
  currentConfig: Record<string, unknown>,
  targetDroneId: string,
): Record<string, unknown> | undefined {
  const fromId = inferDroneIdFromConfig(currentConfig);
  const currentFollowTf = currentConfig.followTf;
  const newFollowTf = droneBodyFrame(targetDroneId);
  const needsFollowTfPatch = currentFollowTf !== newFollowTf;

  const oldTopics = (currentConfig.topics ?? {}) as Record<string, unknown>;
  const remappedTopics =
    fromId === targetDroneId ? oldTopics : remapTopics(oldTopics, fromId, targetDroneId);
  const { topics: newTopics, changed: topicsChanged } = ensureVisibleTargetTopics(
    remappedTopics,
    targetDroneId,
  );

  if (fromId === targetDroneId && !needsFollowTfPatch && !topicsChanged) {
    return undefined;
  }

  return { ...currentConfig, topics: newTopics, followTf: newFollowTf };
}

/**
 * Watches the visual robot's droneId in the Zustand store.
 * When it changes, rewrites the 3D Panel's topic subscriptions
 * and followTf to match the new drone.
 */
export function useActiveDroneRouting(): void {
  const { savePanelConfigs, getCurrentLayoutState } = useCurrentLayoutActions();

  const visualDroneId = useRobotConnectionsStore((s) => s.visualDroneId ?? s.robots[0]?.droneId);
  const visualRouteVersion = useRobotConnectionsStore((s) => s.visualRouteVersion);

  const patchedRef = useRef(false);

  // One-time patch: ensure pickable flags exist in cached layouts from older sessions
  useEffect(() => {
    if (patchedRef.current) {
      return;
    }
    patchedRef.current = true;

    const droneId = visualDroneId ?? DEFAULT_DRONE_ID;
    const layoutState = getCurrentLayoutState();
    // TypeScript correctly treats selectedLayout/data as optional here; layout
    // actions can run before a layout has been hydrated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const currentConfig = layoutState.selectedLayout?.data?.configById?.[PANEL_ID] as
      | Record<string, unknown>
      | undefined;
    if (!currentConfig) {
      return;
    }

    const topics = (currentConfig.topics ?? {}) as Record<string, Record<string, unknown>>;
    const patched = ensurePickableFlags(topics, droneId);
    if (patched) {
      savePanelConfigs({
        configs: [
          {
            id: PANEL_ID,
            override: true,
            config: { ...currentConfig, topics: patched },
          },
        ],
      });
    }
  }, [visualDroneId, getCurrentLayoutState, savePanelConfigs]);

  // Visual drone switch: remap topics

  useEffect(() => {
    if (visualDroneId == undefined) {
      return;
    }

    const layoutState = getCurrentLayoutState();
    // TypeScript correctly treats selectedLayout/data as optional here; layout
    // actions can run before a layout has been hydrated.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const currentConfig = layoutState.selectedLayout?.data?.configById?.[PANEL_ID] as
      | Record<string, unknown>
      | undefined;
    if (!currentConfig) {
      return;
    }

    const nextConfig = buildActiveDronePanelConfig(currentConfig, visualDroneId);
    if (nextConfig == undefined) {
      return;
    }

    savePanelConfigs({
      configs: [
        {
          id: PANEL_ID,
          override: true,
          config: nextConfig,
        },
      ],
    });
  }, [visualDroneId, visualRouteVersion, savePanelConfigs, getCurrentLayoutState]);
}

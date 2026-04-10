// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

/**
 * Centralized topic & frame configuration for the Spikive drone visualization system.
 *
 * Naming convention:
 *   Topic:  `/drone_{id}_<base_topic>`
 *   TF:     `base{id}` (child of `world`, broadcast by odom_visualization with tf45=true)
 */

export const DEFAULT_DRONE_ID = "1";

// ---------------------------------------------------------------------------
// Base topic names (without drone prefix)
// ---------------------------------------------------------------------------
const BASE_TOPICS = {
  pointCloud: "cloud_registered",
  optimalTrajectory: "ego_planner_node/optimal_list",
  goalPoint: "ego_planner_node/goal_point",
  robotModel: "odom_visualization/robot",
  path: "odom_visualization/path",
} as const;

// ---------------------------------------------------------------------------
// Topic builder
// ---------------------------------------------------------------------------
export type DroneTopics = {
  pointCloud: string;
  optimalTrajectory: string;
  goalPoint: string;
  robotModel: string;
  path: string;
};

/** Build fully-qualified topic names for a given drone ID. */
export function droneTopics(droneId: string | number): DroneTopics {
  const id = String(droneId);
  return {
    pointCloud: `/drone_${id}_${BASE_TOPICS.pointCloud}`,
    optimalTrajectory: `/drone_${id}_${BASE_TOPICS.optimalTrajectory}`,
    goalPoint: `/drone_${id}_${BASE_TOPICS.goalPoint}`,
    robotModel: `/drone_${id}_${BASE_TOPICS.robotModel}`,
    path: `/drone_${id}_${BASE_TOPICS.path}`,
  };
}

// ---------------------------------------------------------------------------
// TF frame builder
// ---------------------------------------------------------------------------
/** Return the body-follow TF frame name for a given drone ID. */
export function droneBodyFrame(droneId: string | number): string {
  return `base${String(droneId)}`;
}

// ---------------------------------------------------------------------------
// Publish topics (outbound, not drone-prefixed for now)
// ---------------------------------------------------------------------------
const PUBLISH_TOPICS = {
  goalPose: "/move_base_simple/goal",
  clickedPoint: "/clicked_point",
  initialPose: "/initialpose",
} as const;

// ---------------------------------------------------------------------------
// Assembled default config
// ---------------------------------------------------------------------------
export const TOPIC_CONFIG = {
  subscribe: droneTopics(DEFAULT_DRONE_ID),
  publish: PUBLISH_TOPICS,
  followTf: droneBodyFrame(DEFAULT_DRONE_ID),
} as const;

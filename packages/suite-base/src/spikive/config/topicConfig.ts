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
  odom: "visual_slam/odom",
  // Waypoint action topics
  addWaypoint: "add_waypoint",
  removeWaypoint: "remove_waypoint",
  clearWaypoints: "clear_waypoints",
  saveWaypoints: "save_waypoints",
  loadWaypoints: "load_waypoints",
  deleteProject: "delete_waypoint_project",
  reorderWaypoints: "reorder_waypoints",
  // Waypoint response topics
  waypointMarkers: "waypoint_markers",
  waypointProjectList: "waypoint_project_list",
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
  odom: string;
  addWaypoint: string;
  removeWaypoint: string;
  clearWaypoints: string;
  saveWaypoints: string;
  loadWaypoints: string;
  deleteProject: string;
  reorderWaypoints: string;
  waypointMarkers: string;
  waypointProjectList: string;
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
    odom: `/drone_${id}_${BASE_TOPICS.odom}`,
    addWaypoint: `/drone_${id}_${BASE_TOPICS.addWaypoint}`,
    removeWaypoint: `/drone_${id}_${BASE_TOPICS.removeWaypoint}`,
    clearWaypoints: `/drone_${id}_${BASE_TOPICS.clearWaypoints}`,
    saveWaypoints: `/drone_${id}_${BASE_TOPICS.saveWaypoints}`,
    loadWaypoints: `/drone_${id}_${BASE_TOPICS.loadWaypoints}`,
    deleteProject: `/drone_${id}_${BASE_TOPICS.deleteProject}`,
    reorderWaypoints: `/drone_${id}_${BASE_TOPICS.reorderWaypoints}`,
    waypointMarkers: `/drone_${id}_${BASE_TOPICS.waypointMarkers}`,
    waypointProjectList: `/drone_${id}_${BASE_TOPICS.waypointProjectList}`,
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
// Drone ID extraction utility
// ---------------------------------------------------------------------------
/** Extract the drone numeric ID from a fully-qualified drone topic string. */
export function extractDroneIdFromTopic(topic: string): string | undefined {
  const match = /^\/drone_(\d+)_/.exec(topic);
  return match?.[1];
}

// ---------------------------------------------------------------------------
// Telemetry topics (battery, GPS, etc.)
// ---------------------------------------------------------------------------
export const TELEMETRY_TOPICS = {
  battery: "/mavros/battery",
} as const;

// ---------------------------------------------------------------------------
// Control topic & command codes
// ---------------------------------------------------------------------------
export const CONTROL_TOPIC = "/control";

export const DRONE_COMMANDS = {
  TAKEOFF: 1,
  LAND: 2,
  RETURN: 3,
  CONTINUE: 4,
  STOP: 5,
} as const;

// ---------------------------------------------------------------------------
// Publish topics (outbound, not drone-prefixed for now)
// ---------------------------------------------------------------------------
const PUBLISH_TOPICS = {
  goalPose: "/move_base_simple/goal",
  goalWithId: "/goal_with_id",
  clickedPoint: "/clicked_point",
  initialPose: "/initialpose",
} as const;

// ---------------------------------------------------------------------------
// Waypoint marker colors (frontend-defined, overrides backend hardcoded colors)
// ---------------------------------------------------------------------------
export const WAYPOINT_COLORS = {
  sphere: { r: 0.937, g: 0.514, b: 0.227, a: 1.0 }, // Spikive orange #EF833A
  text: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 }, // white
  line: { r: 0.612, g: 0.153, b: 0.69, a: 0.9 }, // purple #9C27B0
};

// ---------------------------------------------------------------------------
// Assembled default config
// ---------------------------------------------------------------------------
export const TOPIC_CONFIG = {
  subscribe: droneTopics(DEFAULT_DRONE_ID),
  publish: PUBLISH_TOPICS,
  followTf: droneBodyFrame(DEFAULT_DRONE_ID),
} as const;

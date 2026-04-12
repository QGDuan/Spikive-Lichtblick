// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { MessageDefinition } from "@lichtblick/message-definition";
import { ros1, ros2galactic } from "@lichtblick/rosmsg-msgs-common";
import { fromDate } from "@lichtblick/rostime";
import { Point, makeCovarianceArray } from "@lichtblick/suite-base/util/geometry";

import { Pose } from "./transforms/geometry";

export const PublishRos1Datatypes = new Map<string, MessageDefinition>(
  (
    [
      "geometry_msgs/Point",
      "geometry_msgs/PointStamped",
      "geometry_msgs/Pose",
      "geometry_msgs/PoseStamped",
      "geometry_msgs/PoseWithCovariance",
      "geometry_msgs/PoseWithCovarianceStamped",
      "geometry_msgs/Quaternion",
      "std_msgs/Header",
    ] as Array<keyof typeof ros1>
  ).map((type) => [type, ros1[type]]),
);

export const PublishRos2Datatypes = new Map<string, MessageDefinition>(
  (
    [
      "geometry_msgs/Point",
      "geometry_msgs/PointStamped",
      "geometry_msgs/Pose",
      "geometry_msgs/PoseStamped",
      "geometry_msgs/PoseWithCovariance",
      "geometry_msgs/PoseWithCovarianceStamped",
      "geometry_msgs/Quaternion",
      "std_msgs/Header",
    ] as Array<keyof typeof ros2galactic>
  ).map((type) => [type, ros2galactic[type]]),
);

export function makePointMessage(point: Point, frameId: string): unknown {
  const time = fromDate(new Date());
  return {
    // seq is omitted since it is not present in ros2
    header: { stamp: time, frame_id: frameId },
    point: { x: point.x, y: point.y, z: 0 },
  };
}

export function makePoseMessage(pose: Pose, frameId: string): unknown {
  const time = fromDate(new Date());
  return {
    // seq is omitted since it is not present in ros2
    header: { stamp: time, frame_id: frameId },
    pose,
  };
}

export function makePoseEstimateMessage(
  pose: Pose,
  frameId: string,
  xDev: number,
  yDev: number,
  thetaDev: number,
): unknown {
  const time = fromDate(new Date());
  return {
    // seq is omitted since it is not present in ros2
    header: { stamp: time, frame_id: frameId },
    pose: {
      covariance: makeCovarianceArray(xDev, yDev, thetaDev),
      pose,
    },
  };
}

// ---------------------------------------------------------------------------
// quadrotor_msgs/GoalSet  (used by EGO-Planner)
// ---------------------------------------------------------------------------
export const GoalSetDatatypes = new Map<string, MessageDefinition>([
  [
    "quadrotor_msgs/GoalSet",
    {
      name: "quadrotor_msgs/GoalSet",
      definitions: [
        { type: "int16", name: "drone_id", isComplex: false, isArray: false },
        { type: "float32", name: "goal", isComplex: false, isArray: true, arrayLength: 3 },
      ],
    },
  ],
]);

export function makeGoalSetMessage(droneId: number, position: Point): unknown {
  return {
    drone_id: droneId,
    goal: [position.x, position.y, position.z],
  };
}

// ---------------------------------------------------------------------------
// visualization_msgs/MarkerArray  (waypoint visualization)
// ---------------------------------------------------------------------------
export const WaypointMarkerDatatypes = new Map<string, MessageDefinition>(
  (
    [
      "geometry_msgs/Point",
      "geometry_msgs/Pose",
      "geometry_msgs/Quaternion",
      "geometry_msgs/Vector3",
      "std_msgs/ColorRGBA",
      "std_msgs/Header",
      "visualization_msgs/Marker",
      "visualization_msgs/MarkerArray",
    ] as Array<keyof typeof ros1>
  ).map((type) => [type, ros1[type]]),
);

// Marker type constants
const MARKER_SPHERE = 2;
const MARKER_LINE_STRIP = 4;
const MARKER_TEXT_VIEW_FACING = 9;
// Marker action constants
const MARKER_ADD = 0;
const MARKER_DELETEALL = 3;

export type WaypointXYZ = { x: number; y: number; z: number };

/**
 * Build a MarkerArray message for waypoint visualization.
 * Mirrors waypoint_recorder.py _publish_markers().
 */
export function makeWaypointMarkerArray(
  waypoints: WaypointXYZ[],
  frameId: string,
): unknown {
  const time = fromDate(new Date());
  const markers: unknown[] = [];

  // DELETEALL to clear previous markers
  markers.push({
    header: { stamp: time, frame_id: frameId },
    ns: "waypoints",
    id: 0,
    type: 0,
    action: MARKER_DELETEALL,
    pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
    scale: { x: 0, y: 0, z: 0 },
    color: { r: 0, g: 0, b: 0, a: 0 },
    lifetime: { sec: 0, nsec: 0 },
    frame_locked: false,
    points: [],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  });

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]!;

    // Sphere marker
    markers.push({
      header: { stamp: time, frame_id: frameId },
      ns: "waypoints",
      id: i,
      type: MARKER_SPHERE,
      action: MARKER_ADD,
      pose: { position: { x: wp.x, y: wp.y, z: wp.z }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      scale: { x: 0.3, y: 0.3, z: 0.3 },
      color: { r: 1.0, g: 0.3, b: 0.0, a: 1.0 },
      lifetime: { sec: 0, nsec: 0 },
      frame_locked: false,
      points: [],
      colors: [],
      text: "",
      mesh_resource: "",
      mesh_use_embedded_materials: false,
    });

    // Text label
    markers.push({
      header: { stamp: time, frame_id: frameId },
      ns: "waypoints",
      id: 10000 + i,
      type: MARKER_TEXT_VIEW_FACING,
      action: MARKER_ADD,
      pose: {
        position: { x: wp.x, y: wp.y, z: wp.z + 0.6 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      scale: { x: 0, y: 0, z: 0.67 },
      color: { r: 1.0, g: 1.0, b: 0.0, a: 1.0 },
      lifetime: { sec: 0, nsec: 0 },
      frame_locked: false,
      points: [],
      colors: [],
      text: String(i + 1),
      mesh_resource: "",
      mesh_use_embedded_materials: false,
    });
  }

  // Line strip connecting waypoints
  if (waypoints.length >= 2) {
    markers.push({
      header: { stamp: time, frame_id: frameId },
      ns: "waypoints",
      id: 20000,
      type: MARKER_LINE_STRIP,
      action: MARKER_ADD,
      pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      scale: { x: 0.08, y: 0, z: 0 },
      color: { r: 0.2, g: 1.0, b: 0.2, a: 0.8 },
      lifetime: { sec: 0, nsec: 0 },
      frame_locked: false,
      points: waypoints.map((wp) => ({ x: wp.x, y: wp.y, z: wp.z })),
      colors: [],
      text: "",
      mesh_resource: "",
      mesh_use_embedded_materials: false,
    });
  }

  return { markers };
}

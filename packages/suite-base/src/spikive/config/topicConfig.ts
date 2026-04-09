// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

/**
 * Centralized topic name configuration for the Spikive multi-robot system.
 *
 * Currently hardcoded for single-robot use.
 * Future: prefix each topic with a robot namespace (e.g. `/robot_alpha/cloud_registered`)
 * to support multi-robot routing.
 */
export const TOPIC_CONFIG = {
  slam: {
    pointCloud: "/cloud_registered",
    pointCloudEffected: "/cloud_effected",
    path: "/path",
  },
  planner: {
    goalPose: "/move_base_simple/goal",
    clickedPoint: "/clicked_point",
    initialPose: "/initialpose",
  },
} as const;

export type TopicConfig = typeof TOPIC_CONFIG;

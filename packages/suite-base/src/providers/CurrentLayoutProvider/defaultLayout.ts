// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { LayoutData } from "@lichtblick/suite-base/context/CurrentLayoutContext/actions";
import { defaultPlaybackConfig } from "@lichtblick/suite-base/providers/CurrentLayoutProvider/reducers";
import { TOPIC_CONFIG } from "@lichtblick/suite-base/spikive/config/topicConfig";

/**
 * Overridden default layout that may have been provided when self-hosting via Docker
 * */
const staticDefaultLayout = (globalThis as { LICHTBLICK_SUITE_DEFAULT_LAYOUT?: LayoutData })
  .LICHTBLICK_SUITE_DEFAULT_LAYOUT;

/**
 * Spikive default layout: single fullscreen 3D Panel with locked rendering config.
 * Point cloud style, camera position, and publish settings are fixed here.
 */
export const defaultLayout: LayoutData =
  staticDefaultLayout ??
  ({
    configById: {
      "3D!spikive3d": {
        layers: {
          "845139cb-26bc-40b3-8161-8ab60af4baf5": {
            visible: false,
            frameLocked: true,
            label: "Grid",
            instanceId: "845139cb-26bc-40b3-8161-8ab60af4baf5",
            layerId: "foxglove.Grid",
            size: 10,
            divisions: 10,
            lineWidth: 1,
            color: "#248eff",
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            order: 1,
          },
        },
        cameraState: {
          perspective: true,
          distance: 33.403651402282385,
          phi: 31.777720312520323,
          thetaOffset: 130.20758524500332,
          targetOffset: [-3.9764337079652785, -6.845050638619883, 6.789200836741229e-16],
          target: [0, 0, 0],
          targetOrientation: [0, 0, 0, 1],
          fovy: 45,
          near: 0.5,
          far: 5000,
        },
        followTf: "body",
        followMode: "follow-position",
        scene: {},
        transforms: {},
        topics: {
          [TOPIC_CONFIG.slam.pointCloud]: {
            visible: true,
            colorField: "intensity",
            colorMode: "colormap",
            colorMap: "rainbow",
            decayTime: 60,
            explicitAlpha: 0.15,
            pointSize: 0.5,
          },
          [TOPIC_CONFIG.slam.path]: {
            visible: false,
          },
          [TOPIC_CONFIG.slam.pointCloudEffected]: {
            visible: false,
          },
        },
        publish: {
          type: "pose_estimate",
          poseTopic: TOPIC_CONFIG.planner.goalPose,
          pointTopic: TOPIC_CONFIG.planner.clickedPoint,
          poseEstimateTopic: TOPIC_CONFIG.planner.initialPose,
          poseEstimateXDeviation: 0.5,
          poseEstimateYDeviation: 0.5,
          poseEstimateThetaDeviation: 0.26179939,
        },
        imageMode: {},
      },
    },
    globalVariables: {},
    userNodes: {},
    playbackConfig: { ...defaultPlaybackConfig },
    layout: "3D!spikive3d",
  });

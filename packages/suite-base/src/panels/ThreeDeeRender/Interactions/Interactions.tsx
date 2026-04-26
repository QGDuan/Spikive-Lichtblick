// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Cursor20Regular } from "@fluentui/react-icons";
import { Typography } from "@mui/material";
import React, { useEffect } from "react";

import type { MessageDefinition } from "@lichtblick/message-definition";
import type { LayoutActions } from "@lichtblick/suite";
import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@lichtblick/suite-base/components/ExpandingToolbar";
import { useRobotConnectionsStore } from "@lichtblick/suite-base/components/MultiRobotSidebar/useRobotConnections";
import { DroneControlPanel } from "@lichtblick/suite-base/spikive/components/DroneControlPanel";
import { WaypointExecPanel } from "@lichtblick/suite-base/spikive/components/WaypointExecPanel";
import { WaypointPanel } from "@lichtblick/suite-base/spikive/components/WaypointPanel";
import { extractDroneIdFromRobotModelTopic } from "@lichtblick/suite-base/spikive/config/topicConfig";
import { useSceneModeStore } from "@lichtblick/suite-base/spikive/stores/useSceneModeStore";
import { useWaypointStore } from "@lichtblick/suite-base/spikive/stores/useWaypointStore";

import { InteractionData } from "./types";
import { Pose } from "../transforms";

export const OBJECT_TAB_TYPE = "Selected object";
export type TabType = typeof OBJECT_TAB_TYPE;

export type SelectionObject = {
  object: {
    pose: Pose;
    interactionData?: InteractionData;
  };
  instanceIndex: number | undefined;
};

type Props = {
  addPanel: LayoutActions["addPanel"];
  interactionsTabType?: TabType;
  onShowTopicSettings?: (topic: string) => void;
  selectedObject?: SelectionObject;
  setInteractionsTabType: (arg0?: TabType) => void;
  timezone: string | undefined;
  // Publish-related props forwarded to DroneControlPanel
  onClickPublish: () => void;
  publishActive: boolean;
  canPublish: boolean;
  publish?: (topic: string, message: unknown) => void;
  advertise?: (
    topic: string,
    schemaName: string,
    options?: { datatypes: Map<string, MessageDefinition> },
  ) => void;
  unadvertise?: (topic: string) => void;
  dataSourceProfile?: string;
};

const InteractionsBaseComponent = React.memo<Props>(function InteractionsBaseComponent({
  selectedObject,
  interactionsTabType,
  setInteractionsTabType,
  onClickPublish,
  publishActive,
  canPublish,
  publish,
  advertise,
  unadvertise,
  dataSourceProfile,
}: Props) {
  const selectedInteractionData = selectedObject?.object.interactionData;
  const topic = selectedInteractionData?.topic;
  const selectedRobotDroneId =
    topic != undefined ? extractDroneIdFromRobotModelTopic(topic) : undefined;
  const sceneMode = useSceneModeStore((s) => s.sceneMode);
  const activeDroneId = useRobotConnectionsStore((s) => s.activeDroneId);
  const setActiveDroneId = useRobotConnectionsStore((s) => s.setActiveDroneId);

  useEffect(() => {
    if (selectedRobotDroneId != undefined) {
      setActiveDroneId(selectedRobotDroneId);
    }
  }, [selectedRobotDroneId, setActiveDroneId]);

  const isMapping = sceneMode === "mapping-waypoint";

  // Check if waypoints are loaded for the active drone (used in autonomous-flight mode)
  const hasWaypoints = useWaypointStore((s) =>
    activeDroneId ? (s.tables[activeDroneId]?.waypoints.length ?? 0) > 0 : false,
  );

  return (
    <ExpandingToolbar
      tooltip="Inspect objects"
      icon={<Cursor20Regular />}
      selectedTab={interactionsTabType}
      onSelectTab={(newSelectedTab) => {
        setInteractionsTabType(newSelectedTab);
      }}
    >
      <ToolGroup name={OBJECT_TAB_TYPE}>
        <ToolGroupFixedSizePane maxHeight={isMapping || hasWaypoints ? undefined : 240}>
          {activeDroneId != undefined ? (
            isMapping ? (
              <WaypointPanel
                droneId={activeDroneId}
                publish={publish}
                advertise={advertise}
                unadvertise={unadvertise}
              />
            ) : (
              <>
                <DroneControlPanel
                  droneId={activeDroneId}
                  onClickPublish={onClickPublish}
                  publishActive={publishActive}
                  canPublish={canPublish}
                  publish={publish}
                  advertise={advertise}
                  unadvertise={unadvertise}
                  dataSourceProfile={dataSourceProfile}
                />
                {hasWaypoints && (
                  <WaypointExecPanel
                    droneId={activeDroneId}
                    publish={publish}
                    advertise={advertise}
                    unadvertise={unadvertise}
                  />
                )}
              </>
            )
          ) : (
            <Typography variant="body2" color="text.disabled" gutterBottom>
              Click an object in the 3D view to select it.
            </Typography>
          )}
        </ToolGroupFixedSizePane>
      </ToolGroup>
    </ExpandingToolbar>
  );
});

// Wrap the Interactions so that we don't rerender every time any part of the PanelContext config changes, but just the
// one value that we care about.
export default function Interactions(props: Props): React.JSX.Element {
  return <InteractionsBaseComponent {...props} />;
}

// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useEffect } from "react";

import { useRobotConnectionsStore } from "@lichtblick/suite-base/components/MultiRobotSidebar/useRobotConnections";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { droneTopics } from "@lichtblick/suite-base/spikive/config/topicConfig";

const PANEL_ID = "3D!spikive3d";

/**
 * Syncs robot.isVisible state to 3D panel topic visibility.
 * When user toggles visibility in RobotCard, this hook updates
 * config.topics[pointCloudTopic].visible accordingly.
 *
 * This ensures that the point cloud visibility toggle in the sidebar
 * actually controls whether the point cloud is subscribed and rendered.
 */
export function useRobotVisibilitySync(): void {
  const { savePanelConfigs, getCurrentLayoutState } = useCurrentLayoutActions();
  const robots = useRobotConnectionsStore((s) => s.robots);

  useEffect(() => {
    const layoutState = getCurrentLayoutState();
    const currentConfig = layoutState.selectedLayout?.data?.configById?.[PANEL_ID] as
      | Record<string, unknown>
      | undefined;
    if (!currentConfig) {
      return;
    }

    const topics = { ...(currentConfig.topics ?? {}) } as Record<string, Record<string, unknown>>;
    let changed = false;

    for (const robot of robots) {
      const dt = droneTopics(robot.droneId);
      const pointCloudTopic = dt.pointCloud;

      // Sync visibility for point cloud topic
      const currentVisible = topics[pointCloudTopic]?.visible;
      if (currentVisible !== robot.isVisible) {
        topics[pointCloudTopic] = {
          ...topics[pointCloudTopic],
          visible: robot.isVisible,
        };
        changed = true;
      }
    }

    if (changed) {
      savePanelConfigs({
        configs: [
          {
            id: PANEL_ID,
            override: true,
            config: { ...currentConfig, topics },
          },
        ],
      });
    }
  }, [robots, savePanelConfigs, getCurrentLayoutState]);
}

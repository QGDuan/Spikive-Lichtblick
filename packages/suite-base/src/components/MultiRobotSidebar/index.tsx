// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import AddIcon from "@mui/icons-material/Add";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { Button, Typography } from "@mui/material";
import { useCallback, useState } from "react";

import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import { useActiveDroneRouting } from "@lichtblick/suite-base/spikive/hooks/useActiveDroneRouting";

import { AddRobotDialog } from "./AddRobotDialog";
import { useStyles } from "./MultiRobotSidebar.style";
import { RobotCard } from "./RobotCard";
import { useRobotConnectionsStore } from "./useRobotConnections";
import { useWebSocketMonitor } from "./useWebSocketMonitor";

const WS_PROBE_TIMEOUT_MS = 3000;
const WS_SUB_PROTOCOLS = ["foxglove.websocket.v1"];

/** Try a WebSocket handshake. Resolves on open, rejects on error/timeout. */
function probeWebSocket(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(url, WS_SUB_PROTOCOLS);

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        ws.close();
        reject(new Error("Connection timed out"));
      }
    }, WS_PROBE_TIMEOUT_MS);

    ws.onopen = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    };

    ws.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        ws.close();
        reject(new Error("Unable to connect to WebSocket server"));
      }
    };
  });
}

export function MultiRobotSidebar(): React.JSX.Element {
  const { classes } = useStyles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { selectSource } = usePlayerSelection();

  useActiveDroneRouting();
  useWebSocketMonitor();

  const robots = useRobotConnectionsStore((s) => s.robots);
  const addRobot = useRobotConnectionsStore((s) => s.addRobot);
  const setActive = useRobotConnectionsStore((s) => s.setActive);
  const toggleVisibility = useRobotConnectionsStore((s) => s.toggleVisibility);
  const removeRobot = useRobotConnectionsStore((s) => s.removeRobot);

  const handleConnect = useCallback(
    async (url: string, droneId: string): Promise<{ success: boolean; error?: string }> => {
      // Pre-flight: verify the WebSocket is reachable before adding a card
      try {
        await probeWebSocket(url.trim());
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Connection failed",
        };
      }

      const result = addRobot(url, droneId);
      if (result.success) {
        selectSource("foxglove-websocket", {
          type: "connection",
          params: { url: url.trim() },
        });
      }
      return result;
    },
    [addRobot, selectSource],
  );

  const handleOpenDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  return (
    <div className={classes.root}>
      <div className={classes.listContainer}>
        {robots.length === 0 ? (
          <div className={classes.emptyState}>
            <SmartToyOutlinedIcon sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
            <Typography variant="body2">No robots connected</Typography>
            <Typography variant="caption" color="text.secondary">
              Click the button below to add a robot
            </Typography>
          </div>
        ) : (
          robots.map((robot) => (
            <RobotCard
              key={robot.id}
              robot={robot}
              onSetActive={setActive}
              onToggleVisibility={toggleVisibility}
              onRemove={removeRobot}
            />
          ))
        )}
      </div>
      <div className={classes.footer}>
        <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={handleOpenDialog}>
          Add Robot
        </Button>
      </div>
      <AddRobotDialog open={dialogOpen} onClose={handleCloseDialog} onConnect={handleConnect} />
    </div>
  );
}

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

export function MultiRobotSidebar(): React.JSX.Element {
  const { classes } = useStyles();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { selectSource } = usePlayerSelection();

  useActiveDroneRouting();

  const robots = useRobotConnectionsStore((s) => s.robots);
  const addRobot = useRobotConnectionsStore((s) => s.addRobot);
  const setActive = useRobotConnectionsStore((s) => s.setActive);
  const toggleVisibility = useRobotConnectionsStore((s) => s.toggleVisibility);
  const removeRobot = useRobotConnectionsStore((s) => s.removeRobot);

  const handleConnect = useCallback(
    (url: string, droneId: string) => {
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

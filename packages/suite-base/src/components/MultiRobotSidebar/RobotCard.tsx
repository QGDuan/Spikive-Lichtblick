// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useCallback, useState } from "react";

import { BatteryIndicator } from "@lichtblick/suite-base/spikive/components/DroneStatusIndicators";

import { useStyles } from "./RobotCard.style";
import type { ConnectionStatus, RobotEntry } from "./types";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connecting: "#FFA726",
  connected: "#66BB6A",
  slow: "#FFA726",
  disconnected: "#BDBDBD",
  error: "#EF5350",
};

type RobotCardProps = {
  robot: RobotEntry;
  isActive: boolean;
  onSelectDrone: (droneId: string) => void;
  onRemove: (connectionId: string) => void;
};

export const RobotCard = React.memo(function RobotCard({
  robot,
  isActive,
  onSelectDrone,
  onRemove,
}: RobotCardProps): React.JSX.Element {
  const { classes } = useStyles({ isActive });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSelect = useCallback(() => {
    onSelectDrone(robot.droneId);
  }, [onSelectDrone, robot.droneId]);

  const handleRemoveClick = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    setConfirmOpen(false);
    onRemove(robot.connectionId);
  }, [onRemove, robot.connectionId]);

  const handleCancelRemove = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  return (
    <Paper className={classes.card} elevation={0}>
      <div className={classes.header}>
        <Box className={classes.statusDot} sx={{ backgroundColor: STATUS_COLORS[robot.status] }} />
        <Typography className={classes.urlText} title={robot.url}>
          Drone {robot.droneId}
        </Typography>
        <Tooltip title={isActive ? "Selected" : "Select drone"}>
          <IconButton
            className={classes.actionButton}
            onClick={handleSelect}
            size="small"
            aria-label={isActive ? "Selected drone" : "Select drone"}
          >
            {isActive ? (
              <RadioButtonCheckedIcon fontSize="small" color="primary" />
            ) : (
              <RadioButtonUncheckedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </div>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          title={robot.url}
          sx={{ flex: 1, minWidth: 0 }}
        >
          {robot.url}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            ml: 1,
            flexShrink: 0,
            color:
              robot.status === "disconnected" || robot.status === "error"
                ? "#EF5350"
                : robot.status === "slow"
                  ? "#FFA726"
                  : "text.secondary",
            fontFamily: "monospace",
            fontSize: "0.65rem",
          }}
        >
          {robot.status === "disconnected" || robot.status === "error"
            ? "Disconnected"
            : robot.latencyMs != undefined
              ? `${robot.latencyMs}ms`
              : ""}
        </Typography>
      </Box>
      <div className={classes.actions}>
        <Tooltip title="Visualization enabled">
          <span>
            <IconButton
              className={classes.actionButton}
              disabled
              size="small"
              aria-label="Visualization enabled"
            >
              <VisibilityIcon fontSize="small" color="primary" />
            </IconButton>
          </span>
        </Tooltip>
        <BatteryIndicator />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Remove robot">
          <IconButton className={classes.actionButton} onClick={handleRemoveClick} size="small">
            <DeleteOutlineIcon fontSize="small" color="error" />
          </IconButton>
        </Tooltip>
      </div>

      <Dialog open={confirmOpen} onClose={handleCancelRemove} maxWidth="xs">
        <DialogTitle>Remove Robot</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Disconnect and remove <strong>Drone {robot.droneId}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRemove}>Cancel</Button>
          <Button onClick={handleConfirmRemove} color="error" variant="contained">
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
});

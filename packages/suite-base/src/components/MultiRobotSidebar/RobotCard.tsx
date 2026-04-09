// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExtensionIcon from "@mui/icons-material/Extension";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
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
import { useCallback, useState } from "react";

import { useStyles } from "./RobotCard.style";
import { ConnectionStatus, RobotEntry } from "./types";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connecting: "#FFA726",
  connected: "#66BB6A",
  disconnected: "#BDBDBD",
  error: "#EF5350",
};

type RobotCardProps = {
  robot: RobotEntry;
  onSetActive: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
};

export function RobotCard({
  robot,
  onSetActive,
  onToggleVisibility,
  onRemove,
}: RobotCardProps): React.JSX.Element {
  const { classes } = useStyles({ isActive: robot.isActive });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSetActive = useCallback(() => {
    onSetActive(robot.id);
  }, [onSetActive, robot.id]);

  const handleToggleVisibility = useCallback(() => {
    onToggleVisibility(robot.id);
  }, [onToggleVisibility, robot.id]);

  const handleRemoveClick = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    setConfirmOpen(false);
    onRemove(robot.id);
  }, [onRemove, robot.id]);

  const handleCancelRemove = useCallback(() => {
    setConfirmOpen(false);
  }, []);

  return (
    <Paper className={classes.card} elevation={0}>
      <div className={classes.header}>
        <Box
          className={classes.statusDot}
          sx={{ backgroundColor: STATUS_COLORS[robot.status] }}
        />
        <Typography className={classes.urlText} title={robot.url}>
          {robot.url}
        </Typography>
        <Tooltip title={robot.isActive ? "Active" : "Set as active"}>
          <IconButton className={classes.actionButton} onClick={handleSetActive} size="small">
            {robot.isActive ? (
              <RadioButtonCheckedIcon fontSize="small" color="primary" />
            ) : (
              <RadioButtonUncheckedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </div>
      <div className={classes.actions}>
        <Tooltip title={robot.isVisible ? "Hide visualization" : "Show visualization"}>
          <IconButton className={classes.actionButton} onClick={handleToggleVisibility} size="small">
            {robot.isVisible ? (
              <VisibilityIcon fontSize="small" />
            ) : (
              <VisibilityOffIcon fontSize="small" color="disabled" />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Backend interaction (coming soon)">
          <span>
            <IconButton className={classes.actionButton} disabled size="small">
              <ExtensionIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
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
            Disconnect and remove <strong>{robot.url}</strong>?
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
}

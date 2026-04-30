// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import StopIcon from "@mui/icons-material/Stop";
import VisibilityIcon from "@mui/icons-material/Visibility";
import {
  Box,
  Button,
  CircularProgress,
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
import React, { useCallback, useEffect, useState } from "react";

import { BatteryIndicator } from "@lichtblick/suite-base/spikive/components/DroneStatusIndicators";
import type {
  ManagerCommandRequest,
  ManagerCommandType,
  ManagerModuleStatus,
} from "@lichtblick/suite-base/spikive/manager/types";
import { useManagerCommandStore } from "@lichtblick/suite-base/spikive/manager/useManagerCommandStore";
import { useManagerStatusStore } from "@lichtblick/suite-base/spikive/manager/useManagerStatusStore";
import { useNowMs } from "@lichtblick/suite-base/spikive/manager/useNowMs";

import { useStyles } from "./RobotCard.style";
import type { ConnectionStatus, RobotEntry } from "./types";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connecting: "#FFA726",
  connected: "#66BB6A",
  slow: "#FFA726",
  disconnected: "#BDBDBD",
  error: "#EF5350",
};

const MANAGER_STALE_MS = 4000;
const COMMAND_PENDING_TIMEOUT_MS = 8000;

const MODULE_STATUS_COLORS: Record<ManagerModuleStatus, string> = {
  0: "#BDBDBD",
  1: "#FFA726",
  2: "#66BB6A",
};

function ModuleLight({
  label,
  status,
  muted,
}: {
  label: string;
  status: ManagerModuleStatus;
  muted: boolean;
}): React.JSX.Element {
  return (
    <Tooltip title={`${label}: ${status === 2 ? "ready" : status === 1 ? "partial" : "stopped"}`}>
      <Box
        component="span"
        sx={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          bgcolor: MODULE_STATUS_COLORS[status],
          opacity: muted ? 0.38 : 1,
          display: "inline-block",
        }}
      />
    </Tooltip>
  );
}

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
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [managerConfirmOpen, setManagerConfirmOpen] = useState(false);
  const [localPendingCommand, setLocalPendingCommand] = useState<
    Pick<ManagerCommandRequest, "commandType" | "requestId" | "seq"> & {
      startedAt: number;
      errorSeq: number;
    }
  >();
  const nowMs = useNowMs();
  const managerStatus = useManagerStatusStore((s) => s.snapshots[robot.droneId]);
  const pendingManagerRequest = useManagerCommandStore((s) => s.pendingRequest);
  const lastManagerFailure = useManagerCommandStore((s) => s.lastFailure);
  const requestManagerCommand = useManagerCommandStore((s) => s.requestCommand);
  const markManagerFailed = useManagerCommandStore((s) => s.markFailed);

  const managerStale =
    managerStatus == undefined || nowMs - managerStatus.lastUpdateMs > MANAGER_STALE_MS;
  const managerBusy =
    managerStatus?.starting === true ||
    managerStatus?.stopping === true ||
    managerStatus?.mode === "starting" ||
    managerStatus?.mode === "stopping";
  const commandPending =
    localPendingCommand != undefined ||
    (pendingManagerRequest?.droneId === robot.droneId &&
      (pendingManagerRequest.status === "pending" || pendingManagerRequest.status === "published"));
  const awaitingManagerAck =
    localPendingCommand != undefined || pendingManagerRequest?.droneId === robot.droneId;
  const managerCommand: ManagerCommandType =
    managerStatus?.isActive === true ? "shutdown_all" : "start_all";
  const managerDisabled =
    managerStale ||
    managerStatus?.armed === true ||
    managerBusy ||
    commandPending;
  const managerButtonLabel =
    managerStale
      ? "Manager offline"
      : managerStatus?.armed === true
        ? "Disabled while armed"
        : managerBusy || commandPending
          ? awaitingManagerAck
            ? "Waiting for manager"
            : managerStatus?.stopping === true || managerStatus?.mode === "stopping"
              ? "Stopping"
              : "Starting"
          : managerStatus?.mode === "error" && managerStatus.lastError.length > 0
            ? `Manager error: ${managerStatus?.lastError ?? ""}`
          : managerCommand === "start_all"
            ? "Start backend"
            : "Stop backend";

  useEffect(() => {
    if (localPendingCommand == undefined) {
      return;
    }

    const acked = managerStatus?.lastCommandRequestId === localPendingCommand.requestId;
    const failed =
      lastManagerFailure?.requestId === localPendingCommand.requestId &&
      lastManagerFailure.atMs >= localPendingCommand.startedAt;
    const backendRejected =
      managerStatus != undefined && managerStatus.lastErrorSeq > localPendingCommand.errorSeq;
    const timedOut = nowMs - localPendingCommand.startedAt > COMMAND_PENDING_TIMEOUT_MS;

    if (timedOut) {
      markManagerFailed(localPendingCommand.seq, "Manager command ACK timed out");
      setLocalPendingCommand(undefined);
    } else if (backendRejected) {
      markManagerFailed(
        localPendingCommand.seq,
        managerStatus.lastError || "Manager command rejected by backend",
      );
      setLocalPendingCommand(undefined);
    } else if (failed || acked) {
      setLocalPendingCommand(undefined);
    }
  }, [
    lastManagerFailure,
    localPendingCommand,
    managerStatus,
    markManagerFailed,
    nowMs,
  ]);

  const handleSelect = useCallback(() => {
    onSelectDrone(robot.droneId);
  }, [onSelectDrone, robot.droneId]);

  const handleRemoveClick = useCallback(() => {
    setRemoveConfirmOpen(true);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    setRemoveConfirmOpen(false);
    onRemove(robot.connectionId);
  }, [onRemove, robot.connectionId]);

  const handleCancelRemove = useCallback(() => {
    setRemoveConfirmOpen(false);
  }, []);

  const handleManagerClick = useCallback(() => {
    setManagerConfirmOpen(true);
  }, []);

  const handleCancelManager = useCallback(() => {
    setManagerConfirmOpen(false);
  }, []);

  const handleConfirmManager = useCallback(() => {
    if (managerDisabled) {
      setManagerConfirmOpen(false);
      return;
    }
    const request = requestManagerCommand(robot.droneId, managerCommand);
    setLocalPendingCommand({
      commandType: managerCommand,
      requestId: request.requestId,
      seq: request.seq,
      startedAt: Date.now(),
      errorSeq: managerStatus?.lastErrorSeq ?? 0,
    });
    setManagerConfirmOpen(false);
  }, [managerCommand, managerDisabled, managerStatus?.lastErrorSeq, requestManagerCommand, robot.droneId]);

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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25, mr: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.45 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.58rem" }}>
              Drivers
            </Typography>
            <ModuleLight
              label="MavROS"
              status={managerStatus?.mavrosStatus ?? 0}
              muted={managerStale}
            />
            <ModuleLight
              label="Lidar"
              status={managerStatus?.lidarStatus ?? 0}
              muted={managerStale}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.45 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.58rem" }}>
              Tasks
            </Typography>
            <ModuleLight
              label="SLAM"
              status={managerStatus?.slamStatus ?? 0}
              muted={managerStale}
            />
            <ModuleLight
              label="Planner"
              status={managerStatus?.plannerStatus ?? 0}
              muted={managerStale}
            />
          </Box>
        </Box>
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
        <Tooltip title={managerButtonLabel}>
          <span>
            <IconButton
              className={classes.actionButton}
              disabled={managerDisabled}
              onClick={handleManagerClick}
              size="small"
              aria-label={managerButtonLabel}
            >
              {managerBusy || commandPending ? (
                <CircularProgress size={16} />
              ) : managerCommand === "start_all" ? (
                <PlayArrowIcon fontSize="small" color={managerDisabled ? "disabled" : "primary"} />
              ) : (
                <StopIcon fontSize="small" color={managerDisabled ? "disabled" : "warning"} />
              )}
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

      <Dialog open={managerConfirmOpen} onClose={handleCancelManager} maxWidth="xs">
        <DialogTitle>{managerCommand === "start_all" ? "Start Backend" : "Stop Backend"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {managerCommand === "start_all" ? "Start" : "Stop"} backend modules for{" "}
            <strong>Drone {robot.droneId}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelManager}>Cancel</Button>
          <Button
            onClick={handleConfirmManager}
            color={managerCommand === "start_all" ? "primary" : "warning"}
            disabled={managerDisabled}
            variant="contained"
          >
            {managerCommand === "start_all" ? "Start" : "Stop"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={removeConfirmOpen} onClose={handleCancelRemove} maxWidth="xs">
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

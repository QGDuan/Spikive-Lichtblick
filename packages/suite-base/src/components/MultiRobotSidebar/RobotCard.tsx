// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import CloudOffIcon from "@mui/icons-material/CloudOff";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import StopIcon from "@mui/icons-material/Stop";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
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
import React, { useCallback, useEffect, useRef, useState } from "react";

import { BatteryIndicator } from "@lichtblick/suite-base/spikive/components/DroneStatusIndicators";
import { useManagerCommand } from "@lichtblick/suite-base/spikive/hooks/useManagerCommand";
import { useNowMs } from "@lichtblick/suite-base/spikive/hooks/useNowMs";
import {
  ButtonState,
  ManagerSnapshot,
  SubsystemStatus,
  deriveButtonState,
  useManagerStatusStore,
} from "@lichtblick/suite-base/spikive/stores/useManagerStatusStore";

import { useStyles } from "./RobotCard.style";
import { ConnectionStatus, RobotEntry } from "./types";

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  connecting: "#FFA726",
  connected: "#66BB6A",
  slow: "#FFA726",
  disconnected: "#BDBDBD",
  error: "#EF5350",
};

const SUBSYSTEM_COLOR: Record<SubsystemStatus, string> = {
  0: "#BDBDBD", // not running
  1: "#FFA726", // partial
  2: "#66BB6A", // ready
};

const SUBSYSTEM_OFFLINE_COLOR = "#E0E0E0";

type ConfirmKind = "start" | "stop" | undefined;

type RobotCardProps = {
  robot: RobotEntry;
  onSetActive: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onRemove: (id: string) => void;
};

export const RobotCard = React.memo(function RobotCard({
  robot,
  onSetActive,
  onToggleVisibility,
  onRemove,
}: RobotCardProps): React.JSX.Element {
  const { classes } = useStyles({ isActive: robot.isActive });
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(undefined);
  const [pendingAction, setPendingAction] = useState<"start" | "stop" | undefined>(undefined);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const snap = useManagerStatusStore(
    (s) => s.byDroneId[robot.droneId],
    (prev, next) => {
      // Only re-render if this specific drone's snapshot changed
      if (prev === next) return true;
      if (!prev || !next) return false;
      return (
        prev.isActive === next.isActive &&
        prev.starting === next.starting &&
        prev.armed === next.armed &&
        prev.lastErrorSeq === next.lastErrorSeq &&
        prev.lastUpdateMs === next.lastUpdateMs
      );
    },
  );
  const now = useNowMs();
  const btnState = deriveButtonState(snap, now);
  const isOffline = btnState === "manager-offline" || btnState === "no-data";

  const { sendStartAll, sendShutdownAll } = useManagerCommand(robot.droneId);

  // Clear pending action when operation completes
  useEffect(() => {
    if (!snap) return;

    if (pendingAction === "start" && snap.isActive && !snap.starting) {
      // Start completed successfully
      clearTimeout(pendingTimeoutRef.current);
      setPendingAction(undefined);
    } else if (pendingAction === "stop" && !snap.isActive && !snap.starting) {
      // Stop completed successfully
      clearTimeout(pendingTimeoutRef.current);
      setPendingAction(undefined);
    }
  }, [snap, pendingAction]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearTimeout(pendingTimeoutRef.current);
    };
  }, []);

  const handleSetActive = useCallback(() => {
    onSetActive(robot.id);
  }, [onSetActive, robot.id]);

  const handleToggleVisibility = useCallback(() => {
    onToggleVisibility(robot.id);
  }, [onToggleVisibility, robot.id]);

  const handleRemoveClick = useCallback(() => {
    setConfirmRemoveOpen(true);
  }, []);
  const handleConfirmRemove = useCallback(() => {
    setConfirmRemoveOpen(false);
    onRemove(robot.id);
  }, [onRemove, robot.id]);
  const handleCancelRemove = useCallback(() => {
    setConfirmRemoveOpen(false);
  }, []);

  const handleStartClick = useCallback(() => {
    setConfirmKind(btnState === "stop" ? "stop" : "start");
  }, [btnState]);
  const handleConfirmAction = useCallback(() => {
    if (confirmKind === "start") {
      sendStartAll();
      setPendingAction("start");
      pendingTimeoutRef.current = setTimeout(() => {
        setPendingAction(undefined);
      }, 10000);
    } else if (confirmKind === "stop") {
      sendShutdownAll();
      setPendingAction("stop");
      pendingTimeoutRef.current = setTimeout(() => {
        setPendingAction(undefined);
      }, 10000);
    }
    setConfirmKind(undefined);
  }, [confirmKind, sendStartAll, sendShutdownAll]);
  const handleCancelAction = useCallback(() => {
    setConfirmKind(undefined);
  }, []);

  return (
    <Paper className={classes.card} elevation={0}>
      <div className={classes.header}>
        <Box
          className={classes.statusDot}
          sx={{ backgroundColor: STATUS_COLORS[robot.status] }}
        />
        <Typography className={classes.urlText} title={robot.url}>
          Drone {robot.droneId}
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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}>
        <Typography variant="caption" color="text.secondary" noWrap title={robot.url} sx={{ flex: 1, minWidth: 0 }}>
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

      <SubsystemLights snap={snap} offline={isOffline} classes={classes} />

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
        <StartRestartButton
          state={pendingAction ? "starting" : btnState}
          onClick={handleStartClick}
          className={classes.actionButton}
        />
        <BatteryIndicator />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Remove robot">
          <IconButton className={classes.actionButton} onClick={handleRemoveClick} size="small">
            <DeleteOutlineIcon fontSize="small" color="error" />
          </IconButton>
        </Tooltip>
      </div>

      <Dialog open={confirmRemoveOpen} onClose={handleCancelRemove} maxWidth="xs">
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

      <ManagerActionDialog
        kind={confirmKind}
        droneId={robot.droneId}
        snap={snap}
        onCancel={handleCancelAction}
        onConfirm={handleConfirmAction}
      />
    </Paper>
  );
});

// ---------------------------------------------------------------------------
// Start / Restart button
// ---------------------------------------------------------------------------

function StartRestartButton({
  state,
  onClick,
  className,
}: {
  state: ButtonState;
  onClick: () => void;
  className: string;
}): React.JSX.Element {
  switch (state) {
    case "start":
      return (
        <Tooltip title="启动 Manager（启动 6 个 launch）">
          <IconButton className={className} onClick={onClick} size="small" color="primary">
            <PlayArrowIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      );
    case "stop":
      return (
        <Tooltip title="停止 Manager（关闭全部 launch）">
          <IconButton className={className} onClick={onClick} size="small" color="error">
            <StopIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      );
    case "starting":
      return (
        <Tooltip title="启动中...">
          <span>
            <IconButton className={className} disabled size="small">
              <CircularProgress size={14} />
            </IconButton>
          </span>
        </Tooltip>
      );
    case "disabled-armed":
      return (
        <Tooltip title="飞行中，无法启动/重启">
          <span>
            <IconButton className={className} disabled size="small">
              <FlightTakeoffIcon fontSize="small" sx={{ color: "#EF5350" }} />
            </IconButton>
          </span>
        </Tooltip>
      );
    case "manager-offline":
      return (
        <Tooltip title="Manager 离线（status 已超时）">
          <span>
            <IconButton className={className} disabled size="small">
              <CloudOffIcon fontSize="small" color="error" />
            </IconButton>
          </span>
        </Tooltip>
      );
    case "no-data":
    default:
      return (
        <Tooltip title="未收到 Manager 状态">
          <span>
            <IconButton className={className} disabled size="small">
              <HelpOutlineIcon fontSize="small" color="disabled" />
            </IconButton>
          </span>
        </Tooltip>
      );
  }
}

// ---------------------------------------------------------------------------
// Subsystem lights
// ---------------------------------------------------------------------------

type LightsClasses = ReturnType<typeof useStyles>["classes"];

function SubsystemLights({
  snap,
  offline,
  classes,
}: {
  snap: ManagerSnapshot | undefined;
  offline: boolean;
  classes: LightsClasses;
}): React.JSX.Element {
  const drivers: { key: string; label: string; status: SubsystemStatus }[] = [
    { key: "mavros", label: "MAV", status: snap?.drivers.mavros ?? 0 },
    { key: "lidar", label: "LID", status: snap?.drivers.lidar ?? 0 },
    { key: "cam", label: "CAM", status: snap?.drivers.cam ?? 0 },
  ];
  const algo: { key: string; label: string; status: SubsystemStatus }[] = [
    { key: "slam", label: "SLM", status: snap?.algo.slam ?? 0 },
    { key: "planner", label: "PLN", status: snap?.algo.planner ?? 0 },
  ];

  const renderLight = (item: { key: string; label: string; status: SubsystemStatus }) => (
    <Tooltip
      key={item.key}
      title={`${item.label}: ${
        offline ? "offline" : item.status === 2 ? "ready" : item.status === 1 ? "partial" : "stopped"
      }`}
    >
      <span className={classes.statusLight}>
        <Box
          className={classes.statusLightDot}
          sx={{
            backgroundColor: offline ? SUBSYSTEM_OFFLINE_COLOR : SUBSYSTEM_COLOR[item.status],
          }}
        />
        {item.label}
      </span>
    </Tooltip>
  );

  return (
    <div className={classes.statusLights}>
      <div className={classes.statusLightGroup}>{drivers.map(renderLight)}</div>
      <div className={classes.statusLightDivider} />
      <div className={classes.statusLightGroup}>{algo.map(renderLight)}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation dialog for Start / Restart
// ---------------------------------------------------------------------------

function ManagerActionDialog({
  kind,
  droneId,
  snap,
  onCancel,
  onConfirm,
}: {
  kind: ConfirmKind;
  droneId: string;
  snap: ManagerSnapshot | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}): React.JSX.Element {
  const isStop = kind === "stop";
  const summary = snap
    ? [
        `MavROS: ${labelStatus(snap.drivers.mavros)}`,
        `Lidar: ${labelStatus(snap.drivers.lidar)}`,
        `Camera: ${labelStatus(snap.drivers.cam)}`,
        `SLAM: ${labelStatus(snap.algo.slam)}`,
        `Planner: ${labelStatus(snap.algo.planner)}`,
      ].join(" · ")
    : "未收到状态快照";

  return (
    <Dialog open={kind != undefined} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{isStop ? "停止" : "启动"} Drone {droneId}</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          {isStop
            ? "确认停止全部 launch（驱动 + SLAM + Planner）？所有节点将被关闭。"
            : "确认按依赖顺序启动全部 launch（驱动 + SLAM + Planner）？"}
          <Box sx={{ mt: 1, fontSize: "0.7rem", fontFamily: "monospace", color: "text.secondary" }}>
            {summary}
          </Box>
          <Box sx={{ mt: 1, fontSize: "0.7rem", fontStyle: "italic", color: "#EF5350" }}>
            飞行中（armed）请求会被后端拒绝。
          </Box>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          onClick={onConfirm}
          color={isStop ? "error" : "primary"}
          variant="contained"
          autoFocus
        >
          {isStop ? "Stop" : "Start"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function labelStatus(s: SubsystemStatus): string {
  return s === 2 ? "✓" : s === 1 ? "△" : "—";
}

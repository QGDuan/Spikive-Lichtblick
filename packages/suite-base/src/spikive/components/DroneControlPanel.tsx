// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import FlightLandIcon from "@mui/icons-material/FlightLand";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import HomeIcon from "@mui/icons-material/Home";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import { Button, Divider, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { MessageDefinition } from "@lichtblick/message-definition";
import { ros1 } from "@lichtblick/rosmsg-msgs-common";
import { fromDate } from "@lichtblick/rostime";

import { CONTROL_TOPIC, DRONE_COMMANDS, droneTopics } from "@lichtblick/suite-base/spikive/config/topicConfig";
import { useWaypointStore } from "@lichtblick/suite-base/spikive/stores/useWaypointStore";

import { LoadProjectDialog } from "./LoadProjectDialog";

// ---------------------------------------------------------------------------
// ROS1 message schemas
// ---------------------------------------------------------------------------
const ControlCmdDatatypes = new Map<string, MessageDefinition>([
  ["std_msgs/Header", ros1["std_msgs/Header"]],
  [
    "controller_msgs/cmd",
    {
      name: "controller_msgs/cmd",
      definitions: [
        { type: "std_msgs/Header", name: "header", isComplex: true, isArray: false },
        { type: "uint8", name: "cmd", isComplex: false, isArray: false },
      ],
    },
  ],
]);

const EmptyDatatypes = new Map<string, MessageDefinition>([
  ["std_msgs/Empty", ros1["std_msgs/Empty"]],
]);

const StringDatatypes = new Map<string, MessageDefinition>([
  ["std_msgs/String", ros1["std_msgs/String"]],
]);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: theme.spacing(0.5),
  },
  stopButton: {
    gridColumn: "1 / -1",
  },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
type DroneControlPanelProps = {
  droneId: string;
  onClickPublish: () => void;
  publishActive: boolean;
  canPublish: boolean;
  publish?: (topic: string, message: unknown) => void;
  advertise?: (topic: string, schemaName: string, options?: { datatypes: Map<string, MessageDefinition> }) => void;
  unadvertise?: (topic: string) => void;
  dataSourceProfile?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function DroneControlPanel({
  droneId,
  onClickPublish,
  publishActive,
  canPublish,
  publish,
  advertise,
  unadvertise,
}: DroneControlPanelProps): React.JSX.Element {
  const { classes } = useStyles();
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  const topics = useMemo(() => droneTopics(droneId), [droneId]);

  // Read execution state and project list from store
  const execState = useWaypointStore((s) => s.execStates[droneId] ?? "idle");
  const projectList = useWaypointStore((s) => s.projectLists[droneId] ?? []);
  const isExecuting = execState === "executing";

  // Advertise topics on mount, unadvertise on unmount
  const advertised = useRef(false);
  useEffect(() => {
    advertise?.(CONTROL_TOPIC, "controller_msgs/cmd", { datatypes: ControlCmdDatatypes });
    advertise?.(topics.loadWaypoints, "std_msgs/String", { datatypes: StringDatatypes });
    advertise?.(topics.stopWaypointExec, "std_msgs/Empty", { datatypes: EmptyDatatypes });
    advertised.current = true;
    return () => {
      unadvertise?.(CONTROL_TOPIC);
      unadvertise?.(topics.loadWaypoints);
      unadvertise?.(topics.stopWaypointExec);
      advertised.current = false;
    };
  }, [advertise, unadvertise, topics]);

  const sendCommand = useCallback(
    (cmd: number) => {
      if (!publish) {
        return;
      }
      const stamp = fromDate(new Date());
      publish(CONTROL_TOPIC, {
        header: { stamp, frame_id: "" },
        cmd,
      });
    },
    [publish],
  );

  // Stop button: send cmd=5 to flight controller AND stop waypoint execution
  const handleAbort = useCallback(() => {
    sendCommand(DRONE_COMMANDS.STOP);
    if (publish && advertised.current) {
      publish(topics.stopWaypointExec, {});
    }
  }, [sendCommand, publish, topics]);

  const handleLoad = useCallback(
    (name: string) => {
      if (!publish || !advertised.current) {
        return;
      }
      publish(topics.loadWaypoints, { data: name });
    },
    [publish, topics],
  );

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <GpsFixedIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">Drone {droneId}</Typography>
      </div>

      <div className={classes.grid}>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<FlightTakeoffIcon />}
          onClick={() => { sendCommand(DRONE_COMMANDS.TAKEOFF); }}
        >
          Takeoff
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={<FlightLandIcon />}
          onClick={() => { sendCommand(DRONE_COMMANDS.LAND); }}
        >
          Land
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={<HomeIcon />}
          onClick={() => { sendCommand(DRONE_COMMANDS.RETURN); }}
        >
          Return
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={<PlayArrowIcon />}
          onClick={() => { sendCommand(DRONE_COMMANDS.CONTINUE); }}
        >
          Continue
        </Button>
        <Button
          className={classes.stopButton}
          size="small"
          variant="contained"
          color="error"
          startIcon={<StopIcon />}
          onClick={handleAbort}
        >
          Stop
        </Button>
      </div>

      <Divider />
      <Button
        size="small"
        variant="outlined"
        startIcon={<FolderOpenIcon />}
        onClick={() => { setLoadDialogOpen(true); }}
        disabled={isExecuting}
        fullWidth
      >
        Load Path
      </Button>

      {canPublish && (
        <>
          <Divider />
          <Button
            size="small"
            variant={publishActive ? "contained" : "outlined"}
            color="info"
            onClick={onClickPublish}
            disabled={isExecuting}
          >
            {publishActive ? "Cancel Publish" : "Publish Pose"}
          </Button>
        </>
      )}

      <LoadProjectDialog
        open={loadDialogOpen}
        onClose={() => { setLoadDialogOpen(false); }}
        onLoad={handleLoad}
        projectList={projectList}
      />
    </div>
  );
}

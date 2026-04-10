// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import FlightLandIcon from "@mui/icons-material/FlightLand";
import HomeIcon from "@mui/icons-material/Home";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import { Button, Divider, Typography } from "@mui/material";
import { useCallback, useEffect } from "react";
import { makeStyles } from "tss-react/mui";

import { MessageDefinition } from "@lichtblick/message-definition";
import { ros1 } from "@lichtblick/rosmsg-msgs-common";
import { fromDate } from "@lichtblick/rostime";

import { CONTROL_TOPIC, DRONE_COMMANDS } from "@lichtblick/suite-base/spikive/config/topicConfig";

// ---------------------------------------------------------------------------
// ROS1 message schema for controller_msgs/cmd
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

  // Advertise /control on mount, unadvertise on unmount
  useEffect(() => {
    advertise?.(CONTROL_TOPIC, "controller_msgs/cmd", { datatypes: ControlCmdDatatypes });
    return () => {
      unadvertise?.(CONTROL_TOPIC);
    };
  }, [advertise, unadvertise]);

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
          onClick={() => { sendCommand(DRONE_COMMANDS.STOP); }}
        >
          Stop
        </Button>
      </div>

      {canPublish && (
        <>
          <Divider />
          <Button
            size="small"
            variant={publishActive ? "contained" : "outlined"}
            color="info"
            onClick={onClickPublish}
          >
            {publishActive ? "Cancel Publish" : "Publish Pose"}
          </Button>
        </>
      )}
    </div>
  );
}

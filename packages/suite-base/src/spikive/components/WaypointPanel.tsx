// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import ClearAllIcon from "@mui/icons-material/ClearAll";
import DeleteIcon from "@mui/icons-material/Delete";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControlLabel,
  IconButton,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { MessageDefinition } from "@lichtblick/message-definition";
import { ros1 } from "@lichtblick/rosmsg-msgs-common";
import {
  applyZ,
  ZMode,
  useWaypointStore,
} from "@lichtblick/suite-base/spikive/stores/useWaypointStore";
import { DEFAULT_DRONE_ID } from "@lichtblick/suite-base/spikive/config/topicConfig";

const POSE_TOPIC = "/add_waypoint";
const REMOVE_TOPIC = "/remove_waypoint";
const CLEAR_TOPIC = "/clear_waypoints";

/** Minimal datatypes required for geometry_msgs/PoseStamped over ROS1. */
const PoseStampedDatatypes = new Map<string, MessageDefinition>(
  (
    [
      "geometry_msgs/Point",
      "geometry_msgs/Pose",
      "geometry_msgs/PoseStamped",
      "geometry_msgs/Quaternion",
      "std_msgs/Header",
    ] as Array<keyof typeof ros1>
  ).map((type) => [type, ros1[type]]),
);

const Int32Datatypes = new Map<string, MessageDefinition>([
  ["std_msgs/Int32", ros1["std_msgs/Int32"]],
]);

const EmptyDatatypes = new Map<string, MessageDefinition>([
  ["std_msgs/Empty", ros1["std_msgs/Empty"]],
]);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5),
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  buttonRow: {
    display: "flex",
    gap: theme.spacing(0.5),
  },
  zRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  zInput: {
    width: 64,
  },
  tableContainer: {
    overflow: "auto",
  },
  cell: {
    padding: "2px 4px",
    fontSize: "0.7rem",
    fontFamily: "monospace",
  },
  headerCell: {
    padding: "2px 4px",
    fontSize: "0.7rem",
    fontWeight: 600,
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
type WaypointPanelProps = {
  droneId: string;
  publish?: (topic: string, message: unknown) => void;
  advertise?: (
    topic: string,
    schemaName: string,
    options?: { datatypes: Map<string, MessageDefinition> },
  ) => void;
  unadvertise?: (topic: string) => void;
};

export function WaypointPanel({
  droneId,
  publish,
  advertise,
  unadvertise,
}: WaypointPanelProps): React.JSX.Element {
  const { classes } = useStyles();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Read latest odom position from the store (pushed by ThreeDeeRender)
  const pos = useWaypointStore((s) => s.latestOdom[droneId]);

  // Waypoint list comes from /waypoint_markers which is global (not drone-prefixed),
  // so always read from DEFAULT_DRONE_ID regardless of which drone is active.
  const waypointList = useWaypointStore((s) => s.tables[DEFAULT_DRONE_ID]?.waypoints ?? []);

  // Z-settings are per active drone
  const droneState = useWaypointStore((s) => s.tables[droneId]);
  const updateZSettings = useWaypointStore((s) => s.updateZSettings);
  const getOrCreate = useWaypointStore((s) => s.getOrCreate);

  // Ensure both the drone table and the global waypoint table exist
  useEffect(() => {
    getOrCreate(droneId);
    getOrCreate(DEFAULT_DRONE_ID);
  }, [droneId, getOrCreate]);

  // Advertise topics on mount
  const advertised = useRef(false);
  useEffect(() => {
    if (!advertise) {
      return;
    }
    advertise(POSE_TOPIC, "geometry_msgs/PoseStamped", { datatypes: PoseStampedDatatypes });
    advertise(REMOVE_TOPIC, "std_msgs/Int32", { datatypes: Int32Datatypes });
    advertise(CLEAR_TOPIC, "std_msgs/Empty", { datatypes: EmptyDatatypes });
    advertised.current = true;
    return () => {
      unadvertise?.(POSE_TOPIC);
      unadvertise?.(REMOVE_TOPIC);
      unadvertise?.(CLEAR_TOPIC);
      advertised.current = false;
    };
  }, [advertise, unadvertise]);

  const state = droneState ?? {
    waypoints: [],
    zMode: "none" as const,
    overrideZValue: 1.5,
  };

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleRecord = useCallback(() => {
    if (!pos || !publish || !advertised.current) {
      return;
    }
    const adjustedZ = applyZ(pos.z, state);
    const time = { sec: Math.floor(Date.now() / 1000), nsec: 0 };
    publish(POSE_TOPIC, {
      header: { stamp: time, frame_id: "world" },
      pose: {
        position: { x: pos.x, y: pos.y, z: adjustedZ },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
    });
  }, [pos, publish, state]);

  const handleRemove = useCallback(
    (idx: number) => {
      if (!publish || !advertised.current) {
        return;
      }
      publish(REMOVE_TOPIC, { data: idx });
    },
    [publish],
  );

  const handleClearConfirm = useCallback(() => {
    if (!publish || !advertised.current) {
      return;
    }
    publish(CLEAR_TOPIC, {});
    setClearDialogOpen(false);
  }, [publish]);

  const handleZModeChange = useCallback(
    (_e: React.ChangeEvent<HTMLInputElement>, value: string) => {
      updateZSettings(droneId, { zMode: value as ZMode });
    },
    [droneId, updateZSettings],
  );

  const handleOverrideZValue = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        updateZSettings(droneId, { overrideZValue: val });
      }
    },
    [droneId, updateZSettings],
  );

  return (
    <div className={classes.root}>
      {/* Header */}
      <div className={classes.header}>
        <GpsFixedIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">Drone {droneId}</Typography>
        {pos && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ ml: "auto", fontFamily: "monospace", fontSize: "0.6rem" }}
          >
            {pos.x.toFixed(2)}, {pos.y.toFixed(2)}, {pos.z.toFixed(2)}
          </Typography>
        )}
      </div>

      {/* Record */}
      <div className={classes.buttonRow}>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={handleRecord}
          disabled={!pos || !publish}
          sx={{ flex: 1 }}
        >
          Record
        </Button>
      </div>

      {/* Z mode: Raw Z or Override */}
      <RadioGroup row value={state.zMode} onChange={handleZModeChange}>
        <FormControlLabel
          value="none"
          control={<Radio size="small" />}
          label={<Typography variant="caption">Raw Z</Typography>}
          sx={{ mr: 0.5 }}
        />
        <div className={classes.zRow}>
          <FormControlLabel
            value="override"
            control={<Radio size="small" />}
            label={<Typography variant="caption">Override</Typography>}
            sx={{ mr: 0.5 }}
          />
          <TextField
            className={classes.zInput}
            size="small"
            type="number"
            value={state.overrideZValue}
            onChange={handleOverrideZValue}
            disabled={state.zMode !== "override"}
            inputProps={{ step: 0.1 }}
            variant="outlined"
          />
        </div>
      </RadioGroup>

      {/* Waypoint Table */}
      {waypointList.length > 0 && (
        <TableContainer className={classes.tableContainer}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell className={classes.headerCell}>#</TableCell>
                <TableCell className={classes.headerCell}>X</TableCell>
                <TableCell className={classes.headerCell}>Y</TableCell>
                <TableCell className={classes.headerCell}>Z</TableCell>
                <TableCell className={classes.headerCell} sx={{ p: 0 }}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => { setClearDialogOpen(true); }}
                    disabled={!publish}
                    sx={{ p: 0 }}
                  >
                    <ClearAllIcon sx={{ fontSize: "0.95rem" }} />
                  </IconButton>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {waypointList.map((wp) => (
                <TableRow key={wp.idx} hover>
                  <TableCell className={classes.cell}>{wp.idx}</TableCell>
                  <TableCell className={classes.cell}>{wp.x}</TableCell>
                  <TableCell className={classes.cell}>{wp.y}</TableCell>
                  <TableCell className={classes.cell}>{wp.z}</TableCell>
                  <TableCell className={classes.cell} sx={{ p: 0 }}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => { handleRemove(wp.idx); }}
                      disabled={!publish}
                      sx={{ p: 0 }}
                    >
                      <DeleteIcon sx={{ fontSize: "0.85rem" }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Clear confirmation dialog */}
      <Dialog open={clearDialogOpen} onClose={() => { setClearDialogOpen(false); }}>
        <DialogContent>
          <DialogContentText>
            Clear all {waypointList.length} waypoints?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setClearDialogOpen(false); }}>Cancel</Button>
          <Button onClick={handleClearConfirm} color="error" variant="contained">
            Clear
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Button,
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
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef } from "react";
import { makeStyles } from "tss-react/mui";

import { MessageDefinition } from "@lichtblick/message-definition";
import {
  WaypointMarkerDatatypes,
  makeWaypointMarkerArray,
} from "@lichtblick/suite-base/panels/ThreeDeeRender/publish";
import { ZMode, useWaypointStore } from "@lichtblick/suite-base/spikive/stores/useWaypointStore";

const WAYPOINT_MARKERS_TOPIC = "/waypoint_markers";

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
    maxHeight: 120,
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

  // Read latest odom position from the store (pushed by ThreeDeeRender)
  const pos = useWaypointStore((s) => s.latestOdom[droneId]);

  const droneState = useWaypointStore((s) => s.tables[droneId]);
  const addWaypoint = useWaypointStore((s) => s.addWaypoint);
  const removeWaypoint = useWaypointStore((s) => s.removeWaypoint);
  const deleteLast = useWaypointStore((s) => s.deleteLast);
  const clearWaypoints = useWaypointStore((s) => s.clearWaypoints);
  const updateZSettings = useWaypointStore((s) => s.updateZSettings);
  const getOrCreate = useWaypointStore((s) => s.getOrCreate);

  // Ensure the drone table exists in the store on mount
  useEffect(() => {
    getOrCreate(droneId);
  }, [droneId, getOrCreate]);

  const state = droneState ?? {
    waypoints: [],
    zMode: "none" as const,
    overrideZValue: 1.5,
    zOffsetValue: 0.0,
  };

  // ------------------------------------------------------------------
  // Marker publishing
  // ------------------------------------------------------------------
  const advertised = useRef(false);

  useEffect(() => {
    if (!advertise) {
      return;
    }
    advertise(WAYPOINT_MARKERS_TOPIC, "visualization_msgs/MarkerArray", {
      datatypes: WaypointMarkerDatatypes,
    });
    advertised.current = true;
    return () => {
      unadvertise?.(WAYPOINT_MARKERS_TOPIC);
      advertised.current = false;
    };
  }, [advertise, unadvertise]);

  // Re-publish markers whenever waypoints change
  useEffect(() => {
    if (!publish || !advertised.current) {
      return;
    }
    const msg = makeWaypointMarkerArray(state.waypoints, "world");
    publish(WAYPOINT_MARKERS_TOPIC, msg);
  }, [publish, state.waypoints]);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleRecord = useCallback(() => {
    if (!pos) {
      return;
    }
    addWaypoint(droneId, pos.x, pos.y, pos.z);
  }, [pos, droneId, addWaypoint]);

  const handleDeleteLast = useCallback(() => {
    deleteLast(droneId);
  }, [droneId, deleteLast]);

  const handleClearAll = useCallback(() => {
    clearWaypoints(droneId);
  }, [droneId, clearWaypoints]);

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

  const handleZOffsetValue = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        updateZSettings(droneId, { zOffsetValue: val });
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

      {/* Record + Delete Last + Clear All */}
      <div className={classes.buttonRow}>
        <Button
          size="small"
          variant="contained"
          color="primary"
          onClick={handleRecord}
          disabled={!pos}
          sx={{ flex: 1 }}
        >
          Record
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={handleDeleteLast}
          disabled={state.waypoints.length === 0}
        >
          Del Last
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          onClick={handleClearAll}
          disabled={state.waypoints.length === 0}
        >
          Clear
        </Button>
      </div>

      {/* Z mode: mutually exclusive radio */}
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
        <div className={classes.zRow}>
          <FormControlLabel
            value="offset"
            control={<Radio size="small" />}
            label={<Typography variant="caption">Offset</Typography>}
            sx={{ mr: 0.5 }}
          />
          <TextField
            className={classes.zInput}
            size="small"
            type="number"
            value={state.zOffsetValue}
            onChange={handleZOffsetValue}
            disabled={state.zMode !== "offset"}
            inputProps={{ step: 0.1 }}
            variant="outlined"
          />
        </div>
      </RadioGroup>

      {/* Waypoint Table */}
      {state.waypoints.length > 0 && (
        <TableContainer className={classes.tableContainer}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell className={classes.headerCell}>#</TableCell>
                <TableCell className={classes.headerCell}>X</TableCell>
                <TableCell className={classes.headerCell}>Y</TableCell>
                <TableCell className={classes.headerCell}>Z</TableCell>
                <TableCell className={classes.headerCell} padding="none" />
              </TableRow>
            </TableHead>
            <TableBody>
              {state.waypoints.map((wp) => (
                <TableRow key={wp.idx} hover>
                  <TableCell className={classes.cell}>{wp.idx}</TableCell>
                  <TableCell className={classes.cell}>{wp.x}</TableCell>
                  <TableCell className={classes.cell}>{wp.y}</TableCell>
                  <TableCell className={classes.cell}>{wp.z}</TableCell>
                  <TableCell className={classes.cell} padding="none">
                    <Tooltip title="Remove">
                      <IconButton
                        size="small"
                        onClick={() => {
                          removeWaypoint(droneId, wp.idx);
                        }}
                        sx={{ padding: "1px" }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}

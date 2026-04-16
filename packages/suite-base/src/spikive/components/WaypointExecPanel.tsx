// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import ClearAllIcon from "@mui/icons-material/ClearAll";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RouteIcon from "@mui/icons-material/Route";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { MessageDefinition } from "@lichtblick/message-definition";
import { ros1 } from "@lichtblick/rosmsg-msgs-common";
import { droneTopics } from "@lichtblick/suite-base/spikive/config/topicConfig";
import { useWaypointStore } from "@lichtblick/suite-base/spikive/stores/useWaypointStore";

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
// Props
// ---------------------------------------------------------------------------
type WaypointExecPanelProps = {
  droneId: string;
  publish?: (topic: string, message: unknown) => void;
  advertise?: (
    topic: string,
    schemaName: string,
    options?: { datatypes: Map<string, MessageDefinition> },
  ) => void;
  unadvertise?: (topic: string) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function WaypointExecPanel({
  droneId,
  publish,
  advertise,
  unadvertise,
}: WaypointExecPanelProps): React.JSX.Element {
  const { classes } = useStyles();
  const [execDialogOpen, setExecDialogOpen] = useState(false);

  const topics = useMemo(() => droneTopics(droneId), [droneId]);
  const waypointList = useWaypointStore((s) => s.tables[droneId]?.waypoints ?? []);
  const execState = useWaypointStore((s) => s.execStates[droneId] ?? "idle");
  const isExecuting = execState === "executing";

  // Advertise execution topics on mount
  const advertised = useRef(false);
  useEffect(() => {
    if (!advertise) {
      return;
    }
    advertise(topics.startWaypointExec, "std_msgs/Empty", { datatypes: EmptyDatatypes });
    advertise(topics.stopWaypointExec, "std_msgs/Empty", { datatypes: EmptyDatatypes });
    advertise(topics.clearWaypoints, "std_msgs/Empty", { datatypes: EmptyDatatypes });
    advertised.current = true;
    return () => {
      unadvertise?.(topics.startWaypointExec);
      unadvertise?.(topics.stopWaypointExec);
      unadvertise?.(topics.clearWaypoints);
      advertised.current = false;
    };
  }, [advertise, unadvertise, topics]);

  const handleExecuteConfirm = useCallback(() => {
    if (!publish || !advertised.current) {
      return;
    }
    publish(topics.startWaypointExec, {});
    setExecDialogOpen(false);
  }, [publish, topics]);

  const handleClear = useCallback(() => {
    if (!publish || !advertised.current) {
      return;
    }
    publish(topics.clearWaypoints, {});
  }, [publish, topics]);

  return (
    <div className={classes.root}>
      <Divider />

      <div className={classes.header}>
        <RouteIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2">Waypoint Path</Typography>
        <Typography
          variant="caption"
          color={isExecuting ? "success.main" : "text.secondary"}
          sx={{ ml: "auto", fontFamily: "monospace", fontSize: "0.6rem" }}
        >
          {isExecuting ? "EXECUTING" : `${waypointList.length} pts`}
        </Typography>
      </div>

      {/* Read-only waypoint table */}
      <TableContainer className={classes.tableContainer}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell className={classes.headerCell}>#</TableCell>
              <TableCell className={classes.headerCell}>X</TableCell>
              <TableCell className={classes.headerCell}>Y</TableCell>
              <TableCell className={classes.headerCell}>Z</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {waypointList.map((wp) => (
              <TableRow key={`wp-${wp.idx}`} hover>
                <TableCell className={classes.cell}>{wp.idx}</TableCell>
                <TableCell className={classes.cell}>{wp.x}</TableCell>
                <TableCell className={classes.cell}>{wp.y}</TableCell>
                <TableCell className={classes.cell}>{wp.z}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Execute / Clear buttons */}
      <div className={classes.buttonRow}>
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<PlayArrowIcon />}
          onClick={() => { setExecDialogOpen(true); }}
          disabled={isExecuting || !publish}
          sx={{ flex: 1 }}
        >
          Execute
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="error"
          startIcon={<ClearAllIcon />}
          onClick={handleClear}
          disabled={isExecuting || !publish}
          sx={{ flex: 1 }}
        >
          Clear
        </Button>
      </div>

      {/* Execute confirmation dialog */}
      <Dialog open={execDialogOpen} onClose={() => { setExecDialogOpen(false); }}>
        <DialogContent>
          <DialogContentText>
            Navigate drone {droneId} through {waypointList.length} waypoints?
            Ensure the drone is airborne.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setExecDialogOpen(false); }}>Cancel</Button>
          <Button onClick={handleExecuteConfirm} color="success" variant="contained">
            Execute
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

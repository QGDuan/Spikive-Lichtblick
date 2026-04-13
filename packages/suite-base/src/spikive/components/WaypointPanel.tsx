// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import AddIcon from "@mui/icons-material/Add";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import SaveIcon from "@mui/icons-material/Save";
import SettingsIcon from "@mui/icons-material/Settings";
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
  Tooltip,
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
import { DEFAULT_DRONE_ID, PROJECT_TOPICS } from "@lichtblick/suite-base/spikive/config/topicConfig";

import { SaveProjectDialog } from "./SaveProjectDialog";
import { LoadProjectDialog } from "./LoadProjectDialog";
import { ManageProjectsDialog } from "./ManageProjectsDialog";

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
  dragHandle: {
    cursor: "grab",
    opacity: 0.4,
    display: "flex",
    alignItems: "center",
    "&:hover": { opacity: 1 },
  },
  draggingRow: {
    opacity: 0.3,
  },
  dropAbove: {
    borderTop: `2px solid ${theme.palette.primary.main}`,
  },
  dropBelow: {
    borderBottom: `2px solid ${theme.palette.primary.main}`,
  },
}));

// ---------------------------------------------------------------------------
// Draggable row using native HTML5 Drag and Drop
// ---------------------------------------------------------------------------
type DraggableWaypointRowProps = {
  wp: { idx: number; x: number; y: number; z: number };
  index: number;
  dragIndex: number | undefined;
  dropTarget: { index: number; position: "above" | "below" } | undefined;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onRemove: (idx: number) => void;
  disabled: boolean;
  classes: ReturnType<typeof useStyles>["classes"];
};

function DraggableWaypointRow({
  wp,
  index,
  dragIndex,
  dropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
  disabled,
  classes,
}: DraggableWaypointRowProps): React.JSX.Element {
  const isDragging = dragIndex === index;
  const isDropAbove = dropTarget?.index === index && dropTarget.position === "above";
  const isDropBelow = dropTarget?.index === index && dropTarget.position === "below";

  return (
    <TableRow
      hover
      draggable
      onDragStart={() => { onDragStart(index); }}
      onDragOver={(e) => { onDragOver(e, index); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`${isDragging ? classes.draggingRow : ""} ${isDropAbove ? classes.dropAbove : ""} ${isDropBelow ? classes.dropBelow : ""}`}
    >
      <TableCell className={classes.cell} sx={{ p: 0, width: 20 }}>
        <span className={classes.dragHandle}>
          <DragIndicatorIcon sx={{ fontSize: "0.85rem" }} />
        </span>
      </TableCell>
      <TableCell className={classes.cell}>{wp.idx}</TableCell>
      <TableCell className={classes.cell}>{wp.x}</TableCell>
      <TableCell className={classes.cell}>{wp.y}</TableCell>
      <TableCell className={classes.cell}>{wp.z}</TableCell>
      <TableCell className={classes.cell} sx={{ p: 0 }}>
        <IconButton
          size="small"
          color="error"
          onClick={() => { onRemove(wp.idx); }}
          disabled={disabled}
          sx={{ p: 0 }}
        >
          <DeleteIcon sx={{ fontSize: "0.85rem" }} />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Main Component
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
  const [newRouteDialogOpen, setNewRouteDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);

  // Native DnD state
  const [dragIndex, setDragIndex] = useState<number | undefined>(undefined);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: "above" | "below" } | undefined>(undefined);

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
    advertise(PROJECT_TOPICS.saveWaypoints, "std_msgs/String", { datatypes: StringDatatypes });
    advertise(PROJECT_TOPICS.loadWaypoints, "std_msgs/String", { datatypes: StringDatatypes });
    advertise(PROJECT_TOPICS.deleteProject, "std_msgs/String", { datatypes: StringDatatypes });
    advertise(PROJECT_TOPICS.reorderWaypoints, "std_msgs/String", { datatypes: StringDatatypes });
    advertised.current = true;
    return () => {
      unadvertise?.(POSE_TOPIC);
      unadvertise?.(REMOVE_TOPIC);
      unadvertise?.(CLEAR_TOPIC);
      unadvertise?.(PROJECT_TOPICS.saveWaypoints);
      unadvertise?.(PROJECT_TOPICS.loadWaypoints);
      unadvertise?.(PROJECT_TOPICS.deleteProject);
      unadvertise?.(PROJECT_TOPICS.reorderWaypoints);
      advertised.current = false;
    };
  }, [advertise, unadvertise]);

  const state = droneState ?? {
    waypoints: [],
    zMode: "none" as const,
    overrideZValue: 1.5,
  };

  // ------------------------------------------------------------------
  // Handlers — existing
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

  // ------------------------------------------------------------------
  // Handlers — project management
  // ------------------------------------------------------------------
  const handleSave = useCallback(
    (name: string) => {
      if (!publish || !advertised.current) {
        return;
      }
      publish(PROJECT_TOPICS.saveWaypoints, { data: name });
    },
    [publish],
  );

  const handleLoad = useCallback(
    (name: string) => {
      if (!publish || !advertised.current) {
        return;
      }
      publish(PROJECT_TOPICS.loadWaypoints, { data: name });
    },
    [publish],
  );

  const handleDeleteProject = useCallback(
    (names: string) => {
      if (!publish || !advertised.current) {
        return;
      }
      publish(PROJECT_TOPICS.deleteProject, { data: names });
    },
    [publish],
  );

  const handleNewRouteConfirm = useCallback(() => {
    if (!publish || !advertised.current) {
      return;
    }
    publish(CLEAR_TOPIC, {});
    setNewRouteDialogOpen(false);
  }, [publish]);

  // ------------------------------------------------------------------
  // Handlers — native HTML5 drag reorder
  // ------------------------------------------------------------------
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? "above" : "below";
    setDropTarget({ index, position });
  }, []);

  const handleDrop = useCallback(() => {
    if (dragIndex == undefined || dropTarget == undefined || !publish || !advertised.current) {
      setDragIndex(undefined);
      setDropTarget(undefined);
      return;
    }

    const fromIdx = dragIndex;
    let toIdx = dropTarget.position === "above" ? dropTarget.index : dropTarget.index + 1;
    if (fromIdx < toIdx) {
      toIdx -= 1;
    }

    if (fromIdx !== toIdx && waypointList.length > 1) {
      // Build new order: original 1-based indices in new sequence
      const indices = waypointList.map((_, i) => i);
      const [moved] = indices.splice(fromIdx, 1);
      indices.splice(toIdx, 0, moved!);
      const order = indices.map((origIdx) => waypointList[origIdx]!.idx);
      publish(PROJECT_TOPICS.reorderWaypoints, {
        data: JSON.stringify({ order }),
      });
    }

    setDragIndex(undefined);
    setDropTarget(undefined);
  }, [dragIndex, dropTarget, publish, waypointList]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(undefined);
    setDropTarget(undefined);
  }, []);

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

      {/* Load / New / Manage buttons */}
      <div className={classes.buttonRow}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FolderOpenIcon />}
          onClick={() => { setLoadDialogOpen(true); }}
          sx={{ flex: 1 }}
        >
          Load
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => { setNewRouteDialogOpen(true); }}
          sx={{ flex: 1 }}
        >
          New
        </Button>
        <Tooltip title="Manage saved projects">
          <Button
            size="small"
            variant="outlined"
            onClick={() => { setManageDialogOpen(true); }}
            sx={{ minWidth: 0, px: 1 }}
          >
            <SettingsIcon fontSize="small" />
          </Button>
        </Tooltip>
      </div>

      {/* Waypoint Table (draggable via native HTML5 DnD) */}
      {waypointList.length > 0 && (
        <TableContainer className={classes.tableContainer}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell className={classes.headerCell} sx={{ p: 0, width: 20 }} />
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
              {waypointList.map((wp, index) => (
                <DraggableWaypointRow
                  key={`wp-${wp.idx}`}
                  wp={wp}
                  index={index}
                  dragIndex={dragIndex}
                  dropTarget={dropTarget}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onRemove={handleRemove}
                  disabled={!publish}
                  classes={classes}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Save button */}
      {waypointList.length > 0 && (
        <Button
          size="small"
          variant="contained"
          color="success"
          startIcon={<SaveIcon />}
          onClick={() => { setSaveDialogOpen(true); }}
          disabled={!publish}
          fullWidth
        >
          Save Project
        </Button>
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

      {/* New route confirmation dialog */}
      <Dialog open={newRouteDialogOpen} onClose={() => { setNewRouteDialogOpen(false); }}>
        <DialogContent>
          <DialogContentText>
            {waypointList.length > 0
              ? `Current route has ${waypointList.length} waypoints. Start a new route? Unsaved data will be lost.`
              : "Start a new route?"}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setNewRouteDialogOpen(false); }}>Cancel</Button>
          <Button onClick={handleNewRouteConfirm} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <SaveProjectDialog
        open={saveDialogOpen}
        onClose={() => { setSaveDialogOpen(false); }}
        onSave={handleSave}
      />
      <LoadProjectDialog
        open={loadDialogOpen}
        onClose={() => { setLoadDialogOpen(false); }}
        onLoad={handleLoad}
      />
      <ManageProjectsDialog
        open={manageDialogOpen}
        onClose={() => { setManageDialogOpen(false); }}
        onDelete={handleDeleteProject}
      />
    </div>
  );
}

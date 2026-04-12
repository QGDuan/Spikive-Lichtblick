// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import FlightIcon from "@mui/icons-material/Flight";
import MapIcon from "@mui/icons-material/Map";
import {
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { useCallback } from "react";
import { makeStyles } from "tss-react/mui";

import {
  SceneMode,
  useSceneModeStore,
} from "@lichtblick/suite-base/spikive/stores/useSceneModeStore";

const useStyles = makeStyles()((theme) => ({
  content: {
    display: "flex",
    gap: theme.spacing(3),
    justifyContent: "center",
    padding: theme.spacing(4),
  },
  card: {
    width: 240,
    textAlign: "center",
  },
  icon: {
    fontSize: 64,
    marginBottom: theme.spacing(1),
  },
}));

export function SceneSelectionDialog(): React.JSX.Element {
  const { classes } = useStyles();
  const sceneMode = useSceneModeStore((s) => s.sceneMode);
  const setSceneMode = useSceneModeStore((s) => s.setSceneMode);

  const handleSelect = useCallback(
    (mode: SceneMode) => {
      setSceneMode(mode);
    },
    [setSceneMode],
  );

  return (
    <Dialog
      open={sceneMode == undefined}
      disableEscapeKeyDown
      maxWidth="md"
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ textAlign: "center" }}>Select Scene Mode</DialogTitle>
      <DialogContent className={classes.content}>
        <Card className={classes.card} variant="outlined">
          <CardActionArea
            onClick={() => {
              handleSelect("autonomous-flight");
            }}
          >
            <CardContent>
              <FlightIcon className={classes.icon} color="primary" />
              <Typography variant="h6">Autonomous Flight</Typography>
              <Typography variant="body2" color="text.secondary">
                自主飞行
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
        <Card className={classes.card} variant="outlined">
          <CardActionArea
            onClick={() => {
              handleSelect("mapping-waypoint");
            }}
          >
            <CardContent>
              <MapIcon className={classes.icon} color="primary" />
              <Typography variant="h6">Mapping & Waypoints</Typography>
              <Typography variant="body2" color="text.secondary">
                建图打点
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

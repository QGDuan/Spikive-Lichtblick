// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { Rocket24Regular, Settings24Regular } from "@fluentui/react-icons";
import { IconButton, Tooltip, Typography } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import { SpikiveSettingsDialog } from "@lichtblick/suite-base/spikive/components/SpikiveSettingsDialog";

const SPIKIVE_TITLEBAR_HEIGHT = 32;

const useStyles = makeStyles()((theme) => ({
  root: {
    height: SPIKIVE_TITLEBAR_HEIGHT,
    minHeight: SPIKIVE_TITLEBAR_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 12,
    paddingRight: 12,
    backgroundColor: theme.palette.appBar.main,
    color: theme.palette.appBar.text,
    WebkitAppRegion: "drag" as const,
    userSelect: "none",
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    fontSize: 16,
    display: "flex",
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: 0.3,
    lineHeight: 1,
  },
  right: {
    display: "flex",
    alignItems: "center",
    WebkitAppRegion: "no-drag" as const,
  },
}));

export function SpikiveTitleBar(): React.JSX.Element {
  const { classes } = useStyles();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className={classes.root}>
      <div className={classes.left}>
        <span className={classes.icon}>
          <Rocket24Regular />
        </span>
        <Typography className={classes.title} color="inherit">
          Spikive 机器人控制地面站
        </Typography>
      </div>
      <div className={classes.right}>
        <Tooltip title="设置">
          <IconButton size="small" color="inherit" onClick={() => setSettingsOpen(true)}>
            <Settings24Regular />
          </IconButton>
        </Tooltip>
      </div>
      {settingsOpen && (
        <SpikiveSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

export { SPIKIVE_TITLEBAR_HEIGHT };

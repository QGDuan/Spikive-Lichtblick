// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles<{ isActive: boolean }>()((theme, { isActive }) => ({
  card: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    border: `1.5px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: isActive ? theme.palette.primary.main + "08" : theme.palette.background.paper,
    transition: "border-color 0.2s, background-color 0.2s",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(0.75),
  },
  urlText: {
    fontSize: "0.75rem",
    fontFamily: "monospace",
    color: theme.palette.text.primary,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    marginRight: theme.spacing(0.5),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    marginRight: theme.spacing(0.75),
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  actionButton: {
    padding: theme.spacing(0.5),
    minWidth: 0,
  },
  statusLights: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 1),
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0.25),
    fontSize: "0.6rem",
    fontFamily: "monospace",
    color: theme.palette.text.secondary,
  },
  statusLightGroup: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(0.5),
  },
  statusLight: {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: "0.6rem",
    color: theme.palette.text.secondary,
  },
  statusLightDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusLightDivider: {
    width: 1,
    height: 12,
    backgroundColor: theme.palette.divider,
    margin: theme.spacing(0, 0.5),
  },
}));

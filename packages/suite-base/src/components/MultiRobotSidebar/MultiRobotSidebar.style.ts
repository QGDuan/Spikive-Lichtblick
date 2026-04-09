// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  listContainer: {
    flex: 1,
    overflow: "auto",
    padding: theme.spacing(1),
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: theme.palette.text.secondary,
    padding: theme.spacing(2),
    textAlign: "center",
  },
  footer: {
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

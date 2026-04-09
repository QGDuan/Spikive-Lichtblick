// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { makeStyles } from "tss-react/mui";

export const useStyles = makeStyles()((theme) => ({
  content: {
    padding: theme.spacing(2),
  },
  urlField: {
    marginBottom: theme.spacing(2),
  },
  errorAlert: {
    marginBottom: theme.spacing(2),
  },
}));

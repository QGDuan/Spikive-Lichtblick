// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
} from "@mui/material";
import { useCallback, useState } from "react";

import { useStyles } from "./AddRobotDialog.style";

function validateDroneId(droneId: string): string | undefined {
  const trimmed = droneId.trim();
  if (trimmed.length === 0) {
    return "Please enter a Drone ID";
  }
  if (!/^\d+$/.test(trimmed)) {
    return "Drone ID must be a number";
  }
  return undefined;
}

function validateUrl(url: string): string | undefined {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return "Please enter a WebSocket URL";
  }
  if (!trimmed.startsWith("ws://") && !trimmed.startsWith("wss://")) {
    return "URL must start with ws:// or wss://";
  }
  return undefined;
}

type AddRobotDialogProps = {
  open: boolean;
  onClose: () => void;
  onConnect: (url: string, droneId: string) => { success: boolean; error?: string };
};

export function AddRobotDialog({
  open,
  onClose,
  onConnect,
}: AddRobotDialogProps): React.JSX.Element {
  const { classes } = useStyles();
  const [droneId, setDroneId] = useState("1");
  const [url, setUrl] = useState("ws://192.168.1.10:8765");
  const [error, setError] = useState<string | undefined>();

  const handleDroneIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDroneId(e.target.value);
    setError(undefined);
  }, []);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
    setError(undefined);
  }, []);

  const handleConnect = useCallback(() => {
    const droneIdError = validateDroneId(droneId);
    if (droneIdError) {
      setError(droneIdError);
      return;
    }

    const urlError = validateUrl(url);
    if (urlError) {
      setError(urlError);
      return;
    }

    const result = onConnect(url, droneId);

    if (result.success) {
      setDroneId("1");
      setUrl("ws://192.168.1.10:8765");
      setError(undefined);
      onClose();
    } else {
      setError(result.error ?? "Connection failed");
    }
  }, [droneId, url, onConnect, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleConnect();
      }
    },
    [handleConnect],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        Add Robot
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8, color: "text.secondary" }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent className={classes.content}>
        {error != undefined && (
          <Alert severity="error" className={classes.errorAlert}>
            {error}
          </Alert>
        )}
        <TextField
          className={classes.urlField}
          label="Drone ID"
          placeholder="1"
          value={droneId}
          onChange={handleDroneIdChange}
          onKeyDown={handleKeyDown}
          fullWidth
          size="small"
          autoFocus
        />
        <TextField
          className={classes.urlField}
          label="Foxglove Bridge URL"
          placeholder="ws://192.168.1.10:8765"
          value={url}
          onChange={handleUrlChange}
          onKeyDown={handleKeyDown}
          fullWidth
          size="small"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleConnect}
        >
          Connect
        </Button>
      </DialogActions>
    </Dialog>
  );
}

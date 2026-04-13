// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";

import { useWaypointStore } from "@lichtblick/suite-base/spikive/stores/useWaypointStore";

const NAME_REGEX = /^[a-zA-Z0-9]*$/;

type SaveProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
};

export function SaveProjectDialog({
  open,
  onClose,
  onSave,
}: SaveProjectDialogProps): React.JSX.Element {
  const [name, setName] = useState("waypoint");
  const [error, setError] = useState<string | undefined>();
  const projectList = useWaypointStore((s) => s.projectList);

  const handleNameChange = useCallback((_e: unknown, value: string) => {
    if (!NAME_REGEX.test(value)) {
      setError("Only letters and numbers allowed");
      return;
    }
    setName(value);
    setError(undefined);
  }, []);

  const handleInputChange = useCallback(
    (_e: React.SyntheticEvent, value: string) => {
      if (!NAME_REGEX.test(value)) {
        setError("Only letters and numbers allowed");
        return;
      }
      setName(value);
      setError(undefined);
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      onSave("waypoint");
    } else {
      onSave(trimmed);
    }
    setName("waypoint");
    setError(undefined);
    onClose();
  }, [name, onSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && error == undefined) {
        handleConfirm();
      }
    },
    [handleConfirm, error],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Save Waypoint Project</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Enter a project name or select an existing one to overwrite.
        </Typography>
        <Autocomplete
          freeSolo
          options={projectList}
          inputValue={name}
          onInputChange={handleInputChange}
          onChange={(_e, value) => {
            if (typeof value === "string") {
              handleNameChange(undefined, value);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Project Name"
              placeholder="waypoint"
              size="small"
              error={error != undefined}
              helperText={error}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={error != undefined}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

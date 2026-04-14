// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";

type LoadProjectDialogProps = {
  open: boolean;
  onClose: () => void;
  onLoad: (name: string) => void;
  projectList: string[];
};

export function LoadProjectDialog({
  open,
  onClose,
  onLoad,
  projectList,
}: LoadProjectDialogProps): React.JSX.Element {
  const [selected, setSelected] = useState("");

  const handleConfirm = useCallback(() => {
    if (selected) {
      onLoad(selected);
      setSelected("");
      onClose();
    }
  }, [selected, onLoad, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Load Waypoint Project</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {projectList.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No saved projects found.
          </Typography>
        ) : (
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Project</InputLabel>
            <Select
              value={selected}
              label="Project"
              onChange={(e) => { setSelected(e.target.value); }}
            >
              {projectList.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!selected}
        >
          Load
        </Button>
      </DialogActions>
    </Dialog>
  );
}

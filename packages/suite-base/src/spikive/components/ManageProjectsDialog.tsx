// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import DeleteIcon from "@mui/icons-material/Delete";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useState } from "react";

type ManageProjectsDialogProps = {
  open: boolean;
  onClose: () => void;
  onDelete: (names: string) => void;
  projectList: string[];
};

export function ManageProjectsDialog({
  open,
  onClose,
  onDelete,
  projectList,
}: ManageProjectsDialogProps): React.JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleDeleteSingle = useCallback(
    (name: string) => {
      onDelete(name);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    },
    [onDelete],
  );

  const handleDeleteSelected = useCallback(() => {
    if (selected.size > 0) {
      onDelete(Array.from(selected).join(","));
      setSelected(new Set());
    }
  }, [selected, onDelete]);

  const handleClose = useCallback(() => {
    setSelected(new Set());
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manage Waypoint Projects</DialogTitle>
      <DialogContent sx={{ pt: 0, px: 1 }}>
        {projectList.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No saved projects.
          </Typography>
        ) : (
          <List dense disablePadding>
            {projectList.map((name) => (
              <ListItem
                key={name}
                disablePadding
                secondaryAction={
                  <Tooltip title="Delete">
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => { handleDeleteSingle(name); }}
                    >
                      <DeleteIcon fontSize="small" color="error" />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton
                  dense
                  onClick={() => { handleToggle(name); }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Checkbox
                      edge="start"
                      size="small"
                      checked={selected.has(name)}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={name}
                    primaryTypographyProps={{ variant: "body2" }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        {selected.size > 0 && (
          <Button
            color="error"
            variant="outlined"
            size="small"
            onClick={handleDeleteSelected}
            sx={{ mr: "auto" }}
          >
            Delete Selected ({selected.size})
          </Button>
        )}
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

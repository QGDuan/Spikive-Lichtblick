// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export type RobotEntry = {
  id: string;
  url: string;
  status: ConnectionStatus;
  isActive: boolean;
  isVisible: boolean;
  errorMessage?: string;
};

export type MultiRobotState = {
  robots: RobotEntry[];
};

export type MultiRobotActions = {
  addRobot: (url: string) => { success: boolean; error?: string };
  removeRobot: (id: string) => void;
  setActive: (id: string) => void;
  toggleVisibility: (id: string) => void;
  hasDuplicate: (url: string) => boolean;
};

export type MultiRobotStore = MultiRobotState & MultiRobotActions;

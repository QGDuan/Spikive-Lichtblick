// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export type RobotEntry = {
  id: string;
  droneId: string;
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
  addRobot: (url: string, droneId: string) => { success: boolean; error?: string };
  removeRobot: (id: string) => void;
  setActive: (id: string) => void;
  toggleVisibility: (id: string) => void;
};

export type MultiRobotStore = MultiRobotState & MultiRobotActions;

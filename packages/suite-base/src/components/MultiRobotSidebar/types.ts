// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

export type ConnectionStatus = "connecting" | "connected" | "slow" | "disconnected" | "error";

export type RobotEntry = {
  connectionId: string;
  droneId: string;
  url: string;
  status: ConnectionStatus;
  latencyMs?: number;
  errorMessage?: string;
};

export type MultiRobotState = {
  robots: RobotEntry[];
  activeDroneId?: string;
  visualDroneId?: string;
  visualConnectionId?: string;
  visualRouteVersion: number;
};

export type MultiRobotActions = {
  addRobot: (url: string, droneId: string) => { success: boolean; error?: string };
  removeRobot: (connectionId: string) => void;
  setActiveDroneId: (droneId: string) => void;
  updateStatus: (connectionId: string, status: ConnectionStatus, latencyMs?: number) => void;
};

export type MultiRobotStore = MultiRobotState & MultiRobotActions;

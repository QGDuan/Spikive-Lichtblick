// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

export type ManagerMode = "idle" | "starting" | "ready" | "stopping" | "error" | string;

export type ManagerModuleStatus = 0 | 1 | 2;

export type ManagerCommandType = "start_all" | "shutdown_all";

export type ManagerCommandStatus = "pending" | "published";

export type ManagerStatusSnapshot = {
  droneId: string;
  mode: ManagerMode;
  isActive: boolean;
  starting: boolean;
  stopping: boolean;
  armed: boolean;
  lastError: string;
  lastErrorSeq: number;
  mavrosStatus: ManagerModuleStatus;
  lidarStatus: ManagerModuleStatus;
  slamStatus: ManagerModuleStatus;
  plannerStatus: ManagerModuleStatus;
  lastCommandType: string;
  lastCommandRequestId: string;
  lastUpdateMs: number;
};

export type ManagerCommandRequest = {
  seq: number;
  droneId: string;
  commandType: ManagerCommandType;
  requestId: string;
  status: ManagerCommandStatus;
  createdAtMs: number;
  publishedAtMs?: number;
};

export type ManagerCommandResult = {
  seq: number;
  droneId: string;
  commandType: ManagerCommandType;
  requestId: string;
  message: string;
  atMs: number;
};

export type AutoManagerMessage = {
  drone_id?: string;
  mode?: string;
  is_active?: boolean;
  starting?: boolean;
  stopping?: boolean;
  armed?: boolean;
  last_error?: string;
  last_error_seq?: number;
  mavros_status?: number;
  lidar_driver_status?: number;
  slam_status?: number;
  planner_status?: number;
  command?: {
    command_type?: string;
    extra_data?: string;
  };
};

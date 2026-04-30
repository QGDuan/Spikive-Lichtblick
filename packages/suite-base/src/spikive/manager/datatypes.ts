// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { MessageDefinition } from "@lichtblick/message-definition";
import { ros1 } from "@lichtblick/rosmsg-msgs-common";

export const CommandDatatypes = new Map<string, MessageDefinition>([
  ["std_msgs/Header", ros1["std_msgs/Header"]],
  [
    "astro_manager/Command",
    {
      name: "astro_manager/Command",
      definitions: [
        { type: "std_msgs/Header", name: "header", isComplex: true, isArray: false },
        { type: "string", name: "command_type", isComplex: false, isArray: false },
        { type: "string", name: "target_launches", isComplex: false, isArray: true },
        { type: "float64", name: "parameters", isComplex: false, isArray: true },
        { type: "string", name: "extra_data", isComplex: false, isArray: false },
      ],
    },
  ],
]);

export const CommandSchema = `std_msgs/Header header
string command_type
string[] target_launches
float64[] parameters
string extra_data
================================================================================
MSG: std_msgs/Header
uint32 seq
time stamp
string frame_id
`;

export function makeManagerCommandExtraData({
  requestId,
  seq,
  droneId,
}: {
  requestId: string;
  seq: number;
  droneId: string;
}): string {
  return JSON.stringify({
    request_id: requestId,
    seq,
    drone_id: droneId,
  }) ?? "";
}

export function extractManagerCommandRequestId(extraData: unknown): string {
  if (typeof extraData !== "string" || extraData.trim().length === 0) {
    return "";
  }
  try {
    const parsed = JSON.parse(extraData) as { request_id?: unknown };
    return typeof parsed.request_id === "string" ? parsed.request_id : "";
  } catch {
    return "";
  }
}

export function makeManagerCommandMessage({
  commandType,
  requestId,
  seq,
  droneId,
}: {
  commandType: string;
  requestId: string;
  seq: number;
  droneId: string;
}): unknown {
  return {
    header: {
      stamp: { sec: 0, nsec: 0 },
      frame_id: "",
    },
    command_type: commandType,
    target_launches: [],
    parameters: [],
    extra_data: makeManagerCommandExtraData({ requestId, seq, droneId }),
  };
}

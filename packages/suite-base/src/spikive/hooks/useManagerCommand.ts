// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useCallback, useEffect, useRef } from "react";

import { MessageDefinition } from "@lichtblick/message-definition";
import { ros1 } from "@lichtblick/rosmsg-msgs-common";
import { fromDate } from "@lichtblick/rostime";
import { useMessagePipeline } from "@lichtblick/suite-base/components/MessagePipeline";
import { PlayerPresence } from "@lichtblick/suite-base/players/types";

import {
  ASTRO_MANAGER_DATATYPES,
  COMMAND_TYPE,
  droneCommandTopic,
} from "@lichtblick/suite-base/spikive/config/topicConfig";

const PUBLISHER_ID = "spikive-manager";

const AstroManagerCommandDatatypes = new Map<string, MessageDefinition>([
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

export type ManagerCommandApi = {
  sendStartAll: () => void;
  sendShutdownAll: () => void;
};

// Module-level registry: tracks all droneIds whose RobotCards are mounted.
// Shared across instances so every card contributes to one setPublishers call.
const mountedDroneIds = new Set<string>();

function buildPublishers() {
  return Array.from(mountedDroneIds).map((id) => ({
    topic: droneCommandTopic(id),
    schemaName: ASTRO_MANAGER_DATATYPES.command,
    options: { datatypes: AstroManagerCommandDatatypes },
  }));
}

/**
 * Registers the command publisher for `droneId` and keeps it registered
 * even across player reconnects.
 *
 * Root cause of "first click no-op": setPublishers + publish were called
 * back-to-back inside send(). FoxgloveWebSocketPlayer.setPublishers() goes
 * to #unresolvedPublications when the WS isn't connected yet, and only
 * processes them once the serverCapabilities event fires. By the time the
 * user clicks the second time the channel was registered; first click was lost.
 *
 * Fix: advertise eagerly on mount AND re-advertise every time the player
 * becomes PRESENT (i.e. WS connected + capabilities received), which is
 * the exact moment #setupPublishers() runs inside the player.
 */
export function useManagerCommand(droneId: string): ManagerCommandApi {
  const setPublishers = useMessagePipeline((c) => c.setPublishers);
  const publish = useMessagePipeline((c) => c.publish);

  // PlayerPresence.PRESENT means WS connected + serverCapabilities received.
  // That's the moment FoxgloveWebSocketPlayer processes #unresolvedPublications.
  // We watch it so we can re-advertise if the connection is rebuilt.
  const presence = useMessagePipeline((c) => c.playerState.presence);

  const setPublishersRef = useRef(setPublishers);
  setPublishersRef.current = setPublishers;
  const publishRef = useRef(publish);
  publishRef.current = publish;

  // Register/unregister this drone in the shared set.
  useEffect(() => {
    mountedDroneIds.add(droneId);
    return () => {
      mountedDroneIds.delete(droneId);
      // Notify the pipeline that this topic is gone.
      setPublishersRef.current(PUBLISHER_ID, buildPublishers());
    };
  }, [droneId]);

  // Re-advertise whenever the player becomes PRESENT or droneId changes.
  // PRESENT fires after every (re)connect, ensuring #publicationsByTopic
  // is populated before the user can click.
  useEffect(() => {
    if (presence === PlayerPresence.PRESENT) {
      setPublishers(PUBLISHER_ID, buildPublishers());
    }
  }, [presence, setPublishers, droneId]);

  const send = useCallback(
    (commandType: string) => {
      publishRef.current({
        topic: droneCommandTopic(droneId),
        msg: {
          header: { seq: 0, stamp: fromDate(new Date()), frame_id: `drone_${droneId}` },
          command_type: commandType,
          target_launches: [],
          parameters: [],
          extra_data: "",
        },
      });
    },
    [droneId],
  );

  return {
    sendStartAll: useCallback(() => {
      send(COMMAND_TYPE.START_ALL);
    }, [send]),
    sendShutdownAll: useCallback(() => {
      send(COMMAND_TYPE.SHUTDOWN_ALL);
    }, [send]),
  };
}

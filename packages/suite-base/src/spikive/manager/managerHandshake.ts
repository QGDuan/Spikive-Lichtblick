// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { FoxgloveClient } from "@foxglove/ws-protocol";
import type { Channel, MessageData } from "@foxglove/ws-protocol";

import { parse as parseMessageDefinition } from "@lichtblick/rosmsg";
import { MessageReader } from "@lichtblick/rosmsg-serialization";

import { droneTopics } from "@lichtblick/suite-base/spikive/config/topicConfig";

import type { AutoManagerMessage } from "./types";

const HANDSHAKE_TIMEOUT_MS = 5000;
const SUPPORTED_SUB_PROTOCOLS = [FoxgloveClient.SUPPORTED_SUBPROTOCOL, "foxglove.sdk.v1"];

function makeAutoManagerReader(channel: Channel): MessageReader | undefined {
  if (
    channel.encoding !== "ros1" ||
    (channel.schemaEncoding != undefined && channel.schemaEncoding !== "ros1msg") ||
    channel.schemaName !== "astro_manager/AutoManager"
  ) {
    return undefined;
  }
  return new MessageReader(parseMessageDefinition(channel.schema));
}

export function verifyManagerHandshake(url: string, droneId: string): Promise<void> {
  const expectedTopic = droneTopics(droneId).managerStatus;

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let subscriptionId: number | undefined;
    let reader: MessageReader | undefined;
    const ws = new WebSocket(url, SUPPORTED_SUB_PROTOCOLS);
    const client = new FoxgloveClient({ ws });

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (subscriptionId != undefined) {
        try {
          client.unsubscribe(subscriptionId);
        } catch {
          // ignore cleanup errors
        }
      }
      client.close();
      clearTimeout(timer);
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };

    const timer = setTimeout(() => {
      finish(
        new Error(
          `Manager handshake timed out: did not receive ${expectedTopic} with drone_id=${droneId}`,
        ),
      );
    }, HANDSHAKE_TIMEOUT_MS);

    client.on("error", (error) => {
      finish(error instanceof Error ? error : new Error("Manager handshake WebSocket error"));
    });

    client.on("close", () => {
      finish(new Error("Manager handshake connection closed"));
    });

    client.on("advertise", (channels) => {
      for (const channel of channels) {
        if (channel.topic !== expectedTopic) {
          continue;
        }
        const nextReader = makeAutoManagerReader(channel);
        if (!nextReader) {
          finish(new Error(`Manager topic ${expectedTopic} has unsupported schema or encoding`));
          return;
        }
        reader = nextReader;
        subscriptionId = client.subscribe(channel.id);
      }
    });

    client.on("message", (message: MessageData) => {
      if (message.subscriptionId !== subscriptionId || reader == undefined) {
        return;
      }
      const decoded = reader.readMessage<AutoManagerMessage>(message.data);
      const managerDroneId = String(decoded.drone_id ?? "").trim();
      if (managerDroneId !== droneId) {
        finish(
          new Error(
            `Manager drone_id mismatch: input=${droneId}, status=${managerDroneId || "<empty>"}`,
          ),
        );
        return;
      }
      finish();
    });
  });
}

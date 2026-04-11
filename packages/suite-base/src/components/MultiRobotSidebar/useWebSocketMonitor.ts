// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useRef } from "react";

import { useRobotConnectionsStore } from "./useRobotConnections";

const PING_INTERVAL_MS = 3000;
const PING_TIMEOUT_MS = 3000;
const SLOW_THRESHOLD_MS = 500;
const WS_SUB_PROTOCOLS = ["foxglove.websocket.v1"];

type ProbeHandle = {
  timer: ReturnType<typeof setInterval>;
  ws?: WebSocket;
  timeoutTimer?: ReturnType<typeof setTimeout>;
};

/**
 * For each robot in the store, maintains a periodic WebSocket probe that
 * measures handshake latency and updates the robot's status/latencyMs.
 *
 * Lifecycle: probes are started when robots appear and cleaned up when
 * robots are removed or the component unmounts.
 */
export function useWebSocketMonitor(): void {
  const robots = useRobotConnectionsStore((s) => s.robots);
  const updateStatus = useRobotConnectionsStore((s) => s.updateStatus);

  // Stable refs so the interval callback always sees the latest updateStatus
  const updateStatusRef = useRef(updateStatus);
  updateStatusRef.current = updateStatus;

  // Map of robot id → probe handle
  const probesRef = useRef(new Map<string, ProbeHandle>());

  useEffect(() => {
    const probes = probesRef.current;
    const currentIds = new Set(robots.map((r) => r.id));

    // Remove probes for robots that no longer exist
    for (const [id, handle] of probes) {
      if (!currentIds.has(id)) {
        clearInterval(handle.timer);
        if (handle.timeoutTimer != undefined) {
          clearTimeout(handle.timeoutTimer);
        }
        handle.ws?.close();
        probes.delete(id);
      }
    }

    // Start probes for new robots
    for (const robot of robots) {
      if (probes.has(robot.id)) {
        continue;
      }

      const robotId = robot.id;
      const url = robot.url;

      function probe() {
        const handle = probes.get(robotId);
        if (!handle) {
          return;
        }

        // Close any in-flight probe
        handle.ws?.close();
        if (handle.timeoutTimer != undefined) {
          clearTimeout(handle.timeoutTimer);
          handle.timeoutTimer = undefined;
        }

        const start = performance.now();
        let settled = false;
        const ws = new WebSocket(url, WS_SUB_PROTOCOLS);
        handle.ws = ws;

        handle.timeoutTimer = setTimeout(() => {
          if (!settled) {
            settled = true;
            ws.close();
            updateStatusRef.current(robotId, "disconnected", undefined);
          }
        }, PING_TIMEOUT_MS);

        ws.onopen = () => {
          if (!settled) {
            settled = true;
            const latency = Math.round(performance.now() - start);
            if (handle.timeoutTimer != undefined) {
              clearTimeout(handle.timeoutTimer);
              handle.timeoutTimer = undefined;
            }
            ws.close();
            const status = latency >= SLOW_THRESHOLD_MS ? "slow" : "connected";
            updateStatusRef.current(robotId, status, latency);
          }
        };

        ws.onerror = () => {
          if (!settled) {
            settled = true;
            if (handle.timeoutTimer != undefined) {
              clearTimeout(handle.timeoutTimer);
              handle.timeoutTimer = undefined;
            }
            ws.close();
            updateStatusRef.current(robotId, "disconnected", undefined);
          }
        };
      }

      const timer = setInterval(probe, PING_INTERVAL_MS);
      probes.set(robotId, { timer });

      // Run first probe immediately
      probe();
    }

    // Cleanup everything on unmount
    return () => {
      for (const [, handle] of probes) {
        clearInterval(handle.timer);
        if (handle.timeoutTimer != undefined) {
          clearTimeout(handle.timeoutTimer);
        }
        handle.ws?.close();
      }
      probes.clear();
    };
  }, [robots]);
}

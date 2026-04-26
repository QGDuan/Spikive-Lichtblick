// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useEffect, useRef } from "react";

import { useRobotConnectionsStore } from "./useRobotConnections";

const PING_INTERVAL_MS = 3000;
const PING_TIMEOUT_MS = 3000;
const SLOW_THRESHOLD_MS = 500;
const WS_SUB_PROTOCOLS = ["foxglove.websocket.v1"];

type ProbeHandle = {
  url: string;
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
 *
 * This intentionally does not subscribe to `robots`: status updates rewrite the
 * robots array, and re-running this effect would tear down and recreate every
 * probe on each ping.
 */
export function useWebSocketMonitor(): void {
  const probesRef = useRef(new Map<string, ProbeHandle>());

  useEffect(() => {
    const probes = probesRef.current;

    function probe(connectionId: string, handle: ProbeHandle) {
      handle.ws?.close();
      if (handle.timeoutTimer != undefined) {
        clearTimeout(handle.timeoutTimer);
        handle.timeoutTimer = undefined;
      }

      const start = performance.now();
      let settled = false;
      const ws = new WebSocket(handle.url, WS_SUB_PROTOCOLS);
      handle.ws = ws;

      handle.timeoutTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          useRobotConnectionsStore.getState().updateStatus(connectionId, "disconnected", undefined);
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
          useRobotConnectionsStore.getState().updateStatus(connectionId, status, latency);
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
          useRobotConnectionsStore.getState().updateStatus(connectionId, "disconnected", undefined);
        }
      };
    }

    const syncProbes = () => {
      const robots = useRobotConnectionsStore.getState().robots;
      const currentIds = new Set(robots.map((r) => r.connectionId));

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

      for (const robot of robots) {
        if (probes.has(robot.connectionId)) {
          continue;
        }

        const handle: ProbeHandle = {
          url: robot.url,
          timer: setInterval(() => {
            probe(robot.connectionId, handle);
          }, PING_INTERVAL_MS),
        };
        probes.set(robot.connectionId, handle);
        probe(robot.connectionId, handle);
      }
    };

    syncProbes();
    const syncTimer = setInterval(syncProbes, 1000);

    return () => {
      clearInterval(syncTimer);
      for (const [, handle] of probes) {
        clearInterval(handle.timer);
        if (handle.timeoutTimer != undefined) {
          clearTimeout(handle.timeoutTimer);
        }
        handle.ws?.close();
      }
      probes.clear();
    };
  }, []);
}

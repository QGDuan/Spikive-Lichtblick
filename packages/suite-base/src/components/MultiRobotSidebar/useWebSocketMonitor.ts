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
  interval: ReturnType<typeof setInterval>;
  ws?: WebSocket;
  timeoutTimer?: ReturnType<typeof setTimeout>;
};

/**
 * For each robot in the store, maintains a periodic WebSocket probe that
 * measures handshake latency and updates the robot's status/latencyMs.
 *
 * Deliberately does NOT put `robots` in the useEffect dependency array.
 * Instead, it reads `getState().robots` inside the management interval so
 * that store updates (e.g. updateStatus) never trigger the cleanup function,
 * which would close all probes and cause spurious "disconnected" flashes.
 */
export function useWebSocketMonitor(): void {
  const probesRef = useRef(new Map<string, ProbeHandle>());

  useEffect(() => {
    const probes = probesRef.current;

    function runProbe(robotId: string, handle: ProbeHandle) {
      // Close any in-flight probe
      handle.ws?.close();
      if (handle.timeoutTimer != undefined) {
        clearTimeout(handle.timeoutTimer);
        handle.timeoutTimer = undefined;
      }

      const { updateStatus } = useRobotConnectionsStore.getState();
      const start = performance.now();
      let settled = false;
      const ws = new WebSocket(handle.url, WS_SUB_PROTOCOLS);
      handle.ws = ws;

      handle.timeoutTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          useRobotConnectionsStore.getState().updateStatus(robotId, "disconnected", undefined);
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
          useRobotConnectionsStore.getState().updateStatus(robotId, status, latency);
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
          useRobotConnectionsStore.getState().updateStatus(robotId, "disconnected", undefined);
        }
      };

      // Suppress browser console errors for expected connection failures
      ws.onclose = () => {};
    }

    // Management interval: diff store robots vs active probes every tick
    const managerId = setInterval(() => {
      const robots = useRobotConnectionsStore.getState().robots;
      const currentIds = new Set(robots.map((r) => r.id));

      // Remove probes for robots that no longer exist
      for (const [id, handle] of probes) {
        if (!currentIds.has(id)) {
          clearInterval(handle.interval);
          if (handle.timeoutTimer != undefined) clearTimeout(handle.timeoutTimer);
          handle.ws?.close();
          probes.delete(id);
        }
      }

      // Start probes for new robots
      for (const robot of robots) {
        if (!probes.has(robot.id)) {
          const robotId = robot.id;
          const handle: ProbeHandle = {
            url: robot.url,
            interval: setInterval(() => runProbe(robotId, handle), PING_INTERVAL_MS),
          };
          probes.set(robotId, handle);
          // Run first probe immediately
          runProbe(robotId, handle);
        }
      }
    }, 1000); // Check for new/removed robots every 1s

    return () => {
      clearInterval(managerId);
      for (const [, handle] of probes) {
        clearInterval(handle.interval);
        if (handle.timeoutTimer != undefined) clearTimeout(handle.timeoutTimer);
        handle.ws?.close();
      }
      probes.clear();
    };
  }, []); // Empty deps: never re-runs, never triggers cleanup on store updates
}

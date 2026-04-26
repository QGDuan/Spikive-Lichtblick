// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { useSnackbar } from "notistack";
import { useEffect, useRef } from "react";

import { useRobotConnectionsStore } from "@lichtblick/suite-base/components/MultiRobotSidebar/useRobotConnections";
import {
  ManagerSnapshot,
  STALE_THRESHOLD_MS,
  useManagerStatusStore,
} from "@lichtblick/suite-base/spikive/stores/useManagerStatusStore";

type ManagerPrev = {
  starting: boolean;
  isActive: boolean;
  lastErrorSeq: number;
  offline: boolean;
};

type RobotPrev = {
  status: string;
};

/**
 * Snackbar-based notifications driven by the manager status store and
 * the robot-connection store. Mount once at the top of MultiRobotSidebar.
 *
 * Triggered events:
 * - new lastErrorSeq         -> error toast
 * - starting true -> false   -> success or error toast depending on isActive
 * - manager went offline     -> warning toast
 * - manager came back online -> info toast
 * - websocket disconnected   -> warning toast
 * - websocket reconnected    -> success toast
 */
export function useManagerNotifications(): void {
  const { enqueueSnackbar } = useSnackbar();
  const robots = useRobotConnectionsStore((s) => s.robots);
  const byDroneId = useManagerStatusStore((s) => s.byDroneId);

  const managerPrevRef = useRef<Record<string, ManagerPrev>>({});
  const robotPrevRef = useRef<Record<string, RobotPrev>>({});

  // Store enqueueSnackbar in a ref to avoid recreating the interval
  const enqueueRef = useRef(enqueueSnackbar);
  useEffect(() => {
    enqueueRef.current = enqueueSnackbar;
  }, [enqueueSnackbar]);

  // Manager status transitions ---------------------------------------------
  useEffect(() => {
    const prevMap = managerPrevRef.current;
    const now = Date.now();

    for (const droneId of Object.keys(byDroneId)) {
      const snap = byDroneId[droneId];
      if (!snap) {
        continue;
      }
      const prev = prevMap[droneId];
      const offline = now - snap.lastUpdateMs > STALE_THRESHOLD_MS;

      if (!prev) {
        prevMap[droneId] = {
          starting: snap.starting,
          isActive: snap.isActive,
          lastErrorSeq: snap.lastErrorSeq,
          offline,
        };
        continue;
      }

      // 1) New error from backend (last_error_seq monotonically increases).
      if (snap.lastErrorSeq > prev.lastErrorSeq && snap.lastError) {
        enqueueSnackbar(`Drone ${droneId}: ${snap.lastError}`, {
          variant: "error",
        });
      }

      // 2) Startup / restart finished.
      if (prev.starting && !snap.starting) {
        if (snap.isActive) {
          enqueueSnackbar(`Drone ${droneId} 启动完成`, { variant: "success" });
        } else if (snap.lastErrorSeq > prev.lastErrorSeq) {
          // Already covered by case 1, skip the duplicate.
        } else {
          enqueueSnackbar(`Drone ${droneId} 启动失败`, { variant: "error" });
        }
      }

      // 3) Offline / online (only emit on transitions, not steady state).
      if (!prev.offline && offline) {
        enqueueSnackbar(`Drone ${droneId} Manager 失联`, { variant: "warning" });
      } else if (prev.offline && !offline) {
        enqueueSnackbar(`Drone ${droneId} Manager 已恢复`, { variant: "info" });
      }

      prevMap[droneId] = {
        starting: snap.starting,
        isActive: snap.isActive,
        lastErrorSeq: snap.lastErrorSeq,
        offline,
      };
    }

    // Drop entries for drones we no longer have a snapshot for.
    for (const droneId of Object.keys(prevMap)) {
      if (!(droneId in byDroneId)) {
        delete prevMap[droneId];
      }
    }
  }, [byDroneId, enqueueSnackbar]);

  // Stale detection: when a snapshot stops updating, we still want one
  // "Manager 失联" toast. Do this on a 1Hz timer, not on store updates.
  useEffect(() => {
    const id = setInterval(() => {
      const snapshot = useManagerStatusStore.getState().byDroneId;
      const now = Date.now();
      const prevMap = managerPrevRef.current;
      for (const droneId of Object.keys(snapshot)) {
        const snap = snapshot[droneId];
        if (!snap) {
          continue;
        }
        const offline = now - snap.lastUpdateMs > STALE_THRESHOLD_MS;
        const prev = prevMap[droneId];
        if (prev && !prev.offline && offline) {
          enqueueRef.current(`Drone ${droneId} Manager 失联`, { variant: "warning" });
          prevMap[droneId] = { ...prev, offline: true };
        }
      }
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []); // Empty dependency array - use ref for enqueueSnackbar

  // Connection transitions --------------------------------------------------
  useEffect(() => {
    const prevMap = robotPrevRef.current;
    for (const robot of robots) {
      const prev = prevMap[robot.id];
      if (!prev) {
        prevMap[robot.id] = { status: robot.status };
        continue;
      }
      const wasConnected = prev.status === "connected" || prev.status === "slow";
      const isConnected = robot.status === "connected" || robot.status === "slow";
      if (wasConnected && !isConnected) {
        enqueueSnackbar(`Drone ${robot.droneId} 已断开连接`, { variant: "warning" });
      } else if (!wasConnected && isConnected) {
        enqueueSnackbar(`Drone ${robot.droneId} 已重新连接`, { variant: "success" });
      }
      prevMap[robot.id] = { status: robot.status };
    }
    // Clean up entries for removed robots.
    const liveIds = new Set(robots.map((r) => r.id));
    for (const id of Object.keys(prevMap)) {
      if (!liveIds.has(id)) {
        delete prevMap[id];
      }
    }
  }, [robots, enqueueSnackbar]);
}

// Re-export to keep imports tidy at the call site.
export type { ManagerSnapshot };

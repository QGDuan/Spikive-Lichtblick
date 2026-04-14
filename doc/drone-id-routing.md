# Drone ID Dynamic Routing — Lifecycle & Robustness Analysis

## 1. Overview

The Spikive ground station uses a dynamic `drone_id` to route all ROS topic subscriptions and TF frame tracking in the 3D Panel. When the user connects a drone and enters its ID, the system rewrites the panel configuration so that every topic and the camera follow-frame point to the correct drone.

**Core invariant**: At any point in time, the 3D Panel's topic keys and `followTf` must correspond to exactly one `drone_id`.

---

## 2. Architecture

```
                        ┌─────────────────────────┐
                        │    AddRobotDialog.tsx    │
                        │  user inputs droneId+url │
                        └───────────┬─────────────┘
                                    │ onConnect(url, droneId)
                                    ▼
                        ┌─────────────────────────┐
                        │  MultiRobotSidebar      │
                        │  index.tsx               │
                        │  handleConnect()         │
                        └───────────┬─────────────┘
                                    │ addRobot(url, droneId)
                                    ▼
┌───────────────────────────────────────────────────────────┐
│                  Zustand Store                            │
│              useRobotConnections.ts                       │
│                                                           │
│  robots: [                                                │
│    { id, droneId: "2", url, status, isActive, isVisible } │
│  ]                                                        │
│                                                           │
│  Mutex checks:                                            │
│    - URL uniqueness (normalized)                          │
│    - droneId uniqueness                                   │
└───────────────────────────┬───────────────────────────────┘
                            │ activeDroneId changes
                            ▼
┌───────────────────────────────────────────────────────────┐
│              useActiveDroneRouting.ts                      │
│                                                           │
│  useEffect watches activeDroneId                          │
│    fromId = prevDroneId ?? DEFAULT_DRONE_ID               │
│    if fromId === activeDroneId → skip                     │
│    else → remapTopics(from, to) + update followTf         │
│         → savePanelConfigs(override: true)                │
└───────────────────────────┬───────────────────────────────┘
                            │
                            ▼
┌───────────────────────────────────────────────────────────┐
│              3D Panel (configById["3D!spikive3d"])         │
│                                                           │
│  topics: {                                                │
│    "/drone_2_cloud_registered": { visible, colorMap, ... }│
│    "/drone_2_ego_planner_node/optimal_list": { ... }      │
│    "/drone_2_ego_planner_node/goal_point": { ... }        │
│    "/drone_2_odom_visualization/robot": { ... }           │
│    "/drone_2_odom_visualization/path": { ... }            │
│    "/drone_2_waypoint_markers": { ... }                   │
│  }                                                        │
│  followTf: "base2"                                        │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Lifecycle — Step by Step

### 3.1 App Startup (no drone connected)

1. `defaultLayout.ts` initializes the 3D Panel with topics from `TOPIC_CONFIG.subscribe` (bound to `DEFAULT_DRONE_ID = "1"`).
2. Panel config contains `/drone_1_xxx` topics and `followTf: "base1"`.
3. Zustand store `robots[]` is empty.
4. `useActiveDroneRouting` sees `activeDroneId === undefined` → no-op.

### 3.2 First Connection (e.g., drone_id = 2)

1. User opens AddRobotDialog, enters `droneId = "2"`, `url = "ws://192.168.31.78:8765"`.
2. `validateDroneId("2")` → pass. `validateUrl(...)` → pass.
3. `addRobot(url, "2")` in store:
   - URL uniqueness check → pass (no existing robots).
   - droneId uniqueness check → pass.
   - Creates `{ id: "robot-xxx", droneId: "2", url, status: "connected", isActive: true, isVisible: true }`.
4. `selectSource("foxglove-websocket", { params: { url } })` opens Foxglove Bridge connection.
5. `useActiveDroneRouting` fires:
   - `activeDroneId = "2"`, `prevDroneIdRef.current = undefined`.
   - `fromId = undefined ?? DEFAULT_DRONE_ID = "1"`.
   - `fromId("1") !== activeDroneId("2")` → proceed.
   - `remapTopics(oldTopics, "1", "2")`:
     - `/drone_1_cloud_registered` → `/drone_2_cloud_registered`
     - `/drone_1_ego_planner_node/optimal_list` → `/drone_2_ego_planner_node/optimal_list`
     - (same for all 6 topics)
   - `followTf` → `"base2"`.
   - `savePanelConfigs({ override: true, config: newConfig })`.
6. 3D Panel now subscribes to all `/drone_2_xxx` topics.

### 3.3 First Connection (drone_id = 1, matches default)

1. Same flow up to step 5.
2. `fromId = "1"`, `activeDroneId = "1"` → `fromId === activeDroneId` → **skip**.
3. No rewrite needed — default layout already correct.

### 3.4 Switching Active Drone (click radio button on another card)

1. User clicks radio on Drone 1 card → `setActive(robot1.id)`.
2. Zustand: `robots.map(r => ({ ...r, isActive: r.id === robot1.id }))`.
3. `useActiveDroneRouting` fires:
   - `activeDroneId = "1"`, `prevDroneIdRef.current = "2"`.
   - `fromId = "2"`, `toId = "1"` → remap all topics back.
4. Panel config rewritten from `/drone_2_xxx` → `/drone_1_xxx`, `followTf: "base1"`.

### 3.5 Removing a Drone

1. `removeRobot(id)` filters out the entry from `robots[]`.
2. If the removed drone was active, `robots.find(r => r.isActive)` returns `undefined`.
3. `activeDroneId = undefined` → hook skips, panel keeps last config.
4. **Known limitation**: No auto-fallback to another drone. Panel stays on the removed drone's topics.

---

## 4. Mutex (Uniqueness) Guarantees

Located in `useRobotConnections.ts` → `addRobot()`:

| Check | Logic | Error Message |
|---|---|---|
| **URL uniqueness** | `normalizeUrl(url)` (trim, lowercase, strip trailing `/`) compared against all existing robots | "This Foxglove Bridge address already exists" |
| **droneId uniqueness** | Exact string match of `droneId.trim()` against all existing robots | "Drone ID {id} already exists" |

Both checks run **before** the entry is created. If either fails, `addRobot` returns `{ success: false, error }` and the dialog stays open with the error displayed.

**Input validation** in `AddRobotDialog.tsx`:
- `droneId`: non-empty, digits only (`/^\d+$/`).
- `url`: non-empty, must start with `ws://` or `wss://`.

---

## 5. Topic Remapping Logic

`remapTopics(oldTopics, fromId, toId)` in `useActiveDroneRouting.ts`:

```
Input:  { "/drone_1_cloud_registered": { visible: true, colorMap: "rainbow", ... } }
fromId: "1"
toId:   "2"

Step 1: Build key map from droneTopics("1") → droneTopics("2")
        /drone_1_cloud_registered → /drone_2_cloud_registered
        /drone_1_ego_planner_node/optimal_list → /drone_2_ego_planner_node/optimal_list
        /drone_1_waypoint_markers → /drone_2_waypoint_markers
        ... (6 pairs total)

Step 2: For each old key:
        - If in keyMap → write to new key with same settings
        - Else → keep as-is (non-drone keys preserved)

Step 3: Ensure all 6 target topics exist.
        If any missing → add with { visible: true } (plus pickable: false where applicable).

Output: { "/drone_2_cloud_registered": { visible: true, colorMap: "rainbow", ... } }
```

**Deterministic**: No regex guessing. Uses `droneTopics(fromId)` / `droneTopics(toId)` for exact mapping.

---

## 6. Robustness Analysis

### What works well

| Scenario | Behavior |
|---|---|
| Connect drone_id=1 (matches default) | No rewrite needed, zero overhead |
| Connect drone_id=2 (differs from default) | Correct remap from default layout |
| Switch between drone 1 ↔ 2 | Bidirectional remap preserves render settings |
| Duplicate URL attempt | Blocked with error message |
| Duplicate droneId attempt | Blocked with error message |
| Invalid droneId input ("abc", "") | Blocked at dialog validation |
| Topic missing in old config | Auto-added with `{ visible: true }` |
| Waypoint markers per-drone routing | `waypointMarkers` is included in `TOPIC_FIELDS` and remapped like other topics; `ThreeDeeRender` no longer needs a manual extra subscription |

### Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| **Single-connection architecture**: Lichtblick's `selectSource()` only supports one active data source. Adding a second drone replaces the first connection. | Only last-connected drone streams data. | Current scope is single-drone. Multi-drone requires Foxglove Bridge multiplexing or multiple data sources. |
| **No auto-fallback on remove**: Removing the active drone leaves panel pointing to stale topics. | No data displayed until user activates another drone. | Future: auto-activate the next robot in the list. |
| **Layout cache**: Users with a cached layout in localStorage see old topics until reset. | First-time mismatch after code update. | Default layout only applies to fresh sessions. Users can reset layout. |
| **`followTf` depends on `tf45=true`**: If `odom_visualization` doesn't broadcast TF, camera won't follow. | Camera stuck at world origin. | Requires ROS-side `tf45=true` in launch config. |
| **No connection health monitoring**: Status is always "connected" — no actual WebSocket health check. | User can't distinguish live vs dead connections. | Future: poll Foxglove Bridge heartbeat. |

---

## 7. File Reference

| File | Role |
|---|---|
| `packages/suite-base/src/spikive/config/topicConfig.ts` | `DEFAULT_DRONE_ID`, `droneTopics()` (15 fields incl. waypoint topics), `droneBodyFrame()`, `extractDroneIdFromTopic()`, `TOPIC_CONFIG` |
| `packages/suite-base/src/spikive/hooks/useActiveDroneRouting.ts` | Watches active droneId; `TOPIC_FIELDS` (6 entries incl. `waypointMarkers`), `remapTopics()` rewrites panel config |
| `packages/suite-base/src/spikive/stores/useWaypointStore.ts` | Waypoint state per drone: `projectLists: Record<string, string[]>` keyed by droneId |
| `packages/suite-base/src/components/MultiRobotSidebar/types.ts` | `RobotEntry` (with `droneId`), `MultiRobotStore` |
| `packages/suite-base/src/components/MultiRobotSidebar/useRobotConnections.ts` | Zustand store with mutex checks |
| `packages/suite-base/src/components/MultiRobotSidebar/AddRobotDialog.tsx` | Input validation (droneId + URL) |
| `packages/suite-base/src/components/MultiRobotSidebar/RobotCard.tsx` | Displays "Drone {id}" + URL subtitle |
| `packages/suite-base/src/components/MultiRobotSidebar/index.tsx` | Wires dialog → store → routing hook |
| `packages/suite-base/src/providers/CurrentLayoutProvider/defaultLayout.ts` | Initial 3D Panel config using `TOPIC_CONFIG.subscribe` (incl. `waypointMarkers`) |
| `packages/suite-base/src/panels/ThreeDeeRender/ThreeDeeRender.tsx` | `waypoint_markers` via config routing; `waypoint_project_list` via regex subscription for all drones |

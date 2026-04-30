---
name: spikive-lichtblick-groundstation
description: Use when developing, debugging, reviewing, documenting, or planning the Spikive-Lichtblick multi-drone ground-station UI on Lichtblick/Foxglove, especially drone_id topic routing, Select/Visual architecture, MultiRobotSidebar, ThreeDeeRender injections, waypoint flows, ROS1 publish/subscribe, or git/plan alignment.
---

# Spikive-Lichtblick Ground Station

## First pass

Before changing behavior, ground yourself in current repo truth:

1. Check branch, dirty diff, and relevant files. Do not assume `main`, `fix/performance-and-publish`, and the working tree are equivalent.
2. Read current implementation before older plans. Current code wins over `/home/colman/.claude/plans` and the old Claude skill.
3. For feature context, read `doc/00-README.md`, the relevant scenario doc, `doc/05-api-reference.md`, then the matching plan and git commit.
4. Keep user changes. Never revert unrelated dirty files.

Useful history anchors:

- `e58d9ea`: first multi-robot sidebar and minimal UI shell.
- `8a8d9c4`: dynamic `drone_id` routing via `droneTopics`.
- `3f7eea0`: topic-level pickable filtering.
- `3784c14` through `4185f28`: scene modes, waypoint store, project persistence, execution panel, subscription race fix.
- `795540e`: publish pose transform from display frame to `world`.
- `a72bc81`: Spikive title bar, settings dialog, visualization store.
- `08db64c` on `fix/performance-and-publish`: performance experiments, removed Manager frontend work, first-publish race fix. Treat this branch cautiously because it has had pickable regressions such as point clouds becoming clickable.

## Current architecture

This repo is a Lichtblick v1.24.3 fork. Spikive-specific code should stay in:

- `packages/suite-base/src/spikive/`
- `packages/suite-base/src/components/MultiRobotSidebar/`

Known injection or patch points:

- `Workspace.tsx`: replaces native app chrome with Spikive shell and custom sidebars.
- `providers/CurrentLayoutProvider/defaultLayout.ts`: locked single 3D panel default config.
- `panels/ThreeDeeRender/ThreeDeeRender.tsx`: Spikive topic subscriptions, message interception, GoalSet publish, visualization settings.
- `panels/ThreeDeeRender/Renderer.ts`: pickable filtering and selected-object rendering behavior.
- `panels/ThreeDeeRender/Interactions/Interactions.tsx`: selected-object panel switches between drone control, waypoint editing, and waypoint execution.

When patching Lichtblick core, keep the patch minimal and mark the local reason with `Spikive:` comments.

## Core contracts

- `RobotEntry.connectionId` is only a frontend connection/card instance key. Use it for React keys, card removal, and WebSocket probe status.
- `RobotEntry.droneId` is the business identity key that binds UI cards, topic routing, TF frame, selected robotModel, control panels, waypoint stores, and GoalSet.
- `activeDroneId` is the single current select/control target. Card Select, 3D selected robotModel, control panels, waypoints, and GoalSet consume this value.
- `visualDroneId` is the single current 3D display/routing target. In the current single-drone workflow the card Visual button is disabled and default-on; routing should use `visualDroneId` with first-card fallback, not the Select button.
- Active changes must go through the single `setActiveDroneId(droneId)` store action. Do not add `selectId`, derived active objects, or second active IDs.
- Card Select and 3D robotModel selection are just two low-frequency entry points into the same `activeDroneId`.
- SelectObject, control panels, waypoint panels, and GoalSet read `activeDroneId` only.
- `selected_id`, marker `id`, `idFromMessage()`, and `renderable.name` are render-object identifiers only; never infer a business `droneId` from them.
- Card Select calls `setActiveDroneId(robot.droneId)`; 3D robotModel selection parses the robotModel topic and calls the same setter. The disabled Visual button must not steal active selection.
- Current topic naming is `/drone_{id}_<base_topic>` with an underscore prefix, not slash namespaces.
- Current body-follow TF frame is `base{id}`. The usual TF tree is `world -> base{id}`.
- Centralize topic and frame names in `spikive/config/topicConfig.ts`: use `droneTopics()`, `droneBodyFrame()`, and `extractDroneIdFromTopic()`.
- For 3D selection, use only `extractDroneIdFromRobotModelTopic()` on the real `renderable.topic`; generic topic extraction is not a valid active-selection source.
- Avoid hardcoded Spikive topic strings outside `topicConfig.ts` unless intercepting renderer messages with narrow regexes.
- Current visual-drone routing has two layers. `useActiveDroneRouting()` rewrites `configById["3D!spikive3d"].topics` and `followTf` in the layout cache; the mounted `ThreeDeeRender` also applies the same `buildActiveDronePanelConfig()` to its live renderer config so `visualDroneId` affects the current panel immediately.
- `context.setVariable("active_robot_id")` and layout variable interpolation are future direction only. Do not describe them as current implementation.

## Runtime flows

Autonomous flight:

- Select a card with the top-right Select button or select a robot model in the 3D panel; both must write the same `activeDroneId`.
- `Interactions` shows `DroneControlPanel`.
- Flight commands publish to `/control`.
- Pose publish also emits `quadrotor_msgs/GoalSet` to `/goal_with_id`, using the selected drone id.
- Before publishing pose goals, transform from renderer display frame such as `base1` to `world` when possible.

Mapping and waypoint:

- `SceneSelectionDialog` and `useSceneModeStore` switch between `autonomous-flight` and `mapping-waypoint`.
- `WaypointPanel` uses odom interception for current position and sends per-drone waypoint commands through `droneTopics(droneId)`.
- Backend-driven marker/project topics update `useWaypointStore`; frontend recolors waypoint markers before rendering.
- Project save/load/delete/reorder uses per-drone waypoint topics and JSON payloads where implemented.
- In autonomous mode, loaded waypoints show `WaypointExecPanel`; execution state is `/drone_{id}_waypoint_exec_state`.

Backend manager boundary:

- Current Spikive-Lichtblick frontend includes an AstroManager Start/Stop card chain, but it is strictly separate from Select/Visual.
- Adding a card requires two checks: Foxglove WebSocket connectivity and Manager handshake on `/drone_{id}_auto_manager_status` where `message.drone_id` equals the manually entered `Drone ID`.
- Manager Start/Stop uses only the card's `RobotEntry.droneId` to build `/drone_{id}_command_topic`; never use SelectObject, `activeDroneId`, `visualDroneId`, selected ids, or 3D topic parsing for backend lifecycle commands.
- Manager commands are single-publish requests with status ACK. Put `{request_id, seq, drone_id}` JSON in `Command.extra_data`; frontend waits for the same `AutoManager.command.extra_data.request_id` and must not auto-resend on timeout. ACK means backend received/handled the request, not that startup/shutdown succeeded.
- Frontend and backend support only `start_all` and `shutdown_all`. Do not restore `restart_all`, `restart_node`, Restart buttons, or Manage error UI.
- Card Manager status lights are fixed to Drivers: MavROS/Lidar and Tasks: SLAM/Planner.
- Backend authority remains in `/home/colman/Project/drone/Spikive_Manager`: `_on_command()` must reject armed, busy, already-pending, repeated start, empty stop, and unknown commands before queueing, while still echoing the request id in status.

## Debugging playbooks

3D data not visible:

- Check `defaultLayout.ts`, cached layout config, and `useActiveDroneRouting()` output.
- Confirm `visualDroneId`, `visualRouteVersion`, `followTf`, the mounted renderer config, and the six core topic keys all match.
- The card Visual button is disabled/default-on in the current single-drone workflow; it should not dispatch route refreshes.
- For point clouds, the visual `/drone_{id}_cloud_registered` config must include full visualization settings and `pickable: false`; settings sync should use visual/config topic names, not fall back to drone 1 while renderer topics are still loading.
- Backend point cloud frame is usually `world`; odom_visualization should provide `world -> base{id}` when `followTf` is `base{id}`.

Cannot select the drone:

- Check topic-level `pickable` flags. Only the robot model should be selectable.
- Confirm old cached layouts were patched by `ensurePickableFlags()`.
- Inspect `Renderer.ts` pickable filtering before changing selection UI.
- Never allow point clouds, paths, trajectories, or waypoint markers to dispatch active intents.

First publish is dropped:

- Do not call advertise/register and publish back-to-back as the only path. For custom ROS1 messages over Foxglove, advertise with full `schema` and `schemaEncoding: "ros1msg"` as well as local datatypes.
- Do not fix command uncertainty by blind retries. Manager Start/Stop should publish once, then wait for status ACK or fail closed.

Waypoint project list is empty:

- Check subscriptions are added even when `topicsToSubscribe` is initially absent.
- Latched messages can be missed by an early guard. Use `topics` discovery while preserving base subscriptions during disconnect.
- Look for project-list parse warnings and verify JSON shape `{ "projects": [...] }`.

GoalSet flies to the wrong coordinate:

- Confirm whether the renderer display frame is `base{id}`.
- Transform pose publish data to `world` via the renderer transform tree before publishing `/move_base_simple/goal` and `/goal_with_id`.
- Log both source and transformed positions when debugging.

React renders too often:

- Use store `getState()` in intervals/probes instead of tying monitoring to render loops.
- Use granular Zustand selectors and equality functions for card-level state.
- Skip `setState` when snapshots or connection status are unchanged.
- Prefer one shared timer such as `useNowMs()` over per-card intervals.
- WebSocket probes must update by `connectionId`, not `droneId`.

## Development style

- Build the smallest working operational slice, then tighten semantics from real failures.
- Prefer "subtractive UI": hide or remove native Lichtblick chrome and expose only the controls needed for flight, mapping, and maintenance.
- Keep new Spikive logic isolated, but accept targeted core patches when Lichtblick has no extension seam.
- Treat 3D selection, ROS publish/advertise timing, latched subscriptions, layout cache, and coordinate frames as correctness risks.
- For high-frequency paths, avoid broad store subscriptions, store-to-store render loops, active intent dispatches, and regex creation inside message loops.
- Apply route/config repairs on visual/config changes only. Never update active drone or rewrite 3D config from pointcloud, odom, marker, or waypoint high-frequency message handlers.
- Do not add abstractions until the repeated pattern is real. `topicConfig.ts` is the main shared contract.

## Documentation and plan habits

- Write project docs in Chinese unless asked otherwise.
- Update `doc/05-api-reference.md` and the relevant scenario doc when changing public topics, stores, or UI flows.
- Keep `doc/drone-id-routing.md` as the authority for Select/Visual/id boundaries.
- Good plans in this project include context, root cause, minimal files, validation commands or scenarios, and known risks.
- Preserve the distinction between implemented state and evolution direction. Old plans may contain obsolete approaches.

## Architecture summary

Strengths:

- Spikive domain code is mostly concentrated in `spikive/` and `MultiRobotSidebar/`.
- Topic/frame contracts are centralized in `topicConfig.ts`.
- Zustand stores bridge Lichtblick internals and operational UI without forcing large upstream rewrites.
- Historical fixes document major risk areas: pickable filtering, latched subscription race, display-frame to world transform, and first-publish drop.
- Chinese docs and plans make intent, root cause, and verification unusually recoverable.

Weaknesses:

- Several Lichtblick core patches still exist; upgrades require careful patch-by-patch review.
- Dynamic 3D routing depends on both layout cache and mounted renderer internals, so initialization order matters.
- `ThreeDeeRender.tsx` carries many Spikive message interceptors and can grow into a bottleneck.
- `main`, the dirty working tree, and `fix/performance-and-publish` can differ materially; always verify the actual code before acting.

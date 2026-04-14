// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import BatteryFullIcon from "@mui/icons-material/BatteryFull";
import BatteryAlertIcon from "@mui/icons-material/BatteryAlert";
import Battery20Icon from "@mui/icons-material/Battery20";
import { Box, Tooltip, Typography } from "@mui/material";

import { useDroneTelemetryStore } from "@lichtblick/suite-base/spikive/stores/useDroneTelemetryStore";

const LEVEL_COLORS = {
  good: "#4CAF50",
  warning: "#FF9800",
  critical: "#F44336",
} as const;

/**
 * Compact battery indicator for inline use in RobotCard actions row.
 * Always rendered; shows "--" when no data is available.
 */
export function BatteryIndicator(): React.JSX.Element {
  const battery = useDroneTelemetryStore((s) => s.battery);

  if (!battery) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <BatteryFullIcon sx={{ fontSize: 16, color: "text.disabled" }} />
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, fontFamily: "monospace", color: "text.disabled", lineHeight: 1 }}>
          --
        </Typography>
      </Box>
    );
  }

  const color = LEVEL_COLORS[battery.level];
  const Icon = battery.level === "critical" ? BatteryAlertIcon : battery.level === "warning" ? Battery20Icon : BatteryFullIcon;

  return (
    <Tooltip placement="bottom" title={`${battery.percentage}%  ·  ${battery.voltage.toFixed(2)}V (6S)`}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Icon sx={{ fontSize: 16, color }} />
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, fontFamily: "monospace", color, lineHeight: 1 }}>
          {battery.voltage.toFixed(1)}V
        </Typography>
      </Box>
    </Tooltip>
  );
}

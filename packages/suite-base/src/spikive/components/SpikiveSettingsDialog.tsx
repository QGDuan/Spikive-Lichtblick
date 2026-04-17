// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import {
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Stack,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useCallback } from "react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";
import {
  useVisualizationStore,
  type ColorMode,
  type ColorMap,
} from "@lichtblick/suite-base/spikive/stores/useVisualizationStore";

// Performance presets: label → decayTime (seconds)
const PERFORMANCE_PRESETS = [
  { label: "低", value: 15 },
  { label: "中", value: 45 },
  { label: "高", value: 90 },
  { label: "极高", value: 180 },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SpikiveSettingsDialog({ open, onClose }: Props): React.JSX.Element {
  const [colorScheme = "light", setColorScheme] =
    useAppConfigurationValue<string>(AppSetting.COLOR_SCHEME);

  // Read/write visualization settings from Zustand store
  const decayTime = useVisualizationStore((s) => s.decayTime);
  const colorMode = useVisualizationStore((s) => s.colorMode);
  const colorMap = useVisualizationStore((s) => s.colorMap);
  const explicitAlpha = useVisualizationStore((s) => s.explicitAlpha);
  const pointSize = useVisualizationStore((s) => s.pointSize);
  const updateSettings = useVisualizationStore((s) => s.updateSettings);

  const handleBgChange = useCallback(
    (_: unknown, value: string | null) => {
      if (value === "light" || value === "dark") {
        void setColorScheme(value);
      }
    },
    [setColorScheme],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Spikive 设置
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack gap={3} sx={{ pt: 1 }}>
          {/* ── 背景颜色 ── */}
          <FormControl>
            <Typography variant="subtitle2" gutterBottom>
              背景颜色
            </Typography>
            <ToggleButtonGroup
              value={colorScheme}
              exclusive
              onChange={handleBgChange}
              size="small"
            >
              <ToggleButton value="light">白色</ToggleButton>
              <ToggleButton value="dark">黑色</ToggleButton>
            </ToggleButtonGroup>
          </FormControl>

          {/* ── 性能设置 ── */}
          <FormControl>
            <Typography variant="subtitle2" gutterBottom>
              性能设置
            </Typography>
            <ToggleButtonGroup
              value={decayTime}
              exclusive
              onChange={(_, v) => v != null && updateSettings({ decayTime: v })}
              size="small"
            >
              {PERFORMANCE_PRESETS.map((p) => (
                <ToggleButton key={p.value} value={p.value}>
                  {p.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              点云累计时间：{decayTime}s
            </Typography>
          </FormControl>

          {/* ── 点云可视化 ── */}
          <Stack gap={2}>
            <Typography variant="subtitle2">点云可视化</Typography>

            <FormControl size="small">
              <InputLabel>颜色模式</InputLabel>
              <Select
                value={colorMode}
                label="颜色模式"
                onChange={(e) => updateSettings({ colorMode: e.target.value as ColorMode })}
              >
                <MenuItem value="flat">纯色</MenuItem>
                <MenuItem value="gradient">渐变</MenuItem>
                <MenuItem value="colormap">色图</MenuItem>
                <MenuItem value="rgb">RGB</MenuItem>
              </Select>
            </FormControl>

            {colorMode === "colormap" && (
              <FormControl size="small">
                <InputLabel>色图类型</InputLabel>
                <Select
                  value={colorMap}
                  label="色图类型"
                  onChange={(e) => updateSettings({ colorMap: e.target.value as ColorMap })}
                >
                  <MenuItem value="turbo">Turbo</MenuItem>
                  <MenuItem value="rainbow">Rainbow</MenuItem>
                </Select>
              </FormControl>
            )}

            <Typography variant="body2" gutterBottom>
              透明度：{explicitAlpha.toFixed(2)}
            </Typography>
            <Slider
              value={explicitAlpha}
              onChange={(_, v) => updateSettings({ explicitAlpha: v as number })}
              min={0.05}
              max={1}
              step={0.05}
              size="small"
            />

            <Typography variant="body2" gutterBottom>
              点大小：{pointSize.toFixed(1)}
            </Typography>
            <Slider
              value={pointSize}
              onChange={(_, v) => updateSettings({ pointSize: v as number })}
              min={0.1}
              max={5}
              step={0.1}
              size="small"
            />
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

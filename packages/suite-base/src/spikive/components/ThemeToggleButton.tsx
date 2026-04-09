// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import { IconButton, Tooltip } from "@mui/material";
import { useCallback } from "react";

import { AppSetting } from "@lichtblick/suite-base/AppSetting";
import { useAppConfigurationValue } from "@lichtblick/suite-base/hooks";

export function ThemeToggleButton(): React.JSX.Element {
  const [colorScheme = "light", setColorScheme] =
    useAppConfigurationValue<string>(AppSetting.COLOR_SCHEME);

  const isDark = colorScheme === "dark";

  const handleToggle = useCallback(async () => {
    await setColorScheme(isDark ? "light" : "dark");
  }, [isDark, setColorScheme]);

  return (
    <Tooltip title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      <IconButton onClick={handleToggle} size="small">
        {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

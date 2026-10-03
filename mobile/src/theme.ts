import { useColorScheme } from "react-native";

// Palette mirrors the web app's CSS variables (app/globals.css).
const light = {
  background: "#f7f8f6",
  card: "#ffffff",
  foreground: "#1c2521",
  muted: "#777f79",
  accent: "#467a64",
  accentSoft: "#dce9e1",
  border: "#e6e9e5",
  success: "#3d7a5c",
  danger: "#b0603f",
};

const dark: typeof light = {
  background: "#0f1311",
  card: "#161b18",
  foreground: "#e6ebe7",
  muted: "#939c96",
  accent: "#6fa68c",
  accentSoft: "#1f2e27",
  border: "#232b26",
  success: "#6fbd97",
  danger: "#d98a73",
};

export type Theme = typeof light & { isDark: boolean };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === "dark" ? { ...dark, isDark: true } : { ...light, isDark: false };
}

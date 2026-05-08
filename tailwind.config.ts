import type { Config } from "tailwindcss";
import { siteTheme } from "./lib/site-config";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: siteTheme.colors.background,
        panel: siteTheme.colors.panel,
        panelStrong: siteTheme.colors.panelStrong,
        "panel-strong": siteTheme.colors.panelStrong,
        primary: siteTheme.colors.primary,
        primaryStrong: siteTheme.colors.primaryStrong,
        "primary-strong": siteTheme.colors.primaryStrong,
        primarySoft: siteTheme.colors.primarySoft,
        "primary-soft": siteTheme.colors.primarySoft,
        accent: siteTheme.colors.primary,
        accentStrong: siteTheme.colors.primaryStrong,
        "accent-strong": siteTheme.colors.primaryStrong,
        accentSoft: siteTheme.colors.primarySoft,
        "accent-soft": siteTheme.colors.primarySoft,
        ink: siteTheme.colors.ink,
        muted: siteTheme.colors.muted,
        menuSurface: siteTheme.colors.menuSurface,
        "menu-surface": siteTheme.colors.menuSurface,
        menuText: siteTheme.colors.menuText,
        "menu-text": siteTheme.colors.menuText,
        menuMuted: siteTheme.colors.menuMuted,
        "menu-muted": siteTheme.colors.menuMuted,
        menuBorder: siteTheme.colors.menuBorder,
        "menu-border": siteTheme.colors.menuBorder,
        menuHighlight: siteTheme.colors.menuHighlight,
        "menu-highlight": siteTheme.colors.menuHighlight,
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        heading: ["var(--font-display)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 50px rgba(37, 99, 235, 0.18)",
        panel: "0 8px 40px rgba(0, 8, 20, 0.07)",
      },
    },
  },
  plugins: [],
};

export default config;

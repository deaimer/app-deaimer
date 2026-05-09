import type { Metadata } from "next";
import { siteTheme } from "@/lib/site-config";
import "./globals.css";
import "react-quill-new/dist/quill.snow.css";

const themeVariables: Record<string, string> = {
  "--color-background": siteTheme.colors.background,
  "--color-panel": siteTheme.colors.panel,
  "--color-panel-strong": siteTheme.colors.panelStrong,
  "--color-primary": siteTheme.colors.primary,
  "--color-primary-strong": siteTheme.colors.primaryStrong,
  "--color-primary-soft": siteTheme.colors.primarySoft,
  "--color-ink": siteTheme.colors.ink,
  "--color-muted": siteTheme.colors.muted,
  "--color-menu-surface": siteTheme.colors.menuSurface,
  "--color-menu-text": siteTheme.colors.menuText,
  "--color-menu-muted": siteTheme.colors.menuMuted,
  "--color-menu-border": siteTheme.colors.menuBorder,
  "--color-menu-highlight": siteTheme.colors.menuHighlight,
  "--font-sans": siteTheme.fonts.sans,
  "--font-display": siteTheme.fonts.heading,
};

export const metadata: Metadata = {
  title: "Deaimer Platform",
  description: "Deaimer internal platform for admins, managers, candidates, and clients.",
  icons: {
    icon: "/favicon/icon.png",
    shortcut: "/favicon/icon.png",
    apple: "/favicon/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased" style={themeVariables}>
        {children}
      </body>
    </html>
  );
}

/*
 * Route constants for the authenticated app. Settings sub-pages are listed
 * here once so the sidebar, account menu, command palette and the settings
 * sub-nav (APP-4) stay in sync.
 */
export const APP_ROUTES = {
  newChat: "/chat",
  chat: (id: string) => `/chat/${id}`,
  data: "/data",
  settings: "/settings/profile",
  models: "/settings/models",
  usage: "/settings/usage",
} as const;

export interface SettingsNavItem {
  href: string;
  label: string;
  description: string;
}

export const SETTINGS_NAV: readonly SettingsNavItem[] = [
  { href: "/settings/profile", label: "Profile", description: "Your name and email" },
  { href: "/settings/personalization", label: "Personalization", description: "Answer style and custom instructions" },
  { href: "/settings/models", label: "Models and keys", description: "Bring your own API key" },
  { href: "/settings/usage", label: "Usage and plan", description: "Free answers left and daily activity" },
  { href: "/settings/privacy", label: "Privacy and data", description: "Export, delete and password" },
] as const;

/** Title shown in the top bar when a page does not inject its own. */
export function fallbackTitle(pathname: string): string {
  if (pathname.startsWith("/data")) return "Data sources";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname === "/chat") return "New chat";
  return "";
}

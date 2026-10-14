const KEY = "wuup_welcome_seen";

/** localStorage fallback for the welcome dialog (in case the PATCH fails). */
export function welcomeSeenLocally(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeSeenLocally(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

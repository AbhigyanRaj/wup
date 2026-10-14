import { redirect } from "next/navigation";

/** Alias kept for links that use the older name. */
export default function PreferencesAlias() {
  redirect("/settings/personalization");
}

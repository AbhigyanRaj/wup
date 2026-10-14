"use client";

import { ArrowUp } from "lucide-react";
import { dispatchExample } from "./tool-ui";

/** Loads an example into the tool at the top of the page (CustomEvent). */
export function TryExampleButton({ tool, id, title }: { tool: string; id: string; title: string }) {
  return (
    <button
      type="button"
      onClick={() => dispatchExample({ tool, id })}
      className="btn btn--soft btn--sm gap-1.5"
      aria-label={`Try this example in the tool: ${title}`}
    >
      Try this example
      <ArrowUp className="size-3.5" aria-hidden="true" />
    </button>
  );
}

import type { ReactNode } from "react";

/**
 * Numbered steps. Wrap a markdown ordered list:
 *
 *   <Steps>
 *
 *   1. **Open Network Access.** ...
 *   2. ...
 *
 *   </Steps>
 *
 * prose.css turns the list into numbered discs joined by a hairline.
 */
export function Steps({ children }: { children?: ReactNode }) {
  return <div className="steps">{children}</div>;
}

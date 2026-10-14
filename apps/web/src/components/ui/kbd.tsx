import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** Keyboard key hint (.kbd): 20px tall, DM Mono 11px, hairline border. */
export function Kbd({ className, ...rest }: ComponentPropsWithoutRef<"kbd">) {
  return <kbd className={cn("kbd", className)} {...rest} />;
}

/** A key combination, e.g. <KbdGroup keys={["⌘", "K"]} />. */
export function KbdGroup({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </span>
  );
}

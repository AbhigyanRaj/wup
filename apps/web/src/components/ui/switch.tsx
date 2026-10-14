"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  /** Put the label before the switch (settings-row layout). */
  labelPosition?: "start" | "end";
}

/** 36x20 switch; on = blue-600. */
export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(function Switch(
  { className, label, description, labelPosition = "end", id: idProp, ...props },
  ref,
) {
  const auto = React.useId();
  const id = idProp ?? `sw-${auto}`;
  const descId = description ? `${id}-desc` : undefined;

  const control = (
    <SwitchPrimitive.Root
      ref={ref}
      id={id}
      aria-describedby={descId}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5",
        "bg-[#cccccc] transition-colors duration-200 ease-standard hover:bg-[#b3b3b3]",
        "data-[state=checked]:bg-blue-600 data-[state=checked]:hover:bg-blue-700",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-4 rounded-full bg-white shadow-[0_1px_3px_#00000029]",
          "translate-x-0 transition-[translate] duration-200 ease-standard data-[state=checked]:translate-x-4",
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return control;

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        labelPosition === "start" && "flex-row-reverse justify-between",
      )}
    >
      <span className="flex h-6 items-center">{control}</span>
      <div className="flex min-w-0 flex-col">
        <label htmlFor={id} className="cursor-pointer text-[14px] leading-6 text-tx-secondary">
          {label}
        </label>
        {description ? (
          <p id={descId} className="text-[13px] leading-5 text-tx-tertiary">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
});

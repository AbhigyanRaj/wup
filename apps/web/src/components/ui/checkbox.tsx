"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/cn";

export type CheckedState = CheckboxPrimitive.CheckedState;

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** Optional inline label; the whole row becomes clickable. */
  label?: React.ReactNode;
  description?: React.ReactNode;
  invalid?: boolean;
}

/**
 * Tri-state checkbox (true | false | "indeterminate"). 20px box, radius 5,
 * indigo-600 fill when checked or indeterminate.
 */
export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(function Checkbox({ className, label, description, invalid, id: idProp, ...props }, ref) {
  const auto = React.useId();
  const id = idProp ?? `cb-${auto}`;
  const descId = description ? `${id}-desc` : undefined;

  const box = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={descId}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-tx-muted bg-sf-white text-white",
        "transition-[background-color,border-color,box-shadow] duration-150 ease-standard",
        "hover:border-tx-tertiary",
        "data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600",
        "data-[state=indeterminate]:border-indigo-600 data-[state=indeterminate]:bg-indigo-600",
        "aria-invalid:border-red-300 aria-invalid:shadow-[0_0_0_3px_#f8717126]",
        "disabled:cursor-not-allowed disabled:border-st disabled:bg-sf-secondary disabled:data-[state=checked]:bg-indigo-300 disabled:data-[state=checked]:border-indigo-300",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="group/cbi flex items-center justify-center">
        <Check
          aria-hidden="true"
          strokeWidth={2.5}
          className="size-3.5 group-data-[state=indeterminate]/cbi:hidden"
        />
        <Minus
          aria-hidden="true"
          strokeWidth={2.5}
          className="hidden size-3.5 group-data-[state=indeterminate]/cbi:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label) return box;

  return (
    <div className="flex items-start gap-2.5">
      <span className="flex h-6 items-center">{box}</span>
      <div className="flex min-w-0 flex-col">
        <label
          htmlFor={id}
          className="cursor-pointer text-[14px] leading-6 text-tx-secondary"
        >
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

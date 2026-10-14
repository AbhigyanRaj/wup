"use client";

import * as React from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/*
  Kit forms (.input / .field). Pill input 44px (default) or soft "box" input
  48px radius 12 on #f5f5f5. Focus: indigo-300 border + --shadow-focus.
  Error: red border + red focus ring. 16px text below 640px (no iOS zoom).
  Field wires id / aria-describedby / aria-invalid into Input and Textarea.
*/

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
  required?: boolean;
  disabled?: boolean;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

export type InputVariant = "pill" | "box";

const controlBase =
  "w-full border font-sans text-[16px] font-normal leading-6 text-tx placeholder:text-tx-muted sm:text-[15px] " +
  "transition-[border-color,box-shadow,background-color] duration-150 ease-standard " +
  "outline-none focus-visible:border-indigo-300 focus-visible:shadow-focus focus:border-indigo-300 focus:shadow-focus " +
  "aria-invalid:border-red-300 aria-invalid:shadow-[0_0_0_3px_#f8717126] aria-invalid:focus:border-red-300 aria-invalid:focus:shadow-[0_0_0_3px_#f8717140] " +
  "disabled:cursor-not-allowed disabled:bg-sf-secondary disabled:text-tx-muted";

const variantClass: Record<InputVariant, string> = {
  pill: "min-h-11 rounded-full border-st bg-sf-white px-4 py-2.5",
  box: "min-h-12 rounded-xl border-transparent bg-sf-secondary px-4 py-3 hover:bg-sf-tertiary focus:bg-sf-white focus:hover:bg-sf-white",
};

function useFieldProps<
  P extends {
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: React.AriaAttributes["aria-invalid"];
    required?: boolean;
    disabled?: boolean;
  },
>(props: P, invalid?: boolean) {
  const field = React.useContext(FieldContext);
  const describedBy =
    [field?.describedBy, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return {
    id: props.id ?? field?.id,
    "aria-describedby": describedBy,
    "aria-invalid": invalid || field?.invalid || props["aria-invalid"] || undefined,
    required: props.required ?? field?.required,
    disabled: props.disabled ?? field?.disabled,
  };
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  invalid?: boolean;
  /** 16px icon or element inside the left edge. */
  leading?: React.ReactNode;
  /** Icon, button or hint inside the right edge. */
  trailing?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = "pill", invalid, leading, trailing, className, wrapperClassName, type = "text", ...props },
  ref,
) {
  const a11y = useFieldProps(props, invalid);
  const input = (
    <input
      ref={ref}
      type={type}
      {...props}
      {...a11y}
      className={cn(
        controlBase,
        variantClass[variant],
        leading ? "pl-10" : undefined,
        trailing ? "pr-11" : undefined,
        className,
      )}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      {leading ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-tx-muted [&_svg]:size-4 [&_svg]:stroke-[1.5]"
        >
          {leading}
        </span>
      ) : null}
      {input}
      {trailing ? (
        <span className="absolute inset-y-0 right-2 flex items-center text-tx-tertiary [&_svg]:size-4 [&_svg]:stroke-[1.5]">
          {trailing}
        </span>
      ) : null}
    </div>
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: InputVariant;
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { variant = "pill", invalid, className, rows = 4, ...props },
  ref,
) {
  const a11y = useFieldProps(props, invalid);
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      {...a11y}
      className={cn(
        controlBase,
        "min-h-[120px] resize-y px-4 py-3",
        variant === "box"
          ? "rounded-xl border-transparent bg-sf-secondary hover:bg-sf-tertiary focus:bg-sf-white focus:hover:bg-sf-white"
          : "rounded-2xl border-st bg-sf-white",
        className,
      )}
    />
  );
});

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn("text-[14px] font-medium leading-5 text-tx-secondary", className)}
      {...props}
    />
  );
});

export interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  /** Error message; also marks the control aria-invalid. */
  error?: React.ReactNode;
  /** Shows a muted "Optional" tag next to the label. */
  optional?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Explicit control id (auto-generated otherwise). */
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  hint,
  error,
  optional,
  required,
  disabled,
  id: idProp,
  children,
  className,
}: FieldProps) {
  const auto = React.useId();
  const id = idProp ?? `field-${auto}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const value: FieldContextValue = {
    id,
    describedBy: [errorId, hintId].filter(Boolean).join(" ") || undefined,
    invalid: Boolean(error),
    required,
    disabled,
  };
  return (
    <FieldContext.Provider value={value}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor={id}>{label}</Label>
          {optional ? <span className="text-[13px] text-tx-muted">Optional</span> : null}
        </div>
        {children}
        {error ? (
          <p
            id={errorId}
            className="flex items-start gap-1.5 text-[13px] leading-5 text-red-400"
          >
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
        {hint ? (
          <p id={hintId} className="text-[13px] leading-5 text-tx-tertiary">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

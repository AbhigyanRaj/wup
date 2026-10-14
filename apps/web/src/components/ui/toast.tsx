"use client";

import * as React from "react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

export { toast };

const iconCls = "size-[18px]";

/**
 * Kit-styled sonner host. Mount once near the root:
 *   <Toaster />
 * then call toast("Saved"), toast.success(...), toast.error(...), toast.promise(...).
 */
export function Toaster({ className, toastOptions, ...props }: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      theme="light"
      gap={8}
      offset={24}
      mobileOffset={16}
      closeButton
      className={cn("toaster", className)}
      icons={{
        success: <CircleCheck className={iconCls} strokeWidth={1.5} aria-hidden="true" />,
        error: <CircleAlert className={iconCls} strokeWidth={1.5} aria-hidden="true" />,
        warning: <TriangleAlert className={iconCls} strokeWidth={1.5} aria-hidden="true" />,
        info: <Info className={iconCls} strokeWidth={1.5} aria-hidden="true" />,
        loading: (
          <LoaderCircle
            className={cn(iconCls, "animate-spin")}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        ),
        close: <X className="size-3.5" strokeWidth={1.5} aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        ...toastOptions,
        classNames: {
          toast:
            "group/toast relative flex w-full items-start gap-3 rounded-2xl border border-st bg-sf-white py-3.5 pl-4 pr-10 font-sans text-[14px] leading-[1.5] text-tx shadow-card sm:w-[var(--width)]",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-medium text-tx",
          description: "text-[13px] leading-[1.5] text-tx-tertiary",
          icon: "mt-px flex size-[18px] shrink-0 items-center justify-center text-tx-tertiary",
          success: "[&_[data-icon]]:text-green-600",
          error: "[&_[data-icon]]:text-red-400",
          warning: "[&_[data-icon]]:text-yellow-700",
          info: "[&_[data-icon]]:text-indigo-600",
          loading: "[&_[data-icon]]:text-tx-tertiary",
          actionButton:
            "ml-1 inline-flex h-8 shrink-0 items-center self-center rounded-full bg-ink px-3.5 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.2)] transition-transform duration-150 active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
          cancelButton:
            "ml-1 inline-flex h-8 shrink-0 items-center self-center rounded-full bg-sf-secondary px-3.5 text-[13px] font-medium text-tx transition-colors duration-200 hover:bg-sf-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
          closeButton:
            "absolute! left-auto! right-2.5! top-2.5! transform-none! inline-flex size-7 items-center justify-center rounded-full text-tx-muted transition-colors duration-200 hover:bg-sf-secondary hover:text-tx focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
}

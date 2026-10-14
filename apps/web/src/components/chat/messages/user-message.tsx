"use client";

import * as React from "react";
import type { MessageDTO } from "@/lib/types";
import { CopyButton } from "../copy-button";

/** Right-aligned question bubble (#DBEAFE, radius 16, 10/16 padding, max 80%). */
export const UserMessage = React.memo(function UserMessage({ message }: { message: MessageDTO }) {
  return (
    <div className="group/user flex items-start justify-end gap-1.5" data-role="user">
      <CopyButton
        value={message.content}
        label="Copy message"
        className="mt-1 size-8 justify-center px-0 opacity-0 transition-opacity duration-200 group-hover/user:opacity-100 focus-visible:opacity-100 max-md:hidden"
      />
      <div className="max-w-[80%] whitespace-pre-wrap break-words rounded-2xl bg-blue-100 px-4 py-2.5 text-[16px] leading-[1.6] text-tx">
        {message.content}
      </div>
    </div>
  );
});

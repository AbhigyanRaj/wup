"use client";

import * as React from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, ButtonLink } from "@/components/ui/button";

/** Content-area error. The sidebar and top bar stay mounted. */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full items-center justify-center px-4">
      <EmptyState
        as="h2"
        title="This page didn't load"
        description="Something went wrong on our side. Your chats and data are safe. Try again, or start a new chat."
        action={
          <>
            <Button variant="ink" size="sm" onClick={() => unstable_retry()}>
              Try again
            </Button>
            <ButtonLink variant="soft" size="sm" href="/chat">
              New chat
            </ButtonLink>
          </>
        }
      />
    </div>
  );
}

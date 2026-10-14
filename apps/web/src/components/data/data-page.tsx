"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { useAppUI } from "@/components/app/app-ui-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/tabs";
import { useBridges, useCreateSampleBridge } from "@/hooks/data/useBridges";
import { toast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useKnowledge } from "@/hooks/data/useKnowledge";
import { useFeature } from "@/lib/capabilities";
import { BridgeDrawer } from "./bridge-drawer";
import { BridgesTable } from "./bridges-table";
import { DocumentsTable } from "./documents-table";
import { ErrorCallout } from "./parts";

type Tab = "sources" | "documents";

function EmptyArt({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={88} height={88} className="size-[88px] select-none" aria-hidden="true" draggable={false} />
  );
}

export function DataPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const ui = useAppUI();
  const sampleEnabled = useFeature("sample");
  const tab: Tab = params.get("tab") === "documents" ? "documents" : "sources";
  const bridgeId = params.get("bridge");

  const bridges = useBridges();
  const sample = useCreateSampleBridge();
  const addSample = () =>
    sample.mutate(undefined, {
      onSuccess: (res) => {
        toast.success("Sample data added", { description: "Open it to see what you can ask." });
        if (res.connection?.id) setParams({ bridge: res.connection.id });
      },
      onError: (e) => toast.error("Couldn't add the sample data", { description: errorMessage(e) }),
    });
  const docs = useKnowledge();

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const bridgeList = useMemo(() => bridges.data ?? [], [bridges.data]);
  const docList = docs.data ?? [];
  const summary = bridgeList.find((b) => b.id === bridgeId) ?? null;

  const nSources = bridges.data ? ` (${bridgeList.length})` : "";
  const nDocs = docs.data ? ` (${docList.length})` : "";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-8 sm:px-6 md:pt-12 lg:px-10">
      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-[32px] font-display-medium leading-[1.15] tracking-[-0.02em] text-tx">Data sources</h1>
          <p className="mt-2 text-[16px] leading-[1.6] text-tx-tertiary">Everything wuup can read. Read only, always.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="soft"
            leadingIcon={<Upload className="size-4" strokeWidth={1.5} aria-hidden="true" />}
            onClick={() => ui.openDialog("upload")}
          >
            Upload document
          </Button>
          <Button
            variant="ink"
            leadingIcon={<Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />}
            onClick={() => ui.openDialog("connect")}
            data-testid="connect-data"
          >
            Connect data
          </Button>
        </div>
      </header>

      <div className="mt-8 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <SegmentedControl<Tab>
          aria-label="Data source type"
          value={tab}
          onChange={(v) => setParams({ tab: v === "documents" ? "documents" : null })}
          options={[
            { value: "sources", label: `Databases and sheets${nSources}` },
            { value: "documents", label: `Documents${nDocs}` },
          ]}
        />
      </div>

      <div className="mt-6">
        {tab === "sources" ? (
          bridges.isError && !bridges.data ? (
            <ErrorCallout
              error={{ title: "Couldn't load your data sources", message: bridges.error?.message ?? "", hint: "Check your connection and reload the page." }}
            />
          ) : !bridges.isPending && bridgeList.length === 0 ? (
            <div className="rounded-2xl border border-st-secondary bg-sf-white" data-testid="sources-empty">
              <EmptyState
                visual={<EmptyArt src="/images/home/tile-connect.webp" />}
                title="Connect your first database"
                description="Point wuup at MongoDB or a Google Sheet. It learns the schema, hides sensitive fields and never writes."
                action={
                  <>
                    <Button variant="ink" onClick={() => ui.openDialog("connect")}>
                      Connect data
                    </Button>
                    {sampleEnabled ? (
                      <Button variant="soft" disabled={sample.isPending} onClick={addSample}>
                        {sample.isPending ? "Adding sample data..." : "Try sample data"}
                      </Button>
                    ) : null}
                  </>
                }
              />
            </div>
          ) : (
            <BridgesTable
              bridges={bridgeList}
              loading={bridges.isPending}
              selectedId={bridgeId}
              onOpen={(id) => setParams({ bridge: id })}
            />
          )
        ) : docs.isError && !docs.data ? (
          <ErrorCallout
            error={{ title: "Couldn't load your documents", message: docs.error?.message ?? "", hint: "Check your connection and reload the page." }}
          />
        ) : !docs.isPending && docList.length === 0 ? (
          <div className="rounded-2xl border border-st-secondary bg-sf-white" data-testid="documents-empty">
            <EmptyState
              visual={<EmptyArt src="/images/home/tile-upload.webp" />}
              title="No documents yet"
              description="Upload PDFs and text files. wuup answers from them with numbered citations."
              action={
                <Button variant="ink" onClick={() => ui.openDialog("upload")}>
                  Upload document
                </Button>
              }
            />
          </div>
        ) : (
          <DocumentsTable docs={docList} loading={docs.isPending} />
        )}
      </div>

      <BridgeDrawer bridgeId={bridgeId} summary={summary} onClose={() => setParams({ bridge: null })} />
    </div>
  );
}

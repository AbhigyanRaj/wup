"use client";

import Link from "next/link";
import { CircleCheck, ChevronDown, Database, Eye, EyeOff, Search, Table2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { dbSelectionState, formatCount, MONGO_URL_RE } from "@/lib/bridges";
import { ErrorCallout, ReadOnlyCard, SectionLabel } from "./parts";
import type { MongoWizard } from "./use-mongo-wizard";

/* ------------------------------------------------------------------ */
/* Step 1: connection string                                          */
/* ------------------------------------------------------------------ */

export function MongoUrlStep({ w }: { w: MongoWizard }) {
  const { state, dispatch } = w;
  const looksWrong = state.url.trim().length > 8 && !MONGO_URL_RE.test(state.url.trim());
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Connection string"
        error={looksWrong ? "It should start with mongodb:// or mongodb+srv://" : undefined}
        hint={
          <>
            Use a database user with only the <span className="font-medium text-tx-secondary">read</span> role.{" "}
            <Link
              href="/guides/mongodb-read-only-user"
              target="_blank"
              className="text-indigo-800 underline decoration-indigo-200 underline-offset-2 hover:decoration-indigo-600"
            >
              How to create a read-only user
            </Link>
            . Your string is encrypted at rest.
          </>
        }
      >
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          value={state.url}
          placeholder="mongodb+srv://reader:password@cluster0.xxxx.mongodb.net"
          className="font-mono text-[14px]! placeholder:font-sans"
          onChange={(e) => dispatch({ type: "setUrl", url: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              w.next();
            }
          }}
          aria-label="MongoDB connection string"
          data-testid="mongo-url"
        />
      </Field>
      {state.error ? <ErrorCallout error={state.error} /> : null}
      <ReadOnlyCard />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2: pick databases and collections                             */
/* ------------------------------------------------------------------ */

export function MongoPickStep({ w }: { w: MongoWizard }) {
  const { state, dispatch } = w;
  const test = state.test;
  if (!test) return null;
  const filter = state.filter.trim().toLowerCase();
  const showFilter = w.totalCollections > 12;

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-[14px] text-green-700">
        <CircleCheck className="size-4 text-green-600" strokeWidth={1.5} aria-hidden="true" />
        Connected. Found {test.databases.length} database{test.databases.length === 1 ? "" : "s"} and {w.totalCollections}{" "}
        collection{w.totalCollections === 1 ? "" : "s"}.
      </p>

      {test.databases.length === 0 ? (
        <div className="rounded-2xl border border-st-secondary bg-sf-secondary/50 px-5 py-6 text-center text-[14px] text-tx-tertiary">
          This user can&apos;t see any databases. Give it the read role on the databases you want wuup to use.
        </div>
      ) : (
        <>
          {showFilter ? (
            <Input
              variant="box"
              leading={<Search />}
              value={state.filter}
              onChange={(e) => dispatch({ type: "setFilter", filter: e.target.value })}
              placeholder="Filter collections"
              aria-label="Filter collections"
              className="min-h-10! py-2!"
            />
          ) : null}
          <div
            className="overflow-hidden rounded-2xl border border-st bg-sf-white"
            role="group"
            aria-label="Databases and collections"
          >
            {test.databases.map((db, i) => {
              const chosen = state.selection[db.db] ?? [];
              const tri = dbSelectionState(db.collections.length, chosen.length);
              const open = state.expanded.includes(db.db) || !!filter;
              const colls = db.collections.filter((c) => !filter || c.name.toLowerCase().includes(filter));
              if (filter && colls.length === 0) return null;
              const panelId = `db-panel-${i}`;
              return (
                <div key={db.db} className="border-t border-st-secondary first:border-t-0">
                  <div className="flex items-center gap-3 bg-sf-secondary/50 pl-4 pr-2">
                    <Checkbox
                      checked={tri === "all" ? true : tri === "some" ? "indeterminate" : false}
                      onCheckedChange={() => dispatch({ type: "toggleDb", db: db.db })}
                      aria-label={`Select every collection in ${db.db}`}
                    />
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => dispatch({ type: "toggleExpanded", db: db.db })}
                      className="flex min-h-12 flex-1 items-center gap-2.5 rounded-lg px-1 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-400"
                    >
                      <Database className="size-4 text-tx-tertiary" strokeWidth={1.5} aria-hidden="true" />
                      <span className="truncate font-mono text-[14px] text-tx">{db.db}</span>
                      <span className="rounded-full bg-sf-white px-2 py-0.5 text-[12px] tabular-nums text-tx-tertiary shadow-[inset_0_0_0_1px_#f0f0f0]">
                        {chosen.length} of {db.collections.length}
                      </span>
                      <ChevronDown
                        className={cn(
                          "ml-auto size-4 text-tx-tertiary transition-transform duration-200 ease-standard",
                          open && "rotate-180",
                        )}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  {open ? (
                    <ul id={panelId} className="py-1">
                      {colls.map((c) => {
                        const id = `coll-${i}-${c.name}`;
                        const on = chosen.includes(c.name);
                        return (
                          <li key={c.name}>
                            <label
                              htmlFor={id}
                              className="flex min-h-10 cursor-pointer items-center gap-3 py-1.5 pl-11 pr-4 transition-colors duration-150 hover:bg-sf-secondary/60"
                            >
                              <Checkbox
                                id={id}
                                checked={on}
                                onCheckedChange={() => dispatch({ type: "toggleCollection", db: db.db, coll: c.name })}
                              />
                              <span className={cn("min-w-0 flex-1 truncate font-mono text-[13px]", on ? "text-tx" : "text-tx-tertiary")}>
                                {c.name}
                              </span>
                              {c.type === "view" || c.count === null ? (
                                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[12px] text-sky-700">view</span>
                              ) : (
                                <span className="text-[13px] tabular-nums text-tx-tertiary">{formatCount(c.count)}</span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="text-[13px] leading-5 text-tx-tertiary">
            Sessions, migrations and internal collections start unticked. Selecting a whole database also includes collections you
            add later.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3: privacy (sensitive fields)                                 */
/* ------------------------------------------------------------------ */

export function MongoPrivacyStep({ w }: { w: MongoWizard }) {
  const { state, dispatch } = w;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] leading-[1.6] text-tx-secondary">
        These fields look sensitive, so they start hidden. Hidden fields are removed from every result, and wuup can&apos;t filter
        or group by them. Click a field to change it.
      </p>
      <div className="flex flex-col gap-2.5">
        {w.privacyRows.map(({ key, fields }) => {
          const hiddenCount = (state.hidden[key] ?? []).filter((f) => fields.includes(f)).length;
          return (
            <div key={key} className="rounded-2xl border border-st-secondary bg-sf-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Table2 className="size-4 text-tx-tertiary" strokeWidth={1.5} aria-hidden="true" />
                <p className="min-w-0 flex-1 truncate font-mono text-[13px] text-tx">{key}</p>
                <span className="text-[12px] text-tx-tertiary">
                  {hiddenCount} of {fields.length} hidden
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {fields.map((f) => (
                  <RedactChip
                    key={f}
                    field={f}
                    hidden={(state.hidden[key] ?? []).includes(f)}
                    onToggle={() => dispatch({ type: "toggleHidden", key, field: f })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-tx-tertiary">You can hide more fields later from the bridge details panel.</p>
    </div>
  );
}

export function RedactChip({
  field,
  hidden,
  onToggle,
  disabled,
  meta,
  title,
}: {
  field: string;
  hidden: boolean;
  onToggle: () => void;
  disabled?: boolean;
  meta?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={hidden}
      disabled={disabled}
      onClick={onToggle}
      title={title}
      aria-label={`${field}: ${hidden ? "hidden from wuup, click to share" : "shared, click to hide"}`}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[12.5px] transition-colors duration-150 ease-standard",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed",
        hidden
          ? "border-red-100 bg-red-50 text-red-400 hover:bg-red-100"
          : "border-st bg-sf-white text-tx-secondary hover:border-tx-muted enabled:hover:bg-sf-secondary",
      )}
    >
      {hidden ? (
        <EyeOff className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Eye className="size-3.5 text-tx-muted" strokeWidth={1.5} aria-hidden="true" />
      )}
      <span className={cn(hidden && "line-through decoration-red-300")}>{field}</span>
      {meta ? <span className="font-sans text-[11px] text-tx-muted">{meta}</span> : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4: name                                                       */
/* ------------------------------------------------------------------ */

export function MongoNameStep({ w }: { w: MongoWizard }) {
  const { state, dispatch } = w;
  const hiddenTotal = w.privacyRows.reduce((n, r) => n + (state.hidden[r.key] ?? []).length, 0);
  return (
    <div className="flex flex-col gap-5">
      <Field label="Name" hint="Shown in your data sources list and in answers.">
        <Input
          autoFocus
          value={state.name}
          maxLength={80}
          onChange={(e) => dispatch({ type: "setName", name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              w.next();
            }
          }}
          data-testid="bridge-name"
        />
      </Field>
      <div className="rounded-2xl border border-st-secondary bg-sf-secondary/40 px-5 py-4">
        <SectionLabel className="mb-2">wuup will read</SectionLabel>
        <ul className="flex flex-col divide-y divide-st-secondary">
          {w.scope.map((s) => (
            <li key={s.db} className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
              <span className="shrink-0 font-mono text-tx">{s.db}</span>
              <span className="min-w-0 text-right text-tx-tertiary">
                {s.collections[0] === "*" ? "Every collection, including new ones" : s.collections.join(", ")}
              </span>
            </li>
          ))}
          {hiddenTotal > 0 ? (
            <li className="flex items-center justify-between gap-4 py-2 text-[14px]">
              <span className="text-tx-secondary">Hidden fields</span>
              <span className="inline-flex items-center gap-1.5 text-tx-tertiary">
                <EyeOff className="size-3.5 text-red-400" strokeWidth={1.5} aria-hidden="true" />
                {hiddenTotal}
              </span>
            </li>
          ) : null}
        </ul>
      </div>
      {state.error ? <ErrorCallout error={state.error} /> : null}
    </div>
  );
}

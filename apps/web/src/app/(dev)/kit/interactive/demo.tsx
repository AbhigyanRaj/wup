"use client";

import * as React from "react";
import {
  Bell,
  Copy,
  Database,
  FileText,
  LayoutGrid,
  LogOut,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Share2,
  Trash2,
  User,
  Workflow,
} from "lucide-react";

import { ConfirmDialog, Dialog, dialogButtonClass } from "@/components/ui/dialog";
import { Drawer, type DrawerSide } from "@/components/ui/drawer";
import {
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { Toaster, toast } from "@/components/ui/toast";
import {
  SegmentedControl,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CompactAccordion, FaqAccordion } from "@/components/ui/accordion";
import { HAccordion } from "@/components/ui/h-accordion";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Checkbox, type CheckedState } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { Stepper } from "@/components/ui/stepper";
import { EmptyState } from "@/components/ui/empty-state";
import { TableShell, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table-shell";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  useCommandShortcut,
} from "@/components/ui/command";

/* ---------- local demo scaffolding ---------- */

const ink = dialogButtonClass.ink;
const soft = dialogButtonClass.soft;

const iconBtn =
  "inline-flex size-10 items-center justify-center rounded-full bg-sf-secondary text-tx-secondary transition-colors duration-200 ease-standard hover:bg-sf-white hover:shadow-[inset_0_0_0_1px_#e6e6e6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400";

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-[12px] font-medium uppercase leading-4 tracking-[0.17em] text-tx-tertiary">
          {eyebrow}
        </p>
        <h2
          id={`${id}-title`}
          className="font-display text-[28px] font-normal leading-[1.2] tracking-[-0.02em] text-tx md:text-[32px]"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "min-w-0 rounded-2xl border border-st-secondary bg-sf-white p-5 md:p-6 " + (className ?? "")
      }
    >
      {title ? (
        <h3 className="mb-4 text-[14px] font-medium leading-5 text-tx-tertiary">{title}</h3>
      ) : null}
      {children}
    </div>
  );
}

const faq = [
  {
    id: "q1",
    title: "Which data sources can wuup connect to?",
    content:
      "MongoDB, Postgres and a growing list of warehouses. Connections are read-only and schema-aware, so every answer is grounded in your real tables.",
  },
  {
    id: "q2",
    title: "Does wuup ever write to my database?",
    content:
      "No. Queries run through a read-only bridge and are validated before execution. Anything that would mutate data is rejected.",
  },
  {
    id: "q3",
    title: "How are credits counted?",
    content: "One credit per answered question. Follow-ups in the same thread are free for 10 minutes.",
  },
  {
    id: "q4",
    title: "Can I invite my team?",
    content: "Yes. Team plans include shared workspaces, roles and an audit log of every question asked.",
  },
];

const ratesGroups = [
  {
    id: "g1",
    title: "Query credits",
    subtitle: "Per question / per follow-up",
    icon: <Database />,
    content: "Questions cost 1 credit. Follow-ups within 10 minutes are free.",
  },
  {
    id: "g2",
    title: "Workflows",
    subtitle: "Scheduled reports and alerts",
    icon: <Workflow />,
    content: "Each scheduled run costs 2 credits. Alerts are free up to 50 per month.",
  },
  {
    id: "g3",
    title: "Exports",
    icon: <FileText />,
    content: "CSV and PDF exports are included in every plan.",
  },
];

function MockList() {
  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-st" />
        <span className="size-2.5 rounded-full bg-st" />
        <span className="size-2.5 rounded-full bg-st" />
      </div>
      {[80, 64, 72, 48].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="size-6 shrink-0 rounded-md bg-indigo-100" />
          <span className="h-2.5 rounded-full bg-sf-tertiary" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

const hItems = [
  {
    id: "ask",
    label: "Ask",
    title: "Ask in plain language",
    body: "Type a question, get a grounded answer with the exact query that produced it.",
    art: { a: "#a7c0f1", b: "#e8effc" },
    media: <MockList />,
  },
  {
    id: "explore",
    label: "Explore",
    title: "Explore your schema",
    body: "Browse collections, fields and relationships without writing a line of code.",
    art: { a: "#93c5fd", b: "#dbeafe" },
    media: <MockList />,
  },
  {
    id: "share",
    label: "Share",
    title: "Share answers",
    body: "Turn any answer into a live card your team can open, comment on and re-run.",
    art: { a: "#7dd3fc", b: "#e0f2fe" },
    media: <MockList />,
  },
  {
    id: "automate",
    label: "Automate",
    title: "Automate reports",
    body: "Schedule questions and get the answers in your inbox or channel.",
    art: { a: "#81a0e9", b: "#e8effc" },
    media: <MockList />,
  },
];

const rows = [
  { name: "orders_daily", source: "MongoDB", runs: 1284, credits: 2568, status: "Active" },
  { name: "churn_watch", source: "Postgres", runs: 312, credits: 624, status: "Paused" },
  { name: "weekly_revenue", source: "MongoDB", runs: 52, credits: 104, status: "Active" },
  { name: "signup_funnel", source: "BigQuery", runs: 730, credits: 1460, status: "Active" },
  { name: "refund_alerts", source: "Postgres", runs: 98, credits: 196, status: "Failed" },
  { name: "inventory_low", source: "MongoDB", runs: 2210, credits: 4420, status: "Active" },
];

const statusPill: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Paused: "bg-sf-tertiary text-tx-tertiary",
  Failed: "bg-red-50 text-red-400",
};

/* ---------- page ---------- */

export function InteractiveKitDemo() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [lgOpen, setLgOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [dangerOpen, setDangerOpen] = React.useState(false);
  const [drawer, setDrawer] = React.useState<DrawerSide | null>(null);
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showMeta, setShowMeta] = React.useState(false);
  const [range, setRange] = React.useState("7d");
  const [view, setView] = React.useState("list");
  const [children, setChildren] = React.useState([true, false, true]);
  const [notify, setNotify] = React.useState(true);
  const [step, setStep] = React.useState(2);
  const [email, setEmail] = React.useState("not-an-email");

  useCommandShortcut(() => setCmdOpen((o) => !o));

  const parent: CheckedState = children.every(Boolean)
    ? true
    : children.some(Boolean)
      ? "indeterminate"
      : false;

  const emailError = /.+@.+\..+/.test(email) ? undefined : "Enter a valid email address.";

  return (
    <TooltipProvider>
      <main className="min-h-dvh bg-bg font-sans text-tx">
        <div className="mx-auto flex w-[88%] max-w-[1200px] flex-col gap-24 py-16 md:w-10/12 md:py-24">
          <header className="flex flex-col items-start gap-4">
            <p className="text-[12px] font-medium uppercase tracking-[0.17em] text-tx-tertiary">
              wuup kit / dev only
            </p>
            <h1 className="font-display text-[40px] font-normal leading-[1.1] tracking-[-1px] text-tx md:text-[52px]">
              Interactive primitives
            </h1>
            <p className="max-w-[640px] text-[18px] leading-[1.65] text-tx-tertiary">
              Every overlay, control and feedback component in its states. Tab through the page to
              check focus rings; press <kbd className="font-mono text-[14px]">Cmd K</kbd> for the
              palette.
            </p>
          </header>

          {/* ---------------------------------------------------------------- */}
          <Section id="overlays" eyebrow="Overlays" title="Dialogs, drawers and menus">
            <div className="grid gap-2 md:grid-cols-2">
              <Panel title="Dialog">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={ink}
                    data-testid="open-dialog"
                    onClick={() => setDialogOpen(true)}
                  >
                    Open dialog
                  </button>
                  <button type="button" className={soft} onClick={() => setLgOpen(true)}>
                    Large dialog
                  </button>
                  <button type="button" className={soft} onClick={() => setConfirmOpen(true)}>
                    Confirm
                  </button>
                  <button
                    type="button"
                    className={dialogButtonClass.danger}
                    onClick={() => setDangerOpen(true)}
                  >
                    <Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    Delete source
                  </button>
                </div>
              </Panel>
              <Panel title="Drawer">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={soft} onClick={() => setDrawer("right")}>
                    Right
                  </button>
                  <button type="button" className={soft} onClick={() => setDrawer("left")}>
                    Left
                  </button>
                  <button type="button" className={soft} onClick={() => setDrawer("bottom")}>
                    Bottom
                  </button>
                </div>
              </Panel>
              <Panel title="Menu, popover, tooltip">
                <div className="flex flex-wrap items-center gap-2">
                  <MenuRoot>
                    <MenuTrigger className={soft} data-testid="open-menu">
                      Actions
                      <MoreHorizontal className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    </MenuTrigger>
                    <MenuContent>
                      <MenuLabel>Source</MenuLabel>
                      <MenuItem icon={<Pencil />} shortcut="E">
                        Rename
                      </MenuItem>
                      <MenuItem icon={<Copy />} shortcut="D">
                        Duplicate
                      </MenuItem>
                      <MenuItem icon={<Share2 />}>Share</MenuItem>
                      <MenuItem icon={<Settings />} disabled>
                        Settings (disabled)
                      </MenuItem>
                      <MenuSeparator />
                      <MenuLabel>View</MenuLabel>
                      <MenuCheckboxItem
                        checked={showGrid}
                        onCheckedChange={(v) => setShowGrid(v === true)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        Show grid
                      </MenuCheckboxItem>
                      <MenuCheckboxItem
                        checked={showMeta}
                        onCheckedChange={(v) => setShowMeta(v === true)}
                        onSelect={(e) => e.preventDefault()}
                      >
                        Show metadata
                      </MenuCheckboxItem>
                      <MenuSeparator />
                      <MenuItem
                        icon={<Trash2 />}
                        tone="danger"
                        onSelect={() => setDangerOpen(true)}
                      >
                        Delete
                      </MenuItem>
                    </MenuContent>
                  </MenuRoot>

                  <Popover>
                    <PopoverTrigger className={soft}>Popover</PopoverTrigger>
                    <PopoverContent>
                      <p className="text-[14px] font-medium text-tx">Share this answer</p>
                      <p className="mt-1">Anyone in your workspace with the link can view it.</p>
                      <div className="mt-3">
                        <Input
                          aria-label="Share link"
                          readOnly
                          value="https://wuup.in/a/7f3k"
                          className="min-h-10 text-[14px]"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Tooltip content="Notifications">
                    <button type="button" className={iconBtn} aria-label="Notifications">
                      <Bell className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Profile and settings" side="bottom">
                    <button type="button" className={iconBtn} aria-label="Profile">
                      <User className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              </Panel>
              <Panel title="Toasts">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={soft} onClick={() => toast("Draft saved")}>
                    Default
                  </button>
                  <button
                    type="button"
                    className={soft}
                    onClick={() =>
                      toast.success("Source connected", {
                        description: "orders_db is ready to query.",
                      })
                    }
                  >
                    Success
                  </button>
                  <button
                    type="button"
                    className={soft}
                    onClick={() =>
                      toast.error("Query failed", {
                        description: "The bridge timed out after 30s.",
                        action: { label: "Retry", onClick: () => toast("Retrying") },
                      })
                    }
                  >
                    Error
                  </button>
                  <button
                    type="button"
                    className={soft}
                    onClick={() =>
                      toast.promise(new Promise((r) => setTimeout(r, 1600)), {
                        loading: "Running query",
                        success: "Answer ready",
                        error: "Something went wrong",
                      })
                    }
                  >
                    Promise
                  </button>
                </div>
              </Panel>
              <Panel title="Command palette" className="md:col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={soft}
                    data-testid="open-command"
                    onClick={() => setCmdOpen(true)}
                  >
                    <Search className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    Search or jump to
                    <kbd className="ml-2 rounded-md border border-st bg-sf-white px-1.5 font-mono text-[11px] text-tx-tertiary">
                      Cmd K
                    </kbd>
                  </button>
                </div>
              </Panel>
            </div>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="tabs" eyebrow="Navigation" title="Tabs and segmented control">
            <div className="grid gap-2 md:grid-cols-2">
              <Panel title="Tabs (showcase pills)">
                <Tabs defaultValue="answers">
                  <TabsList aria-label="Workspace sections">
                    <TabsTrigger value="answers" icon={<LayoutGrid />}>
                      Answers
                    </TabsTrigger>
                    <TabsTrigger value="sources" icon={<Database />}>
                      Sources
                    </TabsTrigger>
                    <TabsTrigger value="flows" icon={<Workflow />}>
                      Workflows
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="answers" className="text-[15px] leading-[1.6] text-tx-tertiary">
                    Saved answers from your team, newest first.
                  </TabsContent>
                  <TabsContent value="sources" className="text-[15px] leading-[1.6] text-tx-tertiary">
                    Three connected databases, all read-only.
                  </TabsContent>
                  <TabsContent value="flows" className="text-[15px] leading-[1.6] text-tx-tertiary">
                    Scheduled questions and alerts.
                  </TabsContent>
                </Tabs>
              </Panel>
              <Panel title="Segmented control">
                <div className="flex flex-col items-start gap-4">
                  <SegmentedControl
                    aria-label="Date range"
                    value={range}
                    onChange={setRange}
                    options={[
                      { value: "24h", label: "24h" },
                      { value: "7d", label: "7 days" },
                      { value: "30d", label: "30 days" },
                      { value: "90d", label: "90 days" },
                    ]}
                  />
                  <SegmentedControl
                    aria-label="View"
                    size="sm"
                    value={view}
                    onChange={setView}
                    options={[
                      { value: "list", label: "List" },
                      { value: "grid", label: "Grid" },
                      { value: "chart", label: "Chart", disabled: true },
                    ]}
                  />
                  <p className="text-[14px] text-tx-tertiary">
                    Range: <span className="text-tx">{range}</span>, view:{" "}
                    <span className="text-tx">{view}</span>
                  </p>
                </div>
              </Panel>
            </div>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="accordion" eyebrow="Disclosure" title="Accordions">
            <div className="flex flex-col gap-10">
              <FaqAccordion items={faq} defaultOpen={["q1"]} />
              <CompactAccordion items={ratesGroups} defaultOpen={["g1"]} />
              <HAccordion items={hItems} height={560} />
            </div>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="forms" eyebrow="Forms" title="Inputs and controls">
            <div className="grid gap-2 md:grid-cols-2">
              <Panel title="Inputs">
                <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
                  <Field label="Workspace name" hint="Shown to everyone you invite.">
                    <Input placeholder="Acme analytics" />
                  </Field>
                  <Field label="Email" error={emailError}>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      leading={<Mail />}
                    />
                  </Field>
                  <Field label="Search (box variant)" optional>
                    <Input variant="box" placeholder="Search sources" leading={<Search />} />
                  </Field>
                  <Field label="Connection string" disabled>
                    <Input value="mongodb+srv://read-only" readOnly />
                  </Field>
                  <Field label="Notes">
                    <Textarea placeholder="What should this workspace track?" />
                  </Field>
                </form>
              </Panel>
              <Panel title="Checkbox and switch">
                <div className="flex flex-col gap-6">
                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-3 text-[14px] font-medium text-tx-secondary">
                      Notify me about
                    </legend>
                    <Checkbox
                      label="All events"
                      checked={parent}
                      onCheckedChange={(v) => setChildren(children.map(() => v === true))}
                    />
                    <div className="ml-7 flex flex-col gap-3">
                      {["Failed queries", "New members", "Weekly summary"].map((l, i) => (
                        <Checkbox
                          key={l}
                          label={l}
                          checked={children[i]}
                          onCheckedChange={(v) =>
                            setChildren(children.map((c, j) => (j === i ? v === true : c)))
                          }
                        />
                      ))}
                    </div>
                    <Checkbox label="Billing emails (disabled)" checked disabled />
                    <Checkbox
                      label="I accept the terms"
                      description="Required to create a workspace."
                      invalid
                    />
                  </fieldset>
                  <div className="flex flex-col gap-4 border-t border-st-secondary pt-5">
                    <Switch
                      label="Email notifications"
                      description="A daily digest at 09:00."
                      checked={notify}
                      onCheckedChange={setNotify}
                    />
                    <Switch label="Beta features" defaultChecked={false} />
                    <Switch label="Locked (disabled)" checked disabled />
                  </div>
                </div>
              </Panel>
            </div>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="feedback" eyebrow="Feedback" title="Loading and progress">
            <div className="grid gap-2 md:grid-cols-3">
              <Panel title="Skeleton">
                <div className="flex items-center gap-3">
                  <Skeleton shape="circle" className="size-10" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton shape="block" className="mt-5 h-28 w-full" />
                <SkeletonText className="mt-5" lines={3} />
              </Panel>
              <Panel title="Spinner and progress">
                <div className="flex items-center gap-4">
                  <Spinner size="sm" />
                  <Spinner />
                  <Spinner size="lg" />
                  <Spinner className="text-indigo-600" />
                </div>
                <div className="mt-6 flex flex-col gap-5">
                  <Progress value={62} label="Monthly credits" showValue />
                  <Progress value={88} tone="red" label="Storage" showValue />
                  <Progress value={100} tone="green" label="Sync" showValue />
                  <Progress value={35} tone="indigo" aria-label="Indigo tone" />
                  <Progress value={null} label="Indexing schema" />
                </div>
              </Panel>
              <Panel title="Stepper">
                <Stepper
                  steps={["Connect", "Select tables", "Name workspace", "Invite team"]}
                  current={step}
                />
                <div className="mt-6 flex justify-between gap-2">
                  <button
                    type="button"
                    className={soft}
                    disabled={step === 1}
                    onClick={() => setStep((s) => Math.max(1, s - 1))}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className={ink}
                    disabled={step === 4}
                    onClick={() => setStep((s) => Math.min(4, s + 1))}
                  >
                    Next
                  </button>
                </div>
              </Panel>
            </div>
          </Section>

          {/* ---------------------------------------------------------------- */}
          <Section id="data" eyebrow="Data" title="Table and empty state">
            <TableShell
              caption="Scheduled workflows"
              stickyHeader
              maxHeight={320}
              stacked
              toolbar={
                <>
                  <p className="text-[16px] font-medium text-tx">Workflows</p>
                  <button type="button" className={soft}>
                    <Plus className="size-4" strokeWidth={1.5} aria-hidden="true" />
                    New
                  </button>
                </>
              }
            >
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Source</Th>
                  <Th numeric>Runs</Th>
                  <Th numeric>Credits</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.map((r) => (
                  <Tr key={r.name} interactive>
                    <Td primary label="Name">
                      {r.name}
                    </Td>
                    <Td muted label="Source">
                      {r.source}
                    </Td>
                    <Td numeric label="Runs">
                      {r.runs.toLocaleString("en-US")}
                    </Td>
                    <Td numeric label="Credits">
                      {r.credits.toLocaleString("en-US")}
                    </Td>
                    <Td label="Status">
                      <span
                        className={
                          "inline-flex rounded-full px-2.5 py-0.5 text-[13px] " + statusPill[r.status]
                        }
                      >
                        {r.status}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </TableShell>

            <Panel>
              <EmptyState
                title="No saved answers yet"
                description="Ask a question about your data and save the answer to see it here."
                action={
                  <button type="button" className={soft} onClick={() => setCmdOpen(true)}>
                    Ask a question
                  </button>
                }
              />
            </Panel>
          </Section>
        </div>

        {/* ---------- overlays ---------- */}
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Rename source"
          description="This name appears in answers and the sidebar."
          footer={
            <>
              <button type="button" className={soft} onClick={() => setDialogOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className={ink}
                onClick={() => {
                  setDialogOpen(false);
                  toast.success("Source renamed");
                }}
              >
                Save
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input defaultValue="orders_db" />
            </Field>
            <Field label="Description" optional>
              <Textarea rows={3} placeholder="Production orders, read replica" />
            </Field>
          </div>
        </Dialog>

        <Dialog
          open={lgOpen}
          onOpenChange={setLgOpen}
          size="lg"
          title="Query details"
          description="The exact query wuup generated for this answer."
        >
          <pre className="overflow-x-auto rounded-xl bg-sf-secondary p-4 font-mono text-[13px] leading-[1.6] text-tx-secondary">
            {`db.orders.aggregate([
  { $match: { createdAt: { $gte: ISODate("2026-10-07") } } },
  { $group: { _id: "$region", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } }
])`}
          </pre>
        </Dialog>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Publish this dashboard?"
          body="Everyone in the workspace will be able to see it."
          confirmLabel="Publish"
          onConfirm={() => {
            toast.success("Dashboard published");
          }}
        />

        <ConfirmDialog
          open={dangerOpen}
          onOpenChange={setDangerOpen}
          tone="danger"
          title="Delete orders_db?"
          body="Saved answers that use this source will stop updating. This cannot be undone."
          confirmLabel="Delete source"
          onConfirm={() => new Promise<void>((r) => setTimeout(r, 700)).then(() => {
            toast.error("Source deleted");
          })}
        />

        <Drawer
          open={drawer !== null}
          onOpenChange={(o) => !o && setDrawer(null)}
          side={drawer ?? "right"}
          title="Source settings"
          description="orders_db, MongoDB"
          footer={
            <>
              <button type="button" className={soft} onClick={() => setDrawer(null)}>
                Close
              </button>
              <button type="button" className={ink} onClick={() => setDrawer(null)}>
                Save changes
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-5">
            <Field label="Display name">
              <Input defaultValue="orders_db" />
            </Field>
            <Switch label="Include in search" defaultChecked />
            <Switch label="Allow scheduled workflows" />
          </div>
        </Drawer>

        <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
          <CommandInput />
          <CommandList>
            <CommandEmpty />
            <CommandGroup heading="Jump to">
              <CommandItem
                icon={<LayoutGrid />}
                description="Saved answers and dashboards"
                onSelect={() => setCmdOpen(false)}
              >
                Answers
              </CommandItem>
              <CommandItem
                icon={<Database />}
                description="Connected databases"
                onSelect={() => setCmdOpen(false)}
              >
                Sources
              </CommandItem>
              <CommandItem
                icon={<Workflow />}
                description="Schedules and alerts"
                onSelect={() => setCmdOpen(false)}
              >
                Workflows
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem
                icon={<Plus />}
                shortcut="N"
                onSelect={() => {
                  setCmdOpen(false);
                  toast("New question");
                }}
              >
                Ask a new question
              </CommandItem>
              <CommandItem icon={<Settings />} onSelect={() => setCmdOpen(false)}>
                Settings
              </CommandItem>
              <CommandItem icon={<LogOut />} onSelect={() => setCmdOpen(false)}>
                Log out
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <Toaster />
      </main>
    </TooltipProvider>
  );
}

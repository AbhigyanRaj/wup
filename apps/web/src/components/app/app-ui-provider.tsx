"use client";

/*
 * App-wide UI contract: one place that owns global dialogs, confirm prompts
 * and the command palette, so any component can open them without prop
 * drilling.
 *
 *   const ui = useAppUI();
 *   ui.openDialog("connect", { initialType: "mongodb" });
 *   ui.openDialog("upload");
 *   ui.openConfirm({ title: "Delete?", body: "...", confirmLabel: "Delete", tone: "danger", onConfirm });
 *   ui.openCommand();
 */
import * as React from "react";
import dynamic from "next/dynamic";
import { ConfirmDialog } from "@/components/ui/dialog";
import type { AppDialog } from "@/lib/types";

// ─── Contract ───────────────────────────────────────────────────────────────

export type ConnectInitialType = "mongodb" | "sheets";

export interface AppDialogProps {
  connect: { initialType?: ConnectInitialType };
  upload: Record<string, never>;
  welcome: Record<string, never>;
}

export interface ConfirmOptions {
  title: React.ReactNode;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  /** May return a promise: the dialog stays open (pending) until it settles. */
  onConfirm: () => void | Promise<void>;
}

export interface AppUIContextValue {
  openDialog: <K extends AppDialog>(name: K, props?: AppDialogProps[K]) => void;
  closeDialog: () => void;
  /** The dialog currently open, if any. */
  dialog: AppDialog | null;
  openConfirm: (opts: ConfirmOptions) => void;
  openCommand: () => void;
  closeCommand: () => void;
  toggleCommand: () => void;
  commandOpen: boolean;
  /** Mobile sidebar drawer (below 1024px). */
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
}

const AppUIContext = React.createContext<AppUIContextValue | null>(null);

export function useAppUI(): AppUIContextValue {
  const ctx = React.useContext(AppUIContext);
  if (!ctx) throw new Error("useAppUI must be used inside <AppUIProvider>");
  return ctx;
}

// ─── Lazy dialogs ───────────────────────────────────────────────────────────

type OpenChangeProps = { open: boolean; onOpenChange: (open: boolean) => void };
type ConnectProps = OpenChangeProps & { initialType?: ConnectInitialType };

function Nothing() {
  return null;
}

/* The data dialogs are owned by APP-4. A failed chunk load renders nothing. */
const ConnectDataDialog = dynamic<ConnectProps>(
  () =>
    import("@/components/data/connect-data-dialog")
      .then((m: { default: unknown }) => m.default as React.ComponentType<ConnectProps>)
      .catch(() => Nothing),
  { ssr: false, loading: () => null },
);

const UploadDialog = dynamic<OpenChangeProps>(
  () =>
    import("@/components/data/upload-dialog")
      .then((m: { default: unknown }) => m.default as React.ComponentType<OpenChangeProps>)
      .catch(() => Nothing),
  { ssr: false, loading: () => null },
);

const WelcomeDialog = dynamic(() => import("./welcome-dialog"), { ssr: false, loading: () => null });
const CommandPalette = dynamic(() => import("./command-palette"), { ssr: false, loading: () => null });

// ─── Provider ───────────────────────────────────────────────────────────────

interface DialogState {
  name: AppDialog | null;
  props: Record<string, unknown>;
  /** Kept mounted after first open so close animations can run. */
  mounted: Set<AppDialog>;
}

export function AppUIProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = React.useState<DialogState>({ name: null, props: {}, mounted: new Set() });
  const [confirm, setConfirm] = React.useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [commandMounted, setCommandMounted] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);

  // Warm the palette chunk when the browser is idle so the first ⌘K is instant.
  React.useEffect(() => {
    const warm = () => void import("./command-palette");
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 2000);
    return () => clearTimeout(t);
  }, []);

  const openDialog = React.useCallback(<K extends AppDialog>(name: K, props?: AppDialogProps[K]) => {
    setCommandOpen(false);
    setDialog((prev) => ({
      name,
      props: (props ?? {}) as Record<string, unknown>,
      mounted: new Set(prev.mounted).add(name),
    }));
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialog((prev) => ({ ...prev, name: null }));
  }, []);

  const openConfirm = React.useCallback((opts: ConfirmOptions) => {
    setConfirm({ ...opts, open: true });
  }, []);

  const openCommand = React.useCallback(() => {
    setCommandMounted(true);
    setCommandOpen(true);
  }, []);
  const closeCommand = React.useCallback(() => setCommandOpen(false), []);
  const toggleCommand = React.useCallback(() => {
    setCommandMounted(true);
    setCommandOpen((o) => !o);
  }, []);

  const value = React.useMemo<AppUIContextValue>(
    () => ({
      openDialog,
      closeDialog,
      dialog: dialog.name,
      openConfirm,
      openCommand,
      closeCommand,
      toggleCommand,
      commandOpen,
      navOpen,
      setNavOpen,
    }),
    [openDialog, closeDialog, dialog.name, openConfirm, openCommand, closeCommand, toggleCommand, commandOpen, navOpen],
  );

  const onOpenChange = (name: AppDialog) => (open: boolean) => {
    if (!open) setDialog((prev) => (prev.name === name ? { ...prev, name: null } : prev));
  };

  return (
    <AppUIContext.Provider value={value}>
      {children}

      {/* DialogsHost */}
      {dialog.mounted.has("connect") && (
        <ConnectDataDialog
          open={dialog.name === "connect"}
          onOpenChange={onOpenChange("connect")}
          initialType={dialog.props.initialType as ConnectInitialType | undefined}
        />
      )}
      {dialog.mounted.has("upload") && (
        <UploadDialog open={dialog.name === "upload"} onOpenChange={onOpenChange("upload")} />
      )}
      {dialog.mounted.has("welcome") && (
        <WelcomeDialog open={dialog.name === "welcome"} onOpenChange={onOpenChange("welcome")} />
      )}
      {commandMounted && <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />}
      {confirm && (
        <ConfirmDialog
          open={confirm.open}
          onOpenChange={(open) => setConfirm((c) => (c ? { ...c, open } : c))}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          cancelLabel={confirm.cancelLabel}
          tone={confirm.tone}
          onConfirm={confirm.onConfirm}
        />
      )}
    </AppUIContext.Provider>
  );
}

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, EyeOff, FileText, KeyRound, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { ApiError, api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import { usePreferences } from "@/hooks/data/usePreferences";
import { SettingRow, SettingsCard, SettingsHeader } from "./settings-ui";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  isDemo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDemo: boolean;
}) {
  const { logout } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ password?: string; form?: string }>({});
  const ready = confirm === "DELETE" && (isDemo || password.length > 0);

  const reset = () => {
    setConfirm("");
    setPassword("");
    setError({});
  };

  async function submit() {
    if (!ready) return;
    setPending(true);
    setError({});
    try {
      // A wrong password answers 401: handle it here instead of ending the session.
      await api("/user", {
        method: "DELETE",
        json: isDemo ? { confirm: "DELETE" } : { confirm: "DELETE", password },
        skipAuthHandler: true,
      });
      toast.success("Your account was deleted");
      await logout();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.code === "INVALID_CREDENTIALS")) {
        setError({ password: e.message || "That password is incorrect." });
      } else {
        setError({ form: errorMessage(e, "Couldn't delete your account.") });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        if (!o) reset();
        onOpenChange(o);
      }}
      role="alertdialog"
      title="Delete your account?"
      description="This permanently deletes your chats, data sources, documents and saved key. It can't be undone."
      size="sm"
      footer={
        <>
          <Button variant="soft" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger-soft" onClick={submit} disabled={!ready || pending} data-testid="confirm-delete-account">
            {pending ? "Deleting..." : "Delete account"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label={<>Type <span className="font-mono text-tx">DELETE</span> to confirm</>}>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            className="font-mono"
            data-testid="delete-confirm-input"
          />
        </Field>
        {!isDemo ? (
          <Field label="Your password" error={error.password}>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              data-testid="delete-password-input"
            />
          </Field>
        ) : null}
        {error.form ? (
          <p className="text-[13px] text-red-400" role="alert">
            {error.form}
          </p>
        ) : null}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}

const STORED = [
  {
    icon: KeyRound,
    title: "Connection strings, encrypted",
    body: "Database URLs are encrypted at rest and only used to run read-only queries for you.",
  },
  {
    icon: EyeOff,
    title: "Hidden fields stay hidden",
    body: "Fields you redact are stripped from every result before an answer is written.",
  },
  {
    icon: FileText,
    title: "Document chunks",
    body: "Uploaded files are split into chunks for search. Deleting a document deletes its chunks.",
  },
];

export function PrivacySettings() {
  const { user } = usePreferences();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [confirmChats, setConfirmChats] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const data = await api<unknown>("/user/export");
      downloadJson(data, `wuup-export-${new Date().toISOString().slice(0, 10)}.json`);
      toast.success("Your data was downloaded");
    } catch (e) {
      toast.error("Couldn't export your data", { description: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div data-testid="settings-privacy">
      <SettingsHeader title="Privacy and data" description="What wuup keeps, and how to take it with you or delete it." />
      <div className="flex flex-col gap-4">
        <SettingsCard title="What wuup stores">
          <ul className="grid gap-5 sm:grid-cols-3">
            {STORED.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex flex-col gap-2">
                <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">
                  <Icon className="size-[18px]" strokeWidth={1.5} />
                </span>
                <p className="text-[15px] font-medium text-tx">{title}</p>
                <p className="text-[14px] leading-[1.55] text-tx-tertiary">{body}</p>
              </li>
            ))}
          </ul>
        </SettingsCard>

        <SettingsCard title="Your data">
          <div className="flex flex-col divide-y divide-st-secondary">
            <SettingRow
              title="Download my data"
              description="A JSON file with your profile, chats and the list of your sources."
              control={
                <Button
                  variant="soft"
                  size="sm"
                  leadingIcon={<Download className="size-4" strokeWidth={1.5} aria-hidden="true" />}
                  onClick={exportData}
                  disabled={exporting}
                  data-testid="export-data"
                >
                  {exporting ? "Preparing..." : "Download"}
                </Button>
              }
            />
            <SettingRow
              title="Delete all chats"
              description="Removes every conversation. Your data sources and documents stay."
              control={
                <Button variant="soft" size="sm" onClick={() => setConfirmChats(true)} data-testid="delete-chats">
                  Delete chats
                </Button>
              }
            />
          </div>
        </SettingsCard>

        <SettingsCard
          tone="danger"
          title="Delete account"
          description="Permanently delete your account and everything in it."
          footer={
            <Button
              variant="danger-soft"
              leadingIcon={<Trash2 className="size-4" strokeWidth={1.5} aria-hidden="true" />}
              onClick={() => setDeleteOpen(true)}
              data-testid="delete-account"
            >
              Delete account
            </Button>
          }
        />
      </div>

      <ConfirmDialog
        open={confirmChats}
        onOpenChange={setConfirmChats}
        tone="danger"
        title="Delete all chats?"
        body="Every conversation is removed for good. Your data sources and documents are not affected."
        confirmLabel="Delete all chats"
        onConfirm={async () => {
          try {
            await api("/chats", { method: "DELETE" });
            void qc.invalidateQueries({ queryKey: qk.chats.all });
            void qc.invalidateQueries({ queryKey: qk.usage });
            toast.success("All chats deleted");
          } catch (e) {
            toast.error("Couldn't delete your chats", { description: errorMessage(e) });
          }
        }}
      />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} isDemo={!!user?.isDemo} />
    </div>
  );
}

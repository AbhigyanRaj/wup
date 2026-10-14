"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useUpdateProfile, usePreferences } from "@/hooks/data/usePreferences";
import { SettingsCard, SettingsHeader } from "./settings-ui";

const MIN_PW = 10;

function NameCard({ initial, email, isDemo }: { initial: string; email: string | null; isDemo: boolean }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const dirty = name.trim() !== initial.trim();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Name is required.");
    setError(null);
    try {
      await update.mutateAsync({ name: n });
      toast.success("Profile saved");
    } catch (err) {
      setError(errorMessage(err, "Couldn't save your name."));
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <SettingsCard
        as="div"
        title="Your details"
        description="How wuup addresses you."
        footer={
          <Button type="submit" variant="ink" disabled={!dirty || update.isPending} data-testid="save-profile">
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        }
      >
        <div className="grid gap-5">
          <Field label="Name" error={error ?? undefined}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" data-testid="profile-name" />
          </Field>
          <Field label="Email" hint={isDemo ? "Demo accounts have no email." : "Your sign-in email can't be changed here."}>
            <Input value={isDemo ? "Demo account" : (email ?? "")} readOnly disabled />
          </Field>
        </div>
      </SettingsCard>
    </form>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!current) errs.current = "Enter your current password.";
    if (next.length < MIN_PW) errs.next = `Use at least ${MIN_PW} characters.`;
    if (confirm !== next) errs.confirm = "Passwords don't match.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setPending(true);
    try {
      await api("/auth/change-password", { method: "POST", json: { currentPassword: current, newPassword: next } });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.code === "INVALID_CREDENTIALS")) {
        setErrors({ current: err.message || "That password is incorrect." });
      } else if (err instanceof ApiError && err.details?.length) {
        const d = err.details.find((x) => x.path.includes("newPassword"));
        setErrors({ next: d?.message ?? err.message });
      } else {
        setErrors({ form: errorMessage(err, "Couldn't change your password.") });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <SettingsCard
        as="div"
        title="Password"
        description="Use a password you don't use anywhere else."
        footerNote={errors.form ? <span className="text-red-400">{errors.form}</span> : undefined}
        footer={
          <Button type="submit" variant="ink" disabled={pending || !current || !next || !confirm}>
            {pending ? "Changing..." : "Change password"}
          </Button>
        }
      >
        <div className="grid gap-5">
          <Field label="Current password" error={errors.current}>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="New password" error={errors.next} hint={errors.next ? undefined : `At least ${MIN_PW} characters.`}>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password" error={errors.confirm}>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
          </div>
        </div>
      </SettingsCard>
    </form>
  );
}

export function ProfileSettings() {
  const { user, isPending } = usePreferences();
  const { logout } = useAuth();

  return (
    <div data-testid="settings-profile">
      <SettingsHeader title="Profile" description="Your name, sign-in details and session." />
      <div className="flex flex-col gap-4">
        {isPending || !user ? (
          <Skeleton shape="block" className="h-72 w-full" />
        ) : (
          <>
            <NameCard key={user.id} initial={user.name ?? ""} email={user.email} isDemo={user.isDemo} />
            {!user.isDemo ? <PasswordCard /> : null}
          </>
        )}
        <SettingsCard
          title="Session"
          description="Log out of wuup on this device."
          footer={
            <Button variant="soft" leadingIcon={<LogOut className="size-4" strokeWidth={1.5} aria-hidden="true" />} onClick={() => void logout()}>
              Log out
            </Button>
          }
        />
      </div>
    </div>
  );
}

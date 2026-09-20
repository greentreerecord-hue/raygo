"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function RecoverySettingsPage() {
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState("Loading...");
  const [saving, setSaving] = useState(false);
  const [signedIn, setSignedIn] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch(
          "/api/mail/recovery/settings"
        );
        const data = await response.json();

        if (response.status === 401) {
          setSignedIn(false);
          setMessage("Please sign in to manage your recovery email.");
          return;
        }

        if (!response.ok) {
          setMessage(data.error || "Could not load settings.");
          return;
        }

        setRecoveryEmail(data.recoveryEmail || "");
        setVerified(Boolean(data.verified));
        setMessage("");
      } catch {
        setMessage("Could not load recovery settings.");
      }
    }

    loadSettings();
  }, []);

  async function sendVerification() {
    try {
      setMessage("Sending verification email...");

      const response = await fetch(
        "/api/mail/recovery/send-verification",
        { method: "POST" }
      );
      const data = await response.json();

      setMessage(
        data.message ||
          data.error ||
          "Could not send the verification email."
      );
    } catch {
      setMessage("Could not send the verification email.");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/mail/recovery/settings",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryEmail: recoveryEmail.trim(),
            currentPassword,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not save settings.");
        return;
      }

      setCurrentPassword("");
      setVerified(Boolean(data.verified));

      if (data.verified) {
        setMessage(data.message);
      } else {
        await sendVerification();
      }
    } catch {
      setMessage("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-sky-50 px-5 py-16 text-slate-900">
      <section className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold">
          Recovery email settings
        </h1>

        <p className="mt-3 text-slate-600">
          Add an email you already use outside RayGo Mail.
          Password reset links can be sent there after you verify it.
        </p>

        {signedIn ? (
          <>
            <form
              onSubmit={saveSettings}
              className="mt-7 space-y-5"
            >
              <div>
                <label
                  htmlFor="recovery-email"
                  className="block font-bold"
                >
                  Recovery email
                </label>
                <input
                  id="recovery-email"
                  type="email"
                  required
                  value={recoveryEmail}
                  onChange={(event) => {
                    setRecoveryEmail(event.target.value);
                    setVerified(false);
                  }}
                  className="mt-2 w-full rounded-xl border-2 border-slate-300 px-4 py-3"
                />
              </div>

              <div>
                <label
                  htmlFor="current-password"
                  className="block font-bold"
                >
                  Current RayGo Mail password
                </label>
                <input
                  id="current-password"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border-2 border-slate-300 px-4 py-3"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-blue-600 px-6 py-3 font-bold text-white disabled:bg-slate-400"
              >
                {saving
                  ? "Saving..."
                  : "Save and send verification"}
              </button>
            </form>

            <p className="mt-5 font-semibold">
              Status: {verified ? "Verified" : "Not verified"}
            </p>

            {!verified && recoveryEmail && (
              <button
                type="button"
                onClick={sendVerification}
                className="mt-3 font-semibold text-blue-600 underline"
              >
                Resend verification email
              </button>
            )}
          </>
        ) : (
          <Link
            href="/mail/login"
            className="mt-7 inline-block font-semibold text-blue-600"
          >
            Sign in
          </Link>
        )}

        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl bg-slate-100 p-4"
          >
            {message}
          </p>
        )}

        <Link
          href="/mail/inbox"
          className="mt-7 inline-block font-semibold text-blue-600"
        >
          ← Back to inbox
        </Link>
      </section>
    </main>
  );
} 

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const linkToken = new URLSearchParams(
      window.location.search
    ).get("token");

    if (linkToken) {
      setToken(linkToken);
      window.history.replaceState(
        null,
        "",
        "/mail/reset-password"
      );
    } else {
      setMessage("This reset link is missing its token.");
    }
  }, []);

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Your password must have at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/mail/recovery/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      setMessage(
        data.message || data.error || "Could not reset your password."
      );

      if (response.ok) {
        setComplete(true);
        setToken("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage("Could not reset your password. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-sky-50 px-5 py-16 text-slate-900">
      <section className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold">
          Choose a new password
        </h1>

        {!complete && token && (
          <form onSubmit={resetPassword} className="mt-7 space-y-5">
            <div>
              <label htmlFor="password" className="block font-bold">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                className="mt-2 w-full rounded-xl border-2 border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block font-bold"
              >
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                className="mt-2 w-full rounded-xl border-2 border-slate-300 px-4 py-3"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-blue-600 px-6 py-3 font-bold text-white disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Change password"}
            </button>
          </form>
        )}

        {message && (
          <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4">
            {message}
          </p>
        )}

        <Link
          href={complete ? "/mail/login" : "/mail/forgot-password"}
          className="mt-7 inline-block font-semibold text-blue-600"
        >
          {complete ? "Sign in" : "Request a new link"}
        </Link>
      </section>
    </main>
  );
} 

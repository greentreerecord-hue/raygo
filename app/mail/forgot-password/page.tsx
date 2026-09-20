"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [account, setAccount] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSending(true);

    try {
      const response = await fetch(
        "/api/mail/recovery/request-reset",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: account.trim() }),
        }
      );

      const data = await response.json();
      setMessage(
        data.message ||
          data.error ||
          "Could not request a reset link."
      );
    } catch {
      setMessage("Could not request a reset link. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-sky-50 px-5 py-16 text-slate-900">
      <section className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold">
          Reset your RayGo Mail password
        </h1>

        <p className="mt-3 text-slate-600">
          Enter your RayGo Mail username or address. If you have
          verified a recovery email, we will send a reset link there.
        </p>

        <form onSubmit={requestReset} className="mt-7 space-y-5">
          <div>
            <label htmlFor="account" className="block font-bold">
              RayGo Mail username or address
            </label>
            <input
              id="account"
              type="text"
              required
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="yourname@raygoes.com"
              className="mt-2 w-full rounded-xl border-2 border-slate-300 px-4 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-blue-600 px-6 py-3 font-bold text-white disabled:bg-slate-400"
          >
            {sending ? "Sending..." : "Send reset link"}
          </button>
        </form>

        {message && (
          <p role="status" className="mt-5 rounded-xl bg-slate-100 p-4">
            {message}
          </p>
        )}

        <Link
          href="/mail/login"
          className="mt-7 inline-block font-semibold text-blue-600"
        >
          ← Back to sign in
        </Link>
      </section>
    </main>
  );
} 

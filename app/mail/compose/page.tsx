"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RayGoMailComposePage() {
  const router = useRouter();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (!to.trim() || !subject.trim() || !messageBody.trim()) {
      setStatus("To, subject, and message are required.");
      return;
    }

    try {
      setSending(true);

      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject,
          message: messageBody,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push("/mail/login");
        return;
      }

      if (!response.ok) {
        setStatus(data.error || "Unable to send your message.");
        return;
      }

      setStatus("Message sent successfully.");

      setTimeout(() => {
        router.push("/mail/inbox");
        router.refresh();
      }, 800);
    } catch {
      setStatus("Unable to send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <section className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <Link href="/" className="text-2xl font-bold text-blue-600">
              RayGo Mail
            </Link>

            <h1 className="mt-2 text-3xl font-bold">New Message</h1>
          </div>

          <Link
            href="/mail/inbox"
            className="rounded-full border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-100"
          >
            Back to Inbox
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label htmlFor="to" className="mb-2 block font-semibold">
              To
            </label>

            <input
              id="to"
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="username@raygoes.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <p className="mt-2 text-sm text-slate-500">
              Internal delivery currently supports RayGo Mail addresses.
            </p>
          </div>

          <div>
            <label
              htmlFor="subject"
              className="mb-2 block font-semibold"
            >
              Subject
            </label>

            <input
              id="subject"
              type="text"
              maxLength={200}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Enter a subject"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="message"
              className="mb-2 block font-semibold"
            >
              Message
            </label>

            <textarea
              id="message"
              rows={12}
              maxLength={10000}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              placeholder="Write your message..."
              className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {status && (
            <p
              className={`rounded-xl px-4 py-3 font-semibold ${
                status === "Message sent successfully."
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {status}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Link
              href="/mail/inbox"
              className="rounded-xl border border-slate-300 px-6 py-3 font-bold hover:bg-slate-100"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
} 

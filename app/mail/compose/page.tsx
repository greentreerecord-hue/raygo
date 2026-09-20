"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

type Draft = {
  id: number;
  to_email: string;
  subject: string;
  message_body: string;
};

function ComposeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [success, setSuccess] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = searchParams.get("draft");

    if (!id) {
      setDraftId(null);
      setTo(searchParams.get("to") || "");
      setSubject(searchParams.get("subject") || "");
      setMessageBody("");
      return;
    }

    async function loadDraft() {
      setLoadingDraft(true);
      setStatus("");
      setSuccess(false);

      try {
        const response = await fetch(
          `/api/mail/drafts?id=${encodeURIComponent(id || "")}`,
          { cache: "no-store" }
        );

        if (cancelled) return;

        if (response.status === 401) {
          router.replace("/mail/login");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          setStatus(data.error || "Unable to open draft.");
          return;
        }

        const draft = data.draft as Draft;
        setDraftId(draft.id);
        setTo(draft.to_email);
        setSubject(draft.subject);
        setMessageBody(draft.message_body);
      } catch {
        if (!cancelled) setStatus("Unable to open draft.");
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    }

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  async function handleSaveDraft() {
    setStatus("");
    setSuccess(false);

    if (!to.trim() && !subject.trim() && !messageBody.trim()) {
      setStatus("Write something before saving a draft.");
      return;
    }

    try {
      setSaving(true);

      const response = await fetch("/api/mail/drafts", {
        method: draftId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(draftId === null ? {} : { id: draftId }),
          to,
          subject,
          message: messageBody,
        }),
      });

      if (response.status === 401) {
        router.replace("/mail/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Unable to save draft.");
        return;
      }

      const savedId = Number(data.draft.id);
      setDraftId(savedId);
      setStatus("Draft saved.");
      setSuccess(true);

      if (draftId === null) {
        router.replace(`/mail/compose?draft=${savedId}`);
      }
    } catch {
      setStatus("Unable to save draft. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setSuccess(false);

    if (!to.trim() || !subject.trim() || !messageBody.trim()) {
      setStatus("To, subject, and message are required.");
      return;
    }

    try {
      setSending(true);

      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          message: messageBody,
        }),
      });

      if (response.status === 401) {
        router.replace("/mail/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "Unable to send your message.");
        return;
      }

      if (draftId !== null) {
        await fetch(`/api/mail/drafts?id=${draftId}`, {
          method: "DELETE",
        });
      }

      setStatus("Message sent successfully.");
      setSuccess(true);

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
            <h1 className="mt-2 text-3xl font-bold">
              {draftId === null ? "New Message" : "Edit Draft"}
            </h1>
          </div>

          <Link
            href="/mail/inbox"
            className="rounded-full border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-100"
          >
            Back to Inbox
          </Link>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {loadingDraft ? (
            <p className="text-slate-600">Opening draft...</p>
          ) : (
            <>
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
                  role="status"
                  className={`rounded-xl px-4 py-3 font-semibold ${
                    success
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {status}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                <Link
                  href="/mail/inbox"
                  className="rounded-xl border border-slate-300 px-6 py-3 font-bold hover:bg-slate-100"
                >
                  Back
                </Link>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={saving || sending}
                  className="rounded-xl border border-blue-300 px-6 py-3 font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Draft"}
                </button>

                <button
                  type="submit"
                  disabled={sending || saving}
                  className="rounded-xl bg-blue-600 px-8 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </form>
      </section>
    </main>
  );
}

export default function RayGoMailComposePage() {
  return (
    <Suspense fallback={<p className="p-8">Opening new message...</p>}>
      <ComposeForm />
    </Suspense>
  );
} 

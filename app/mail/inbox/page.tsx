"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MailUser = {
  id: number;
  name: string;
  username: string;
  email: string;
};

type MailMessage = {
  id: number;
  subject: string;
  message_body: string;
  read_at: string | null;
  created_at: string;
  sender_name: string;
  sender_email: string;
};

export default function RayGoMailInboxPage() {
  const router = useRouter();

  const [user, setUser] = useState<MailUser | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");

  useEffect(() => {
    async function loadInbox() {
      try {
        const [userResponse, messagesResponse] = await Promise.all([
          fetch("/api/mail/me", { cache: "no-store" }),
          fetch("/api/mail/messages", { cache: "no-store" }),
        ]);

        if (userResponse.status === 401 || messagesResponse.status === 401) {
          router.replace("/mail/login");
          return;
        }

        const userData = await userResponse.json();
        const messagesData = await messagesResponse.json();

        if (!userResponse.ok) {
          setInboxError(userData.error || "Unable to open your account.");
          return;
        }

        if (!messagesResponse.ok) {
          setInboxError(messagesData.error || "Unable to load your inbox.");
          return;
        }

        setUser(userData.user);
        setMessages(messagesData.messages || []);
      } catch {
        setInboxError("Unable to load your inbox. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadInbox();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/mail/logout", { method: "POST" });
    router.push("/mail/login");
    router.refresh();
  }

  function formatMessageDate(value: string) {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function replyLink(message: MailMessage) {
    const subject = message.subject.toLowerCase().startsWith("re:")
      ? message.subject
      : `Re: ${message.subject}`;

    return `/mail/compose?to=${encodeURIComponent(
      message.sender_email
    )}&subject=${encodeURIComponent(subject)}`;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-lg text-slate-600">Opening your inbox...</p>
      </main>
    );
  }

  if (inboxError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <section className="rounded-3xl border border-red-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold">RayGo Mail</h1>
          <p className="mt-4 text-red-700">{inboxError}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
          >
            Try Again
          </button>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          RayGo Mail
        </Link>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-100"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            href="/mail/compose"
            className="mb-6 block w-full rounded-2xl bg-blue-600 px-5 py-3 text-center font-bold text-white hover:bg-blue-700"
          >
            Compose
          </Link>

          <nav className="space-y-2">
            <button
              type="button"
              className="w-full rounded-xl bg-blue-50 px-4 py-3 text-left font-bold text-blue-700"
            >
              Inbox ({messages.length})
            </button>

            <button
              type="button"
              className="w-full rounded-xl px-4 py-3 text-left font-semibold hover:bg-slate-100"
            >
              Sent
            </button>

            <button
              type="button"
              className="w-full rounded-xl px-4 py-3 text-left font-semibold hover:bg-slate-100"
            >
              Drafts
            </button>

            <button
              type="button"
              className="w-full rounded-xl px-4 py-3 text-left font-semibold hover:bg-slate-100"
            >
              Trash
            </button>
          </nav>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h1 className="text-3xl font-bold">Inbox</h1>
            <p className="mt-1 text-slate-500">
              Welcome, {user.name}. Your RayGo Mail address is {user.email}.
            </p>
          </div>

          {messages.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-xl font-bold">Your inbox is ready</p>
              <p className="mt-2 text-slate-500">
                Messages sent to your RayGo Mail address will appear here.
              </p>
              <Link
                href="/mail/compose"
                className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
              >
                Compose Your First Message
              </Link>
            </div>
          ) : (
            <div>
              {messages.map((message) => (
                <article
                  key={message.id}
                  className="border-b border-slate-200 px-6 py-5 last:border-b-0 hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{message.sender_name}</p>
                      <p className="text-sm text-slate-500">
                        {message.sender_email}
                      </p>
                      <h2 className="mt-2 text-lg font-bold">
                        {message.subject}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">
                        {message.message_body}
                      </p>

                      <Link
                        href={replyLink(message)}
                        className="mt-4 inline-block rounded-xl border border-blue-300 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50"
                      >
                        Reply
                      </Link>
                    </div>

                    <time className="text-sm text-slate-500">
                      {formatMessageDate(message.created_at)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
} 

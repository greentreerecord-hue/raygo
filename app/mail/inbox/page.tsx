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
  sender_name?: string;
  sender_email?: string;
  recipient_name?: string;
  recipient_email?: string;
};

type Folder = "inbox" | "sent" | "trash";

export default function RayGoMailInboxPage() {
  const router = useRouter();

  const [user, setUser] = useState<MailUser | null>(null);
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [folder, setFolder] = useState<Folder>("inbox");
  const [loading, setLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const [actionError, setActionError] = useState("");
  const [movingId, setMovingId] = useState<number | null>(null);
  const [emptyingTrash, setEmptyingTrash] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      setLoading(true);
      setInboxError("");
      setActionError("");

      try {
        const url =
          folder === "inbox"
            ? "/api/mail/messages"
            : `/api/mail/messages?folder=${folder}`;

        const [userResponse, messagesResponse] = await Promise.all([
          fetch("/api/mail/me", { cache: "no-store" }),
          fetch(url, { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (userResponse.status === 401 || messagesResponse.status === 401) {
          router.replace("/mail/login");
          return;
        }

        const userData = await userResponse.json();
        const messagesData = await messagesResponse.json();

        if (cancelled) return;

        if (!userResponse.ok) {
          setInboxError(userData.error || "Unable to open your account.");
          return;
        }

        if (!messagesResponse.ok) {
          setInboxError(
            messagesData.error || "Unable to load your messages."
          );
          return;
        }

        setUser(userData.user);
        setMessages(messagesData.messages || []);
      } catch {
        if (!cancelled) {
          setInboxError("Unable to load your messages. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [folder, router]);

  async function moveMessage(id: number) {
    if (folder === "sent" || movingId !== null || emptyingTrash) return;

    setMovingId(id);
    setActionError("");

    try {
      const response = await fetch("/api/mail/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: folder === "inbox" ? "trash" : "restore",
        }),
      });

      if (response.status === 401) {
        router.replace("/mail/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error || "Unable to move this message.");
        return;
      }

      setMessages((current) =>
        current.filter((message) => message.id !== id)
      );
    } catch {
      setActionError("Unable to move this message. Please try again.");
    } finally {
      setMovingId(null);
    }
  }

  async function handleEmptyTrash() {
    if (
      folder !== "trash" ||
      messages.length === 0 ||
      emptyingTrash ||
      movingId !== null
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Permanently delete all messages in Trash? This cannot be undone."
    );

    if (!confirmed) return;

    setEmptyingTrash(true);
    setActionError("");

    try {
      const response = await fetch("/api/mail/messages", {
        method: "DELETE",
      });

      if (response.status === 401) {
        router.replace("/mail/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error || "Unable to empty Trash.");
        return;
      }

      setMessages([]);
    } catch {
      setActionError("Unable to empty Trash. Please try again.");
    } finally {
      setEmptyingTrash(false);
    }
  }

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
      message.sender_email || ""
    )}&subject=${encodeURIComponent(subject)}`;
  }

  const folderTitle =
    folder === "inbox" ? "Inbox" : folder === "sent" ? "Sent" : "Trash";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <Link href="/" className="text-2xl font-bold text-blue-600">
          RayGo Mail
        </Link>

        {user && (
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
        )}
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <Link
            href="/mail/compose"
            className="mb-6 block w-full rounded-2xl bg-blue-600 px-5 py-3 text-center font-bold text-white hover:bg-blue-700"
          >
            Compose
          </Link>

          <nav className="space-y-2" aria-label="Mail folders">
            <button
              type="button"
              onClick={() => setFolder("inbox")}
              className={`w-full rounded-xl px-4 py-3 text-left font-semibold hover:bg-slate-100 ${
                folder === "inbox" ? "bg-blue-50 text-blue-700" : ""
              }`}
            >
              Inbox {folder === "inbox" ? `(${messages.length})` : ""}
            </button>

            <button
              type="button"
              onClick={() => setFolder("sent")}
              className={`w-full rounded-xl px-4 py-3 text-left font-semibold hover:bg-slate-100 ${
                folder === "sent" ? "bg-blue-50 text-blue-700" : ""
              }`}
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
              onClick={() => setFolder("trash")}
              className={`w-full rounded-xl px-4 py-3 text-left font-semibold hover:bg-slate-100 ${
                folder === "trash" ? "bg-blue-50 text-blue-700" : ""
              }`}
            >
              Trash
            </button>
          </nav>

          <Link
            href="/mail/recovery-settings"
            className="mt-6 block rounded-xl px-4 py-3 font-semibold text-blue-700 hover:bg-blue-50"
          >
            Recovery email settings
          </Link>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <h1 className="text-3xl font-bold">{folderTitle}</h1>

              {user && folder === "inbox" && (
                <p className="mt-1 text-slate-500">
                  Welcome, {user.name}. Your RayGo Mail address is {user.email}.
                </p>
              )}
            </div>

            {folder === "trash" && !loading && messages.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyTrash}
                disabled={emptyingTrash || movingId !== null}
                className="rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {emptyingTrash ? "Emptying..." : "Empty Trash"}
              </button>
            )}
          </div>

          {actionError && (
            <p
              role="alert"
              className="mx-6 mt-4 rounded-xl bg-red-50 p-4 text-red-700"
            >
              {actionError}
            </p>
          )}

          {loading ? (
            <p className="px-6 py-12 text-center text-slate-600">
              Loading messages...
            </p>
          ) : inboxError ? (
            <div className="px-6 py-12 text-center">
              <p role="alert" className="text-red-700">
                {inboxError}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
              >
                Try Again
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-xl font-bold">
                {folder === "trash"
                  ? "Trash is empty"
                  : folder === "sent"
                    ? "No sent messages yet"
                    : "Your inbox is ready"}
              </p>

              {folder === "inbox" && (
                <>
                  <p className="mt-2 text-slate-500">
                    Messages sent to your RayGo Mail address will appear here.
                  </p>
                  <Link
                    href="/mail/compose"
                    className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700"
                  >
                    Compose Your First Message
                  </Link>
                </>
              )}
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
                      <p className="font-bold">
                        {folder === "sent"
                          ? `To: ${message.recipient_name || message.recipient_email}`
                          : message.sender_name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {folder === "sent"
                          ? message.recipient_email
                          : message.sender_email}
                      </p>
                      <h2 className="mt-2 text-lg font-bold">
                        {message.subject}
                      </h2>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">
                        {message.message_body}
                      </p>

                      {folder !== "sent" && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {folder === "inbox" && (
                            <Link
                              href={replyLink(message)}
                              className="inline-block rounded-xl border border-blue-300 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              Reply
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() => moveMessage(message.id)}
                            disabled={movingId !== null || emptyingTrash}
                            className="rounded-xl border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-100 disabled:opacity-50"
                          >
                            {movingId === message.id
                              ? "Moving..."
                              : folder === "inbox"
                                ? "Move to Trash"
                                : "Restore"}
                          </button>
                        </div>
                      )}
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

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

export default function RayGoMailInboxPage() {
  const router = useRouter();
  const [user, setUser] = useState<MailUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch("/api/mail/me", {
          cache: "no-store",
        });

        if (!response.ok) {
          router.replace("/mail/login");
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch {
        router.replace("/mail/login");
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/mail/logout", {
      method: "POST",
    });

    router.push("/mail/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-lg text-slate-600">Opening your inbox...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
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
          <button
            type="button"
            className="mb-6 w-full rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700"
          >
            Compose
          </button>

          <nav className="space-y-2">
            <button
              type="button"
              className="w-full rounded-xl bg-blue-50 px-4 py-3 text-left font-bold text-blue-700"
            >
              Inbox
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
              Welcome, {user.name}. Your RayGo Mail address is ready.
            </p>
          </div>

          <article className="border-b border-slate-200 bg-blue-50 px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold">RayGo Mail Team</p>
                <p className="mt-1 font-semibold">
                  Welcome to your new RayGo Mail inbox
                </p>
                <p className="mt-2 text-slate-600">
                  Your account has been created successfully. We are building
                  compose, sending, receiving, replies, and folders next.
                </p>
              </div>

              <span className="whitespace-nowrap text-sm text-slate-500">
                Today
              </span>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
} 

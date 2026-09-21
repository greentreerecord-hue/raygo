"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type CrawlResponse = {
  success?: boolean;
  indexedCount?: number;
  indexed?: string[];
  error?: string;
};

export default function CrawlerDashboardPage() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [crawlerSecret, setCrawlerSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [indexedPages, setIndexedPages] = useState<string[]>(
    []
  );

  async function runCrawler(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const url = websiteUrl.trim();
    const secret = crawlerSecret.trim();

    if (!url || !secret) {
      setMessage(
        "Enter a website address and your crawler secret."
      );
      return;
    }

    setLoading(true);
    setMessage("");
    setIndexedPages([]);

    try {
      const response = await fetch("/api/crawler/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-crawler-secret": secret,
        },
        body: JSON.stringify({ url }),
      });

      const data: CrawlResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "The crawler could not index this website."
        );
      }

      const pages = data.indexed || [];

      setIndexedPages(pages);
      setMessage(
        `Success! RayGo indexed ${
          data.indexedCount ?? pages.length
        } page(s).`
      );
      setWebsiteUrl("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The crawler could not index this website."
      );
    } finally {
      setCrawlerSecret("");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 px-5 py-8 text-slate-900">
      <header className="mx-auto flex max-w-4xl items-center justify-between">
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight"
        >
          <span className="text-blue-600">Ray</span>
          <span className="text-emerald-500">Go</span>
        </Link>

        <Link
          href="/"
          className="rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm hover:bg-slate-50"
        >
          Back to Search
        </Link>
      </header>

      <section className="mx-auto mt-16 max-w-2xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-10">
          <div className="mb-8 text-center">
            <div className="mb-4 text-5xl">🕷️</div>

            <h1 className="text-3xl font-black sm:text-4xl">
              RayGo Crawler Dashboard
            </h1>

            <p className="mt-3 text-slate-600">
              Add public webpages to the RayGo search index.
            </p>
          </div>

          <form
            onSubmit={runCrawler}
            className="space-y-6"
          >
            <div>
              <label
                htmlFor="website-url"
                className="mb-2 block font-bold"
              >
                Website address
              </label>

              <input
                id="website-url"
                type="url"
                required
                value={websiteUrl}
                onChange={(event) =>
                  setWebsiteUrl(event.target.value)
                }
                placeholder="https://example.com"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="crawler-secret"
                className="mb-2 block font-bold"
              >
                Crawler secret
              </label>

              <input
                id="crawler-secret"
                type="password"
                required
                autoComplete="off"
                value={crawlerSecret}
                onChange={(event) =>
                  setCrawlerSecret(event.target.value)
                }
                placeholder="Enter your private crawler secret"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
              />

              <p className="mt-2 text-sm text-slate-500">
                Your secret is masked and is cleared after each
                request.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {loading
                ? "Crawling website..."
                : "Crawl Website"}
            </button>
          </form>

          {message && (
            <div
              className={`mt-6 rounded-2xl border p-4 ${
                message.startsWith("Success")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {message}
            </div>
          )}

          {indexedPages.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-lg font-bold">
                Indexed pages
              </h2>

              <div className="space-y-2">
                {indexedPages.map((pageUrl) => (
                  <a
                    key={pageUrl}
                    href={pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block break-all rounded-xl border border-slate-200 bg-slate-50 p-3 text-blue-700 hover:underline"
                  >
                    {pageUrl}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-2xl bg-slate-100 p-4 text-sm text-slate-600">
            Only crawl public websites you trust. RayGo respects
            robots.txt rules and blocks private network addresses.
          </div>
        </div>
      </section>
    </main>
  );
} 

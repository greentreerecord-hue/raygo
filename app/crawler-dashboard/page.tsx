"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type ActionResult = {
  success?: boolean;
  error?: string;
  indexedCount?: number;
  importedCount?: number;
  indexed?: string[];
  imported?: string[];
  skipped?: string[];
  errors?: string[];
};

type ActionType =
  | "crawler"
  | "news"
  | "music";

export default function CrawlerDashboardPage() {
  const [websiteUrl, setWebsiteUrl] =
    useState("");

  const [feedUrl, setFeedUrl] =
    useState("");

  const [crawlerSecret, setCrawlerSecret] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [resultLinks, setResultLinks] =
    useState<string[]>([]);

  const [working, setWorking] =
    useState<ActionType | null>(null);

  async function sendRequest(
    endpoint: string,
    body: Record<string, string>,
    action: ActionType
  ) {
    const secret = crawlerSecret.trim();

    if (!secret) {
      setMessage(
        "Enter your private crawler secret."
      );
      return;
    }

    setWorking(action);
    setMessage("");
    setResultLinks([]);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-crawler-secret": secret,
        },
        body: JSON.stringify(body),
      });

      const data =
        (await response.json()) as ActionResult;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "The request could not be completed."
        );
      }

      const links =
        action === "news"
          ? data.imported || []
          : data.indexed || [];

      setResultLinks(links);

      if (action === "news") {
        setMessage(
          `Success! RayGo imported ${
            data.importedCount ??
            links.length
          } news article(s).`
        );
      } else if (action === "music") {
        setMessage(
          `Success! RayGo imported ${
            data.importedCount ??
            links.length
          } music release(s).`
        );
      } else {
        setMessage(
          `Success! RayGo indexed ${
            data.indexedCount ??
            links.length
          } page(s).`
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The request failed."
      );
    } finally {
      setCrawlerSecret("");
      setWorking(null);
    }
  }

  async function crawlWebsite(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const url = websiteUrl.trim();

    if (!url) {
      setMessage(
        "Enter a public website URL."
      );
      return;
    }

    await sendRequest(
      "/api/crawler/run",
      { url },
      "crawler"
    );
  }

  async function importNewsFeed(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const url = feedUrl.trim();

    if (!url) {
      setMessage(
        "Enter a public RSS or Atom feed URL."
      );
      return;
    }

    await sendRequest(
      "/api/news/import",
      { feedUrl: url },
      "news"
    );
  }

  async function importMusic(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    await sendRequest(
      "/api/music/import",
      {},
      "music"
    );
  }

  const isSuccess =
    message.startsWith("Success!");

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 px-5 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-3xl font-black tracking-tight"
            >
              <span className="text-blue-600">
                Ray
              </span>

              <span className="text-emerald-500">
                Go
              </span>
            </Link>

            <p className="mt-1 text-slate-600">
              Crawler, News and Music
              Dashboard
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm hover:bg-slate-50"
          >
            Back to Search
          </Link>
        </header>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <h1 className="text-3xl font-black">
            RayGo Administration
          </h1>

          <p className="mt-2 text-slate-600">
            Add websites, news feeds and
            approved Ray&apos;sStream music
            to the RayGo search index.
          </p>

          <div className="mt-6">
            <label
              htmlFor="crawler-secret"
              className="mb-2 block font-bold"
            >
              Crawler secret
            </label>

            <input
              id="crawler-secret"
              type="password"
              value={crawlerSecret}
              onChange={(event) =>
                setCrawlerSecret(
                  event.target.value
                )
              }
              placeholder="Enter your private crawler secret"
              autoComplete="off"
              className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500"
            />

            <p className="mt-2 text-sm text-slate-500">
              Your secret is masked and
              cleared after every request.
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-5">
            <p className="font-bold text-blue-600">
              Web Crawler
            </p>

            <h2 className="text-2xl font-black">
              Crawl a Website
            </h2>

            <p className="mt-1 text-slate-600">
              Index public pages from a
              website for regular RayGo
              search.
            </p>
          </div>

          <form onSubmit={crawlWebsite}>
            <label
              htmlFor="website-url"
              className="mb-2 block font-bold"
            >
              Website URL
            </label>

            <input
              id="website-url"
              type="url"
              value={websiteUrl}
              onChange={(event) =>
                setWebsiteUrl(
                  event.target.value
                )
              }
              placeholder="https://example.com"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />

            <button
              type="submit"
              disabled={working !== null}
              className="mt-5 w-full rounded-2xl bg-blue-600 px-6 py-3 text-lg font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working === "crawler"
                ? "Crawling Website..."
                : "Crawl Website"}
            </button>
          </form>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-5">
            <p className="font-bold text-emerald-600">
              RayGo News
            </p>

            <h2 className="text-2xl font-black">
              Import a News Feed
            </h2>

            <p className="mt-1 text-slate-600">
              Import articles from a public
              RSS or Atom feed into RayGo
              News.
            </p>
          </div>

          <form onSubmit={importNewsFeed}>
            <label
              htmlFor="feed-url"
              className="mb-2 block font-bold"
            >
              RSS or Atom feed URL
            </label>

            <input
              id="feed-url"
              type="url"
              value={feedUrl}
              onChange={(event) =>
                setFeedUrl(
                  event.target.value
                )
              }
              placeholder="https://example.com/news/feed.xml"
              required
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
            />

            <button
              type="submit"
              disabled={working !== null}
              className="mt-5 w-full rounded-2xl bg-emerald-600 px-6 py-3 text-lg font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working === "news"
                ? "Importing News..."
                : "Import News Feed"}
            </button>
          </form>
        </section>

        <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="mb-5">
            <p className="font-bold text-violet-600">
              RayGo Music
            </p>

            <h2 className="text-2xl font-black">
              Import Ray&apos;sStream Music
            </h2>

            <p className="mt-1 text-slate-600">
              Import approved releases from
              the Ray&apos;sStream Music
              Shop into RayGo Music. Search
              results send listeners to the
              shop without exposing private
              purchase links.
            </p>
          </div>

          <form onSubmit={importMusic}>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-900">
              <p className="font-bold">
                Source
              </p>

              <p className="mt-1 break-all text-sm">
                https://raysstream.com/api/music
              </p>
            </div>

            <button
              type="submit"
              disabled={working !== null}
              className="mt-5 w-full rounded-2xl bg-violet-600 px-6 py-3 text-lg font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working === "music"
                ? "Importing Music..."
                : "Import Ray'sStream Music"}
            </button>
          </form>
        </section>

        {message && (
          <section
            className={`mb-6 rounded-2xl border p-5 ${
              isSuccess
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <p className="font-bold">
              {message}
            </p>
          </section>
        )}

        {resultLinks.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <h2 className="mb-4 text-2xl font-black">
              Added to RayGo
            </h2>

            <div className="space-y-3">
              {resultLinks.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all rounded-2xl border border-slate-200 bg-slate-50 p-4 font-medium text-blue-600 hover:bg-blue-50"
                >
                  {url}
                </a>
              ))}
            </div>
          </section>
        )}

        <p className="mt-8 text-center text-sm text-slate-500">
          Only crawl public websites and
          feeds you trust. RayGo blocks
          private network addresses.
        </p>
      </div>
    </main>
  );
} 

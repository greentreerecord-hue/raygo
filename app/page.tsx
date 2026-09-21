"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SearchCategory =
  | "web"
  | "news"
  | "images"
  | "videos"
  | "music";

type SearchResult = {
  url: string;
  hostname: string;
  title: string;
  description: string;
  category?: string;
  published_at?: string | null;
  indexed_at?: string;
};

type SearchResponse = {
  query?: string;
  count?: number;
  results?: SearchResult[];
  error?: string;
};

const categories: {
  label: string;
  value: SearchCategory;
}[] = [
  { label: "News", value: "news" },
  { label: "Images", value: "images" },
  { label: "Videos", value: "videos" },
  { label: "Music", value: "music" },
];

export default function Home() {
  const [searchText, setSearchText] = useState("");
  const [activeCategory, setActiveCategory] =
    useState<SearchCategory>("web");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function searchRayGo(
    query: string,
    category: SearchCategory
  ) {
    setLoading(true);
    setMessage("");
    setHasSearched(true);

    try {
      const parameters = new URLSearchParams();

      if (query.trim()) {
        parameters.set("q", query.trim());
      }

      if (category !== "web") {
        parameters.set("category", category);
      }

      const response = await fetch(
        `/api/search?${parameters.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = (await response.json()) as SearchResponse;

      if (!response.ok) {
        throw new Error(
          data.error || "RayGo search is unavailable."
        );
      }

      const nextResults = data.results || [];

      setResults(nextResults);

      if (nextResults.length === 0) {
        if (category === "news") {
          setMessage(
            query.trim()
              ? `No RayGo News results found for "${query.trim()}".`
              : "No news articles are indexed yet."
          );
        } else if (category !== "web") {
          setMessage(
            `No ${category} results are indexed yet.`
          );
        } else {
          setMessage(
            `No results found for "${query.trim()}".`
          );
        }
      }
    } catch (error) {
      setResults([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "RayGo search is temporarily unavailable."
      );
    } finally {
      setLoading(false);
    }
  }

  async function searchWeb(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const query = searchText.trim();

    if (!query && activeCategory === "web") {
      setMessage("Enter something to search for.");
      return;
    }

    await searchRayGo(query, activeCategory);
  }

  async function selectCategory(
    category: SearchCategory
  ) {
    setActiveCategory(category);
    setSearchText("");

    await searchRayGo("", category);
  }

  function returnToWebSearch() {
    setActiveCategory("web");
    setSearchText("");
    setResults([]);
    setMessage("");
    setHasSearched(false);
  }

  function formatDate(value?: string | null) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <button
          type="button"
          onClick={returnToWebSearch}
          className="text-2xl font-extrabold tracking-tight"
        >
          <span className="text-blue-600">Ray</span>
          <span className="text-emerald-500">Go</span>
        </button>

        <nav className="flex flex-wrap gap-3">
          <Link
            href="/mail"
            className="rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm hover:bg-slate-50"
          >
            ✉ RayGo Mail
          </Link>

          <Link
            href="/crawler-dashboard"
            className="rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm hover:bg-slate-50"
          >
            Crawler
          </Link>

          <Link
            href="/mail/login"
            className="rounded-full bg-blue-600 px-5 py-2 font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Sign In
          </Link>
        </nav>
      </header>

      <section
        className={`flex flex-col items-center px-5 text-center ${
          hasSearched
            ? "pb-8 pt-8"
            : "min-h-[70vh] justify-center py-12"
        }`}
      >
        <h1 className="mb-3 text-6xl font-black tracking-tight sm:text-8xl">
          <span className="text-blue-600">Ray</span>
          <span className="text-emerald-500">Go</span>
        </h1>

        <p className="mb-9 text-lg text-slate-600 sm:text-xl">
          {activeCategory === "news"
            ? "Search the latest news with RayGo"
            : "Search the web with RayGo"}
        </p>

        <form
          onSubmit={searchWeb}
          className="flex w-full max-w-3xl items-center rounded-full border-2 border-slate-300 bg-white p-2 shadow-xl focus-within:border-blue-500"
        >
          <span className="pl-4 text-2xl">🔎</span>

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder={
              activeCategory === "news"
                ? "Search RayGo News"
                : "Search the web"
            }
            aria-label="Search RayGo"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-blue-600 px-7 py-3 text-lg font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <button
              key={category.value}
              type="button"
              disabled={loading}
              onClick={() =>
                selectCategory(category.value)
              }
              className={`rounded-full border px-5 py-2 font-medium shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                activeCategory === category.value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white hover:bg-slate-50"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      {hasSearched && (
        <section className="mx-auto w-full max-w-3xl px-5 pb-16">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-black">
              {activeCategory === "news"
                ? "RayGo News"
                : "Search Results"}
            </h2>

            {results.length > 0 && (
              <p className="text-sm font-medium text-slate-500">
                {results.length} result
                {results.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          {message && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
              {message}
            </div>
          )}

          <div className="space-y-4">
            {results.map((result) => (
              <article
                key={result.url}
                className="rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:shadow-md"
              >
                <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-emerald-600">
                    {result.hostname}
                  </span>

                  {result.category === "news" &&
                    result.published_at && (
                      <span className="text-slate-400">
                        {formatDate(result.published_at)}
                      </span>
                    )}
                </div>

                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xl font-bold text-blue-600 hover:underline"
                >
                  {result.title}
                </a>

                {result.description && (
                  <p className="mt-3 leading-relaxed text-slate-600">
                    {result.description}
                  </p>
                )}

                <p className="mt-3 break-all text-sm text-emerald-600">
                  {result.url}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="px-6 py-6 text-center text-sm text-slate-500">
        © 2026 RayGo · raygoes.com
      </footer>
    </main>
  );
} 

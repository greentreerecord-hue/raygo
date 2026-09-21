"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type SearchResult = {
  url: string;
  hostname: string;
  title: string;
  description: string | null;
  indexed_at: string;
};

type SearchResponse = {
  query: string;
  count: number;
  results: SearchResult[];
};

export default function Home() {
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  async function searchWeb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchText.trim();

    if (!query) {
      return;
    }

    setLoading(true);
    setSearched(true);
    setError("");

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data: SearchResponse = await response.json();
      setResults(data.results || []);
    } catch (searchError) {
      console.error(searchError);
      setResults([]);
      setError("RayGo could not complete the search. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 text-slate-900">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-blue-600">Ray</span>
          <span className="text-emerald-500">Go</span>
        </div>

        <nav className="flex gap-3">
          <Link
            href="/mail"
            className="rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm"
          >
            RayGo Mail
          </Link>

          <button
            type="button"
            className="rounded-full bg-blue-600 px-5 py-2 font-semibold text-white shadow-sm"
          >
            Sign In
          </button>
        </nav>
      </header>

      <section className="flex flex-col items-center px-5 py-20 text-center">
        <h1 className="mb-3 text-6xl font-black tracking-tight sm:text-8xl">
          <span className="text-blue-600">Ray</span>
          <span className="text-emerald-500">Go</span>
        </h1>

        <p className="mb-9 text-lg text-slate-600 sm:text-xl">
          Search the web with RayGo
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
            placeholder="Search the web"
            aria-label="Search the web"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-lg outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-blue-600 px-7 py-3 text-lg font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {["News", "Images", "Videos", "Music"].map(
            (category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSearchText(category)}
                className="rounded-full border border-slate-300 bg-white px-5 py-2 font-medium shadow-sm hover:bg-slate-50"
              >
                {category}
              </button>
            )
          )}
        </div>

        <div className="mt-12 w-full max-w-3xl text-left">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
              {error}
            </div>
          )}

          {!loading &&
            searched &&
            !error &&
            results.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                <p className="text-lg font-bold">
                  No results found
                </p>
                <p className="mt-2 text-slate-500">
                  RayGo has not indexed a matching page yet.
                </p>
              </div>
            )}

          {!loading &&
            results.map((result) => (
              <article
                key={result.url}
                className="mb-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <p className="mb-1 text-sm font-medium text-emerald-700">
                  {result.hostname}
                </p>

                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xl font-bold text-blue-700 hover:underline"
                >
                  {result.title || result.url}
                </a>

                <p className="mt-2 break-all text-sm text-emerald-700">
                  {result.url}
                </p>

                {result.description && (
                  <p className="mt-3 leading-relaxed text-slate-600">
                    {result.description}
                  </p>
                )}
              </article>
            ))}
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-slate-500">
        © 2026 RayGo · raygoes.com
      </footer>
    </main>
  );
} 

"use client";

import { FormEvent, useState } from "react";

export default function Home() {
  const [searchText, setSearchText] = useState("");

  function searchWeb(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = searchText.trim();

    if (!query) {
      return;
    }

    window.location.href =
      `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 text-slate-900">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="text-2xl font-extrabold tracking-tight">
          <span className="text-blue-600">Ray</span>
          <span className="text-emerald-500">Go</span>
        </div>

        <nav className="flex gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm"
          >
            RayGo Mail
          </button>

          <button
            type="button"
            className="rounded-full bg-blue-600 px-5 py-2 font-semibold text-white shadow-sm"
          >
            Sign In
          </button>
        </nav>
      </header>

      <section className="flex min-h-[75vh] flex-col items-center justify-center px-5 text-center">
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
            className="rounded-full bg-blue-600 px-7 py-3 text-lg font-bold text-white hover:bg-blue-700"
          >
            Search
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
      </section>

      <footer className="px-6 py-6 text-center text-sm text-slate-500">
        © 2026 RayGo · raygoes.com
      </footer>
    </main>
  );
} 

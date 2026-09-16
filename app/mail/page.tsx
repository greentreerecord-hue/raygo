import Link from "next/link";

export const metadata = {
  title: "RayGo Mail",
  description:
    "Secure and simple email from RayGo.",
};

export default function RayGoMailPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 text-slate-900">
      <header className="flex items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-2xl font-extrabold tracking-tight"
        >
          <span className="text-blue-600">Ray</span>
          <span className="text-emerald-500">Go</span>
        </Link>

        <Link
          href="/"
          className="rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm"
        >
          Back to Search
        </Link>
      </header>

      <section className="mx-auto flex min-h-[75vh] max-w-6xl flex-col items-center justify-center gap-12 px-6 py-12 lg:flex-row">
        <div className="max-w-xl text-center lg:text-left">
          <p className="mb-3 text-lg font-bold text-blue-600">
            Introducing
          </p>

          <h1 className="mb-5 text-5xl font-black tracking-tight sm:text-7xl">
            <span className="text-blue-600">RayGo</span>{" "}
            <span className="text-emerald-500">Mail</span>
          </h1>

          <p className="mb-8 text-xl leading-relaxed text-slate-600">
            Simple, organized email with your own
            RayGo Mail account.
          </p>

          <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
            <Link
              href="/mail/signup"
              className="rounded-full bg-blue-600 px-7 py-3 text-lg font-bold text-white shadow-lg hover:bg-blue-700"
            >
              Create Account
            </Link>

            <Link
              href="/mail/login"
              className="rounded-full border-2 border-blue-600 bg-white px-7 py-3 text-lg font-bold text-blue-600 shadow-sm hover:bg-blue-50"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-3xl text-white">
              ✉
            </div>

            <div>
              <h2 className="text-2xl font-extrabold">
                Your Inbox
              </h2>
              <p className="text-slate-500">
                Everything in one place
              </p>
            </div>
          </div>

          {[
            ["Welcome to RayGo Mail", "Your new inbox is ready."],
            ["Easy to use", "Compose, reply, and organize."],
            ["Built for you", "Simple email without the clutter."],
          ].map(([title, description]) => (
            <div
              key={title}
              className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 last:mb-0"
            >
              <p className="font-bold">{title}</p>
              <p className="text-sm text-slate-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-slate-500">
        © 2026 RayGo Mail · raygoes.com
      </footer>
    </main>
  );
} 

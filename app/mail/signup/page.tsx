"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RayGoMailSignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  function cleanUsername(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "");
  }

  async function createAccount(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (
      !name.trim() ||
      !username.trim() ||
      !password ||
      !confirmPassword
    ) {
      setMessage("Please complete every field.");
      return;
    }

    if (username.length < 3) {
      setMessage(
        "Your email name must have at least 3 characters."
      );
      return;
    }

    if (password.length < 8) {
      setMessage(
        "Your password must have at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Your passwords do not match.");
      return;
    }

    try {
      setCreating(true);
      setMessage("Creating your RayGo Mail account...");

      const response = await fetch(
        "/api/mail/signup",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error ||
            "Could not create your account."
        );
        return;
      }

      setMessage(
        `Account created! Your address is ${data.email}`
      );

      setTimeout(() => {
        router.push("/mail/inbox");
      }, 1200);
    } catch (error) {
      console.error("Mail signup error:", error);
      setMessage("Could not create your account.");
    } finally {
      setCreating(false);
    }
  }

  const emailPreview = username
    ? `${username}@raygoes.com`
    : "yourname@raygoes.com";

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 px-5 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-xl">
        <Link
          href="/mail"
          className="mb-6 inline-block rounded-full border border-slate-300 bg-white px-5 py-2 font-semibold shadow-sm"
        >
          ← Back to RayGo Mail
        </Link>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl sm:p-10">
          <h1 className="mb-2 text-4xl font-black">
            Create RayGo Mail
          </h1>

          <p className="mb-8 text-slate-600">
            Choose your new RayGo Mail address.
          </p>

          <form
            onSubmit={createAccount}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-2 block font-bold"
              >
                Your Name
              </label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                disabled={creating}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-500"
                placeholder="Raymond Robinson"
              />
            </div>

            <div>
              <label
                htmlFor="username"
                className="mb-2 block font-bold"
              >
                Choose Email Address
              </label>

              <div className="flex items-center rounded-xl border-2 border-slate-300 bg-white focus-within:border-blue-500">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      cleanUsername(event.target.value)
                    )
                  }
                  disabled={creating}
                  className="min-w-0 flex-1 rounded-l-xl px-4 py-3 text-lg outline-none"
                  placeholder="yourname"
                />

                <span className="pr-4 text-slate-500">
                  @raygoes.com
                </span>
              </div>

              <p className="mt-2 text-sm text-blue-600">
                Your address: {emailPreview}
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block font-bold"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                disabled={creating}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-500"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block font-bold"
              >
                Confirm Password
              </label>

              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                disabled={creating}
                className="w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg outline-none focus:border-blue-500"
                placeholder="Enter the password again"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full rounded-full bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg hover:bg-blue-700 disabled:bg-slate-400"
            >
              {creating
                ? "Creating Account..."
                : "Create Account"}
            </button>
          </form>

          {message && (
            <p className="mt-5 rounded-xl bg-slate-100 p-4 font-semibold">
              {message}
            </p>
          )}

          <p className="mt-7 text-center text-slate-600">
            Already have an account?{" "}
            <Link
              href="/mail/login"
              className="font-bold text-blue-600"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
} 

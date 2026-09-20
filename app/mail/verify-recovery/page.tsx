"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function VerifyRecoveryPage() {
  const started = useRef(false);
  const [message, setMessage] = useState(
    "Checking your verification link..."
  );
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(
      window.location.search
    ).get("token");

    window.history.replaceState(
      null,
      "",
      "/mail/verify-recovery"
    );

    if (!token) {
      setMessage("This verification link is missing its token.");
      return;
    }

    async function verify() {
      try {
        const response = await fetch(
          "/api/mail/recovery/verify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          }
        );

        const data = await response.json();
        setVerified(response.ok);
        setMessage(
          data.message ||
            data.error ||
            "Could not verify your recovery email."
        );
      } catch {
        setMessage(
          "Could not verify your recovery email. Please try again."
        );
      }
    }

    verify();
  }, []);

  return (
    <main className="min-h-screen bg-sky-50 px-5 py-16 text-slate-900">
      <section className="mx-auto max-w-lg rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold">
          Verify recovery email
        </h1>

        <p role="status" className="mt-5">
          {message}
        </p>

        <Link
          href={verified ? "/mail/inbox" : "/mail/login"}
          className="mt-7 inline-block rounded-full bg-blue-600 px-5 py-3 font-semibold text-white"
        >
          {verified ? "Go to inbox" : "Go to sign in"}
        </Link>
      </section>
    </main>
  );
} 

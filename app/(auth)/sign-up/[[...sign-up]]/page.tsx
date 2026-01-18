"use client";

import React from "react";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  const hasClerk = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!hasClerk) {
    return (
      <div className="w-[520px] max-w-[92vw] rounded-[28px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
        <div className="px-10 pt-10 pb-10">
          <h1 className="font-serif text-[44px] leading-none text-white font-normal tracking-tight">
            Sign up
          </h1>
          <p className="mt-6 text-white/70 text-sm">
            Clerk keys are missing. Add <code className="text-white">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code>{" "}
            (and <code className="text-white">CLERK_SECRET_KEY</code>) in <code className="text-white">.env.local</code>,
            then restart the dev server.
          </p>
          <div className="pt-6 text-center text-sm text-white/60">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="text-white underline underline-offset-4 hover:opacity-90"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[520px] max-w-[92vw] rounded-[28px] bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
      <div className="px-10 pt-10 pb-6 flex items-center justify-between gap-6">
        <h1 className="font-serif text-[44px] leading-none text-white font-normal tracking-tight">
          Sign up
        </h1>
      </div>

      <div className="px-10 pb-10">
        <div className="mx-auto w-full max-w-[420px]">
          <SignUp
            forceRedirectUrl="/loading"
            appearance={{
              variables: {
                colorPrimary: "#ff7c12",
                borderRadius: "28px",
                fontFamily: "var(--font-sohne)",
              },
              elements: {
                rootBox: "w-full",
                cardBox: "w-full",
                card: "w-full bg-transparent shadow-none border-0 p-0 rounded-none",
                header: "hidden",
                footer: "hidden",
                main: "p-0",
                socialButtonsBlockButton:
                "w-full rounded-[16px] h-11 bg-white/10 border border-white/20 text-white hover:bg-white/15",
                socialButtonsBlockButtonText: "text-white font-normal",
                dividerLine: "bg-white/20",
                dividerText: "text-white/60",
                formFieldLabel: "text-white/70",
                formFieldInput:
                "w-full rounded-[16px] h-11 bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:ring-2 focus:ring-offset-0 focus:ring-white/30",
                formButtonPrimary:
                "w-full rounded-[16px] h-11 bg-[var(--accent)] text-white hover:opacity-90 focus:ring-2 focus:ring-white/30",
              },
            }}
          />
        </div>

        <div className="pt-6 text-center text-sm text-white/60">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-white underline underline-offset-4 hover:opacity-90"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}


import React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950">
      {/* Background image (optional). User will add later as /public/img/login-bg.jpg */}
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center blur-sm"
        style={{ backgroundImage: "url(/img/login-bg.jpg)" }}
        aria-hidden="true"
      />

      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        {children}
      </div>
    </div>
  );
}


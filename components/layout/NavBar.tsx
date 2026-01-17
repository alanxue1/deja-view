"use client";

import React from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Button from "@/components/ui/Button";

export const NavBar: React.FC = () => {
  return (
    <nav className="w-full h-[73px] flex items-center border-b border-[var(--border)]">
      <div className="w-full max-w-6xl mx-auto px-10">
        <div className="grid grid-cols-3 items-center h-full">
          {/* Left: Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="text-[16px] text-[var(--ink)] hover:opacity-70 transition-opacity font-sohne"
              data-cursor="hover"
            >
              Logo
            </Link>
          </div>

          {/* Center: Deja View */}
          <div className="flex items-center justify-center">
            <h1 className="text-[16px] text-[var(--ink)] font-normal font-sohne">
              Deja View
            </h1>
          </div>

          {/* Right: Auth - UserButton when signed in, SignIn when signed out */}
          <div className="flex items-center justify-end">
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Button asChild href="/sign-in" variant="ghost" className="text-[16px] font-normal font-sohne">
                Login
              </Button>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;

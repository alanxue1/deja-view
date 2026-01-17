"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
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

          {/* Right: Login */}
          <div className="flex items-center justify-end">
            <Button 
              variant="ghost" 
              asChild 
              href="/login" 
              className="text-[16px] font-normal font-sohne"
            >
              Login
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;

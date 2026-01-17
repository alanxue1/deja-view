"use client";

import React from "react";
import { User } from "lucide-react";
import Link from "next/link";

export const OverlayHeader: React.FC = () => {
  return (
    <header className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-6">
      <div className="flex items-center justify-between max-w-full">
        {/* Left: Logo */}
        <div className="pointer-events-auto">
          <Link
            href="/"
            className="text-base font-medium text-white hover:opacity-70 transition-opacity"
            data-cursor="hover"
          >
            Logo
          </Link>
        </div>

        {/* Center: Deja View */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <h1 className="text-lg font-semibold text-white">Deja View</h1>
        </div>

        {/* Right: User Icon */}
        <div className="pointer-events-auto">
          <button
            className="text-white hover:opacity-70 transition-opacity"
            data-cursor="hover"
            aria-label="User menu"
          >
            <User size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default OverlayHeader;

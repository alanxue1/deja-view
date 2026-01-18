"use client";

import React from "react";
import { usePathname } from "next/navigation";
import OverlayHeader from "@/components/overlay/OverlayHeader";

// Routes where the header should be hidden entirely
const HIDDEN_ROUTES = ["/sign-in", "/sign-up"];

// Routes that use the dark (white text) scheme
const DARK_SCHEME_ROUTES = ["/room"];

// Routes where the hamburger menu should be hidden
const NO_HAMBURGER_ROUTES = ["/"];

export const GlobalHeader: React.FC = () => {
  const pathname = usePathname();

  // Hide header on auth routes
  if (HIDDEN_ROUTES.some((route) => pathname.startsWith(route))) {
    return null;
  }

  // Determine color scheme based on route
  const scheme = DARK_SCHEME_ROUTES.some((route) => pathname.startsWith(route))
    ? "dark"
    : "light";

  // Hide hamburger on home page (exact match for "/")
  const showHamburger = !NO_HAMBURGER_ROUTES.includes(pathname);

  return <OverlayHeader scheme={scheme} showHamburger={showHamburger} />;
};

export default GlobalHeader;

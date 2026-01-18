"use client";

import React from "react";
import { usePathname } from "next/navigation";
import OverlayHeader from "@/components/overlay/OverlayHeader";

// Routes where the header should be hidden entirely
const HIDDEN_ROUTES = ["/sign-in", "/sign-up"];

// Routes that use the overlay (white text) scheme - typically dark backgrounds
const OVERLAY_ROUTES = ["/room"];

// Routes where hamburger menu should be hidden
const NO_HAMBURGER_ROUTES = ["/"];

export const GlobalHeader: React.FC = () => {
  const pathname = usePathname();

  // Hide header on auth routes
  if (HIDDEN_ROUTES.some((route) => pathname.startsWith(route))) {
    return null;
  }

  // Use overlay mode (white text) on dark background routes
  const useOverlay = OVERLAY_ROUTES.some((route) => pathname.startsWith(route));
  
  // Hide hamburger on home page
  const showHamburger = !NO_HAMBURGER_ROUTES.includes(pathname);

  return <OverlayHeader overlay={useOverlay} showHamburger={showHamburger} />;
};

export default GlobalHeader;

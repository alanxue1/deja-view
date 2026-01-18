"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, useClerk, useUser } from "@clerk/nextjs";
import Hamburger from "hamburger-react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Sidebar from "@/components/layout/Sidebar";

interface OverlayHeaderProps {
  /** Color scheme: "dark" = white text (for /room), "light" = ink text (for light pages) */
  scheme?: "dark" | "light";
  /** Whether to show the hamburger menu (default: true) */
  showHamburger?: boolean;
}

export const OverlayHeader: React.FC<OverlayHeaderProps> = ({ scheme = "dark", showHamburger = true }) => {
  const router = useRouter();
  const clerk = useClerk();
  const { user } = useUser();
  const [isOpen, setOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef<HTMLDivElement | null>(null);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    origin: "top right" | "bottom right";
  } | null>(null);

  const isDark = scheme === "dark";

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  // Colors based on scheme
  const textColor = isDark ? "text-white" : "text-[var(--ink)]";
  const hamburgerColor = isDark ? "white" : "#5f6368";
  const iconColor = isDark ? "text-white" : "text-[var(--ink)]";

  useEffect(() => {
    if (!isProfileOpen) {
      setMenuPos(null);
      return;
    }

    const updateMenuPosition = () => {
      const btn = profileButtonRef.current;
      const menu = menuRef.current;
      if (!btn || !menu) return;

      const btnRect = btn.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();

      const margin = 12; // keep away from viewport edges
      const gap = 8; // space between button and menu

      let top = btnRect.bottom + gap;
      let origin: "top right" | "bottom right" = "top right";

      // If menu would go off bottom, flip above the button
      if (top + menuRect.height > window.innerHeight - margin) {
        top = btnRect.top - gap - menuRect.height;
        origin = "bottom right";
      }

      // Right-align to the button, then clamp within viewport
      let left = btnRect.right - menuRect.width;
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - menuRect.width));
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - menuRect.height));

      setMenuPos({ top, left, origin });
    };

    // Wait a frame so the menu is mounted/measurable
    const raf = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    // Reposition on scroll (any scroll container)
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isProfileOpen]);

  useEffect(() => {
    if (!isProfileOpen) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!profileWrapRef.current?.contains(target)) setProfileOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isProfileOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[60] pointer-events-none p-6">
        <div className="flex items-center justify-between max-w-full">
          {/* Left: Hamburger Menu - Placeholder div for layout */}
          <div className="pointer-events-none" style={{ width: '48px', height: '48px' }} />

          {/* Center: Deja View */}
          <div className="absolute left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <button
              onClick={handleHomeClick}
              className={`text-2xl font-tiempos font-normal ${textColor} hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 p-0`}
              data-cursor="hover"
            >
              Deja View
            </button>
          </div>

          {/* Right: User Icon or Profile Image */}
          <div className="pointer-events-auto">
            <SignedIn>
              <div
                ref={profileWrapRef}
                className="relative w-12 h-12 flex items-center justify-center"
                style={{ width: "48px", height: "48px" }}
              >
                <button
                  type="button"
                  ref={profileButtonRef}
                  onClick={() => setProfileOpen((v) => !v)}
                  className="w-12 h-12 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 rounded-full flex items-center justify-center"
                  data-cursor="hover"
                  aria-label="User menu"
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                >
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.firstName || "User"}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <User size={32} className={iconColor} />
                  )}
                </button>

                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      ref={menuRef}
                      className="glass-popover fixed min-w-[240px] max-w-[calc(100vw-24px)] z-[120] p-3 text-white"
                      style={{
                        top: menuPos?.top ?? 0,
                        left: menuPos?.left ?? 0,
                        transformOrigin: menuPos?.origin ?? "top right",
                        willChange: "transform, opacity",
                      }}
                    >
                      <div className="px-2 pb-3">
                        <div className="text-base font-semibold leading-tight">
                          {user?.fullName || user?.firstName || "Account"}
                        </div>
                        {user?.primaryEmailAddress?.emailAddress && (
                          <div className="text-xs text-white/75 mt-1">
                            {user.primaryEmailAddress.emailAddress}
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-white/10 my-2" />

                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setProfileOpen(false);
                          await clerk.signOut({ redirectUrl: "/" });
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 transition-colors text-sm"
                        data-cursor="hover"
                      >
                        Log out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="redirect" forceRedirectUrl="/loading">
                <button
                  type="button"
                  className={`w-12 h-12 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 rounded-full flex items-center justify-center`}
                  data-cursor="hover"
                  aria-label="Sign in"
                >
                  <User size={32} className={iconColor} />
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </header>
      {/* Hamburger Menu - Rendered outside header stacking context */}
      {showHamburger && (
        <div 
          className="fixed z-[110] pointer-events-auto" 
          style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 110, pointerEvents: 'auto' }}
        >
          <div className="p-2">
            <Hamburger 
              toggled={isOpen} 
              toggle={setOpen} 
              size={28}
              color={hamburgerColor}
            />
          </div>
        </div>
      )}
      {showHamburger && <Sidebar isOpen={isOpen} onClose={() => setOpen(false)} />}
    </>
  );
};

export default OverlayHeader;

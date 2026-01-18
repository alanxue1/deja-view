"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton, useClerk, useUser } from "@clerk/nextjs";
import Hamburger from "hamburger-react";
import { AnimatePresence, motion } from "framer-motion";
import Button from "@/components/ui/Button";
import Sidebar from "@/components/layout/Sidebar";

interface OverlayHeaderProps {
  overlay?: boolean;
  onRoomSelect?: (modelPath: string) => void;
}

export const OverlayHeader: React.FC<OverlayHeaderProps> = ({ overlay = true, onRoomSelect }) => {
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

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

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

  // Overlay mode: absolute positioning with white text for dark backgrounds
  if (overlay) {
    return (
      <>
        <header className="absolute top-0 left-0 right-0 z-[60] pointer-events-none p-6">
          <div className="flex items-center justify-between max-w-full">
            {/* Left: Hamburger Menu - Placeholder div for layout */}
            <div className="pointer-events-none" style={{ width: '48px', height: '48px' }} />

            {/* Center: Deja View */}
            <div className="absolute left-1/2 transform -translate-x-1/2">
              <h1 className="text-2xl font-semibold text-white">Deja View</h1>
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
                      <User size={32} className="text-white" />
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
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center overflow-hidden">
                              {user?.imageUrl ? (
                                <img
                                  src={user.imageUrl}
                                  alt={user.firstName || "User"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User size={18} className="text-white/90" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-base font-semibold leading-tight truncate">
                                {user?.fullName || user?.firstName || "Account"}
                              </div>
                              {user?.primaryEmailAddress?.emailAddress && (
                                <div className="text-xs text-white/75 mt-1 truncate">
                                  {user.primaryEmailAddress.emailAddress}
                                </div>
                              )}
                            </div>
                          </div>
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
                    className="w-12 h-12 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 rounded-full flex items-center justify-center"
                    data-cursor="hover"
                    aria-label="Sign in"
                  >
                    <User size={32} className="text-white" />
                  </button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </header>
        {/* Hamburger Menu - Rendered outside header stacking context */}
        <div className="fixed top-6 left-6 z-[110] pointer-events-auto" style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 110, pointerEvents: 'auto' }}>
          <div className="p-2">
            <Hamburger 
              toggled={isOpen} 
              toggle={setOpen} 
              size={28}
              color="white"
            />
          </div>
        </div>
        <Sidebar isOpen={isOpen} onClose={() => setOpen(false)} onRoomSelect={onRoomSelect} />
      </>
    );
  }

  // Regular mode: normal flow with regular colors and Clerk auth
  return (
    <>
      <nav className="w-full h-[73px] flex items-center border-b border-[var(--border)] relative z-[60]">
        <div className="w-full max-w-6xl mx-auto px-10">
          <div className="grid grid-cols-3 items-center h-full">
            {/* Left: Hamburger Menu - Placeholder div for layout */}
            <div className="flex items-center" style={{ width: '48px', height: '48px' }} />

            {/* Center: Deja View */}
            <div className="flex items-center justify-center">
              <button
                onClick={handleHomeClick}
                className="text-[20px] text-[var(--ink)] hover:opacity-70 transition-opacity font-normal font-sohne cursor-pointer bg-transparent border-0 p-0"
                data-cursor="hover"
              >
                Deja View
              </button>
            </div>

            {/* Right: Auth - UserButton when signed in, SignIn when signed out */}
            <div className="flex items-center justify-end">
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="redirect" forceRedirectUrl="/loading">
                  <Button
                    variant="ghost"
                    className="text-[16px] font-normal font-sohne"
                  >
                    Login
                  </Button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </nav>
      {/* Hamburger Menu - Rendered outside nav stacking context */}
      <div className="fixed top-0 left-0 z-[110] pointer-events-auto" style={{ position: 'fixed', top: '0px', left: '0px', zIndex: 110, pointerEvents: 'auto', padding: '20px' }}>
        <div className="p-2">
          <Hamburger 
            toggled={isOpen} 
            toggle={setOpen} 
            size={28}
            color="#5f6368"
          />
        </div>
      </div>
      <Sidebar isOpen={isOpen} onClose={() => setOpen(false)} />
    </>
  );
};

export default OverlayHeader;

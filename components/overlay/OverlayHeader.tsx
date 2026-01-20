"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, useClerk, useUser } from "@clerk/nextjs";
import Hamburger from "hamburger-react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "@/components/layout/Sidebar";

interface OverlayHeaderProps {
  overlay?: boolean;
  showHamburger?: boolean;
  onRoomSelect?: (modelPath: string) => void;
  currentRoomPath?: string;
}

// Map model paths to display names
const ROOM_NAMES: Record<string, string> = {
  "/davidsbedroom.glb": "David's Bedroom",
  "/uoft-student-dorm.glb": "Uoft Student Dorm",
};

export const OverlayHeader: React.FC<OverlayHeaderProps> = ({ overlay = true, showHamburger = true, onRoomSelect, currentRoomPath }) => {
  const currentRoomName = currentRoomPath ? ROOM_NAMES[currentRoomPath] || "Room" : null;
  const router = useRouter();
  const clerk = useClerk();
  const { user } = useUser();
  const [isOpen, setOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isLoadingPinterest, setIsLoadingPinterest] = useState(false);
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

  const handlePinterestBoard = async (url: string) => {
    if (!url || isLoadingPinterest) return;
    
    // As soon as the user submits a Pinterest URL, enable DB import for this session.
    // This makes saved items appear immediately even while the Pinterest pipeline runs.
    try {
      window.sessionStorage.setItem("dejaView:dbImportEnabled", "1");
      window.dispatchEvent(new Event("dejaView:dbImportEnabled"));
    } catch {
      // ignore
    }

    setIsLoadingPinterest(true);
    try {
      const response = await fetch("/api/pinterest-board", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ boardUrl: url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process Pinterest board");
      }

      const result = await response.json();
      console.log("✅ Pinterest board processed:", result);

      // Clear input
      const input = document.querySelector('input[placeholder*="Pinterest"]') as HTMLInputElement;
      if (input) input.value = '';

      // Reload the page to show new items
      window.location.reload();
    } catch (error) {
      console.error("❌ Error processing Pinterest board:", error);
      setIsLoadingPinterest(false);
    }
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

      const margin = 12;
      const gap = 8;

      let top = btnRect.bottom + gap;
      let origin: "top right" | "bottom right" = "top right";

      if (top + menuRect.height > window.innerHeight - margin) {
        top = btnRect.top - gap - menuRect.height;
        origin = "bottom right";
      }

      let left = btnRect.right - menuRect.width;
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - menuRect.width));
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - menuRect.height));

      setMenuPos({ top, left, origin });
    };

    const raf = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
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

  // Overlay mode: fixed positioning with white text for dark backgrounds
  if (overlay) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-[60] pointer-events-none p-6">
          <div className="flex items-center justify-between max-w-full">
            {/* Left: Hamburger Menu - Placeholder div for layout */}
            <div className="pointer-events-none" style={{ width: '48px', height: '48px' }} />

            {/* Center: Déjà View */}
            {/* Avoid transform-based centering (can cause subpixel/ghosted text rendering) */}
            <div className="absolute inset-x-0 pointer-events-auto flex flex-col items-center">
              <h1 className="text-2xl font-semibold text-white font-serif mb-3">Déjà View</h1>
              {/* Pinterest Board Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={isLoadingPinterest ? "Processing..." : "Paste Pinterest board URL..."}
                  disabled={isLoadingPinterest}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 text-white text-sm placeholder:text-white/60 focus:outline-none focus:ring-0 focus:border-white/30 w-72 disabled:opacity-50 text-center"
                  style={{ boxShadow: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoadingPinterest) {
                      const url = (e.target as HTMLInputElement).value;
                      if (url) {
                        handlePinterestBoard(url);
                      }
                    }
                  }}
                />
              </div>
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
        <div className="fixed top-6 left-6 z-[110] pointer-events-auto flex items-center gap-3" style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 110, pointerEvents: 'auto' }}>
          <div className="p-2">
            <Hamburger 
              toggled={isOpen} 
              toggle={setOpen} 
              size={28}
              color="white"
            />
          </div>
          {currentRoomName && (
            <span className="text-white text-sm font-medium opacity-80">
              {currentRoomName}
            </span>
          )}
        </div>
        <Sidebar isOpen={isOpen} onClose={() => setOpen(false)} onRoomSelect={onRoomSelect} />
      </>
    );
  }

  // Non-overlay mode (not typically used for /room page)
  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[60] pointer-events-none p-6">
        <div className="flex items-center justify-between max-w-full">
          <div className="pointer-events-none" style={{ width: '48px', height: '48px' }} />
          {/* Avoid transform-based centering (can cause subpixel/ghosted text rendering) */}
          <div className="absolute inset-x-0 pointer-events-auto flex flex-col items-center">
            <button
              onClick={handleHomeClick}
              className="text-2xl font-semibold text-[var(--ink)] font-serif hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 p-0 mb-3"
              data-cursor="hover"
            >
              Déjà View
            </button>
            {/* Pinterest Board Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder={isLoadingPinterest ? "Processing..." : "Paste Pinterest board URL..."}
                disabled={isLoadingPinterest}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-2 text-[var(--ink)] text-sm placeholder:text-[var(--ink)]/60 focus:outline-none focus:ring-0 focus:border-white/30 w-72 disabled:opacity-50 text-center"
                style={{ boxShadow: 'none' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoadingPinterest) {
                    const url = (e.target as HTMLInputElement).value;
                    if (url) {
                      handlePinterestBoard(url);
                    }
                  }
                }}
              />
            </div>
          </div>
          <div className="pointer-events-auto">
            <SignedIn>
              <div
                ref={profileWrapRef}
                className="relative w-12 h-12 flex items-center justify-center"
              >
                <button
                  type="button"
                  ref={profileButtonRef}
                  onClick={() => setProfileOpen((v) => !v)}
                  className="w-12 h-12 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 rounded-full flex items-center justify-center"
                  data-cursor="hover"
                >
                  {user?.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.firstName || "User"}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <User size={32} className="text-[var(--ink)]" />
                  )}
                </button>
              </div>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="redirect" forceRedirectUrl="/loading">
                <button
                  type="button"
                  className="w-12 h-12 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 rounded-full flex items-center justify-center"
                  data-cursor="hover"
                >
                  <User size={32} className="text-[var(--ink)]" />
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </header>
      {showHamburger && (
        <>
          <div className="fixed top-6 left-6 z-[110] pointer-events-auto">
            <div className="p-2">
              <Hamburger 
                toggled={isOpen} 
                toggle={setOpen} 
                size={28}
                color="#5f6368"
              />
            </div>
          </div>
          <Sidebar isOpen={isOpen} onClose={() => setOpen(false)} onRoomSelect={onRoomSelect} />
        </>
      )}
    </>
  );
};

export default OverlayHeader;

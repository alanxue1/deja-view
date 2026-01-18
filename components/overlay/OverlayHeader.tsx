"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Hamburger from "hamburger-react";
import Button from "@/components/ui/Button";
import Sidebar from "@/components/layout/Sidebar";

interface OverlayHeaderProps {
  overlay?: boolean;
}

export const OverlayHeader: React.FC<OverlayHeaderProps> = ({ overlay = true }) => {
  const router = useRouter();
  const { user } = useUser();
  const [isOpen, setOpen] = useState(false);

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

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
              <button
                className="p-2 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0 rounded-full flex items-center justify-center"
                data-cursor="hover"
                aria-label="User menu"
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
        <Sidebar isOpen={isOpen} onClose={() => setOpen(false)} />
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

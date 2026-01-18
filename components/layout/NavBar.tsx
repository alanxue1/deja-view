"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import Hamburger from "hamburger-react";
import Button from "@/components/ui/Button";
import Sidebar from "@/components/layout/Sidebar";

export const NavBar: React.FC = () => {
  const router = useRouter();
  const [isOpen, setOpen] = useState(false);

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

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

export default NavBar;

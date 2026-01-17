"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Button from "@/components/ui/Button";

interface OverlayHeaderProps {
  overlay?: boolean;
}

export const OverlayHeader: React.FC<OverlayHeaderProps> = ({ overlay = true }) => {
  const router = useRouter();
  const { user } = useUser();

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

  // Overlay mode: absolute positioning with white text for dark backgrounds
  if (overlay) {
    return (
      <header className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-6">
        <div className="flex items-center justify-between max-w-full">
          {/* Left: Hamburger Menu */}
          <div className="pointer-events-auto">
            <button
              className="p-2 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0"
              data-cursor="hover"
              aria-label="Menu"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                height="24px" 
                viewBox="0 -960 960 960" 
                width="24px" 
                fill="white"
                className="w-7 h-7"
              >
                <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
              </svg>
            </button>
          </div>

          {/* Center: Deja View */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <h1 className="text-xl font-semibold text-white">Deja View</h1>
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
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <User size={28} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </header>
    );
  }

  // Regular mode: normal flow with regular colors and Clerk auth
  return (
    <nav className="w-full h-[73px] flex items-center border-b border-[var(--border)]">
      <div className="w-full max-w-6xl mx-auto px-10">
        <div className="grid grid-cols-3 items-center h-full">
          {/* Left: Hamburger Menu */}
          <div className="flex items-center">
            <button
              className="p-2 hover:opacity-70 transition-opacity cursor-pointer bg-transparent border-0"
              data-cursor="hover"
              aria-label="Menu"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                height="24px" 
                viewBox="0 -960 960 960" 
                width="24px" 
                fill="#5f6368"
                className="w-7 h-7"
              >
                <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
              </svg>
            </button>
          </div>

          {/* Center: Deja View */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleHomeClick}
              className="text-[18px] text-[var(--ink)] hover:opacity-70 transition-opacity font-normal font-sohne cursor-pointer bg-transparent border-0 p-0"
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
  );
};

export default OverlayHeader;

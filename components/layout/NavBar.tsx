"use client";

import React from "react";
import Link from "next/link";
<<<<<<< HEAD
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
=======
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
>>>>>>> 65b7ed7 (Align sidebar content with hamburger menu icon position and improve 3D hover preview)
import Button from "@/components/ui/Button";

export const NavBar: React.FC = () => {
  const router = useRouter();

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push("/");
  };

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
                className="w-6 h-6"
              >
                <path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/>
              </svg>
            </button>
          </div>

          {/* Center: Deja View */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleHomeClick}
              className="text-[16px] text-[var(--ink)] hover:opacity-70 transition-opacity font-normal font-sohne cursor-pointer bg-transparent border-0 p-0"
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
              <Button asChild href="/sign-in" variant="ghost" className="text-[16px] font-normal font-sohne">
                Login
              </Button>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;

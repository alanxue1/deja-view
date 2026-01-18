"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Container from "@/components/ui/Container";

const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="24px"
    viewBox="0 -960 960 960"
    width="24px"
    fill="currentColor"
    className={className}
  >
    <path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z" />
  </svg>
);

// Progress ring component
const ProgressRing: React.FC<{
  progress: number;
  size: number;
  strokeWidth: number;
}> = ({ progress, size, strokeWidth }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0 -rotate-90"
    >
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E0E0E0"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
};

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const [memoryName, setMemoryName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isEdited, setIsEdited] = useState(false);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(4 * 60); // 4 minutes in seconds
  const [progress, setProgress] = useState(0);
  const totalTime = 4 * 60; // 4 minutes total

  // Set default value when user loads
  useEffect(() => {
    if (user && !isEdited) {
      const username = user.firstName || user.username || "User";
      setMemoryName(`${username}'s Room`);
    }
  }, [user, isEdited]);

  // Countdown timer
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Update progress based on time remaining
  useEffect(() => {
    if (!isLoading) return;
    const elapsed = totalTime - timeRemaining;
    const newProgress = (elapsed / totalTime) * 100;
    setProgress(newProgress);
  }, [timeRemaining, isLoading, totalTime]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Start loading state
      setIsLoading(true);
      setTimeRemaining(4 * 60);
      setProgress(0);
      console.log("File selected:", file);
    }
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    // Clear default value on first focus
    if (!isEdited && user) {
      const username = user.firstName || user.username || "User";
      if (memoryName === `${username}'s Room`) {
        setMemoryName("");
      }
    }
  };

  const handleInputBlur = () => {
    setIsFocused(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMemoryName(e.target.value);
    setIsEdited(true);
  };

  // Loading screen
  if (isLoading) {
    return (
      <main className="min-h-screen bg-[var(--bg)] flex flex-col pt-20">
        <Container className="flex-1 flex flex-col items-center justify-center py-16 px-6">
          <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
            {/* Loading Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-[var(--ink)] font-normal text-center mb-16">
              Loading your{" "}
              <span className="text-[var(--accent)] border-b-2 border-[var(--accent)]">
                {memoryName || "Room"}
              </span>
            </h1>

            {/* Progress Ring */}
            <div className="relative w-36 h-36 md:w-44 md:h-44 mb-6 animate-scale-in">
              <ProgressRing
                progress={progress}
                size={176}
                strokeWidth={4}
              />
              {/* Inner circle */}
              <div className="absolute inset-3 rounded-full bg-[#E8E8E8] flex items-center justify-center">
                <span className="text-[var(--ink)] font-sohne text-base md:text-lg">
                  Ready in {formatTime(timeRemaining)}
                </span>
              </div>
            </div>

            {/* Check back message */}
            <p className="text-[var(--muted)] font-sohne text-base md:text-lg text-center mb-2 animate-fade-in-up">
              Check back soon!
            </p>
            <p className="text-[var(--muted)] font-sohne text-sm text-center animate-fade-in-up animation-delay-100">
              Do not close your browser.
            </p>
          </div>
        </Container>

        <style jsx>{`
          @keyframes fade-in {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes scale-in {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes fade-in-up {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
          }

          .animate-scale-in {
            animation: scale-in 0.6s ease-out forwards;
          }

          .animate-fade-in-up {
            animation: fade-in-up 0.5s ease-out forwards;
            animation-delay: 0.3s;
            opacity: 0;
          }

          .animation-delay-100 {
            animation-delay: 0.4s;
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col pt-20">
      <Container className="flex-1 flex flex-col items-center justify-center py-16 px-6">
        <div className="w-full max-w-2xl flex flex-col items-center">
          {/* Main Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-[var(--ink)] font-normal text-center mb-12">
            {user ? "Upload your Next Memory." : "Upload your First Memory."}
          </h1>

          {/* Memory Name Input */}
          <div className="w-full max-w-md mb-16">
            <input
              ref={inputRef}
              type="text"
              value={memoryName}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className={`w-full text-center text-2xl md:text-3xl font-sohne bg-transparent border-0 border-b-2 transition-colors pb-3 px-2 focus:outline-none ${
                isFocused || isEdited
                  ? "text-[var(--accent)] border-[var(--accent)]"
                  : "text-[var(--muted)] border-[var(--ink)]"
              }`}
              placeholder="Memory name"
            />
          </div>

          {/* Upload Button */}
          <div className="mb-16">
            <button
              onClick={handleUploadClick}
              className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-[#E0E0E0] hover:bg-[#D0D0D0] active:scale-95 transition-all flex items-center justify-center shadow-[var(--shadow-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
              data-cursor="hover"
              aria-label="Upload file"
            >
              <UploadIcon className="w-7 h-7 md:w-8 md:h-8 text-[var(--ink)]" />
            </button>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".glb,.gltf,.obj,.ply,.las,.laz"
              className="hidden"
            />
          </div>

          {/* Instructions */}
          <div className="w-full max-w-lg">
            <ol className="space-y-4 text-sm md:text-base text-[var(--ink)] font-sohne list-decimal pl-6">
              <li className="leading-relaxed">
                Record a slow room walk-through (stay ~2 m from walls) or export
                a LiDAR scan.
              </li>
              <li className="leading-relaxed">
                Aim for 45-90 seconds, good lighting, and avoid fast turns.
              </li>
              <li className="leading-relaxed">
                Upload the file we'll detect the format and open your room in the
                viewer.
              </li>
            </ol>
          </div>
        </div>
      </Container>
    </main>
  );
}

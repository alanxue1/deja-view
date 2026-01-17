"use client";

import React, { useRef, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import OverlayHeader from "@/components/overlay/OverlayHeader";
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

export default function UploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const [memoryName, setMemoryName] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isEdited, setIsEdited] = useState(false);

  // Set default value when user loads
  useEffect(() => {
    if (user && !isEdited) {
      const username = user.firstName || user.username || "User";
      setMemoryName(`${username}'s Room`);
    }
  }, [user, isEdited]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Handle file upload logic here
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

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col">
      <OverlayHeader overlay={false} />
      <Container className="flex-1 flex flex-col items-center justify-center py-16 px-6">
        <div className="w-full max-w-2xl flex flex-col items-center">
          {/* Main Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-[var(--ink)] font-normal text-center mb-12">
            Upload your First Memory.
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

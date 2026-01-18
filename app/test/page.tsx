"use client";

import React, { useState, useEffect } from "react";
import Container from "@/components/ui/Container";
import OverlayHeader from "@/components/overlay/OverlayHeader";
import LoadingProgress from "@/components/ui/LoadingProgress";
import Button from "@/components/ui/Button";
import ScrollIndicator from "@/components/ui/ScrollIndicator";

export default function TestPage() {
  const [progress, setProgress] = useState(0.3);
  const [minutesRemaining, setMinutesRemaining] = useState<number | undefined>(6);
  const [useMinutes, setUseMinutes] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-animate progress for testing
  useEffect(() => {
    if (isAnimating) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 1) {
            setIsAnimating(false);
            return 1;
          }
          return prev + 0.01;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isAnimating]);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <OverlayHeader overlay={false} />
      <Container className="py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-serif text-[var(--ink)] mb-8">
            Loading Progress Component Test
          </h1>

          {/* Test Component Display */}
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-card shadow-sm mb-8 overflow-visible">
            <LoadingProgress
              progress={progress}
              minutesRemaining={useMinutes ? minutesRemaining : undefined}
            />
            <div className="mt-8">
              <ScrollIndicator />
            </div>
          </div>

          {/* Controls */}
          <div className="bg-white rounded-card shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-xl font-serif text-[var(--ink)] mb-4">
                Controls
              </h2>
              
              {/* Progress Slider */}
              <div className="mb-4">
                <label className="block text-sm text-[var(--ink)] mb-2">
                  Progress: {Math.round(progress * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={progress}
                  onChange={(e) => setProgress(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Display Mode Toggle */}
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMinutes}
                    onChange={(e) => setUseMinutes(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-[var(--ink)]">
                    Show minutes remaining
                  </span>
                </label>
              </div>

              {/* Minutes Input */}
              {useMinutes && (
                <div className="mb-4">
                  <label className="block text-sm text-[var(--ink)] mb-2">
                    Minutes Remaining
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={minutesRemaining || 0}
                    onChange={(e) =>
                      setMinutesRemaining(parseInt(e.target.value) || 0)
                    }
                    className="w-32 px-3 py-2 border border-[var(--border)] rounded-card text-sm"
                  />
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="soft"
                  onClick={() => setProgress(0)}
                  className="text-sm"
                >
                  Reset (0%)
                </Button>
                <Button
                  variant="soft"
                  onClick={() => setProgress(0.25)}
                  className="text-sm"
                >
                  25%
                </Button>
                <Button
                  variant="soft"
                  onClick={() => setProgress(0.5)}
                  className="text-sm"
                >
                  50%
                </Button>
                <Button
                  variant="soft"
                  onClick={() => setProgress(0.75)}
                  className="text-sm"
                >
                  75%
                </Button>
                <Button
                  variant="soft"
                  onClick={() => setProgress(1)}
                  className="text-sm"
                >
                  100%
                </Button>
                <Button
                  variant="soft"
                  onClick={() => {
                    setProgress(0);
                    setIsAnimating(true);
                  }}
                  className="text-sm"
                  disabled={isAnimating}
                >
                  {isAnimating ? "Animating..." : "Animate Progress"}
                </Button>
              </div>
            </div>
          </div>

          {/* Code Examples */}
          <div className="mt-8 bg-white rounded-card shadow-sm p-6">
            <h2 className="text-xl font-serif text-[var(--ink)] mb-4">
              Usage Examples
            </h2>
            <div className="space-y-4 font-mono text-sm">
              <div>
                <p className="text-[var(--muted)] mb-1">Show percentage:</p>
                <pre className="bg-[#f5f5f5] p-3 rounded-card overflow-x-auto">
                  {`<LoadingProgress progress={0.65} />`}
                </pre>
              </div>
              <div>
                <p className="text-[var(--muted)] mb-1">Show minutes:</p>
                <pre className="bg-[#f5f5f5] p-3 rounded-card overflow-x-auto">
                  {`<LoadingProgress progress={0.65} minutesRemaining={6} />`}
                </pre>
              </div>
            </div>
          </div>

          {/* Scroll Indicator Test */}
          <div id="scroll-target" className="mt-16 min-h-screen flex items-center justify-center bg-white rounded-card shadow-sm p-12">
            <div className="text-center">
              <h2 className="text-2xl font-serif text-[var(--ink)] mb-4">
                Scroll Indicator Test
              </h2>
              <p className="text-[var(--muted)] mb-8">
                Click the mouse icon below to scroll down
              </p>
              <ScrollIndicator targetId="scroll-target" />
            </div>
          </div>
        </div>
      </Container>
    </main>
  );
}

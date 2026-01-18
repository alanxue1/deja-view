"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import Text from "@/components/ui/Text";
import type { MatchResponse } from "@/lib/match/types";

type UiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; data: MatchResponse };

// Arrow button component for navigation
function ArrowButton({
  direction,
  onClick,
  disabled,
}: {
  direction: "left" | "right";
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-12 h-12 rounded-full bg-white/80 border border-black/10 flex items-center justify-center
                 transition-all duration-200 hover:bg-white hover:shadow-md
                 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/80 disabled:hover:shadow-none"
      aria-label={direction === "left" ? "Previous item" : "Next item"}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        className={direction === "left" ? "rotate-180" : ""}
      >
        <path
          d="M7.5 4L13.5 10L7.5 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// Icon components
function BookmarkIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      className={className}
    >
      <path
        d="M5 5C5 3.89543 5.89543 3 7 3H17C18.1046 3 19 3.89543 19 5V21L12 17.5L5 21V5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M9 22C9.55228 22 10 21.5523 10 21C10 20.4477 9.55228 20 9 20C8.44772 20 8 20.4477 8 21C8 21.5523 8.44772 22 9 22Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 22C20.5523 22 21 21.5523 21 21C21 20.4477 20.5523 20 20 20C19.4477 20 19 20.4477 19 21C19 21.5523 19.4477 22 20 22Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 1H5L7.68 14.39C7.77144 14.8504 8.02191 15.264 8.38755 15.5583C8.75318 15.8526 9.2107 16.009 9.68 16H19.4C19.8693 16.009 20.3268 15.8526 20.6925 15.5583C21.0581 15.264 21.3086 14.8504 21.4 14.39L23 6H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbsDownIcon({ className }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M17 2H19.67C20.236 1.98999 20.7859 2.18813 21.2154 2.55681C21.645 2.92549 21.9242 3.43905 22 4V11C21.9242 11.561 21.645 12.0745 21.2154 12.4432C20.7859 12.8119 20.236 13.01 19.67 13H17M10 15V19C10 19.7956 10.3161 20.5587 10.8787 21.1213C11.4413 21.6839 12.2044 22 13 22L17 13V2H5.72C5.2377 1.99454 4.76965 2.16359 4.40147 2.47599C4.0333 2.78839 3.78954 3.22309 3.72 3.7L2.34 12.7C2.29777 12.9866 2.31825 13.2793 2.4 13.5575C2.48175 13.8356 2.62282 14.0923 2.81346 14.3091C3.0041 14.5259 3.2399 14.6976 3.5045 14.8125C3.7691 14.9274 4.05609 14.9827 4.34 14.975H10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Circular action button component
function ActionButton({
  color,
  label,
  icon,
  active = false,
  animateActive = false,
  onClick,
}: {
  color: "white" | "orange" | "gray";
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  animateActive?: boolean;
  onClick: () => void;
}) {
  const colorClasses = {
    white: "bg-white border border-black/10 hover:bg-gray-50 text-[var(--ink)]",
    orange: "bg-[var(--accent)] hover:opacity-90 text-white",
    gray: "bg-[#4a5568] hover:bg-[#3d4654] text-white",
  };

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <motion.div
        whileTap={{ scale: 0.92 }}
        animate={
          animateActive
            ? active
              ? { scale: [1, 1.12, 1] }
              : { scale: 1 }
            : { scale: 1 }
        }
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className={`w-14 h-14 rounded-full transition-all duration-200 flex items-center justify-center ${colorClasses[color]}`}
      >
        {icon}
      </motion.div>
      <span className="text-xs text-[var(--ink)] opacity-70 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </button>
  );
}

export default function MatchTestPage() {
  const [query, setQuery] = React.useState("orange chair");
  const [state, setState] = React.useState<UiState>({ kind: "idle" });
  const [showDebug, setShowDebug] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [direction, setDirection] = React.useState(0); // -1 for left, 1 for right
  const [favouritedIds, setFavouritedIds] = React.useState<Set<string>>(() => new Set());

  const formatPrice = React.useCallback(
    (p: MatchResponse["products"][number]) => {
      const min = p.priceRange?.min;
      const max = p.priceRange?.max;
      if (!min && !max) return "Price unavailable";
      if (min && max && min === max) return `CA$${min}`;
      if (min && max) return `CA$${min}–${max}`;
      return `CA$${min ?? max ?? "?"}`;
    },
    []
  );

  const run = React.useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;

      setState({ kind: "loading" });
      setCurrentIndex(0); // Reset to first item on new search
      try {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`match failed (${res.status}): ${text || res.statusText}`);
        }

        const data = (await res.json()) as MatchResponse;
        setState({ kind: "success", data });
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "unknown error",
        });
      }
    },
    [setState]
  );

  React.useEffect(() => {
    void run(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const products = state.kind === "success" ? state.data.products : [];
  const warnings = state.kind === "success" ? state.data.warnings ?? [] : [];
  const currentProduct = products[currentIndex];

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < products.length - 1) {
      setDirection(1);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleFavourite = () => {
    // Placeholder - will implement later
    if (!currentProduct) return;
    setFavouritedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentProduct.id)) next.delete(currentProduct.id);
      else next.add(currentProduct.id);
      return next;
    });
  };

  const handleBuyNow = () => {
    if (currentProduct?.productUrl) {
      window.open(currentProduct.productUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDislike = () => {
    // Placeholder - will implement later (remove from world)
    console.log("Disliked:", currentProduct?.title);
  };

  // Animation variants for card transitions
  const cardVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <main className="min-h-screen bg-[var(--bg)] flex flex-col pt-20">
      <Container className="py-8 flex-1 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-3xl font-serif text-[var(--ink)] font-normal">
            Shopify matching spike
          </h1>
          <Text className="text-sm text-[var(--ink)] opacity-70">
            Type a query, fetch from <code className="font-mono">/api/match</code>, swipe results.
          </Text>
        </div>

        <Card className="bg-white/40 border border-black/10 rounded-2xl p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void run(query);
              }}
              placeholder="orange chair"
              className="flex-1 rounded-xl border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/20"
            />
            <div className="flex gap-2">
              <Button variant="soft" onClick={() => void run(query)} disabled={state.kind === "loading"}>
                {state.kind === "loading" ? "Searching…" : "Search"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("orange chair");
                  void run("orange chair");
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-xs text-[var(--ink)] opacity-70">
            {state.kind === "idle" && "Idle"}
            {state.kind === "loading" && "Loading…"}
            {state.kind === "error" && `Error: ${state.message}`}
            {state.kind === "success" &&
              `Returned ${state.data.returned}/${state.data.totalCandidates} candidates`}
            </div>

            {state.kind === "success" ? (
              <label className="flex items-center gap-2 text-xs text-[var(--ink)] opacity-70 select-none">
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => setShowDebug(e.target.checked)}
                  className="accent-black/70"
                />
                Show debug {warnings.length ? `(${warnings.length})` : ""}
              </label>
            ) : null}
          </div>
        </Card>

        <section className="flex-1 min-h-0">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-serif text-[var(--ink)] font-normal">Results</h2>
            {products.length > 0 && (
              <Text className="text-xs text-[var(--ink)] opacity-70">
                {currentIndex + 1} of {products.length}
              </Text>
            )}
          </div>

          {/* Single card with arrow navigation */}
          <div className="flex items-center justify-center gap-4">
            {/* Left Arrow */}
            <ArrowButton
              direction="left"
              onClick={goToPrevious}
              disabled={currentIndex === 0 || products.length === 0}
            />

            {/* Card container with fixed dimensions */}
            <div className="relative w-[320px] sm:w-[380px] h-[520px] sm:h-[580px]">
              <AnimatePresence mode="wait" custom={direction}>
                {currentProduct ? (
                  <motion.div
                    key={currentProduct.id}
                    custom={direction}
                    variants={cardVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: "spring", stiffness: 400, damping: 35 },
                      opacity: { duration: 0.15 },
                    }}
                    className="absolute inset-0"
                  >
                    <Card className="h-full bg-white/60 border border-black/10 rounded-3xl overflow-hidden flex flex-col">
                      {/* Image container - uses object-contain to avoid cropping */}
                      <div className="flex-1 min-h-0 bg-[#f8f8f8] flex items-center justify-center p-4 rounded-t-3xl overflow-hidden">
                        {currentProduct.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={currentProduct.images[0]}
                            alt={currentProduct.title}
                            className="max-w-full max-h-full object-contain rounded-2xl"
                          />
                        ) : (
                          <div className="text-sm text-[var(--ink)] opacity-60">
                            No image available
                          </div>
                        )}
                      </div>

                      {/* Content area */}
                      <div className="p-5 flex flex-col gap-4">
                        {/* Title */}
                        <h3 className="text-lg font-serif italic text-[var(--ink)] leading-snug line-clamp-2">
                          {currentProduct.title}
                        </h3>

                        {/* Price */}
                        <div className="text-base text-[var(--ink)] opacity-80">
                          {formatPrice(currentProduct)}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-between pt-2">
                        {(() => {
                          const isFavourited = !!currentProduct && favouritedIds.has(currentProduct.id);
                          return (
                          <ActionButton
                            color="white"
                            label="Favourite"
                            active={isFavourited}
                            animateActive
                            icon={
                              <BookmarkIcon
                                filled={isFavourited}
                                className={isFavourited ? "text-amber-400" : "text-[var(--ink)]"}
                              />
                            }
                            onClick={handleFavourite}
                          />
                          );
                        })()}
                          <ActionButton
                            color="orange"
                            label="Buy now"
                            icon={<ShoppingCartIcon />}
                            onClick={handleBuyNow}
                          />
                          <ActionButton
                            color="gray"
                            label="Dislike"
                            icon={<ThumbsDownIcon />}
                            onClick={handleDislike}
                          />
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ) : state.kind === "success" && products.length === 0 ? (
                  <Card className="h-full bg-white/60 border border-black/10 rounded-3xl p-6 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-sm text-[var(--ink)]">No results found.</div>
                      {warnings.length > 0 && (
                        <pre className="mt-3 text-[10px] whitespace-pre-wrap opacity-70 max-w-full overflow-auto">
                          {warnings.join("\n")}
                        </pre>
                      )}
                    </div>
                  </Card>
                ) : state.kind === "loading" ? (
                  <Card className="h-full bg-white/60 border border-black/10 rounded-3xl p-6 flex items-center justify-center">
                    <div className="text-sm text-[var(--ink)] opacity-70">Loading...</div>
                  </Card>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Right Arrow */}
            <ArrowButton
              direction="right"
              onClick={goToNext}
              disabled={currentIndex >= products.length - 1 || products.length === 0}
            />
          </div>

          {state.kind === "success" && showDebug && warnings.length ? (
            <Card className="mt-6 bg-white/40 border border-black/10 rounded-2xl p-4">
              <div className="text-xs text-[var(--ink)] opacity-70 mb-2">Warnings</div>
              <pre className="text-[10px] whitespace-pre-wrap text-[var(--ink)] opacity-70">
                {warnings.join("\n")}
              </pre>
            </Card>
          ) : null}
        </section>
      </Container>
    </main>
  );
}

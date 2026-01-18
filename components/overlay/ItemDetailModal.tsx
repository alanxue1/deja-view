"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { NormalizedProduct } from "@/lib/match/types";

// Database item type matching what comes from MongoDB items collection
export interface DatabaseItem {
  _id: string;
  source?: {
    type?: string;
    url?: string;
  };
  analysis?: {
    main_item?: string;
    description?: string;
    style?: string;
    materials?: string[];
    colors?: string[];
    confidence?: number;
    label?: string;
    type?: string;
  };
  asset?: {
    glbUrl?: string;
    imageUrl?: string;
  };
}

interface ItemDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DatabaseItem | null;
}

type UiState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; products: NormalizedProduct[]; searchQuery: string };

// Icon components
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} className={className}>
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

function ChevronIcon({ direction, className }: { direction: "left" | "right"; className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={`${className} ${direction === "left" ? "rotate-180" : ""}`}
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
      className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center
                 transition-all duration-200 hover:bg-white/20 hover:border-white/30
                 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10"
      aria-label={direction === "left" ? "Previous item" : "Next item"}
    >
      <ChevronIcon direction={direction} className="text-white/90 w-4 h-4" />
    </button>
  );
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  isOpen,
  onClose,
  item,
}) => {
  const [state, setState] = useState<UiState>({ kind: "idle" });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [favouritedIds, setFavouritedIds] = useState<Set<string>>(() => new Set());

  const formatPrice = useCallback((p: NormalizedProduct) => {
    const min = p.priceRange?.min;
    const max = p.priceRange?.max;
    if (!min && !max) return "Price unavailable";
    const c = (p.currency || "").toUpperCase();
    const symbol =
      c === "CAD"
        ? "CA$"
        : c === "USD"
          ? "$"
          : c === "GBP"
            ? "£"
            : c === "EUR"
              ? "€"
              : c
                ? `${c} `
                : "$";
    if (min && max && min === max) return `${symbol}${min}`;
    if (min && max) return `${symbol}${min}–${max}`;
    return `${symbol}${min ?? max ?? "?"}`;
  }, []);

  // Fetch matches when item changes
  useEffect(() => {
    if (!isOpen || !item?._id) {
      setState({ kind: "idle" });
      return;
    }

    const fetchMatches = async () => {
      setState({ kind: "loading" });
      setCurrentIndex(0);

      try {
        // Always fetch description/main item from MongoDB (items collection) via /api/match-cache.
        // This avoids stale/placeholder client-side descriptions and uses the source-of-truth fields.
        const params = new URLSearchParams({ itemId: item._id });
        
        const res = await fetch(`/api/match-cache?${params.toString()}`);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch matches (${res.status})`);
        }

        const data = await res.json();
        setState({
          kind: "success",
          products: data.products || [],
          searchQuery: data.searchQuery || "",
        });
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        });
      }
    };

    fetchMatches();
  }, [isOpen, item?._id]);

  const products = state.kind === "success" ? state.products : [];
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

  // Animation variants - floating card
  const cardVariants = {
    hidden: { opacity: 0, x: 40, scale: 0.95 },
    visible: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, x: 40, scale: 0.95 },
  };

  const productVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -100 : 100,
      opacity: 0,
    }),
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle arrow keys for navigation
  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (!isOpen || state.kind !== "success") return;
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
    };
    window.addEventListener("keydown", handleArrowKeys);
    return () => window.removeEventListener("keydown", handleArrowKeys);
  }, [isOpen, state.kind, currentIndex, products.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="fixed right-4 top-[calc(50%-140px)] -translate-y-1/2 z-50 w-[340px]
                     bg-zinc-800/80 backdrop-blur-xl rounded-2xl
                     border border-white/15 shadow-2xl shadow-black/40"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-zinc-800 border border-white/20 
                     flex items-center justify-center hover:bg-zinc-700 transition-colors z-10"
          >
            <CloseIcon className="text-white/80 w-4 h-4" />
          </button>

          {/* Content */}
          <div className="relative h-[420px] overflow-hidden rounded-2xl">
            <AnimatePresence mode="wait" custom={direction}>
              {state.kind === "loading" ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                  <p className="mt-3 text-xs text-white/60">Finding similar...</p>
                </motion.div>
              ) : state.kind === "error" ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-4"
                >
                  <p className="text-red-400/80 text-xs text-center">{state.message}</p>
                  <button
                    onClick={() => {
                      if (item?._id) {
                        setState({ kind: "loading" });
                        // Always fetch description/main item from MongoDB (items collection)
                        const params = new URLSearchParams({ itemId: item._id });
                        fetch(`/api/match-cache?${params.toString()}`)
                          .then((res) => res.json())
                          .then((data) =>
                            setState({
                              kind: "success",
                              products: data.products || [],
                              searchQuery: data.searchQuery || "",
                            })
                          )
                          .catch((e) =>
                            setState({ kind: "error", message: e.message })
                          );
                      }
                    }}
                    className="mt-3 px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs hover:bg-white/20"
                  >
                    Retry
                  </button>
                </motion.div>
              ) : products.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                >
                  <p className="text-white/50 text-xs">No similar products found</p>
                </motion.div>
              ) : currentProduct ? (
                <motion.div
                  key={currentProduct.id}
                  custom={direction}
                  variants={productVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: "spring", stiffness: 400, damping: 35 },
                    opacity: { duration: 0.15 },
                  }}
                  className="absolute inset-0 flex flex-col"
                >
                  {/* Product Image */}
                  <div className="h-[220px] bg-gradient-to-b from-white/5 to-transparent flex items-center justify-center p-3">
                    {currentProduct.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentProduct.images[0]}
                        alt={currentProduct.title}
                        className="max-w-full max-h-full object-contain rounded-xl"
                      />
                    ) : (
                      <div className="text-sm text-white/40">No image</div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 p-4 flex flex-col">
                    <h3 className="text-sm font-medium text-white/95 leading-snug line-clamp-2">
                      {currentProduct.title}
                    </h3>

                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-base text-white/90 font-semibold">
                        {formatPrice(currentProduct)}
                      </span>
                      {currentProduct.vendor && (
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">
                          {currentProduct.vendor}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mt-auto pt-3">
                      {/* Nav */}
                      <div className="flex items-center gap-1.5">
                        <ArrowButton direction="left" onClick={goToPrevious} disabled={currentIndex === 0} />
                        <span className="text-[10px] text-white/40 min-w-[40px] text-center">
                          {currentIndex + 1}/{products.length}
                        </span>
                        <ArrowButton direction="right" onClick={goToNext} disabled={currentIndex >= products.length - 1} />
                      </div>

                      {/* Buy/Save */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleFavourite}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                            favouritedIds.has(currentProduct.id)
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                              : "bg-white/5 border-white/20 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          <BookmarkIcon filled={favouritedIds.has(currentProduct.id)} className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleBuyNow}
                          className="h-8 px-4 rounded-full bg-amber-500 hover:bg-amber-400 text-white text-xs font-medium transition-colors"
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Shopify Attribution */}
          <div className="flex items-center justify-center gap-1.5 py-2 border-t border-white/10">
            <span className="text-[10px] text-white/30">Powered by</span>
            <Image
              src="/img/shopify_logo.webp"
              alt="Shopify"
              width={70}
              height={20}
              className="opacity-50"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ItemDetailModal;

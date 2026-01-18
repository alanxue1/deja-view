"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
      className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center
                 transition-all duration-200 hover:bg-white/20 hover:border-white/30
                 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/10"
      aria-label={direction === "left" ? "Previous item" : "Next item"}
    >
      <ChevronIcon direction={direction} className="text-white/90" />
    </button>
  );
}

function ActionButton({
  variant,
  label,
  icon,
  active = false,
  onClick,
}: {
  variant: "primary" | "secondary" | "ghost";
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  const baseClasses = "flex flex-col items-center gap-1.5 group transition-all duration-200";
  const buttonClasses = {
    primary: "w-12 h-12 rounded-full bg-amber-500/90 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20",
    secondary: "w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20",
    ghost: "w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white/70 hover:bg-white/10 hover:text-white",
  };

  return (
    <button onClick={onClick} className={baseClasses}>
      <motion.div
        whileTap={{ scale: 0.92 }}
        animate={active ? { scale: [1, 1.1, 1] } : { scale: 1 }}
        transition={{ duration: 0.15 }}
        className={`${buttonClasses[variant]} flex items-center justify-center`}
      >
        {icon}
      </motion.div>
      <span className="text-[10px] text-white/60 group-hover:text-white/80 transition-colors uppercase tracking-wider">
        {label}
      </span>
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
    if (min && max && min === max) return `CA$${min}`;
    if (min && max) return `CA$${min}–${max}`;
    return `CA$${min ?? max ?? "?"}`;
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
        const res = await fetch(`/api/match-cache?itemId=${item._id}`);
        
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

  // Animation variants
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  const cardVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 200 : -200,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -200 : 200,
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

  const itemName = item?.analysis?.main_item || item?.analysis?.label || "Item";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-xl font-serif text-white/95 tracking-wide">
                  Shop Similar
                </h2>
                <p className="text-sm text-white/50 mt-0.5">
                  {itemName}
                  {state.kind === "success" && state.searchQuery && (
                    <span className="text-white/30"> · &quot;{state.searchQuery}&quot;</span>
                  )}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 
                         flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <CloseIcon className="text-white/80" />
              </button>
            </div>

            {/* Content */}
            <div className="flex items-center gap-3">
              {/* Left Arrow */}
              <ArrowButton
                direction="left"
                onClick={goToPrevious}
                disabled={currentIndex === 0 || products.length === 0}
              />

              {/* Card Container */}
              <div className="relative flex-1 h-[420px] sm:h-[480px]">
                <AnimatePresence mode="wait" custom={direction}>
                  {state.kind === "loading" ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center 
                               bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl"
                    >
                      <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                      <p className="mt-4 text-sm text-white/60">Finding similar products...</p>
                    </motion.div>
                  ) : state.kind === "error" ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center 
                               bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6"
                    >
                      <p className="text-red-400/80 text-sm text-center">{state.message}</p>
                      <button
                        onClick={() => {
                          if (item?._id) {
                            setState({ kind: "loading" });
                            fetch(`/api/match-cache?itemId=${item._id}`)
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
                        className="mt-4 px-4 py-2 rounded-full bg-white/10 text-white/70 text-sm hover:bg-white/20"
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
                      className="absolute inset-0 flex flex-col items-center justify-center 
                               bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl"
                    >
                      <p className="text-white/50 text-sm">No similar products found</p>
                    </motion.div>
                  ) : currentProduct ? (
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
                      className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 
                               rounded-3xl overflow-hidden flex flex-col"
                    >
                      {/* Product Image */}
                      <div className="flex-1 min-h-0 bg-white/5 flex items-center justify-center p-4 overflow-hidden">
                        {currentProduct.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={currentProduct.images[0]}
                            alt={currentProduct.title}
                            className="max-w-full max-h-full object-contain rounded-2xl"
                          />
                        ) : (
                          <div className="text-sm text-white/40">No image available</div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-5 flex flex-col gap-3 bg-gradient-to-t from-black/30 to-transparent">
                        {/* Title */}
                        <h3 className="text-base font-serif text-white/95 leading-snug line-clamp-2">
                          {currentProduct.title}
                        </h3>

                        {/* Price & Vendor */}
                        <div className="flex items-baseline justify-between">
                          <span className="text-lg text-white/90 font-medium">
                            {formatPrice(currentProduct)}
                          </span>
                          {currentProduct.vendor && (
                            <span className="text-xs text-white/40 uppercase tracking-wider">
                              {currentProduct.vendor}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-center gap-6 pt-2">
                          {(() => {
                            const isFavourited = !!currentProduct && favouritedIds.has(currentProduct.id);
                            return (
                              <ActionButton
                                variant="secondary"
                                label="Save"
                                active={isFavourited}
                                icon={
                                  <BookmarkIcon
                                    filled={isFavourited}
                                    className={isFavourited ? "text-amber-400" : "text-white/80"}
                                  />
                                }
                                onClick={handleFavourite}
                              />
                            );
                          })()}
                          <ActionButton
                            variant="primary"
                            label="Buy"
                            icon={<ShoppingCartIcon className="text-white" />}
                            onClick={handleBuyNow}
                          />
                        </div>
                      </div>
                    </motion.div>
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

            {/* Pagination */}
            {products.length > 0 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {products.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setDirection(idx > currentIndex ? 1 : -1);
                      setCurrentIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      idx === currentIndex
                        ? "bg-white/80 w-6"
                        : "bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ItemDetailModal;

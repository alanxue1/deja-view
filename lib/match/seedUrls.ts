/**
 * Spike-mode seed URLs (hardcoded).
 *
 * Notes:
 * - Replace these with your own preferred Shopify product URLs as needed.
 * - We only support URLs shaped like `https://{domain}/products/{handle}` (query params ok).
 * - Some stores may block bots or require a password; those will fail and be skipped.
 */
export const SEED_SHOPIFY_PRODUCT_URLS: string[] = [
  // Shopify-style product URLs (must be `/products/{handle}`).
  // Replace these with your target furniture stores once you have them.
  "https://www.burrow.com/products/serif-tv-stand",
  "https://www.burrow.com/products/nomad-fabric-sofa",
  "https://www.hem.com/products/alphabeta-shelf",
  "https://kith.com/products/khkhm030001-214",
  "https://www.allbirds.com/products/mens-wool-runners",

  // Extra seed URLs so we can reliably return 5–6 results even if some stores block/404.
  // (These are mostly to exercise the pipeline; swap for furniture-centric sources anytime.)
  "https://www.allbirds.com/products/womens-wool-runners",
  "https://www.allbirds.com/products/mens-tree-runners",
  "https://www.allbirds.com/products/womens-tree-runners",
  "https://www.allbirds.com/products/mens-wool-runner-up-mizzles",
  "https://www.allbirds.com/products/womens-wool-runner-up-mizzles",
];


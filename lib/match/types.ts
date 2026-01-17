export type MatchRequest = {
  query: string;
};

export type NormalizedProduct = {
  /** Unique key suitable for React list keys (best-effort). */
  id: string;
  title: string;
  vendor?: string;
  currency?: string;
  /** Lowest/highest price in currency units as strings to avoid float issues. */
  priceRange?: { min?: string; max?: string };
  available?: boolean;
  images: string[];
  productUrl: string;
  storeDomain: string;
  /** Small summary for a swipe gallery; keep it stable. */
  variantsSummary?: Array<{
    id?: string;
    title?: string;
    available?: boolean;
    price?: string;
    sku?: string;
  }>;
  fetchedAt: string;
  sourceQuery: string;
  sourceRank: number;
  score: number;
};

export type MatchResponse = {
  query: string;
  totalCandidates: number;
  returned: number;
  products: NormalizedProduct[];
  warnings?: string[];
};


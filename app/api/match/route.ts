import { NextResponse } from "next/server";

import { googleCseSearch } from "@/lib/match/googleCse";
import { rankAndTrim } from "@/lib/match/rank";
import { SEED_SHOPIFY_PRODUCT_URLS } from "@/lib/match/seedUrls";
import { normalizeShopifyProduct } from "@/lib/match/shopifyNormalize";
import type { MatchRequest, MatchResponse } from "@/lib/match/types";

export const runtime = "nodejs";

const RETURN_LIMIT = 3;
const NORMALIZE_CONCURRENCY = 3;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_ENTRIES = 100;

type CacheEntry<T> = { value: T; expiresAt: number };
const memoryCache = globalThis as typeof globalThis & {
  __dejaViewMatchCache?: Map<string, CacheEntry<unknown>>;
};

function getCache(): Map<string, CacheEntry<unknown>> {
  if (!memoryCache.__dejaViewMatchCache) memoryCache.__dejaViewMatchCache = new Map();
  return memoryCache.__dejaViewMatchCache;
}

function cacheGet<T>(key: string): T | null {
  const c = getCache();
  const hit = c.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    c.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet<T>(key: string, value: T) {
  const c = getCache();
  // simple cap: drop oldest insertion order when over capacity
  while (c.size >= CACHE_MAX_ENTRIES) {
    const first = c.keys().next().value as string | undefined;
    if (!first) break;
    c.delete(first);
  }
  c.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

const SHOP_OBJECT_TOKENS = [
  "chair",
  "armchair",
  "stool",
  "sofa",
  "couch",
  "table",
  "lamp",
  "sconce",
  "desk",
  "bed",
  "dresser",
  "nightstand",
  "bench",
  "rug",
  "mirror",
];

const INTENT_GROUPS: Record<string, string[]> = {
  // If query intent is lighting, table-related words in "table lamp" should NOT dominate.
  lamp: ["lamp", "lighting", "sconce", "pendant", "chandelier"],
  sconce: ["sconce", "lamp", "lighting"],

  chair: ["chair", "armchair", "stool", "bench"],
  armchair: ["chair", "armchair"],
  stool: ["stool", "chair"],
  bench: ["bench", "chair"],

  sofa: ["sofa", "couch", "sectional"],
  couch: ["sofa", "couch", "sectional"],

  bed: ["bed", "headboard", "frame"],
  dresser: ["dresser", "drawer", "chest"],
  nightstand: ["nightstand", "bedside", "night stand"],

  table: ["table", "desk", "end table", "side table", "coffee table", "console"],
  desk: ["desk", "table"],
  rug: ["rug", "carpet"],
  mirror: ["mirror"],
};

function extractIntent(query: string): { primary: string | null; tokens: string[] } {
  const q = query.toLowerCase();
  let best: { token: string; idx: number } | null = null;
  for (const t of SHOP_OBJECT_TOKENS) {
    const idx = q.lastIndexOf(t);
    if (idx === -1) continue;
    if (!best || idx > best.idx) best = { token: t, idx };
  }

  if (!best) return { primary: null, tokens: [] };
  return { primary: best.token, tokens: INTENT_GROUPS[best.token] ?? [best.token] };
}

function urlLooksLikeIntent(url: string, intentTokens: string[]): boolean {
  if (intentTokens.length === 0) return true;
  const u = url.toLowerCase();
  // If the URL slug contains an intent token, prefer it.
  return intentTokens.some((t) => u.includes(`/${t}`) || u.includes(`-${t}`) || u.includes(`${t}-`));
}

function titleMatchesRequiredTokens(title: string, required: string[]): boolean {
  if (required.length === 0) return true;
  const t = title.toLowerCase();
  return required.some((r) => t.includes(r));
}

function isRelevantToIntent(args: { title: string; intentPrimary: string | null; intentTokens: string[] }): boolean {
  const t = args.title.toLowerCase();
  if (!args.intentPrimary || args.intentTokens.length === 0) return true;

  // Default: require one of the intent tokens to appear in the title.
  const hasAny = args.intentTokens.some((tok) => t.includes(tok));

  // Special-case lighting: allow "light" results but avoid "light sable/linen" etc.
  if (args.intentPrimary === "lamp" || args.intentPrimary === "sconce") {
    if (hasAny) return true;

    const hasLightWord = /\blight\b/.test(t);
    if (!hasLightWord) return false;

    // Exclude obvious non-lighting furniture hits.
    const bad = ["chair", "sofa", "couch", "table set", "dining", "linen", "upholstered", "bed", "dresser", "desk"];
    if (bad.some((b) => t.includes(b))) return false;
    return true;
  }

  return hasAny;
}

function normalizeForDedupe(s: string): string {
  return s
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeImageForDedupe(url: string | undefined): string {
  if (!url) return "";
  const u = url.startsWith("//") ? `https:${url}` : url;
  try {
    const x = new URL(u);
    // strip querystring; use just path for stable-ish equality across mirrors
    return x.pathname.toLowerCase();
  } catch {
    return u.toLowerCase().split("?")[0] ?? "";
  }
}

function dedupeKey(p: { title: string; vendor?: string; images?: string[] }): string {
  const t = normalizeForDedupe(p.title);
  const v = normalizeForDedupe(p.vendor ?? "");
  const img = normalizeImageForDedupe(p.images?.[0]);
  // Prefer image-based equality; title/vendor backs it up.
  return `${t}|${v}|${img}`;
}

function buildCseQuery(args: { userQuery: string; includeMyshopify: boolean; intentPrimary: string | null }): string {
  const parts = [
    args.userQuery,
    "furniture",
    "inurl:/products/",
    "-video",
    "-tutorial",
    "-how",
    "-diy",
    "-youtube",
    "-tiktok",
    "-reel",
    "-pinterest",
  ];

  // Intent-specific nudges.
  if (args.intentPrimary === "lamp") {
    parts.push('"table lamp"', "lamp", "-bollard");
  } else if (args.intentPrimary === "chair") {
    parts.push("chair", "-stroller");
  }

  if (!args.includeMyshopify) parts.push("-site:myshopify.com");
  return parts.join(" ");
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      results[idx] = await mapper(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

async function googleCseCached(args: { query: string; apiKey: string; cseId: string; num: number; start: number }) {
  const cacheKey = `cse:${args.cseId}:${args.num}:${args.start}:${args.query}`;
  const cached = cacheGet<ReturnType<typeof googleCseSearch>>(cacheKey);
  if (cached) return cached as any;
  const res = await googleCseSearch(args);
  cacheSet(cacheKey, res);
  return res;
}

async function handleMatch(query: string) {
  const q = query.trim();
  if (!q) {
    return NextResponse.json({ error: "`query` is required" }, { status: 400 });
  }

  // Cache full match response (saves both CSE quota and normalization work).
  const fullCacheKey = `match:v1:${q.toLowerCase()}`;
  const cachedResp = cacheGet<MatchResponse>(fullCacheKey);
  if (cachedResp) {
    return NextResponse.json({
      ...cachedResp,
      warnings: [...(cachedResp.warnings ?? []), "cache: hit (in-memory)"].slice(0, 20),
    });
  }

  const warnings: string[] = [];
  const intent = extractIntent(q);

  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  let candidateUrls: string[] = [];
  if (apiKey && cseId) {
    try {
      // Two-pass discovery:
      // - A: exclude myshopify.com for quality
      // - B: include myshopify.com for recall
      const queryA = buildCseQuery({ userQuery: q, includeMyshopify: false, intentPrimary: intent.primary });
      const queryB = buildCseQuery({ userQuery: q, includeMyshopify: true, intentPrimary: intent.primary });

      // Quota-friendly: pull the minimum pages needed to get a decent candidate set.
      // Worst-case 3 requests per user query, but often 1–2.
      const a1 = await googleCseCached({ query: queryA, apiKey, cseId, num: 10, start: 1 });
      let aLinks = a1.map((r: any) => r.link) as string[];

      if (aLinks.length < 12) {
        const a2 = await googleCseCached({ query: queryA, apiKey, cseId, num: 10, start: 11 });
        aLinks = [...aLinks, ...a2.map((r: any) => r.link)];
      }

      let bLinks: string[] = [];
      if (aLinks.length < 12) {
        const b1 = await googleCseCached({ query: queryB, apiKey, cseId, num: 10, start: 1 });
        bLinks = b1.map((r: any) => r.link) as string[];
      }

      const seen = new Set<string>();
      candidateUrls = [...aLinks, ...bLinks]
        .filter((u) => {
          try {
            const x = new URL(u);
            return x.pathname.includes("/products/");
          } catch {
            return false;
          }
        })
        .filter((u) => {
          const key = u.split("#")[0];
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      // Prefer intent-looking URLs and custom domains, but keep full set.
      candidateUrls.sort((aUrl, bUrl) => {
        const aIntent = Number(urlLooksLikeIntent(aUrl, intent.tokens));
        const bIntent = Number(urlLooksLikeIntent(bUrl, intent.tokens));
        if (aIntent !== bIntent) return bIntent - aIntent;

        try {
          const ha = new URL(aUrl).hostname;
          const hb = new URL(bUrl).hostname;
          const aCustom = Number(!ha.endsWith("myshopify.com"));
          const bCustom = Number(!hb.endsWith("myshopify.com"));
          if (aCustom !== bCustom) return bCustom - aCustom;
        } catch {
          // ignore
        }
        return 0;
      });

      if (candidateUrls.length === 0) {
        warnings.push("google cse returned 0 usable /products/ urls; falling back to seed list");
      }
    } catch (e) {
      warnings.push(`google cse error; falling back to seed list: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  } else {
    warnings.push("GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID not set; using hardcoded seed URLs");
  }

  if (candidateUrls.length === 0) {
    candidateUrls = SEED_SHOPIFY_PRODUCT_URLS;
  }

  const normalized = await mapLimit(candidateUrls, NORMALIZE_CONCURRENCY, async (productUrl, idx) => {
    try {
      return await normalizeShopifyProduct({
        productUrl,
        sourceQuery: q,
        sourceRank: idx,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown error";
      if (
        msg.includes("password-protected") ||
        msg.includes("product.js fetch failed") ||
        msg.includes("product.js returned") ||
        msg.includes("not a shopify storefront")
      ) {
        warnings.push(`failed to normalize ${productUrl}: ${msg}`);
      }
      return null;
    }
  });

  const products = normalized.filter((p): p is NonNullable<typeof p> => Boolean(p));
  const relevant = products.filter((p) =>
    isRelevantToIntent({ title: p.title, intentPrimary: intent.primary, intentTokens: intent.tokens })
  );
  const ranked = rankAndTrim({
    query: q,
    products: intent.tokens.length ? relevant : relevant.length ? relevant : products,
    limit: RETURN_LIMIT * 5,
  });

  // De-dupe near-identical products coming from multiple domains (common for resellers / mirrors).
  const seenProducts = new Set<string>();
  const uniqueRanked: typeof ranked = [];
  for (const p of ranked) {
    const k = dedupeKey(p);
    if (seenProducts.has(k)) continue;
    seenProducts.add(k);
    uniqueRanked.push(p);
    if (uniqueRanked.length >= RETURN_LIMIT * 3) break;
  }

  // Lightweight diversity: avoid returning 5 from the same store.
  const perStoreCap = 2;
  const perStoreCounts = new Map<string, number>();
  const diversified: typeof ranked = [];
  for (const p of uniqueRanked) {
    const c = perStoreCounts.get(p.storeDomain) ?? 0;
    if (c >= perStoreCap) continue;
    perStoreCounts.set(p.storeDomain, c + 1);
    diversified.push(p);
    if (diversified.length >= RETURN_LIMIT) break;
  }

  const resp: MatchResponse = {
    query: q,
    totalCandidates: candidateUrls.length,
    returned: diversified.length,
    products: diversified,
    warnings: warnings.length ? warnings.slice(0, 20) : undefined,
  };

  cacheSet(fullCacheKey, resp);
  return NextResponse.json(resp);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";
  return handleMatch(query);
}

export async function POST(req: Request) {
  let body: MatchRequest | undefined;
  try {
    body = (await req.json()) as MatchRequest;
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  const query = typeof body?.query === "string" ? body.query : "";
  if (!query) {
    return NextResponse.json({ error: "`query` is required" }, { status: 400 });
  }
  return handleMatch(query);
}


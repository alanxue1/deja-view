import type { NormalizedProduct } from "./types";

function getProductHandleFromUrl(url: string): { origin: string; storeDomain: string; handle: string; canonicalUrl: string } {
  const u = new URL(url);
  const m = u.pathname.match(/\/products\/([^\/?#]+)/);
  if (!m?.[1]) {
    throw new Error(`unsupported product url (expected /products/{handle}): ${url}`);
  }
  const handle = decodeURIComponent(m[1]);
  const canonicalUrl = `${u.origin}/products/${encodeURIComponent(handle)}`;
  return { origin: u.origin, storeDomain: u.hostname, handle, canonicalUrl };
}

function formatCentsToCurrencyString(cents: number | undefined): string | undefined {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return undefined;
  return (cents / 100).toFixed(2);
}

function normalizeImageUrl(u: string): string {
  // Shopify Ajax product endpoint often returns protocol-relative URLs: //cdn.shopify.com/...
  if (u.startsWith("//")) return `https:${u}`;
  return u;
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 20000, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function tryFetchShopifyProductJs(args: { origin: string; handle: string }) {
  // Shopify theme Ajax API: /products/{handle}.js (returns JSON despite `.js`).
  const url = `${args.origin}/products/${encodeURIComponent(args.handle)}.js`;
  const res = await fetchWithTimeout(url, {
    headers: {
      accept: "application/json,text/javascript,*/*;q=0.1",
      // Use a normal browser-ish UA to avoid overly aggressive bot heuristics.
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    // keep cookies out
    credentials: "omit",
    redirect: "follow",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`product.js fetch failed (${res.status})`);
  }

  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("json") && !ct.includes("javascript") && !ct.includes("text/plain")) {
    const text = await res.text().catch(() => "");
    const lower = text.toLowerCase();
    if (lower.includes("enter using password") || lower.includes("password page")) {
      throw new Error("shopify storefront is password-protected");
    }
    throw new Error(`product.js returned unexpected content-type (${ct || "unknown"})`);
  }

  // Some stores serve this endpoint as text/javascript; JSON.parse still works.
  const text = await res.text();
  try {
    return JSON.parse(text) as any;
  } catch {
    throw new Error("product.js returned non-json body");
  }
}

function extractJsonLdProductsFromHtml(html: string): any[] {
  const out: any[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return out;
}

function findJsonLdProduct(doc: any): any | undefined {
  if (!doc) return undefined;
  if (doc["@type"] === "Product") return doc;
  if (doc["@graph"] && Array.isArray(doc["@graph"])) {
    return doc["@graph"].find((n: any) => n?.["@type"] === "Product");
  }
  return undefined;
}

async function tryFetchProductJsonLd(args: { canonicalUrl: string }) {
  const res = await fetchWithTimeout(args.canonicalUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    credentials: "omit",
    redirect: "follow",
    cache: "no-store",
    timeoutMs: 12000,
  });
  if (!res.ok) {
    throw new Error(`html fetch failed (${res.status})`);
  }
  const html = await res.text();

  // Fail fast if this doesn't look like a Shopify storefront page.
  // (Avoid normalizing random sites that happen to use `/products/` in their URL scheme.)
  const shopifySignals =
    html.includes("cdn.shopify.com") ||
    html.includes("x-shopify") ||
    html.toLowerCase().includes('meta name="generator" content="shopify"') ||
    html.toLowerCase().includes("shopify");
  if (!shopifySignals) {
    throw new Error("not a shopify storefront (no shopify signals in html)");
  }

  if (html.toLowerCase().includes("enter using password") || html.toLowerCase().includes("password page")) {
    throw new Error("shopify storefront is password-protected");
  }

  const blocks = extractJsonLdProductsFromHtml(html);
  for (const b of blocks) {
    const p = findJsonLdProduct(b);
    if (p) return p;
  }
  throw new Error("no Product JSON-LD found");
}

function guessCurrencyFromStoreDomain(storeDomain: string): string | undefined {
  const d = storeDomain.toLowerCase();
  if (d.endsWith(".ca")) return "CAD";
  if (d.endsWith(".co.uk") || d.endsWith(".uk")) return "GBP";
  if (d.endsWith(".eu")) return "EUR";
  // default unknown
  return undefined;
}

export async function normalizeShopifyProduct(args: {
  sourceQuery: string;
  sourceRank: number;
  productUrl: string;
}): Promise<NormalizedProduct> {
  const { origin, storeDomain, handle, canonicalUrl } = getProductHandleFromUrl(args.productUrl);
  const fetchedAt = new Date().toISOString();

  // Path 1: Shopify /products/{handle}.js
  try {
    const raw = await tryFetchShopifyProductJs({ origin, handle });
    const variants: any[] = Array.isArray(raw?.variants) ? raw.variants : [];
    const prices = variants.map((v) => (typeof v?.price === "number" ? v.price : undefined)).filter((x) => typeof x === "number") as number[];
    const minCents = prices.length ? Math.min(...prices) : undefined;
    const maxCents = prices.length ? Math.max(...prices) : undefined;

    const images: string[] = Array.isArray(raw?.images)
      ? raw.images.filter((x: any) => typeof x === "string").map(normalizeImageUrl)
      : [];

    // Try to determine currency via JSON-LD (more reliable than theme Ajax).
    let currency: string | undefined = undefined;
    try {
      const jsonld = await tryFetchProductJsonLd({ canonicalUrl });
      const offers = jsonld?.offers;
      const offersArr = Array.isArray(offers) ? offers : offers ? [offers] : [];
      currency = typeof offersArr?.[0]?.priceCurrency === "string" ? offersArr[0].priceCurrency : undefined;
    } catch {
      currency = undefined;
    }
    currency = currency || guessCurrencyFromStoreDomain(storeDomain);

    return {
      id: String(raw?.id ?? `${storeDomain}:${handle}`),
      title: String(raw?.title ?? handle),
      vendor: typeof raw?.vendor === "string" ? raw.vendor : undefined,
      currency,
      priceRange: {
        min: formatCentsToCurrencyString(minCents),
        max: formatCentsToCurrencyString(maxCents),
      },
      available: typeof raw?.available === "boolean" ? raw.available : undefined,
      images,
      productUrl: canonicalUrl,
      storeDomain,
      variantsSummary: variants.slice(0, 8).map((v) => ({
        id: v?.id != null ? String(v.id) : undefined,
        title: typeof v?.public_title === "string" ? v.public_title : typeof v?.title === "string" ? v.title : undefined,
        available: typeof v?.available === "boolean" ? v.available : undefined,
        price: formatCentsToCurrencyString(typeof v?.price === "number" ? v.price : undefined),
        sku: typeof v?.sku === "string" ? v.sku : undefined,
      })),
      fetchedAt,
      sourceQuery: args.sourceQuery,
      sourceRank: args.sourceRank,
      score: 0,
    };
  } catch {
    // fall through
  }

  // Path 2: HTML + JSON-LD Product
  const jsonld = await tryFetchProductJsonLd({ canonicalUrl });
  const offers = jsonld?.offers;
  const offersArr = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const prices = offersArr
    .map((o: any) => (o?.price != null ? String(o.price) : undefined))
    .filter((x: any) => typeof x === "string") as string[];

  const min = prices.length ? prices.reduce((a, b) => (Number(a) <= Number(b) ? a : b)) : undefined;
  const max = prices.length ? prices.reduce((a, b) => (Number(a) >= Number(b) ? a : b)) : undefined;

  const availability = offersArr.map((o: any) => (typeof o?.availability === "string" ? o.availability : "")).join(" ");
  const available =
    availability.includes("InStock") || availability.includes("https://schema.org/InStock") || availability.includes("http://schema.org/InStock")
      ? true
      : availability
          ? false
          : undefined;

  const imagesRaw = jsonld?.image;
  const images = Array.isArray(imagesRaw) ? imagesRaw : imagesRaw ? [imagesRaw] : [];

  const vendor =
    typeof jsonld?.brand?.name === "string"
      ? jsonld.brand.name
      : typeof jsonld?.brand === "string"
        ? jsonld.brand
        : undefined;

  return {
    id: `${storeDomain}:${handle}`,
    title: typeof jsonld?.name === "string" ? jsonld.name : handle,
    vendor,
    currency: typeof offersArr?.[0]?.priceCurrency === "string" ? offersArr[0].priceCurrency : undefined,
    priceRange: { min, max },
    available,
    images: images.filter((x: any) => typeof x === "string").map(normalizeImageUrl),
    productUrl: canonicalUrl,
    storeDomain,
    variantsSummary: undefined,
    fetchedAt,
    sourceQuery: args.sourceQuery,
    sourceRank: args.sourceRank,
    score: 0,
  };
}


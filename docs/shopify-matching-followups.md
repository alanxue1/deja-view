# Shopify matching spike — follow-ups

This repo currently implements a **no-DB spike** endpoint that takes a query (e.g. `"orange chair"`) and returns a ranked set of normalized product candidates from a **hardcoded** list of Shopify-style product URLs.

## Future: MongoDB caching

When you want persistence/caching, add two collections:

- `products_cache`
  - **key**: `productUrl`
  - **value**: normalized product JSON (and optionally raw product payload)
  - **fields**: `fetchedAt`, `expiresAt` (TTL), `storeDomain`, `handle`
- `item_matches`
  - **key**: `itemFingerprint` (hash of normalized query + optional image hash)
  - **value**: list of `productUrl`s + scores + timestamps
  - **fields**: `createdAt`, `expiresAt` (TTL)

Suggested TTL: **7–30 days** (shorter if you care about price/availability freshness).

## Future: Google CSE discovery

Replace the hardcoded URL list with Google CSE to discover candidate product URLs.

Env vars:

- `GOOGLE_CSE_API_KEY`
- `GOOGLE_CSE_ID`

Template:

- Copy `env.example` to `.env.local` and fill values:
  - `cp env.example .env.local`

Query bias operators (MVP):

- `inurl:/products/`
- `("cdn.shopify.com" OR "myshopify.com")`

Implementation notes:

- **Never** call Google CSE from the client (key leak); do it in server routes.
- Add basic rate limiting + caching once volume increases.


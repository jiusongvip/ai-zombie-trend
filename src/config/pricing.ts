/**
 * Authoritative pricing catalog.
 *
 * The checkout API uses this as the SOURCE OF TRUTH for price/credits/duration.
 * Any price, credits, or plan info sent by the client is IGNORED — only the
 * product_id is honored, and everything else is looked up here.
 *
 * To change pricing, edit this file and redeploy. Admin UI cannot alter prices.
 *
 * Packs are sold by FILM COUNT and `credits` is derived as
 * `films * CREDITS_PER_FILM`, so the advertised film count and what the credits
 * actually buy can never drift apart. `films` counts the standard tier; the HD
 * count per pack is derived from the same credit total, so both numbers on the
 * pricing page come from one source.
 *
 * The two constants must equal the `creditCost` of the matching tier in
 * `config/video-models.ts` (`sd-2-vip-480` / `sd-2-vip-720`) — those are the
 * numbers the render pipeline really charges.
 *
 * Packs are one-time purchases (no subscription) and credits do not expire.
 */

import { PaymentInterval, PaymentType } from '@/core/payment/types';

/** Credits for one 480p film — the tier every pack is sized against. */
export const CREDITS_PER_FILM = 20;

/** Credits for one 720p film. */
export const CREDITS_PER_HD_FILM = 40;

export type PricingPlanInfo = {
  name: string;
  interval: PaymentInterval;
  intervalCount: number;
};

export type PricingProduct = {
  productId: string;
  productName: string;
  planName: string;
  description: string;
  type: PaymentType;
  priceInCents: number;
  /** Pre-promo list price. When set the card shows it struck through. */
  originalPriceInCents?: number;
  currency: string;
  films: number;
  credits: number;
  /** Films this pack funds at the 720p tier — whole films only. */
  hdFilms: number;
  creditsValidDays?: number;
  plan?: PricingPlanInfo;
};

function pack(
  films: number,
  productName: string,
  priceInCents: number,
  originalPriceInCents: number
): PricingProduct {
  const credits = films * CREDITS_PER_FILM;
  return {
    productId: `film_pack_${films}`,
    productName,
    planName: productName,
    description: `${credits} Credits`,
    type: PaymentType.ONE_TIME,
    priceInCents,
    originalPriceInCents,
    currency: 'usd',
    films,
    credits,
    hdFilms: Math.floor(credits / CREDITS_PER_HD_FILM),
  };
}

export const pricingCatalog: Record<string, PricingProduct> = {
  film_pack_1: pack(1, 'Single Pack', 599, 890),
  film_pack_3: pack(3, 'Trio Pack', 1499, 2190),
  film_pack_10: pack(10, 'Ten Pack', 3990, 5790),
  film_pack_60: pack(60, 'Annual Pack', 12600, 17999),
};

export function getPricingProduct(productId: string): PricingProduct | null {
  if (!productId) return null;
  return pricingCatalog[productId] ?? null;
}

export function listPricingProducts(): PricingProduct[] {
  return Object.values(pricingCatalog);
}

/** Display price with forced two decimals — `$126.00`, not `$126`. */
export function formatPrice(priceInCents: number) {
  return `$${(priceInCents / 100).toFixed(2)}`;
}

/**
 * Cheapest per-film price across the catalog, in cents — the "as low as"
 * figure the marketing copy quotes. Derived so it tracks the packs.
 */
export function lowestPricePerFilmInCents(): number {
  return Math.min(
    ...listPricingProducts().map((p) => Math.round(p.priceInCents / p.films))
  );
}

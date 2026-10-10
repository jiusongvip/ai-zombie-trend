import { createFileRoute } from '@tanstack/react-router';

import { getVideoModel } from '@/config/video-models';
import { zombieFilmTiers, zombieStyles } from '@/config/zombie-styles';
import { getConfiguredProviders } from '@/modules/video/service';
import { respData, respErr } from '@/lib/resp';

/**
 * Public style + quality menu for the homepage generator.
 *
 * Deliberately carries no prompts — the scene templates are the product's
 * secret sauce and are applied server-side at generate time. The client gets
 * the ids (labels come from its own i18n messages), the price of each
 * resolution tier, and whether the underlying provider is actually configured.
 */
async function GET() {
  try {
    const configured = await getConfiguredProviders();
    const models = zombieFilmTiers.map((tier) => getVideoModel(tier.modelId));
    // Every tier rides the same endpoint family, so the picker's ratio list is
    // taken from the default one.
    const model = models[0];

    return respData({
      styles: zombieStyles.map((style) => ({ id: style.id })),
      // The generator preselects the first tier, which is the server's default.
      tiers: zombieFilmTiers.map((tier, i) => ({
        resolution: tier.resolution,
        creditCost: models[i]?.creditCost ?? 0,
      })),
      // The generator renders its format picker from this, so the UI can only
      // ever offer ratios the model actually accepts.
      aspectRatios: model?.aspectRatios ?? [],
      providerReady: models.every(
        (m) => !!m && configured.includes(m.provider)
      ),
    });
  } catch (error: any) {
    return respErr(error?.message || 'Failed to load styles');
  }
}

export const Route = createFileRoute('/api/zombie/styles')({
  server: {
    handlers: { GET },
  },
});

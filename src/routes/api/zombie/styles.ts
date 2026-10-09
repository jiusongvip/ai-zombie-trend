import { createFileRoute } from '@tanstack/react-router';

import { getVideoModel } from '@/config/video-models';
import { zombieStyles } from '@/config/zombie-styles';
import { getConfiguredProviders } from '@/modules/video/service';
import { respData, respErr } from '@/lib/resp';

/**
 * Public style menu for the homepage generator.
 *
 * Deliberately carries no prompts — the scene templates are the product's
 * secret sauce and are applied server-side at generate time. The client gets
 * the ids (labels come from its own i18n messages), the per-film price, and
 * whether the underlying provider is actually configured.
 */
async function GET() {
  try {
    const configured = await getConfiguredProviders();
    const model = getVideoModel(zombieStyles[0].modelId);

    return respData({
      styles: zombieStyles.map((style) => ({
        id: style.id,
        creditCost: model?.creditCost ?? 0,
      })),
      // The generator renders its format picker from this, so the UI can only
      // ever offer ratios the model actually accepts.
      aspectRatios: model?.aspectRatios ?? [],
      providerReady: !!model && configured.includes(model.provider),
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

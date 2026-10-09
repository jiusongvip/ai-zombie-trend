import { createFileRoute } from '@tanstack/react-router';

import {
  cheapestCreditCost,
  listVideoModels,
  toPublicVideoModel,
} from '@/config/video-models';
import { getConfiguredProviders } from '@/modules/video/service';
import { respData, respErr } from '@/lib/resp';

/**
 * Model catalog for the Studio picker.
 *
 * Deliberately public: the landing page and pricing table need it to show
 * "from N credits", and it contains no secrets — only model names, option
 * ranges, and credit prices. `configuredProviders` is what actually gates
 * generation (an unconfigured provider's models are shown as unavailable).
 */
async function GET() {
  try {
    const configuredProviders = await getConfiguredProviders();
    return respData({
      models: listVideoModels().map(toPublicVideoModel),
      configuredProviders,
      minCreditCost: cheapestCreditCost(),
    });
  } catch (error: any) {
    return respErr(error.message || 'Failed to load models');
  }
}

export const Route = createFileRoute('/api/video/models')({
  server: {
    handlers: { GET },
  },
});

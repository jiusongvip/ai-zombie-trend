import { createFileRoute } from '@tanstack/react-router';

import { staticPageRouteOptions } from './-static-page';

export const Route = createFileRoute('/(pages)/ai-zombie-trend-prompts')(
  staticPageRouteOptions('ai-zombie-trend-prompts', { article: true })
);

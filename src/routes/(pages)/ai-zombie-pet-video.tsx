import { createFileRoute } from '@tanstack/react-router';

import { staticPageRouteOptions } from './-static-page';

export const Route = createFileRoute('/(pages)/ai-zombie-pet-video')(
  staticPageRouteOptions('ai-zombie-pet-video', { article: true })
);

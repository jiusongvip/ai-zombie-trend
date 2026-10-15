import { createFileRoute } from '@tanstack/react-router';

import { staticPageRouteOptions } from './-static-page';

export const Route = createFileRoute('/(pages)/ai-zombie-couple-video')(
  staticPageRouteOptions('ai-zombie-couple-video', { article: true })
);

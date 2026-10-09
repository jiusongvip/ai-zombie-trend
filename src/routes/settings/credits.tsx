import { createFileRoute } from '@tanstack/react-router';

import { CreditsView } from '@/blocks/credits-view';

export const Route = createFileRoute('/settings/credits')({
  component: CreditsPage,
});

function CreditsPage() {
  return <CreditsView className="p-6" />;
}

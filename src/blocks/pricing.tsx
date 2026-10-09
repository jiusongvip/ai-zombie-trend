'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Film,
  Music,
  RotateCcw,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { useRouter } from '@/core/i18n/navigation';
import { apiPost } from '@/lib/api-client';
import { currentPathWithQuery } from '@/lib/redirect';
import { m } from '@/paraglide/messages.js';
import { formatPrice, pricingCatalog } from '@/config/pricing';
import { usePublicConfig } from '@/hooks/use-public-config';
import {
  PaymentProviderModal,
  type PaymentProvider,
} from '@/components/payment-provider-modal';
import {
  PricingTable,
  type PricingGroup,
  type PricingPlan,
} from '@/components/pricing-table';

const ALL_PROVIDERS: PaymentProvider[] = [
  'stripe',
  'creem',
  'paypal',
  'alipay',
  'wechat',
  'waffo',
];

type Feature = { icon: LucideIcon; label: string };

export function Pricing({ title }: { title?: string } = {}) {
  const router = useRouter();
  const { data: session } = useSession();

  const { data: configsData } = usePublicConfig();
  const configs = configsData ?? {};
  // Only an explicit "false" closes the CTA — the flag is unset while loading.
  const paymentsClosed = configs.payments_open === 'false';
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [loadingProvider, setLoadingProvider] =
    useState<PaymentProvider | null>(null);

  const enabledProviders = useMemo<PaymentProvider[]>(
    () => ALL_PROVIDERS.filter((p) => configs[`${p}_enabled`] === 'true'),
    [configs]
  );

  const commonFeatures: Feature[] = [
    { icon: Film, label: m['landing.pricing.feature_scored']() },
    { icon: Sparkles, label: m['landing.pricing.feature_all_styles']() },
    { icon: Zap, label: m['landing.pricing.feature_no_watermark']() },
    { icon: RotateCcw, label: m['landing.pricing.feature_refund']() },
  ];

  const packBadges: Record<string, { badge?: string; featured?: boolean }> = {
    film_pack_1: { badge: m['landing.pricing.limited_time']() },
    film_pack_10: { featured: true, badge: m['landing.pricing.popular']() },
    film_pack_60: { badge: m['landing.pricing.best_value']() },
  };

  const plans: PricingPlan[] = Object.values(pricingCatalog).map((p) => ({
    id: p.productId,
    name: p.productName,
    description: m['landing.pricing.per_video']({ n: p.films }),
    price: formatPrice(p.priceInCents),
    originalPrice: p.originalPriceInCents
      ? formatPrice(p.originalPriceInCents)
      : undefined,
    interval: `${p.credits} ${m['landing.pricing.credits_unit']()}`,
    features: commonFeatures,
    buttonText: paymentsClosed
      ? m['landing.pricing.soon']()
      : m['landing.pricing.buy'](),
    productId: p.productId,
    priceInCents: p.priceInCents,
    currency: p.currency,
    credits: p.credits,
    ...packBadges[p.productId],
  }));

  const groups: PricingGroup[] = [
    {
      key: 'packs',
      label: m['landing.pricing.group_packs'](),
      plans,
    },
  ];

  const checkoutMutation = useMutation({
    mutationFn: ({
      plan,
      provider,
    }: {
      plan: PricingPlan;
      provider: PaymentProvider;
    }) =>
      apiPost<{ checkout_url?: string }>('/api/payment/checkout', {
        product_id: plan.productId,
        product_name: plan.productName || plan.name,
        plan_name: plan.plan?.name || plan.name,
        price: plan.priceInCents,
        currency: plan.currency || 'usd',
        type: 'one-time',
        description: plan.name,
        plan: plan.plan,
        credits: plan.credits,
        credits_valid_days: plan.creditsValidDays,
        payment_provider: provider,
        // Come back to the page the user paid from.
        redirect: currentPathWithQuery('/settings/billing'),
      }),
    onSuccess: (data) => {
      if (!data?.checkout_url) {
        toast.error('Checkout failed');
        setLoadingProvider(null);
        return;
      }
      window.location.href = data.checkout_url;
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Checkout failed');
      setLoadingProvider(null);
    },
  });

  function startCheckout(plan: PricingPlan, provider: PaymentProvider) {
    setLoadingProvider(provider);
    checkoutMutation.mutate({ plan, provider });
  }

  async function handleCheckout(plan: PricingPlan) {
    if (paymentsClosed) {
      toast.info(m['landing.pricing.soon_toast']());
      return;
    }

    if (!session?.user) {
      const callbackUrl = encodeURIComponent(currentPathWithQuery('/pricing'));
      router.push(`/sign-in?callbackUrl=${callbackUrl}`);
      return;
    }

    const selectEnabled = configs.select_payment_enabled === 'true';
    const defaultProvider = (configs.default_payment_provider ||
      enabledProviders[0] ||
      'stripe') as PaymentProvider;

    if (selectEnabled && enabledProviders.length > 1) {
      setPendingPlan(plan);
      setModalOpen(true);
      return;
    }

    await startCheckout(plan, defaultProvider);
  }

  function handleProviderSelect(provider: PaymentProvider) {
    if (!pendingPlan) return;
    startCheckout(pendingPlan, provider);
  }

  return (
    <section
      id="pricing"
      className="border-border/70 border-t px-4 py-20 sm:py-24"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <h2 className="font-display text-primary text-glow text-3xl font-semibold tracking-tight sm:text-4xl">
            {title ?? m['landing.pricing.title']()}
          </h2>
          <p className="text-muted-foreground mt-4">
            {m['landing.pricing.description']()}
          </p>
        </div>
        <PricingTable groups={groups} onCheckout={handleCheckout} />
      </div>

      <PaymentProviderModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setPendingPlan(null);
            setLoadingProvider(null);
          }
        }}
        providers={enabledProviders.length ? enabledProviders : ['stripe']}
        loadingProvider={loadingProvider}
        onSelect={handleProviderSelect}
        planName={pendingPlan?.name}
        price={pendingPlan?.price}
      />
    </section>
  );
}

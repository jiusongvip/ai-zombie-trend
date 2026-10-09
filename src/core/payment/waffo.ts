import {
  CheckoutSession,
  PaymentConfigs,
  PaymentEvent,
  PaymentEventType,
  PaymentInfo,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
  PaymentStatus,
  WebhookIgnoredError,
} from './types';

import {
  WaffoPancake,
  type AnonymousCheckoutParams,
  type WebhookEventData,
} from '@waffo/pancake-ts';

/**
 * Waffo Pancake payment provider configs
 * @docs https://docs.waffo.ai/
 */
export interface WaffoConfigs extends PaymentConfigs {
  merchantId: string;
  privateKey: string;
  storeId?: string;
  environment?: 'test' | 'prod';
  webhookPublicKey?: string;
}

/**
 * Waffo Pancake payment provider implementation
 * @website https://waffo.ai/
 */
export class WaffoProvider implements PaymentProvider {
  readonly name = 'waffo';
  configs: WaffoConfigs;

  private client: WaffoPancake;

  constructor(configs: WaffoConfigs) {
    this.configs = configs;
    this.client = new WaffoPancake({
      merchantId: configs.merchantId,
      privateKey: configs.privateKey,
      environment: configs.environment || 'test',
      webhookPublicKey: configs.webhookPublicKey || undefined,
    });
  }

  // create payment
  async createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession> {
    if (!order.productId) {
      throw new Error('productId is required');
    }
    if (!order.orderNo) {
      throw new Error('orderNo is required (used as orderMerchantExternalId)');
    }

    // Waffo identifies our local order through the merchant-side business
    // reference (orderMerchantExternalId), which is inherited by orders,
    // payments and refunds and echoed back on every webhook event
    // (data.orderMerchantExternalId). We therefore use the local orderNo as
    // the session id everywhere — webhook matching and session lookup both
    // resolve by it.
    const payload: AnonymousCheckoutParams = {
      productId: order.productId,
      currency: (order.price?.currency || 'USD').toUpperCase(),
      buyerEmail: order.customer?.email,
      orderMerchantExternalId: order.orderNo,
      successUrl: order.successUrl,
      metadata: this.toMetadata(order.metadata),
      darkMode: true,
    };

    const result = await this.client.checkout.anonymous.create(payload);

    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: {
        sessionId: order.orderNo,
        checkoutUrl: result.checkoutUrl,
      },
      checkoutResult: result,
      metadata: order.metadata || {},
    };
  }

  // get payment session — sessionId is our local orderNo (orderMerchantExternalId)
  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    const lookup = await this.client.graphql.query<{
      payments: Array<{
        id: string;
        orderId: string;
        status: string;
        orderMerchantExternalId: string;
      }>;
    }>({
      query: `query ($ref: String!) {
        payments(filter: { orderMerchantExternalId: { eq: $ref } }) {
          id orderId status orderMerchantExternalId
        }
      }`,
      variables: { ref: sessionId },
    });

    this.throwGraphQLError(lookup);

    const payment = lookup.data?.payments?.[0];
    if (!payment?.orderId) {
      // The Waffo order/payment does not exist yet — the buyer opened the
      // checkout page but has not paid. Report it as still processing so the
      // return callback can finish without touching the order.
      return {
        provider: this.name,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: { out_trade_no: sessionId },
        metadata: {},
      };
    }

    const detail = await this.client.graphql.query<{
      onetimeOrder: WaffoOnetimeOrder | null;
    }>({
      // The Waffo schema has no `ID` scalar — `query ($id: ID!)` fails with
      // `Unknown type "ID"` and the order would never be marked paid.
      query: `query ($id: String!) {
        onetimeOrder(id: $id) {
          id buyerEmail currency status
          priceSnapshot { currency subtotal taxAmount total }
          payments { id status cardInfo { brand last4 } createdAt }
          createdAt updatedAt
        }
      }`,
      variables: { id: payment.orderId },
    });

    this.throwGraphQLError(detail);

    const waffoOrder = detail.data?.onetimeOrder;
    if (!waffoOrder) {
      throw new Error(`Waffo order not found: ${payment.orderId}`);
    }

    return this.buildPaymentSessionFromOrder(waffoOrder, sessionId);
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const signature = req.headers.get('x-waffo-signature');

    if (!rawBody || !signature) {
      throw new Error('Invalid webhook request');
    }

    // RSA-SHA256 signature verification (throws on invalid signature/stale timestamp)
    const event = this.client.webhooks.verify<WebhookEventData>(
      rawBody,
      signature
    );

    const eventType = this.mapWaffoEventType(event.eventType);

    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      return {
        eventType,
        eventResult: event,
        paymentSession: this.buildPaymentSessionFromWebhookData(
          event.data,
          event.timestamp
        ),
      };
    }

    throw new WebhookIgnoredError(`No handler for waffo event: ${event.eventType}`);
  }

  private toMetadata(
    metadata?: Record<string, any>
  ): Record<string, string> | undefined {
    if (!metadata || Object.keys(metadata).length === 0) {
      return undefined;
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      result[key] =
        typeof value === 'string' ? value : JSON.stringify(value ?? '');
    }
    return result;
  }

  private throwGraphQLError(response: {
    data: unknown;
    errors?: Array<{ message: string }>;
  }) {
    if (response.errors?.length) {
      throw new Error(
        `Waffo GraphQL error: ${response.errors.map((e) => e.message).join('; ')}`
      );
    }
  }

  private mapWaffoEventType(eventType: string): PaymentEventType {
    switch (eventType) {
      case 'order.completed':
        return PaymentEventType.CHECKOUT_SUCCESS;
      default:
        // This product only sells one-time credit packs — subscription and
        // refund events are acknowledged without handling.
        throw new WebhookIgnoredError(
          `Not handle waffo event type: ${eventType}`
        );
    }
  }

  private mapWaffoOrderStatus(status?: string): PaymentStatus {
    switch (status) {
      case 'completed':
        return PaymentStatus.SUCCESS;
      case 'pending':
        return PaymentStatus.PROCESSING;
      case 'canceled':
        return PaymentStatus.CANCELED;
      default:
        throw new Error(`Unknown Waffo order status: ${status}`);
    }
  }

  // build payment session from webhook event data (order.completed)
  private buildPaymentSessionFromWebhookData(
    data: WebhookEventData,
    eventTimestamp?: string
  ): PaymentSession {
    const amount = Number(data.chargedAmount ?? data.total ?? data.amount) || 0;

    const paymentInfo: PaymentInfo = {
      description: data.productName,
      transactionId: data.paymentId || data.orderId,
      amount,
      currency: data.currency,
      discountCode: '',
      discountAmount: 0,
      discountCurrency: data.currency,
      paymentAmount: amount,
      paymentCurrency: data.currency,
      paymentEmail: data.buyerEmail,
      paidAt: data.paymentDate
        ? new Date(data.paymentDate)
        : eventTimestamp
          ? new Date(eventTimestamp)
          : new Date(),
      invoiceId: data.orderId,
      invoiceUrl: '',
    };

    return {
      provider: this.name,
      paymentStatus: this.mapWaffoOrderStatus(data.orderStatus ?? 'completed'),
      paymentInfo,
      // out_trade_no lets handleCheckoutSuccess match the local order row,
      // whose paymentSessionId stores the same orderMerchantExternalId.
      paymentResult: {
        ...data,
        out_trade_no: data.orderMerchantExternalId,
      },
      metadata: data.orderMetadata || {},
    };
  }

  // build payment session from a GraphQL onetimeOrder
  private buildPaymentSessionFromOrder(
    waffoOrder: WaffoOnetimeOrder,
    orderNo: string
  ): PaymentSession {
    const succeededPayment =
      waffoOrder.payments?.find((p) => p.status === 'succeeded') ||
      waffoOrder.payments?.[0];

    const total = Number(waffoOrder.priceSnapshot?.total) || 0;

    const paymentInfo: PaymentInfo = {
      transactionId: succeededPayment?.id,
      amount: total,
      currency: waffoOrder.currency,
      discountCode: '',
      discountAmount: 0,
      discountCurrency: waffoOrder.currency,
      paymentAmount: total,
      paymentCurrency: waffoOrder.currency,
      paymentEmail: waffoOrder.buyerEmail,
      paidAt: succeededPayment?.createdAt
        ? new Date(succeededPayment.createdAt)
        : undefined,
      invoiceId: waffoOrder.id,
      invoiceUrl: '',
    };

    return {
      provider: this.name,
      paymentStatus: this.mapWaffoOrderStatus(waffoOrder.status),
      paymentInfo,
      // handleCheckoutSuccess resolves the local order from
      // `result.id || result.object?.id || result.out_trade_no`. Waffo's own
      // order id must not occupy `id` there, or the lookup would search by it
      // and find nothing — our stored paymentSessionId is the merchant ref.
      paymentResult: {
        ...waffoOrder,
        id: undefined,
        waffoOrderId: waffoOrder.id,
        out_trade_no: orderNo,
      },
      metadata: {},
    };
  }
}

interface WaffoOnetimeOrder {
  id: string;
  buyerEmail: string;
  currency: string;
  status: string;
  priceSnapshot?: {
    currency: string;
    subtotal?: string;
    taxAmount?: string;
    total?: string;
  };
  payments?: Array<{
    id: string;
    status: string;
    cardInfo?: { brand?: string; last4?: string };
    createdAt?: string;
  }>;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Create Waffo Pancake provider with configs
 */
export function createWaffoProvider(configs: WaffoConfigs): WaffoProvider {
  return new WaffoProvider(configs);
}

import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import Stripe from "stripe";
import { db } from "@payments/database/database";
import { createStripeClient } from "@shared/stripe/client";
import { webhookEvents } from "@payments/pubsub/topics";
import { user } from "~encore/clients";

const stripeSecretKey = secret("StripeSecretKey");
const stripeWebhookSecret = secret("StripeWebhookSecret");

/**
 * Extracts IDs from a Stripe webhook event payload.
 * Handles both snapshot (full) and thin (v2) payload formats.
 */
interface ExtractedIds {
    customerId: string | null;
    subscriptionId: string | null;
    invoiceId: string | null;
    paymentIntentId: string | null;
    chargeId: string | null;
}

function extractIds(event: Stripe.Event): ExtractedIds {
    const result: ExtractedIds = {
        customerId: null,
        subscriptionId: null,
        invoiceId: null,
        paymentIntentId: null,
        chargeId: null,
    };

    // Check for v2 thin payload with related_object
    const eventAny = event as any;
    if (eventAny.related_object) {
        const relatedObject = eventAny.related_object;
        const relatedType = relatedObject.type || "";
        const objectId = relatedObject.id;

        if (relatedType.includes("customer")) {
            result.customerId = objectId;
        } else if (relatedType.includes("subscription")) {
            result.subscriptionId = objectId;
        } else if (relatedType.includes("invoice")) {
            result.invoiceId = objectId;
        } else if (relatedType.includes("payment_intent")) {
            result.paymentIntentId = objectId;
        } else if (relatedType.includes("charge")) {
            result.chargeId = objectId;
        }
        return result;
    }

    // Traditional payload format with data.object
    if (!event.data?.object) {
        return result;
    }

    const dataObject = event.data.object as any;
    const objectId = dataObject.id;
    const objectType = dataObject.object;

    result.customerId = dataObject.customer || null;
    result.subscriptionId = objectType === "subscription" ? objectId : dataObject.subscription || null;
    result.invoiceId = objectType === "invoice" ? objectId : dataObject.invoice || null;
    result.paymentIntentId = objectType === "payment_intent" ? objectId : dataObject.payment_intent || null;
    result.chargeId = objectType === "charge" ? objectId : dataObject.charge || null;

    return result;
}

/**
 * Extracts subscription details from a Stripe webhook event.
 * Returns null values for thin payloads (requires API call for full details).
 */
interface SubscriptionDetails {
    amount: number | null;
    currency: string | null;
    status: string | null;
    planId: string | null;
    interval: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
}

function extractSubscriptionDetails(event: Stripe.Event): SubscriptionDetails {
    const defaultResult: SubscriptionDetails = {
        amount: null,
        currency: null,
        status: null,
        planId: null,
        interval: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
    };

    // Thin payloads don't have subscription data
    if ((event as any).related_object) {
        return defaultResult;
    }

    if (!event.data?.object) {
        return defaultResult;
    }

    const dataObject = event.data.object as any;
    const objectType = dataObject.object;

    // Get subscription data (either the object itself if it's a subscription, or nested)
    const isSubscriptionObject = objectType === "subscription";
    const subscriptionData = isSubscriptionObject ? dataObject : dataObject.subscription || {};
    const priceData = subscriptionData.items?.data?.[0]?.price;

    // Helper to safely extract with fallback
    const getValue = <T>(...values: (T | null | undefined)[]): T | null => {
        for (const value of values) {
            if (value !== null && value !== undefined) {
                return value;
            }
        }
        return null;
    };

    // Extract amount: prioritize subscription price -> invoice amount -> direct amount
    const amount = getValue(
        priceData?.unit_amount,
        dataObject.amount,
        dataObject.amount_due
    );

    // Extract currency: prioritize subscription price -> invoice/direct currency
    const currency = getValue(priceData?.currency, dataObject.currency);

    // Extract status: prioritize subscription status -> direct status
    const status = getValue(subscriptionData.status, dataObject.status);

    // Extract plan/price ID: prioritize subscription price -> subscription plan -> direct plan
    const planId = getValue(
        priceData?.id,
        subscriptionData.plan?.id,
        dataObject.plan?.id
    );

    // Extract interval: prioritize subscription price recurring -> subscription plan -> direct plan
    const interval = getValue(
        priceData?.recurring?.interval,
        subscriptionData.plan?.interval,
        dataObject.plan?.interval
    );

    // Extract period dates from subscription data
    const currentPeriodStart = subscriptionData.current_period_start
        ? new Date(subscriptionData.current_period_start * 1000)
        : null;
    const currentPeriodEnd = subscriptionData.current_period_end
        ? new Date(subscriptionData.current_period_end * 1000)
        : null;

    // Extract cancellation info
    const cancelAtPeriodEnd = subscriptionData.cancel_at_period_end ?? false;
    const canceledAt = subscriptionData.canceled_at
        ? new Date(subscriptionData.canceled_at * 1000)
        : null;

    return {
        amount,
        currency,
        status,
        planId,
        interval,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        canceledAt,
    };
}

/**
 * Finds user_id by stripe_customer_id via user service.
 * Returns null if user not found (expected for webhooks from external customers).
 */
async function findUserIdByCustomerId(customerId: string | null): Promise<string | null> {
    if (!customerId) {
        return null;
    }

    try {
        const userData = await user.getByStripeCustomerId({
            stripe_customer_id: customerId,
        });
        return userData.user_id;
    } catch (error) {
        // User not found is expected for webhooks from customers not in our system
        console.warn(`User not found for stripe_customer_id: ${customerId}`, error);
        return null;
    }
}

/**
 * Saves webhook event to database.
 * Preserves complete payload in JSONB for both snapshot and thin formats.
 */
async function saveWebhookEvent(
    event: Stripe.Event,
    ids: ExtractedIds,
    subscriptionDetails: SubscriptionDetails,
    userId: string | null
): Promise<void> {
    await db.exec`
        INSERT INTO webhook_events (
            stripe_event_id,
            event_type,
            api_version,
            livemode,
            customer_id,
            subscription_id,
            invoice_id,
            payment_intent_id,
            charge_id,
            user_id,
            amount,
            currency,
            subscription_status,
            plan_id,
            subscription_interval,
            current_period_start,
            current_period_end,
            cancel_at_period_end,
            canceled_at,
            payload,
            processed
        ) VALUES (
            ${event.id},
            ${event.type},
            ${event.api_version || null},
            ${event.livemode},
            ${ids.customerId},
            ${ids.subscriptionId},
            ${ids.invoiceId},
            ${ids.paymentIntentId},
            ${ids.chargeId},
            ${userId},
            ${subscriptionDetails.amount},
            ${subscriptionDetails.currency},
            ${subscriptionDetails.status},
            ${subscriptionDetails.planId},
            ${subscriptionDetails.interval},
            ${subscriptionDetails.currentPeriodStart},
            ${subscriptionDetails.currentPeriodEnd},
            ${subscriptionDetails.cancelAtPeriodEnd},
            ${subscriptionDetails.canceledAt},
            ${JSON.stringify(event)}::jsonb,
            false
        )
    `;
}

/**
 * Publishes webhook event to PubSub if it's subscription-related.
 * Does not throw errors to avoid failing the webhook.
 */
async function publishToPubSubIfRelevant(
    event: Stripe.Event,
    ids: ExtractedIds,
    subscriptionDetails: SubscriptionDetails,
    userId: string | null
): Promise<void> {
    const isSubscriptionRelated =
        event.type.includes("subscription") ||
        event.type.includes("invoice") ||
        event.type.includes("customer.subscription");

    if (!isSubscriptionRelated) {
        return;
    }

    try {
        await webhookEvents.publish({
            stripe_event_id: event.id,
            event_type: event.type,
            user_id: userId,
            customer_id: ids.customerId,
            subscription_id: ids.subscriptionId,
            subscription_status: subscriptionDetails.status,
            amount: subscriptionDetails.amount,
            currency: subscriptionDetails.currency,
            plan_id: subscriptionDetails.planId,
            interval: subscriptionDetails.interval,
            current_period_start: subscriptionDetails.currentPeriodStart,
            current_period_end: subscriptionDetails.currentPeriodEnd,
            cancel_at_period_end: subscriptionDetails.cancelAtPeriodEnd,
            canceled_at: subscriptionDetails.canceledAt,
            payload: event,
        });
    } catch (error) {
        // Log error but don't fail the webhook
        console.error("Failed to publish webhook event to PubSub:", error);
    }
}

/**
 * Reads raw body from request stream.
 * Required for Stripe signature verification.
 */
async function readRawBody(req: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return chunks.length === 1 ? chunks[0] : Buffer.concat(chunks as any);
}

/**
 * Verifies Stripe webhook signature and constructs event.
 * Throws if signature verification fails.
 */
function verifyWebhookSignature(
    stripe: Stripe,
    rawBody: Buffer,
    signature: string,
    webhookSecret: string
): Stripe.Event {
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret) as Stripe.Event;
}

/**
 * Main webhook handler for Stripe events.
 * Handles signature verification, event processing, and PubSub publishing.
 */
export const webhook = api.raw(
    { expose: true, path: "/webhook/stripe", method: "POST" },
    async (req, resp) => {
        try {
            const stripe = createStripeClient(stripeSecretKey());
            const webhookSecret = stripeWebhookSecret();

            // Read raw body for signature verification
            const rawBody = await readRawBody(req);

            // Get and validate signature header
            const signatureHeader = req.headers["stripe-signature"];
            if (!signatureHeader) {
                resp.writeHead(400, { "Content-Type": "application/json" });
                resp.end(JSON.stringify({ error: "Missing stripe-signature header" }));
                return;
            }
            const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

            // Verify webhook signature
            let event: Stripe.Event;
            try {
                event = verifyWebhookSignature(stripe, rawBody, signature, webhookSecret);
            } catch (err) {
                console.error("Webhook signature verification failed:", err);
                resp.writeHead(400, { "Content-Type": "application/json" });
                resp.end(
                    JSON.stringify({
                        error: "Webhook signature verification failed",
                        message: err instanceof Error ? err.message : "Unknown error",
                    })
                );
                return;
            }

            // Extract data from event
            const ids = extractIds(event);
            const subscriptionDetails = extractSubscriptionDetails(event);
            const userId = await findUserIdByCustomerId(ids.customerId);

            // Save to database
            await saveWebhookEvent(event, ids, subscriptionDetails, userId);

            // Publish to PubSub if subscription-related
            await publishToPubSubIfRelevant(event, ids, subscriptionDetails, userId);

            // Respond with success
            const isSnapshot = !(event as any).related_object && !!event.data?.object;
            resp.writeHead(200, { "Content-Type": "application/json" });
            resp.end(
                JSON.stringify({
                    received: true,
                    event_type: event.type,
                    payload_style: isSnapshot ? "snapshot" : "thin",
                })
            );
        } catch (error) {
            console.error("Webhook error:", error);
            resp.writeHead(500, { "Content-Type": "application/json" });
            resp.end(
                JSON.stringify({
                    error: "Internal server error",
                    message: error instanceof Error ? error.message : "Unknown error",
                })
            );
        }
    }
);

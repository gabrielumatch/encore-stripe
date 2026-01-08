import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import Stripe from "stripe";
import { db } from "@payments/database/database";
import { buffer } from "node:stream/consumers";
import { createStripeClient } from "@shared/stripe/client";
import { webhookEvents } from "@payments/pubsub/topics";

const stripeSecretKey = secret("StripeSecretKey");
const stripeWebhookSecret = secret("StripeWebhookSecret");

export const webhook = api.raw(
    { expose: true, path: "/webhook/stripe", method: "POST" },
    async (req, resp) => {
        try {
            const stripe = createStripeClient(stripeSecretKey());

            // Get the raw body as buffer for signature verification
            const rawBody = await buffer(req);
            const signature = req.headers["stripe-signature"];

            if (!signature) {
                resp.writeHead(400, { "Content-Type": "application/json" });
                resp.end(JSON.stringify({ error: "Missing stripe-signature header" }));
                return;
            }

            let event: Stripe.Event;
            try {
                // Verify webhook signature using raw body buffer
                event = stripe.webhooks.constructEvent(
                    rawBody,
                    signature,
                    stripeWebhookSecret()
                ) as Stripe.Event;
            } catch (err) {
                resp.writeHead(400, { "Content-Type": "application/json" });
                resp.end(
                    JSON.stringify({
                        error: "Webhook signature verification failed",
                        message: err instanceof Error ? err.message : "Unknown error",
                    })
                );
                return;
            }

            // Extract important fields from the event
            // Note: Stripe can send two payload styles:
            // - Snapshot: Full object data with `data.object` (complete state)
            // - Thin: Minimal data with `related_object` or minimal `data.object` (requires API call for full details)
            // We save the complete payload in JSONB, so both formats work

            // Check if this is a thin payload with related_object (v2 events)
            const hasRelatedObject = (event as any).related_object !== undefined;
            const relatedObject = hasRelatedObject ? (event as any).related_object : null;

            // Handle both payload styles
            let dataObject: any = null;
            let objectId: string | null = null;
            let objectType: string | null = null;
            let isSnapshot = false;

            if (hasRelatedObject) {
                // Thin payload with related_object (v2 events)
                objectId = relatedObject?.id || null;
                objectType = relatedObject?.type || null;
                isSnapshot = false;
            } else if (event.data && event.data.object) {
                // Traditional payload with data.object (can be snapshot or thin)
                dataObject = event.data.object as any;
                objectId = dataObject.id || null;
                objectType = dataObject.object || null;
                // Detect if snapshot: has full object data (more than just id/type)
                isSnapshot = objectType !== undefined && Object.keys(dataObject).length > 2;
            }

            // Extract IDs - works for both snapshot and thin payloads
            // For related_object format, we need to check the type and extract accordingly
            let customerId: string | null = null;
            let subscriptionId: string | null = null;
            let invoiceId: string | null = null;
            let paymentIntentId: string | null = null;
            let chargeId: string | null = null;

            if (hasRelatedObject && relatedObject) {
                // For related_object format, check the type
                const relatedType = relatedObject.type || "";
                if (relatedType.includes("customer")) {
                    customerId = objectId;
                } else if (relatedType.includes("subscription")) {
                    subscriptionId = objectId;
                } else if (relatedType.includes("invoice")) {
                    invoiceId = objectId;
                } else if (relatedType.includes("payment_intent")) {
                    paymentIntentId = objectId;
                } else if (relatedType.includes("charge")) {
                    chargeId = objectId;
                }
            } else if (dataObject) {
                // Traditional format with data.object
                customerId = dataObject.customer || null;
                subscriptionId = objectType === "subscription" ? objectId : dataObject.subscription || null;
                invoiceId = objectType === "invoice" ? objectId : dataObject.invoice || null;
                paymentIntentId = objectType === "payment_intent" ? objectId : dataObject.payment_intent || null;
                chargeId = objectType === "charge" ? objectId : dataObject.charge || null;
            }

            // Extract subscription details if available (snapshot only)
            // For thin payloads, subscription data will be null - we'd need to fetch from Stripe API if needed
            const subscriptionData = objectType === "subscription" && dataObject ? dataObject : (dataObject?.subscription || {});
            const amount = dataObject
                ? (subscriptionData.items?.data?.[0]?.price?.unit_amount ||
                    dataObject.amount ||
                    dataObject.amount_due ||
                    null)
                : null;
            const currency = dataObject
                ? (subscriptionData.items?.data?.[0]?.price?.currency ||
                    dataObject.currency ||
                    null)
                : null;
            const subscriptionStatus = dataObject
                ? (subscriptionData.status || dataObject.status || null)
                : null;
            const planId = dataObject
                ? (subscriptionData.items?.data?.[0]?.price?.id ||
                    dataObject.plan?.id ||
                    null)
                : null;
            const interval = dataObject
                ? (subscriptionData.items?.data?.[0]?.price?.recurring?.interval ||
                    dataObject.plan?.interval ||
                    null)
                : null;
            const currentPeriodStart = dataObject && subscriptionData.current_period_start
                ? new Date(subscriptionData.current_period_start * 1000)
                : null;
            const currentPeriodEnd = dataObject && subscriptionData.current_period_end
                ? new Date(subscriptionData.current_period_end * 1000)
                : null;
            const cancelAtPeriodEnd = dataObject
                ? (subscriptionData.cancel_at_period_end || false)
                : false;
            const canceledAt = dataObject && subscriptionData.canceled_at
                ? new Date(subscriptionData.canceled_at * 1000)
                : null;

            // Find user_id by stripe_customer_id (will be null if not found)
            const user = customerId
                ? await db.queryRow<{ id: string }>`
            SELECT id FROM users WHERE stripe_customer_id = ${customerId}
          `
                : null;
            const userId = user?.id || null;

            // Save webhook event to database
            // We save the complete payload (JSONB) which works for both snapshot and thin formats
            // For thin payloads, extracted fields may be null, but the full payload is preserved
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
          ${customerId},
          ${subscriptionId},
          ${invoiceId},
          ${paymentIntentId},
          ${chargeId},
          ${userId},
          ${amount},
          ${currency},
          ${subscriptionStatus},
          ${planId},
          ${interval},
          ${currentPeriodStart},
          ${currentPeriodEnd},
          ${cancelAtPeriodEnd},
          ${canceledAt},
          ${JSON.stringify(event)}::jsonb,
          false
        )
      `;

            // Publish to PubSub for subscription-related events
            // This allows other services to react to subscription changes
            if (
                event.type.includes("subscription") ||
                event.type.includes("invoice") ||
                event.type.includes("customer.subscription")
            ) {
                try {
                    await webhookEvents.publish({
                        stripe_event_id: event.id,
                        event_type: event.type,
                        user_id: userId,
                        customer_id: customerId,
                        subscription_id: subscriptionId,
                        subscription_status: subscriptionStatus,
                        amount: amount,
                        currency: currency,
                        plan_id: planId,
                        interval: interval,
                        current_period_start: currentPeriodStart,
                        current_period_end: currentPeriodEnd,
                        cancel_at_period_end: cancelAtPeriodEnd,
                        canceled_at: canceledAt,
                        payload: event,
                    });
                } catch (pubErr) {
                    // Log error but don't fail the webhook
                    console.error("Failed to publish webhook event to PubSub:", pubErr);
                }
            }

            // Respond to Stripe (200 OK)
            // Important: Always respond 200 quickly to acknowledge receipt
            // For thin payloads, you can fetch full details later via Stripe API if needed
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


import { Subscription } from "encore.dev/pubsub";
import { db } from "./database";
import { webhookEvents, WebhookEvent } from "../payments/topics";

const _ = new Subscription(webhookEvents, "update-subscriptions", {
    handler: async (event: WebhookEvent) => {
        // Only process events that have subscription_id
        if (!event.subscription_id || !event.user_id) {
            return;
        }

        // Handle subscription created/updated
        if (
            event.event_type === "customer.subscription.created" ||
            event.event_type === "customer.subscription.updated" ||
            event.event_type === "customer.subscription.deleted"
        ) {
            if (event.event_type === "customer.subscription.deleted") {
                // Update subscription status to canceled
                await db.exec`
                    UPDATE subscriptions
                    SET 
                        status = 'canceled',
                        canceled_at = ${event.canceled_at || new Date()},
                        updated_at = now()
                    WHERE stripe_subscription_id = ${event.subscription_id}
                `;
            } else {
                // Upsert subscription (create or update)
                await db.exec`
                    INSERT INTO subscriptions (
                        user_id,
                        stripe_subscription_id,
                        stripe_customer_id,
                        status,
                        plan_id,
                        amount,
                        currency,
                        interval,
                        current_period_start,
                        current_period_end,
                        cancel_at_period_end,
                        canceled_at
                    ) VALUES (
                        ${event.user_id}::uuid,
                        ${event.subscription_id},
                        ${event.customer_id},
                        ${event.subscription_status || 'active'},
                        ${event.plan_id},
                        ${event.amount},
                        ${event.currency},
                        ${event.interval},
                        ${event.current_period_start},
                        ${event.current_period_end},
                        ${event.cancel_at_period_end},
                        ${event.canceled_at}
                    )
                    ON CONFLICT (stripe_subscription_id) 
                    DO UPDATE SET
                        status = EXCLUDED.status,
                        plan_id = EXCLUDED.plan_id,
                        amount = EXCLUDED.amount,
                        currency = EXCLUDED.currency,
                        interval = EXCLUDED.interval,
                        current_period_start = EXCLUDED.current_period_start,
                        current_period_end = EXCLUDED.current_period_end,
                        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                        canceled_at = EXCLUDED.canceled_at,
                        updated_at = now()
                `;
            }
        }
    },
});


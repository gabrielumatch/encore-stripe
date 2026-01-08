import { Topic } from "encore.dev/pubsub";

export interface WebhookEvent {
    stripe_event_id: string;
    event_type: string;
    user_id: string | null;
    customer_id: string | null;
    subscription_id: string | null;
    subscription_status: string | null;
    amount: number | null;
    currency: string | null;
    plan_id: string | null;
    interval: string | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    canceled_at: Date | null;
    payload: any; // JSONB payload from Stripe
}

export const webhookEvents = new Topic<WebhookEvent>("webhook-events", {
    deliveryGuarantee: "at-least-once",
});


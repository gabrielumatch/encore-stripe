import { api } from "encore.dev/api";
import { db } from "@payments/database/database";

interface WebhookEvent {
    id: string;
    stripe_event_id: string;
    event_type: string;
    customer_id: string | null;
    subscription_id: string | null;
    amount: number | null;
    currency: string | null;
    subscription_status: string | null;
    created_at: Date;
}

interface ListUserWebhooksResponse {
    webhooks: WebhookEvent[];
}

interface ListUserWebhooksRequest {
    userId: string;
}

export const listUserWebhooks = api(
    { method: "GET", path: "/webhooks/users/:userId" },
    async ({ userId }: ListUserWebhooksRequest): Promise<ListUserWebhooksResponse> => {
        // Get all webhook events for this user
        const webhooks: WebhookEvent[] = [];
        const rows = await db.query<WebhookEvent>`
            SELECT 
                id,
                stripe_event_id,
                event_type,
                customer_id,
                subscription_id,
                amount,
                currency,
                subscription_status,
                created_at
            FROM webhook_events
            WHERE user_id = ${userId}::uuid
            ORDER BY created_at DESC
        `;

        for await (const webhook of rows) {
            webhooks.push(webhook);
        }

        return { webhooks };
    }
);

import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { db } from "./database";
import { db as paymentDb } from "../payments/database";

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

interface GetUserWebhooksResponse {
    webhooks: WebhookEvent[];
}

interface GetUserWebhooksRequest {
    userId: string;
}

export const getUserWebhooks = api(
    { expose: true, method: "GET", path: "/users/:userId/webhooks" },
    async ({ userId }: GetUserWebhooksRequest): Promise<GetUserWebhooksResponse> => {
        // First verify user exists
        const user = await db.queryRow<{ id: string }>`
            SELECT id FROM users WHERE id = ${userId}::uuid
        `;

        if (!user) {
            throw new APIError(ErrCode.NotFound, "User not found");
        }

        // Get all webhook events for this user
        const webhooks: WebhookEvent[] = [];
        const rows = await paymentDb.query<WebhookEvent>`
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


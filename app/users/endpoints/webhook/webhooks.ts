import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { db } from "@users/database/database";
import { payment } from "~encore/clients";

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

        // Get webhooks via API call to payment service
        const result = await payment.listUserWebhooks({ userId });

        return result;
    }
);


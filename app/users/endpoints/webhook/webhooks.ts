import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { db } from "@users/database/database";
import { payment } from "~encore/clients";
import { GetUserWebhooksRequest } from "@users/types";
import { ListUserWebhooksResponse } from "@payments/types";

export const getUserWebhooks = api(
    { expose: true, method: "GET", path: "/users/:userId/webhooks" },
    async ({ userId }: GetUserWebhooksRequest): Promise<ListUserWebhooksResponse> => {
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


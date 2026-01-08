import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { db } from "@users/database/database";
import { User, Subscription, GetUserRequest, GetUserResponse } from "@users/types";

export const getUser = api(
    { expose: true, method: "GET", path: "/users/:userId" },
    async ({ userId }: GetUserRequest): Promise<GetUserResponse> => {
        const user = await db.queryRow<User>`
            SELECT id, email, name, stripe_customer_id, created_at, updated_at
            FROM users
            WHERE id = ${userId}::uuid
        `;

        if (!user) {
            throw new APIError(ErrCode.NotFound, "User not found");
        }

        const subscription = await db.queryRow<Subscription>`
            SELECT 
                id,
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
                canceled_at,
                created_at,
                updated_at
            FROM subscriptions
            WHERE user_id = ${userId}::uuid
            ORDER BY created_at DESC
            LIMIT 1
        `;

        return {
            user,
            subscription,
        };
    }
);


import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { db } from "@users/database/database";

interface User {
    id: string;
    email: string;
    name: string;
    stripe_customer_id: string | null;
    created_at: Date;
    updated_at: Date;
}

interface Subscription {
    id: string;
    user_id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string;
    status: string;
    plan_id: string | null;
    amount: number | null;
    currency: string | null;
    interval: string | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    canceled_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

interface GetUserResponse {
    user: User;
    subscription: Subscription | null;
}

interface GetUserRequest {
    userId: string;
}

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


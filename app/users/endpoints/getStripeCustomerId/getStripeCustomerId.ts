import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { db } from "@users/database/database";

interface GetStripeCustomerIdRequest {
    userId: string;
}

interface GetStripeCustomerIdResponse {
    stripe_customer_id: string | null;
}

export const getStripeCustomerId = api(
    { method: "GET", path: "/users/:userId/stripe-customer-id" },
    async ({ userId }: GetStripeCustomerIdRequest): Promise<GetStripeCustomerIdResponse> => {
        const user = await db.queryRow<{ stripe_customer_id: string | null }>`
            SELECT stripe_customer_id
            FROM users
            WHERE id = ${userId}::uuid
        `;

        if (!user) {
            throw new APIError(ErrCode.NotFound, "User not found");
        }

        return {
            stripe_customer_id: user.stripe_customer_id,
        };
    }
);

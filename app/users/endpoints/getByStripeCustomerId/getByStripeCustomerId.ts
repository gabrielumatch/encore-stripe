import { api } from "encore.dev/api";
import { db } from "@users/database/database";

interface GetByStripeCustomerIdRequest {
    stripe_customer_id: string;
}

interface GetByStripeCustomerIdResponse {
    user_id: string | null;
}

/**
 * Private endpoint to get user_id by stripe_customer_id.
 * Used internally by other services (e.g., payment webhook handler).
 */
export const getByStripeCustomerId = api(
    { method: "GET", path: "/users/by-stripe-customer/:stripe_customer_id" },
    async ({ stripe_customer_id }: GetByStripeCustomerIdRequest): Promise<GetByStripeCustomerIdResponse> => {
        const user = await db.queryRow<{ id: string }>`
            SELECT id
            FROM users
            WHERE stripe_customer_id = ${stripe_customer_id}
        `;

        return {
            user_id: user?.id || null,
        };
    }
);
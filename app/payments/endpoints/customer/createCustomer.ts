import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";

const stripeSecretKey = secret("StripeSecretKey");

interface CreateCustomerRequest {
    email: string;
    name: string;
}

interface CreateCustomerResponse {
    stripe_customer_id: string;
}

/**
 * Private endpoint to create a Stripe customer.
 * This should only be called internally by other services.
 */
export const createCustomer = api(
    { method: "POST", path: "/customers" },
    async (req: CreateCustomerRequest): Promise<CreateCustomerResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        try {
            const customer = await stripe.customers.create({
                email: req.email,
                name: req.name,
            });

            return {
                stripe_customer_id: customer.id,
            };
        } catch (error) {
            throw new APIError(
                ErrCode.Internal,
                `Failed to create Stripe customer: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
);

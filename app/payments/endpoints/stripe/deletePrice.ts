import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import {
    DeletePriceRequest,
    DeletePriceResponse,
} from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

export const deletePrice = api(
    { expose: true, method: "DELETE", path: "/stripe/prices/:price_id" },
    async ({ price_id }: DeletePriceRequest): Promise<DeletePriceResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        try {
            // Stripe doesn't actually delete prices, it marks them as inactive
            // We'll update the price to set it as inactive instead
            const price = await stripe.prices.update(price_id, {
                active: false,
            });

            return {
                deleted: !price.active,
                price_id: price.id,
                active: price.active,
            };
        } catch (error) {
            throw new APIError(
                ErrCode.Internal,
                `Failed to delete price: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
);
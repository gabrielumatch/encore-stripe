import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import { ListPricesResponse } from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

export const listPrices = api(
    { expose: true, method: "GET", path: "/stripe/prices" },
    async (): Promise<ListPricesResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        const prices = await stripe.prices.list({
            limit: 100,
            expand: ["data.product"],
        });

        const formattedPrices = prices.data.map((price) => ({
            id: price.id,
            active: price.active,
            currency: price.currency,
            unit_amount: price.unit_amount,
            recurring: price.recurring
                ? {
                    interval: price.recurring.interval,
                    interval_count: price.recurring.interval_count,
                }
                : null,
            product: price.product,
            metadata: price.metadata,
        }));

        return { prices: formattedPrices };
    }
);
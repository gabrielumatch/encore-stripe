import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import {
    CreatePriceRequest,
    CreatePriceResponse,
} from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

export const createPrice = api(
    { expose: true, method: "POST", path: "/stripe/prices" },
    async (req: CreatePriceRequest): Promise<CreatePriceResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        try {
            const priceParams: any = {
                product: req.product_id,
                unit_amount: req.unit_amount,
                currency: req.currency.toLowerCase(),
                active: req.active ?? true,
            };

            if (req.recurring) {
                priceParams.recurring = {
                    interval: req.recurring.interval,
                    interval_count: req.recurring.interval_count || 1,
                };
            }

            if (req.metadata) {
                priceParams.metadata = req.metadata;
            }

            const price = await stripe.prices.create(priceParams);

            return {
                price_id: price.id,
                product_id: typeof price.product === "string" ? price.product : price.product.id,
                unit_amount: price.unit_amount || 0,
                currency: price.currency,
                recurring: price.recurring
                    ? {
                          interval: price.recurring.interval,
                          interval_count: price.recurring.interval_count,
                      }
                    : null,
                active: price.active,
            };
        } catch (error) {
            throw new APIError(
                ErrCode.Internal,
                `Failed to create price: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
);
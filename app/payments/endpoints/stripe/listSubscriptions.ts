import { api, Query } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import { ListSubscriptionsResponse } from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

interface ListSubscriptionsRequest {
    customer_id?: Query<string>;
    limit?: Query<number>;
}

export const listSubscriptions = api(
    { expose: true, method: "GET", path: "/stripe/subscriptions" },
    async (req: ListSubscriptionsRequest = {}): Promise<ListSubscriptionsResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        const subscriptions = await stripe.subscriptions.list({
            customer: req.customer_id,
            limit: req.limit || 100,
            expand: ["data.items.data.price"],
        });

        const formattedSubscriptions = subscriptions.data.map((sub) => {
            const subscription = sub as any;
            return {
                id: sub.id,
                customer: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
                status: sub.status,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
                cancel_at_period_end: sub.cancel_at_period_end,
                canceled_at: sub.canceled_at,
                items: {
                    data: sub.items.data.map((item) => ({
                        price: {
                            id: item.price.id,
                            unit_amount:
                                typeof item.price === "string" ? null : item.price.unit_amount,
                            currency: typeof item.price === "string" ? "" : item.price.currency,
                            recurring:
                                typeof item.price === "string" || !item.price.recurring
                                    ? null
                                    : {
                                        interval: item.price.recurring.interval,
                                    },
                        },
                    })),
                },
                metadata: sub.metadata,
            };
        });

        return { subscriptions: formattedSubscriptions };
    }
);
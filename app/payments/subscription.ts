import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import Stripe from "stripe";
import { stripe } from "../stripe/client";

interface CreateSubscriptionRequest {
    user_id: string;
    price_id: string;
}

interface CreateSubscriptionResponse {
    subscription_id: string;
    status: string;
    client_secret?: string;
}

export const createSubscription = api(
    { expose: true, method: "POST", path: "/subscriptions" },
    async (req: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> => {
        // Get user's stripe_customer_id from database
        const { db: userDb } = await import("../users/database");
        const user = await userDb.queryRow<{ stripe_customer_id: string | null }>`
      SELECT stripe_customer_id FROM users WHERE id = ${req.user_id}
    `;

        if (!user) {
            throw new APIError(ErrCode.NotFound, "User not found");
        }

        if (!user.stripe_customer_id) {
            throw new APIError(
                ErrCode.FailedPrecondition,
                "User does not have a Stripe customer ID"
            );
        }

        try {
            // Create subscription in Stripe
            const subscription = await stripe.subscriptions.create({
                customer: user.stripe_customer_id,
                items: [{ price: req.price_id }],
                payment_behavior: "default_incomplete",
                payment_settings: { save_default_payment_method: "on_subscription" },
                expand: ["latest_invoice.payment_intent"],
            });

            // Get payment intent if available
            const invoice = subscription.latest_invoice as Stripe.Invoice & {
                payment_intent?: Stripe.PaymentIntent | string;
            };
            const paymentIntent =
                invoice?.payment_intent && typeof invoice.payment_intent === "object"
                    ? invoice.payment_intent
                    : null;
            const clientSecret = paymentIntent?.client_secret || undefined;

            return {
                subscription_id: subscription.id,
                status: subscription.status,
                client_secret: clientSecret,
            };
        } catch (error) {
            throw new APIError(
                ErrCode.Internal,
                `Failed to create subscription: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
);


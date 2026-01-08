import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { secret } from "encore.dev/config";
import Stripe from "stripe";
import { createStripeClient } from "@shared/stripe/client";
import { user } from "~encore/clients";

const stripeSecretKey = secret("StripeSecretKey");

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
        const stripe = createStripeClient(stripeSecretKey());

        // Get user's stripe_customer_id via API call to user service
        const userData = await user.getStripeCustomerId({ userId: req.user_id });

        if (!userData.stripe_customer_id) {
            throw new APIError(
                ErrCode.FailedPrecondition,
                "User does not have a Stripe customer ID"
            );
        }

        try {
            // Create subscription in Stripe
            const subscription = await stripe.subscriptions.create({
                customer: userData.stripe_customer_id,
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


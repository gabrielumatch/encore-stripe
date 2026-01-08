import { secret } from "encore.dev/config";
import Stripe from "stripe";

const stripeSecretKey = secret("StripeSecretKey");
const stripeWebhookSecret = secret("StripeWebhookSecret");

export const stripe = new Stripe(stripeSecretKey(), {
    apiVersion: "2025-12-15.clover",
});

export const getWebhookSecret = () => stripeWebhookSecret();


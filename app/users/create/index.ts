import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { db } from "../database/database";
import { createStripeClient } from "../../../shared/stripe/client";

const stripeSecretKey = secret("StripeSecretKey");

interface CreateUserRequest {
    email: string;
    name: string;
}

interface CreateUserResponse {
    id: string;
    email: string;
    name: string;
    stripe_customer_id: string | null;
    created_at: Date;
    updated_at: Date;
}

export const create = api(
    { expose: true, method: "POST", path: "/users" },
    async (req: CreateUserRequest): Promise<CreateUserResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        // Check if user already exists
        const existingUser = await db.queryRow<{ id: string }>`
            SELECT id FROM users WHERE email = ${req.email}
        `;

        if (existingUser) {
            throw new APIError(ErrCode.AlreadyExists, "User with this email already exists");
        }

        // Create customer in Stripe
        let stripeCustomerId: string | null = null;
        try {
            const customer = await stripe.customers.create({
                email: req.email,
                name: req.name,
            });
            stripeCustomerId = customer.id;
        } catch (error) {
            // If Stripe fails, we can still create the user without stripe_customer_id
            // or throw an error - let's throw for now to ensure Stripe integration works
            throw new APIError(
                ErrCode.Internal,
                `Failed to create Stripe customer: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }

        // Insert user into database
        const user = await db.queryRow<CreateUserResponse>`
      INSERT INTO users (email, name, stripe_customer_id)
      VALUES (${req.email}, ${req.name}, ${stripeCustomerId})
      RETURNING id, email, name, stripe_customer_id, created_at, updated_at
    `;

        if (!user) {
            throw new APIError(ErrCode.Internal, "Failed to create user");
        }

        return user;
    }
);


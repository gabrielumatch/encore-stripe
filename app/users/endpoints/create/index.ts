import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { db } from "@users/database/database";
import { payment } from "~encore/clients";
import { User } from "@users/types";

interface CreateUserRequest {
    email: string;
    name: string;
}

export const create = api(
    { expose: true, method: "POST", path: "/users" },
    async (req: CreateUserRequest): Promise<User> => {
        // Check if user already exists
        const existingUser = await db.queryRow<{ id: string }>`
            SELECT id FROM users WHERE email = ${req.email}
        `;

        if (existingUser) {
            throw new APIError(ErrCode.AlreadyExists, "User with this email already exists");
        }

        // Create customer in Stripe via payment service
        let stripeCustomerId: string | null = null;
        try {
            const customerData = await payment.createCustomer({
                email: req.email,
                name: req.name,
            });
            stripeCustomerId = customerData.stripe_customer_id;
        } catch (error) {
            // If Stripe fails, we can still create the user without stripe_customer_id
            // or throw an error - let's throw for now to ensure Stripe integration works
            throw new APIError(
                ErrCode.Internal,
                `Failed to create Stripe customer: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }

        // Insert user into database
        const user = await db.queryRow<User>`
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


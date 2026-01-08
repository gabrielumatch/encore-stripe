import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import { ListCustomersResponse } from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

export const listCustomers = api(
    { expose: true, method: "GET", path: "/stripe/customers" },
    async (): Promise<ListCustomersResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        const customers = await stripe.customers.list({
            limit: 100,
        });

        const formattedCustomers = customers.data.map((customer) => ({
            id: customer.id,
            email: customer.email,
            name: customer.name ?? null,
            phone: customer.phone ?? null,
            created: customer.created,
            metadata: customer.metadata as Record<string, string>,
        }));

        return { customers: formattedCustomers };
    }
);
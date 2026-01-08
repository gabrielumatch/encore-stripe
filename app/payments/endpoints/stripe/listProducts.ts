import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import { ListProductsResponse } from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

export const listProducts = api(
    { expose: true, method: "GET", path: "/stripe/products" },
    async (): Promise<ListProductsResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        const products = await stripe.products.list({
            limit: 100,
        });

        const formattedProducts = products.data.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description,
            active: product.active,
            images: product.images,
            metadata: product.metadata,
        }));

        return { products: formattedProducts };
    }
);
import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import {
    CreateProductRequest,
    CreateProductResponse,
} from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

export const createProduct = api(
    { expose: true, method: "POST", path: "/stripe/products" },
    async (req: CreateProductRequest): Promise<CreateProductResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        try {
            const productParams: any = {
                name: req.name,
                active: req.active ?? true,
            };

            if (req.description) {
                productParams.description = req.description;
            }

            if (req.images && req.images.length > 0) {
                productParams.images = req.images;
            }

            if (req.metadata) {
                productParams.metadata = req.metadata;
            }

            const product = await stripe.products.create(productParams);

            return {
                product_id: product.id,
                name: product.name,
                description: product.description,
                active: product.active,
                images: product.images,
                metadata: product.metadata,
            };
        } catch (error) {
            throw new APIError(
                ErrCode.Internal,
                `Failed to create product: ${error instanceof Error ? error.message : "Unknown error"}`
            );
        }
    }
);
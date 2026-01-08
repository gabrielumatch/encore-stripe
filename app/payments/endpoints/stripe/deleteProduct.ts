import { api } from "encore.dev/api";
import { APIError, ErrCode } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createStripeClient } from "@shared/stripe/client";
import {
    DeleteProductRequest,
    DeleteProductResponse,
} from "@payments/types";

const stripeSecretKey = secret("StripeSecretKey");

const isProductWithPricesError = (error: any): boolean => {
    return (
        error?.code === "resource_already_exists" ||
        error?.message?.includes("has one or more user-created prices")
    );
};

const archiveProduct = async (stripe: any, productId: string): Promise<DeleteProductResponse> => {
    const archivedProduct = await stripe.products.update(productId, {
        active: false,
    });
    return {
        deleted: !archivedProduct.active,
        product_id: archivedProduct.id,
    };
};

const deleteProductDirectly = async (stripe: any, productId: string): Promise<DeleteProductResponse> => {
    const deletedProduct = await stripe.products.del(productId);
    return {
        deleted: deletedProduct.deleted || false,
        product_id: deletedProduct.id,
    };
};

export const deleteProduct = api(
    { expose: true, method: "DELETE", path: "/stripe/products/:product_id" },
    async ({ product_id }: DeleteProductRequest): Promise<DeleteProductResponse> => {
        const stripe = createStripeClient(stripeSecretKey());

        try {
            return await deleteProductDirectly(stripe, product_id);
        } catch (error: any) {
            if (!isProductWithPricesError(error)) {
                throw new APIError(
                    ErrCode.Internal,
                    `Failed to delete product: ${error instanceof Error ? error.message : "Unknown error"}`
                );
            }

            const archivedProduct = await archiveProduct(stripe, product_id);
            return archivedProduct;
        }
    }
);
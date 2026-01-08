import { Query } from "encore.dev/api";

/**
 * Shared types for the payment service
 */

/**
 * WebhookEvent represents a webhook event stored in the database
 * (for API responses - subset of fields from database)
 */
export interface WebhookEvent {
    id: string;
    stripe_event_id: string;
    event_type: string;
    customer_id: string | null;
    subscription_id: string | null;
    amount: number | null;
    currency: string | null;
    subscription_status: string | null;
    created_at: Date;
}

/**
 * Request/Response types for webhook endpoints
 */
export interface ListUserWebhooksRequest {
    userId: string;
}

export interface ListUserWebhooksResponse {
    webhooks: WebhookEvent[];
}

/**
 * Request/Response types for customer endpoints
 */
export interface CreateCustomerRequest {
    email: string;
    name: string;
}

export interface CreateCustomerResponse {
    stripe_customer_id: string;
}

/**
 * Request/Response types for subscription endpoints
 */
export interface CreateSubscriptionRequest {
    user_id: string;
    price_id: string;
}

export interface CreateSubscriptionResponse {
    subscription_id: string;
    status: string;
    client_secret?: string;
}

/**
 * Request/Response types for Stripe list endpoints
 */
export interface ListPricesResponse {
    prices: Array<{
        id: string;
        active: boolean;
        currency: string;
        unit_amount: number | null;
        recurring: {
            interval: string;
            interval_count: number;
        } | null;
        product: string | any;
        metadata: Record<string, string>;
    }>;
}

export interface ListProductsResponse {
    products: Array<{
        id: string;
        name: string;
        description: string | null;
        active: boolean;
        images: string[];
        metadata: Record<string, string>;
    }>;
}

export interface ListSubscriptionsRequest {
    customer_id?: Query<string>;
    limit?: Query<number>;
}

export interface ListSubscriptionsResponse {
    subscriptions: Array<{
        id: string;
        customer: string;
        status: string;
        current_period_start: number;
        current_period_end: number;
        cancel_at_period_end: boolean;
        canceled_at: number | null;
        items: {
            data: Array<{
                price: {
                    id: string;
                    unit_amount: number | null;
                    currency: string;
                    recurring: {
                        interval: string;
                    } | null;
                };
            }>;
        };
        metadata: Record<string, string>;
    }>;
}

export interface ListCustomersResponse {
    customers: Array<{
        id: string;
        email: string | null;
        name: string | null;
        phone: string | null;
        created: number;
        metadata: Record<string, string>;
    }>;
}

/**
 * Request/Response types for creating Stripe resources
 */
export interface CreateProductRequest {
    name: string;
    description?: string;
    images?: string[];
    metadata?: Record<string, string>;
    active?: boolean;
}

export interface CreateProductResponse {
    product_id: string;
    name: string;
    description: string | null;
    active: boolean;
    images: string[];
    metadata: Record<string, string>;
}

export interface CreatePriceRequest {
    product_id: string;
    unit_amount: number; // Amount in cents
    currency: string; // e.g., "usd", "brl"
    recurring?: {
        interval: "day" | "week" | "month" | "year";
        interval_count?: number;
    };
    active?: boolean;
    metadata?: Record<string, string>;
}

export interface CreatePriceResponse {
    price_id: string;
    product_id: string;
    unit_amount: number;
    currency: string;
    recurring: {
        interval: string;
        interval_count: number;
    } | null;
    active: boolean;
}

/**
 * Request/Response types for deleting Stripe resources
 */
export interface DeleteProductRequest {
    product_id: string;
}

export interface DeleteProductResponse {
    deleted: boolean;
    product_id: string;
}

export interface DeletePriceRequest {
    price_id: string;
}

export interface DeletePriceResponse {
    deleted: boolean;
    price_id: string;
    active: boolean;
}

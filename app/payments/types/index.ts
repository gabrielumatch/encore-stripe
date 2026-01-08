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

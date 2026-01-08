/**
 * Shared types for the user service
 */

export interface User {
    id: string;
    email: string;
    name: string;
    stripe_customer_id: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface Subscription {
    id: string;
    user_id: string;
    stripe_subscription_id: string;
    stripe_customer_id: string;
    status: string;
    plan_id: string | null;
    amount: number | null;
    currency: string | null;
    interval: string | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    canceled_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

/**
 * Request/Response types for user endpoints
 */
export interface CreateUserRequest {
    email: string;
    name: string;
}

export interface GetUserRequest {
    userId: string;
}

export interface GetUserResponse {
    user: User;
    subscription: Subscription | null;
}

export interface ListUsersResponse {
    users: User[];
}

export interface GetStripeCustomerIdRequest {
    userId: string;
}

export interface GetStripeCustomerIdResponse {
    stripe_customer_id: string | null;
}

export interface GetUserWebhooksRequest {
    userId: string;
}

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

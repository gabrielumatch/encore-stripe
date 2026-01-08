CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL,
    plan_id TEXT,
    -- Subscription pricing details (amount in cents/smallest currency unit)
    amount BIGINT,
    currency TEXT,
    interval TEXT, -- 'month', 'year', etc
    -- Subscription period
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    -- Cancellation info
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);


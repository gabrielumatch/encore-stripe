CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    api_version TEXT, -- Stripe API version used
    livemode BOOLEAN, -- true for live mode, false for test
    -- Event object IDs (extracted for quick queries)
    customer_id TEXT,
    subscription_id TEXT,
    invoice_id TEXT,
    payment_intent_id TEXT,
    charge_id TEXT,
    user_id UUID, -- Our internal user ID (linked after processing)
    -- Transaction/Subscription details (amount in cents/smallest currency unit)
    amount BIGINT,
    currency TEXT,
    subscription_status TEXT,
    plan_id TEXT,
    subscription_interval TEXT, -- 'month', 'year', etc
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    -- Full payload JSONB - contains COMPLETE webhook data from Stripe
    -- This stores EVERYTHING Stripe sends: event object, data.object, metadata, etc
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_events_customer_id ON webhook_events(customer_id);
CREATE INDEX idx_webhook_events_subscription_id ON webhook_events(subscription_id);
CREATE INDEX idx_webhook_events_invoice_id ON webhook_events(invoice_id);
CREATE INDEX idx_webhook_events_payment_intent_id ON webhook_events(payment_intent_id);
CREATE INDEX idx_webhook_events_charge_id ON webhook_events(charge_id);
CREATE INDEX idx_webhook_events_user_id ON webhook_events(user_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_subscription_status ON webhook_events(subscription_status);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);
-- GIN index for fast JSONB queries on the full payload
CREATE INDEX idx_webhook_events_payload_gin ON webhook_events USING GIN (payload);


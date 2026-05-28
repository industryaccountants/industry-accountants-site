// stripe-webhook.js
// Handles Stripe payment events
// Required env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const adminSb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    switch (stripeEvent.type) {
      case 'invoice.paid': {
        const invoice = stripeEvent.data.object;
        const { client_id, service_type } = invoice.metadata || {};

        await adminSb.from('invoices')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('stripe_invoice_id', invoice.id);

        if (client_id) {
          await adminSb.from('payments').insert({
            client_id, stripe_invoice_id: invoice.id,
            stripe_payment_intent_id: invoice.payment_intent,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
            service_type, status: 'paid',
            paid_at: new Date().toISOString()
          });

          await adminSb.from('clients')
            .update({ payment_status: 'paid', service_active: true })
            .eq('id', client_id);

          await adminSb.from('status_updates').insert({
            client_id,
            step: 'payment_received',
            message: 'Payment received. Your file is now active and your accountant will begin work shortly.',
            is_visible_to_client: true
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        await adminSb.from('invoices').update({ status: 'payment_failed' }).eq('stripe_invoice_id', invoice.id);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const { client_id } = sub.metadata || {};
        if (client_id) {
          await adminSb.from('clients').update({ subscription_status: 'cancelled', service_active: false }).eq('id', client_id);
        }
        break;
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

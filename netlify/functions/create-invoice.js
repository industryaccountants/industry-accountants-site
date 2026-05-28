// create-invoice.js
// Creates and sends Stripe invoices
// Required env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { client_id, client_email, service_type, line_items, due_days = 7, notes, admin_jwt } = JSON.parse(event.body || '{}');

    if (!client_id || !line_items?.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Verify admin
    const adminSb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const anonSb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${admin_jwt}` } } });

    const { data: { user } } = await anonSb.auth.getUser();
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    const { data: adminUser } = await adminSb.from('admin_users').select('role').eq('user_id', user.id).single();
    if (!adminUser) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not an admin' }) };

    // Get or create Stripe customer
    const { data: clientRec } = await adminSb.from('clients')
      .select('stripe_customer_id, email, full_name').eq('id', client_id).single();

    let customer;
    if (clientRec?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(clientRec.stripe_customer_id);
    } else {
      customer = await stripe.customers.create({
        email: client_email || clientRec?.email,
        name: clientRec?.full_name,
        metadata: { client_id }
      });
      await adminSb.from('clients').update({ stripe_customer_id: customer.id }).eq('id', client_id);
    }

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: due_days,
      description: notes || `${service_type} — The Industry Accountants`,
      metadata: { client_id, service_type }
    });

    // Add line items
    for (const item of line_items) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        description: item.description,
        amount: Math.round(item.amount * 100),
        currency: item.currency || 'usd',
      });
    }

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    const total = line_items.reduce((s, i) => s + i.amount, 0);

    await adminSb.from('invoices').insert({
      client_id,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customer.id,
      amount_total: total,
      currency: line_items[0]?.currency || 'usd',
      service_type,
      status: 'sent',
      due_date: new Date(Date.now() + due_days * 86400000).toISOString(),
      notes,
      created_by: user.id,
      invoice_url: finalized.hosted_invoice_url
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, invoice_id: invoice.id, invoice_url: finalized.hosted_invoice_url, amount_total: total })
    };

  } catch (err) {
    console.error('create-invoice error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

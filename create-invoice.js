// netlify/functions/create-invoice.js
// Creates a Stripe invoice and sends it to the client
// Required env vars: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

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
    const {
      client_id, client_name, client_email, service_type,
      line_items, due_days = 7, notes, admin_jwt
    } = JSON.parse(event.body);

    // Verify admin JWT
    const adminSb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const anonSb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${admin_jwt}` } } });

    const { data: { user } } = await anonSb.auth.getUser();
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    // Verify admin role
    const { data: adminUser } = await adminSb
      .from('admin_users').select('role').eq('user_id', user.id).single();
    if (!adminUser) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Not an admin' }) };

    // Find or create Stripe customer
    let customer;
    const { data: clientRec } = await adminSb
      .from('clients').select('stripe_customer_id, email, full_name')
      .eq('id', client_id).single();

    if (clientRec?.stripe_customer_id) {
      customer = await stripe.customers.retrieve(clientRec.stripe_customer_id);
    } else {
      customer = await stripe.customers.create({
        email: client_email || clientRec?.email,
        name: client_name || clientRec?.full_name,
        metadata: { client_id, supabase_url: process.env.SUPABASE_URL }
      });
      // Save customer ID
      await adminSb.from('clients').update({ stripe_customer_id: customer.id }).eq('id', client_id);
    }

    // Create invoice
    const invoice = await stripe.invoices.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: due_days,
      description: notes || `${service_type} — The Industry Accountants`,
      metadata: { client_id, service_type, created_by: user.id }
    });

    // Add line items
    for (const item of line_items) {
      await stripe.invoiceItems.create({
        customer: customer.id,
        invoice: invoice.id,
        description: item.description,
        amount: Math.round(item.amount * 100), // convert to cents
        currency: item.currency || 'usd',
      });
    }

    // Finalize and send
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    // Save invoice record to Supabase
    await adminSb.from('invoices').insert({
      client_id,
      stripe_invoice_id: invoice.id,
      stripe_customer_id: customer.id,
      amount_total: line_items.reduce((sum, i) => sum + i.amount, 0),
      currency: line_items[0]?.currency || 'usd',
      service_type,
      status: 'sent',
      due_date: new Date(Date.now() + due_days * 86400000).toISOString(),
      notes,
      created_by: user.id,
      invoice_url: finalizedInvoice.hosted_invoice_url
    });

    // Log action
    await adminSb.from('audit_log').insert({
      user_id: user.id, client_id,
      action: 'create_invoice',
      success: true,
      details: { amount: line_items.reduce((s, i) => s + i.amount, 0), service_type }
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        invoice_url: finalizedInvoice.hosted_invoice_url,
        amount_total: line_items.reduce((s, i) => s + i.amount, 0)
      })
    };

  } catch (err) {
    console.error('create-invoice error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

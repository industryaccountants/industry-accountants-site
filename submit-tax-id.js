// submit-tax-id.js
// Encrypts and stores SSN/SIN server-side using AES-256-CBC (Node crypto) with pgcrypto RPC as primary
// Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, ENCRYPTION_KEY

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// AES-256-CBC encryption — ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars or 32 ASCII chars)
function aesEncrypt(plaintext, keyStr) {
  // Derive a 32-byte key via SHA-256 so any key length works safely
  const key = crypto.createHash('sha256').update(keyStr).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  // Store as iv:ciphertext in hex, prefixed so we know it's our format
  return 'AES:' + iv.toString('hex') + ':' + encrypted.toString('hex');
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const body = JSON.parse(event.body || '{}');
    const { tax_id, tax_id_type, client_id, jwt } = body;

    if (!tax_id || !tax_id_type || !client_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const cleanId = tax_id.replace(/[\s\-]/g, '');

    // Validate format
    if (!/^\d{9}$/.test(cleanId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Invalid ${tax_id_type} format — must be 9 digits` }) };
    }

    // Verify JWT if provided
    const adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let userId = null;
    if (jwt) {
      const anonClient = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${jwt}` } } }
      );
      const { data: { user } } = await anonClient.auth.getUser();
      userId = user?.id;
    }

    // Verify client belongs to user (skip if no JWT — client just signed up)
    if (userId) {
      const { data: clientRec } = await adminClient
        .from('clients').select('id').eq('id', client_id).eq('user_id', userId).single();
      if (!clientRec) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };
      }
    } else {
      // No JWT — verify client_id exists at minimum
      const { data: clientRec } = await adminClient
        .from('clients').select('id').eq('id', client_id).single();
      if (!clientRec) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Client not found' }) };
      }
    }

    // Check not already submitted
    const { data: existing } = await adminClient
      .from('sensitive_data').select('id, is_submitted').eq('client_id', client_id).single();
    if (existing?.is_submitted && tax_id_type !== 'EIN') {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Already submitted', last4: cleanId.slice(-4) }) };
    }

    const last4 = cleanId.slice(-4);
    const encKey = process.env.ENCRYPTION_KEY;

    // Encrypt using pgcrypto via RPC (primary), fall back to AES-256-CBC (secure)
    let encryptedId = null;
    try {
      const { data: encResult, error: rpcErr } = await adminClient.rpc('encrypt_tax_id', {
        plaintext: cleanId,
        enc_key: encKey
      });
      if (rpcErr || !encResult) throw new Error(rpcErr?.message || 'empty result');
      encryptedId = encResult;
    } catch(e) {
      // Secure fallback: AES-256-CBC via Node crypto (NOT plain Base64)
      console.warn('pgcrypto RPC unavailable, using AES-256-CBC fallback:', e.message);
      encryptedId = aesEncrypt(cleanId, encKey);
    }

    // Save to sensitive_data
    const upsertData = {
      client_id,
      is_submitted: true,
      tax_id_submitted_at: new Date().toISOString()
    };

    if (tax_id_type === 'EIN') {
      upsertData.ein_encrypted = encryptedId;
      upsertData.ein_last4 = last4;
    } else {
      upsertData.tax_id_encrypted = encryptedId;
      upsertData.tax_id_type = tax_id_type;
      upsertData.tax_id_last4 = last4;
    }

    const { error: upsertErr } = await adminClient.from('sensitive_data').upsert(upsertData);
    if (upsertErr) throw new Error('Storage error: ' + upsertErr.message);

    // Audit log
    await adminClient.from('audit_log').insert({
      user_id: userId,
      client_id,
      action: `submit_${tax_id_type.toLowerCase()}`,
      success: true,
      details: { tax_id_type, last4 }
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ success: true, message: `${tax_id_type} secured. Last 4: ${last4}`, last4 })
    };

  } catch (err) {
    console.error('submit-tax-id error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

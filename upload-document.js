// netlify/functions/upload-document.js
// Generates a signed Supabase Storage upload URL server-side
// Client uploads directly to Supabase Storage — file never passes through Netlify

const { createClient } = require('@supabase/supabase-js');

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
    const { file_name, file_type, file_size, document_type, tax_year, client_id, jwt } = JSON.parse(event.body);

    // Verify JWT
    const anonClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file_type)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'File type not allowed. Use PDF, JPG, PNG, or Word.' }) };
    }

    // Max 25MB
    if (file_size > 25 * 1024 * 1024) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'File too large. Max 25MB.' }) };
    }

    const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Verify client belongs to user
    const { data: clientRecord } = await adminClient
      .from('clients').select('id').eq('id', client_id).eq('user_id', user.id).single();
    if (!clientRecord) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Forbidden' }) };

    // Build secure file path: userId/clientId/timestamp_filename
    const timestamp = Date.now();
    const safeName = file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `${user.id}/${client_id}/${timestamp}_${safeName}`;

    // Create signed upload URL (expires in 5 minutes)
    const { data: signedUrl, error: urlError } = await adminClient.storage
      .from('client-documents')
      .createSignedUploadUrl(filePath);

    if (urlError) throw urlError;

    // Pre-register document in DB
    const { data: doc, error: docError } = await adminClient.from('documents').insert({
      client_id,
      file_name,
      file_path: filePath,
      file_size,
      file_type,
      document_type: document_type || 'other',
      tax_year: tax_year || new Date().getFullYear(),
      status: 'received'
    }).select().single();

    if (docError) throw docError;

    // Audit log
    await adminClient.from('audit_log').insert({
      user_id: user.id,
      client_id,
      action: 'upload_document',
      success: true,
      details: { file_name, document_type, file_size }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        signed_url: signedUrl.signedUrl,
        token: signedUrl.token,
        file_path: filePath,
        document_id: doc.id
      })
    };

  } catch (err) {
    console.error('upload-document error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) };
  }
};

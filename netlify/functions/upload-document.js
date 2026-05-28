// upload-document.js
// Generates signed Supabase Storage upload URLs
// Required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY

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
    const { file_name, file_type, file_size, document_type, tax_year, client_id, jwt } = JSON.parse(event.body || '{}');

    if (!file_name || !client_id) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Verify JWT
    const anonClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${jwt}` } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (file_type && !allowedTypes.includes(file_type)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'File type not allowed' }) };
    }

    if (file_size > 25 * 1024 * 1024) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'File too large (max 25MB)' }) };
    }

    const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const timestamp = Date.now();
    const safeName = file_name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const filePath = `${user.id}/${client_id}/${timestamp}_${safeName}`;

    const { data: signedUrl, error: urlError } = await adminClient.storage
      .from('client-documents').createSignedUploadUrl(filePath);
    if (urlError) throw new Error(urlError.message);

    const { data: doc, error: docError } = await adminClient.from('documents').insert({
      client_id,
      file_name,
      file_path: filePath,
      file_size: file_size || 0,
      file_type: file_type || 'application/octet-stream',
      document_type: document_type || 'other',
      tax_year: tax_year || new Date().getFullYear(),
      status: 'received'
    }).select().single();

    if (docError) throw new Error(docError.message);

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ signed_url: signedUrl.signedUrl, token: signedUrl.token, file_path: filePath, document_id: doc.id })
    };

  } catch (err) {
    console.error('upload-document error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

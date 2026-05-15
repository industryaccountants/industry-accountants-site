# The Industry Accountants — Portal Setup Guide
# Complete step-by-step instructions to go live

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Files in this folder:
  index.html          ← The portal (login + client dashboard)
  css/portal.css      ← All styles
  js/config.js        ← YOUR KEYS GO HERE (Step 1)
  js/portal.js        ← All logic (don't need to edit this)
  SETUP.md            ← This file

Total time to go live: ~30–45 minutes
Cost: $0/month (Supabase free tier handles up to 500 users)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 1 — CREATE YOUR SUPABASE PROJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://supabase.com
2. Click "Start your project" → sign up with GitHub or email
3. Click "New Project"
4. Fill in:
   - Organization: your name or "Industry Accountants"
   - Project name: industry-portal
   - Database password: create a strong one and SAVE IT
   - Region: pick the closest to you (US East or US West)
5. Click "Create new project"
6. Wait about 2 minutes for it to spin up

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 2 — GET YOUR API KEYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. In your Supabase project, click "Project Settings" (gear icon, bottom left)
2. Click "API" in the left menu
3. You'll see two values you need:

   Project URL:      looks like https://xxxxx.supabase.co
   anon public key:  a long string starting with "eyJ..."

4. Open js/config.js in a text editor
5. Replace:
   PASTE_YOUR_PROJECT_URL_HERE  → your Project URL
   PASTE_YOUR_ANON_KEY_HERE     → your anon public key
6. Save the file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 3 — SET UP THE DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. In Supabase, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Copy and paste the ENTIRE block below, then click "Run":

-------- COPY FROM HERE --------

-- Profiles table (one row per client)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  service TEXT,
  status TEXT DEFAULT 'pending',
  partner_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security: clients can only see their own data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id);

CREATE POLICY "Users see own messages"
  ON messages FOR ALL
  USING (auth.uid() = user_id);

-- Allow new users to insert their profile on signup
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-------- COPY TO HERE --------

4. You should see "Success. No rows returned" — that means it worked.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 4 — SET UP FILE STORAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. In Supabase, click "Storage" in the left sidebar
2. Click "New bucket"
3. Name it exactly: client-docs
4. Toggle "Private bucket" ON (very important for security)
5. Click "Save"

Now add the security policy:
6. Click on the "client-docs" bucket
7. Click "Policies" tab
8. Click "New policy" → "For full customization"
9. Name: "Clients manage own files"
10. For "Allowed operations" check: SELECT, INSERT, DELETE
11. In the "Policy definition" box, paste:

   auth.uid()::text = (storage.foldername(name))[1]

12. Click "Review" then "Save policy"

This means each client can only see files in their own folder. 
You as the admin can see everything from the Supabase dashboard.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 5 — ENABLE EMAIL AUTH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. In Supabase, go to "Authentication" → "Providers"
2. Email should already be enabled — confirm it is
3. Go to "Authentication" → "Email Templates"
4. Update the "Confirm signup" template to say something like:
   "Welcome to The Industry Accountants Client Portal — 
    click below to confirm your email and access your account."
5. Under Authentication → URL Configuration, set:
   Site URL: your website URL (or http://localhost for testing)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 6 — TEST IT LOCALLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option A — Easiest: just open index.html in your browser.
  Double-click index.html → it opens in Chrome/Safari/Firefox.
  Create a test account, upload a file, check it works.

Option B — If Option A doesn't work:
  Install VS Code → install the "Live Server" extension
  → right-click index.html → "Open with Live Server"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 7 — PUT IT LIVE (FREE HOSTING)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Option A — Netlify (easiest, free, custom domain supported):
1. Go to https://netlify.com → sign up free
2. Drag and drop your entire industry-portal folder onto the Netlify dashboard
3. It gives you a URL like: https://amazing-name-123.netlify.app
4. Go to "Domain settings" to connect your own domain
   e.g. portal.theindustryaccountants.com

Option B — GitHub Pages (also free):
1. Create a free GitHub account at github.com
2. Create a new repository called "industry-portal"
3. Upload all your files
4. Go to Settings → Pages → Deploy from main branch
5. Your URL: https://yourusername.github.io/industry-portal

Recommendation: Use Netlify. Drag and drop, done in 5 minutes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 8 — CONNECT PORTAL TO YOUR WEBFLOW SITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. In Webflow, find your "Portal Login" button
2. Change the link to point to your Netlify URL
   e.g. https://portal.theindustryaccountants.com
3. Do the same for "File My Taxes" → point to the portal
4. That's it — your Webflow site stays as-is, 
   portal lives at a subdomain you control

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## HOW TO SEE YOUR CLIENTS' SUBMISSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All data lives in your Supabase dashboard:

- Clients → Authentication → Users (see all accounts)
- Profiles → Table Editor → profiles (see service, status)
- Documents → Storage → client-docs (download any file)
- Messages → Table Editor → messages

To update a client's status (e.g. mark as "under review"):
1. Go to Table Editor → profiles
2. Find the client row
3. Click their "status" cell
4. Change to: pending / intake_submitted / docs_received / under_review / complete
5. The client will see the updated timeline next time they log in

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## MONTHLY COSTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Supabase free tier:         $0  (up to 500 users, 1GB storage)
Netlify free tier:          $0  (100GB bandwidth/month)
Custom domain (optional):  ~$12/year
─────────────────────────────────────────
Total:                      $0–1/month

You own all the code, all the data, all the IP.
No vendor lock-in. You can move it anywhere.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## WHAT'S NEXT (Phase 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When you're ready, ask Claude to add:
- [ ] Admin dashboard (see all clients, update statuses)
- [ ] Partner portal (white-label subdomains)
- [ ] Stripe billing (invoice clients directly)
- [ ] E-signatures via DocuSeal
- [ ] Automated email notifications via Resend
- [ ] Mobile app wrapper via Capacitor (iOS + Android)

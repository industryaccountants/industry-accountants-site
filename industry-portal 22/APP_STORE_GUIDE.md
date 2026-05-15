# The Industry Accountants — App Store Guide
# How to publish to Apple App Store & Google Play

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## WHAT'S ALREADY DONE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ PWA (Progressive Web App) — built into your site
   Clients on iPhone/Android can already "Add to Home Screen"
   from Safari/Chrome and get an app-like experience

✅ App icons — all sizes generated (72px to 512px)
✅ Service worker — offline support enabled
✅ Web manifest — app metadata configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 1 — PREREQUISITES (One-time setup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You need:
- A Mac computer (required for iOS builds)
- Node.js installed (nodejs.org — download LTS version)
- Xcode installed (Mac App Store — free, needed for iOS)
- Android Studio installed (developer.android.com — free)

Cost:
- Apple Developer Program: $99/year → developer.apple.com/programs
- Google Play Console: $25 one-time → play.google.com/console

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 2 — INSTALL CAPACITOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Open Terminal on your Mac and run these commands:

# Create a new Capacitor project
mkdir tia-app && cd tia-app
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android

# Initialize Capacitor
npx cap init "The Industry Accountants" "com.theindustryaccountants.portal" --web-dir=www

# Create www folder and copy your site files into it
mkdir www
# Copy all files from your industry-portal folder into www/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 3 — CONFIGURE capacitor.config.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create/edit capacitor.config.json with:

{
  "appId": "com.theindustryaccountants.portal",
  "appName": "The Industry Accountants",
  "webDir": "www",
  "server": {
    "url": "https://theindustryaccountants.com",
    "cleartext": false
  },
  "ios": {
    "contentInset": "always"
  },
  "android": {
    "allowMixedContent": false
  }
}

Note: Using server.url means the app loads your live website
so updates deploy automatically — no app store resubmission needed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 4 — ADD iOS AND ANDROID PLATFORMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

npx cap add ios
npx cap add android

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 5 — OPEN AND BUILD IN XCODE (iOS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

npx cap open ios

In Xcode:
1. Select your project in the left panel
2. Go to "Signing & Capabilities"
3. Select your Apple Developer Team
4. Set Bundle Identifier: com.theindustryaccountants.portal
5. Add your app icons (use the icons/ folder we generated)
6. Product → Archive
7. Window → Organizer → Distribute App → App Store Connect
8. Follow the upload wizard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 6 — OPEN AND BUILD IN ANDROID STUDIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

npx cap open android

In Android Studio:
1. Build → Generate Signed Bundle/APK
2. Choose "Android App Bundle"
3. Create a new keystore (save this file safely — you need it forever)
4. Build the release bundle
5. Upload the .aab file to Google Play Console

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 7 — APP STORE LISTING DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use these for both stores:

App Name: The Industry Accountants
Subtitle: Tax, Payroll & Bookkeeping

Description:
The Industry Accountants is a premium digital accounting
firm offering tax filing, bookkeeping, payroll setup, and
business consulting — 100% electronic, 100% paperless.

• Secure client portal with document upload
• Real-time filing status tracking
• Direct messaging with your accountant
• Free financial tools (payroll calculator, tax estimator)
• 48-hour turnaround on all services

Category: Finance
Age Rating: 4+
Price: Free

Keywords: tax filing, accountant, bookkeeping, payroll,
tax return, small business, CPA, accounting app

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## STEP 8 — SCREENSHOTS NEEDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apple requires screenshots for:
- iPhone 6.9" (1320 x 2868)
- iPhone 6.5" (1284 x 2778)
- iPad 13" (2064 x 2752)

Take screenshots of:
1. Login screen
2. Client dashboard
3. Document upload
4. Status tracking
5. Free tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Day 1: Install tools, set up Capacitor (2-3 hours)
Day 2: Build iOS and Android files (1-2 hours)
Day 3: Submit to both stores
Day 4-10: Wait for Apple review (Google usually 2-3 days)
Day 10+: Both apps live in stores! 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## IMPORTANT NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Save your Android keystore file somewhere safe — losing
  it means you can never update your Android app
- Apple review can take 1-7 days — be patient
- Once approved, site updates go live automatically
  since the app loads from theindustryaccountants.com
- Ask Claude for help at any step!

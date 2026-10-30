# Pranika Rocks — Staff Attendance Website

A responsive staff attendance portal with:
- Admin dashboard and staff overview
- Staff email/password sign-in and self-registration
- QR-based check-in and check-out
- Admin manual check-in/check-out
- Daily totals and monthly attendance history
- CSV export for spreadsheet reporting
- Supabase database with Row Level Security policies

## 1. Create the free database
1. Open https://supabase.com/ and create a free project.
2. In **Project Settings → API**, copy the **Project URL** and **anon/public key**.
3. Open `config.js` and replace the two placeholder values. Never use the `service_role` key in a website.
4. In Supabase, open **SQL Editor → New query**, paste all of `supabase.sql`, and run it.

## 2. Create the admin account
1. Open the website after deploying it (or run it locally; see below).
2. Choose **Staff registration** and create your own account using an email you control.
3. Confirm your email if Supabase asks you to.
4. In Supabase → SQL Editor, run this command after replacing the email:
   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'your-email@example.com';
   ```
5. Sign out and sign in again. Your dashboard should now show the Admin workspace.

## 3. Add staff
Staff can register from the **Staff registration** tab. New registrations receive the `staff` role automatically. The admin can see their names and email addresses in Staff members. For a small team, share the website URL and ask each staff member to register with their own email.

In Supabase → Authentication → URL Configuration, set your deployed website URL as the Site URL. Add the same URL to Redirect URLs. For email confirmation, staff must confirm their email before signing in (depending on your Supabase Auth settings).

## 4. Deploy free with GitHub Pages
1. Create a GitHub repository, e.g. `pranika-rocks-attendance`.
2. Upload all project files (`index.html`, `styles.css`, `app.js`, `config.js`, `supabase.sql`, `README.md`).
3. In the repository, open **Settings → Pages**.
4. Choose **Deploy from a branch**, select `main` and `/ (root)`, then Save.
5. Wait for GitHub Pages to publish. Your website URL will look like `https://YOUR-USERNAME.github.io/pranika-rocks-attendance/`.
6. In Supabase URL Configuration, set that URL as Site URL and add it to Redirect URLs.

You can also deploy the folder with Netlify or Cloudflare Pages. Use HTTPS because camera access for QR scanning requires a secure context.

## 5. Run locally for testing
Because the project uses JavaScript modules, serve it through a local web server rather than opening `index.html` as a file. For example, with Python installed:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

## Important notes
- The website uses India local date (`Asia/Kolkata`) for database work dates and the browser's local time for displayed check-in/check-out times. Ensure staff devices have automatic date/time enabled.
- QR codes are generated for the current date and replaced when the admin generates a new one. Keep the QR display private to your workplace. Anyone who can photograph the current QR may be able to share it; this starter project does not verify GPS or device identity.
- Supabase free-tier limits and policies can change. Free hosting does not mean unlimited usage.
- The admin manually marks attendance on behalf of a staff member using the admin account.
- Back up attendance data periodically from the Supabase dashboard.


## Version 2.0: GPS geofence and live selfie
1. Set `WORKPLACE_LATITUDE`, `WORKPLACE_LONGITUDE` and `GEOFENCE_RADIUS_METERS` in `config.js`. Use the workplace pin coordinates from Google Maps. The default radius is 150 metres.
2. Staff must allow location and camera permissions. QR attendance is blocked when GPS is outside the configured radius or unavailable.
3. After QR scan, staff capture a fresh selfie. This starter build does not upload or retain the selfie; it records the capture in the attendance note and saves GPS coordinates in that note.
4. Run the migration statements at the bottom of `supabase.sql` if the database already exists.

### Phone Face ID / fingerprint
A website cannot directly demand Face ID or read biometric data. The browser standard is WebAuthn/passkeys; the device may use Face ID, fingerprint or screen lock. Secure passkey authentication requires server-side challenge and cryptographic assertion verification. It is deliberately not faked or enabled in this static starter project (`PASSKEYS_ENABLED=false`). A verified WebAuthn backend must be added before using device biometrics as an attendance security check.

### Privacy and reliability
- Inform staff about GPS and camera use, purpose, access, and retention; obtain appropriate consent and provide a suitable alternative where required.
- GPS can be inaccurate or spoofed; geofencing is not proof of physical presence.
- Treat saved location data as sensitive and restrict admin access.
- The selfie is not stored in this build. Do not store facial templates or add automated face recognition without legal, security and privacy review.


### Workplace GPS location
The project is preconfigured with the Google Maps pin coordinates `16.725389, 81.111093` and a 150-metre geofence radius. Confirm the pin is at the intended staff check-in point before using GPS attendance.

// Supabase connection. Never place a service_role key in browser code.
export const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_PUBLIC_KEY";

// Set these to your workplace pin coordinates from Google Maps.
export const WORKPLACE_LATITUDE = 16.725389;
export const WORKPLACE_LONGITUDE = 81.111093;
export const GEOFENCE_RADIUS_METERS = 150;

// Passkeys require a verified server-side WebAuthn implementation.
export const PASSKEYS_ENABLED = false;

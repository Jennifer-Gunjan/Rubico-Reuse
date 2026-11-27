// Photos live in the Supabase Storage bucket, so next/image must be told that host is allowed.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

/**
 * The live site sent only Strict-Transport-Security. These are the rest of the baseline.
 *
 * The site renders text colleagues wrote and is publicly readable by design, so the gap was
 * worth closing: without frame-ancestors it can be framed and a signed-in colleague tricked
 * into clicking Accept; without nosniff a response can be treated as a type it is not; and
 * without a referrer policy, listing URLs travel to whatever a listing links to.
 *
 * No XSS was found - React escapes what it interpolates - so this is hardening rather than a
 * patched hole.
 */
const securityHeaders = [
  // Clickjacking. frame-ancestors is the modern form; X-Frame-Options is kept for old browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin to other sites, the full URL within our own: enough for analytics, and
  // a listing id never reaches a third party.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app asks for none of these, so deny them rather than leave them to the default.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

/**
 * Report-Only on purpose. Next.js injects inline bootstrap scripts, so an enforcing policy
 * needs per-request nonces; shipping one blind would break the app for everyone. This
 * reports violations without blocking, so the real policy can be written from evidence.
 * Promote to Content-Security-Policy once the reports are quiet.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  supabase ? `img-src 'self' data: blob: ${supabase.origin}` : "img-src 'self' data: blob:",
  "font-src 'self' data:",
  supabase ? `connect-src 'self' ${supabase.origin}` : "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabase
      ? [{ protocol: supabase.protocol.replace(":", ""), hostname: supabase.hostname, port: supabase.port, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [...securityHeaders, { key: "Content-Security-Policy-Report-Only", value: csp }],
    }];
  },
};

export default config;

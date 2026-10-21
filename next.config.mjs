// Photos live in the Supabase Storage bucket, so next/image must be told that host is allowed.
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabase
      ? [{ protocol: supabase.protocol.replace(":", ""), hostname: supabase.hostname, port: supabase.port, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default config;

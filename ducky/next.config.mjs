/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Native SVG renderer for the visual checks; keep it out of the webpack bundle.
  serverExternalPackages: ["@resvg/resvg-js"],
  // The font resvg renders captions with (lib/server/visual.ts) must ship with the route.
  outputFileTracingIncludes: {
    "/api/visual": ["./node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf"],
  },
};
export default nextConfig;

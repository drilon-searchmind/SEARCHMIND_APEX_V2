/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    domains: [
      "lh3.googleusercontent.com",
      "attachments.clickup.com",
      "cdn.shopify.com"
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ca.slack-edge.com',
        port: '',
        pathname: '/**'
      }
    ]
  }
};

export default nextConfig;

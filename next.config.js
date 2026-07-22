/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/dashboard/:customerId/performance-dashboard",
        destination: "/dashboard/:customerId/home?page_id=overview",
        permanent: false,
      },
      {
        source: "/dashboard/:customerId/daily-overview",
        destination: "/dashboard/:customerId/home?page_id=daily",
        permanent: false,
      },
      {
        source: "/dashboard/:customerId/markets-overview",
        destination: "/dashboard/:customerId/home?page_id=markets",
        permanent: false,
      },
      {
        source: "/dashboard/:customerId/tools/pace-report",
        destination: "/dashboard/:customerId/home?page_id=pace-report",
        permanent: false,
      },
      {
        source: "/dashboard/:customerId/tools/pnl",
        destination: "/dashboard/:customerId/home?page_id=pnl",
        permanent: false,
      },
      {
        source: "/dashboard/:customerId/ecommerce",
        destination: "/dashboard/:customerId/home?page_id=ecommerce",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ca.slack-edge.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "attachments.clickup.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

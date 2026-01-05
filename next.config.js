/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
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

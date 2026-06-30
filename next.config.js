/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfkit relies on Node's filesystem/font files, so keep it external to the
    // server bundle rather than letting Next/webpack try to bundle it.
    serverComponentsExternalPackages: ["pdfkit", "resend"],
  },
};

module.exports = nextConfig;

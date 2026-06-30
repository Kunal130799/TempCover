/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfkit relies on Node's filesystem/font files, so keep it external to the
    // server bundle rather than letting Next/webpack try to bundle it.
    serverComponentsExternalPackages: ["pdfkit", "resend"],
    // pdfkit loads its standard font metrics (.afm) from disk at runtime via a
    // dynamic require that Next's tracer can't follow. On Vercel that means the
    // font files are missing from the serverless bundle and PDF generation
    // crashes with `ENOENT … Helvetica.afm`. Force them to be included for the
    // routes that render certificates.
    outputFileTracingIncludes: {
      "/success": ["./node_modules/pdfkit/js/data/**/*"],
      "/api/certificate": ["./node_modules/pdfkit/js/data/**/*"],
    },
  },
};

module.exports = nextConfig;

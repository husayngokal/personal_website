/** @type {import('next').NextConfig} */
const nextConfig = {
  // The site is built to outlast cultural moments. React strict mode catches
  // sloppy effects early; this stays on through the site's life.
  reactStrictMode: true,
  // Images are mostly local SVG marks and one portrait. No remote patterns
  // until the Obsidian image-sync pipeline is wired (see BRIEF.md Part XII).
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Editorial register: no trailing slashes, lowercase, no extensions.
  // Matches Appendix E.
  trailingSlash: false,
  // Threads were removed from the Notebook in August 2026. Four thread
  // URLs had been published in the sitemap, so they redirect to the
  // notebook index rather than 404. Permanent: they are not coming back.
  async redirects() {
    return [
      { source: '/notebook/threads', destination: '/notebook', permanent: true },
      { source: '/notebook/threads/:name*', destination: '/notebook', permanent: true },
    ];
  },
};

export default nextConfig;

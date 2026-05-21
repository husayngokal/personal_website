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
};

export default nextConfig;

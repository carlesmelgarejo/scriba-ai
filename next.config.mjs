/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    // El cos de la petició passa pel middleware d'auth, i Next el bufferitza amb
    // un límit de 10 MB per defecte que el trunca en silenci (només queda el
    // primer tros). El pugem perquè hi càpiguen àudios llargs.
    // Nota: a Next 16.2.12+ la clau es diu `proxyClientMaxBodySize`; posem les
    // dues per compatibilitat (nginx també ha de permetre-ho amb client_max_body_size).
    middlewareClientMaxBodySize: "200mb",
    proxyClientMaxBodySize: "200mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

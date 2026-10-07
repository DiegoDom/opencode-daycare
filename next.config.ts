import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La action de SPEC 17 recibe hasta 4 fotos de ≤5 MB como File: el límite
  // por defecto de 1 MB no alcanza para validar el tamaño en el server.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;

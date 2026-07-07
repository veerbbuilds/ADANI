import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Adani Port Logistics Logbook",
    short_name: "Port Logbook",
    description: "Digital Logbook for Adani Port Yard Movements",
    start_url: "/surveyor",
    display: "standalone",
    background_color: "#060814",
    theme_color: "#060814",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

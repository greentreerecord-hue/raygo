import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/mail/"],
    },
    sitemap: "https://raygoes.com/sitemap.xml",
    host: "https://raygoes.com",
  };
} 
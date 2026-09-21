import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/upload/",
        "/uploaded/",
        "/creator/dashboard/",
        "/creator/login/",
        "/creator/signup/",
        "/viewer/login/",
        "/viewer/signup/",
      ],
    },
    sitemap: "https://raysstream.com/sitemap.xml",
    host: "https://raysstream.com",
  };
} 

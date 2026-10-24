import type { MetadataRoute } from "next";

// Chalk is private: no search engine should index anything (see also the noindex meta + header).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}

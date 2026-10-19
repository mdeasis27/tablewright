import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["sql.js"],
  // The portfolio hub links every demo as /{lang}/app; this app is a single English page.
  rewrites: async () => [{ source: "/:lang(en|es)/app", destination: "/" }],
};

export default config;

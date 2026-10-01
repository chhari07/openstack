import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The soft-launch website is its own Next.js project with its own lint setup.
    "website/**",
    // The Stack AI function runs on Deno (Supabase), not in this project.
    "supabase/**",
  ]),
]);

export default eslintConfig;

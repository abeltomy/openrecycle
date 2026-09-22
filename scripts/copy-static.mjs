// After the Vite build, publish the spec, schema and examples alongside
// the site so every link from the landing page resolves on Pages.
import { cpSync, mkdirSync } from "node:fs";

for (const dir of ["docs", "schema", "examples"]) {
  mkdirSync(`dist/${dir}`, { recursive: true });
  cpSync(dir, `dist/${dir}`, { recursive: true });
}
console.log("copied docs, schema, examples into dist/");

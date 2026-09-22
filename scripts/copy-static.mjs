// After the Vite build, publish the landing page at /landing/ and the
// spec, schema and examples alongside the app so every link resolves on Pages.
import { cpSync, mkdirSync } from "node:fs";

const out = "dist";
for (const dir of ["landing", "docs", "schema", "examples"]) {
  mkdirSync(`${out}/${dir}`, { recursive: true });
  cpSync(dir, `${out}/${dir}`, { recursive: true });
}
console.log("copied landing, docs, schema, examples into dist/");

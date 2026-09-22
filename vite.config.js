import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" keeps asset paths relative, so the build works on GitHub Pages
// under /<repo-name>/ without knowing the repo name in advance.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});

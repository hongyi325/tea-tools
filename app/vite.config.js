import {fileURLToPath} from "node:url";
import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 從 repo 根目錄提供網站，網址是 https://hongyi325.github.io/tea-tools/
// 所以打包結果直接輸出到上一層（repo 根目錄），不清空整個資料夾（裡面有 app/ 與 .git）。
// 舊的 assets/index-*.js / .css 由 scripts/clean-assets.mjs 在打包前清掉。
// favicon.svg、icons.svg 直接放在 repo 根目錄，不用 public/ 複製（輸出就在根目錄，會互相重疊）。
export default defineConfig({
    plugins: [react()],
    base: "/tea-tools/",
    publicDir: false,
    build: {
        outDir: fileURLToPath(new URL("..", import.meta.url)),
        emptyOutDir: false,
    },
});

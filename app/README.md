# 茶葉記帳 原始碼

網站：https://hongyi325.github.io/tea-tools/

- `src/App.jsx`：整個 app（從第一版 `tea-tools.html` 還原，並對照線上版本確認一致）
- 打包結果直接輸出到 repo 根目錄（`index.html`、`assets/`），GitHub Pages 從那裡提供網站

## 修改與發布

```sh
cd app
npm install      # 第一次才需要
npm run dev      # 本機預覽：http://localhost:5173/tea-tools/
npm run build    # 打包到 repo 根目錄，會自動刪掉舊的 assets/index-*.js
```

打包後把 `app/` 和根目錄的 `index.html`、`assets/` 一起 commit、push，GitHub Pages 約一分鐘後更新。

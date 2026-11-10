# 茶葉記帳 原始碼

網站：https://hongyi325.github.io/tea-tools/

打包結果直接輸出到 repo 根目錄（`index.html`、`assets/`），GitHub Pages 從那裡提供網站。

## 檔案

| 檔案 | 內容 |
|---|---|
| `src/App.jsx` | Firebase 登入與資料同步、存檔／刪除／復原、三種尺寸的外框（手機底部五格、平板與電腦上方分頁） |
| `src/Entry.jsx` | 記一筆：銷售、茶廠收入、茶廠支出、茶園支出，含數字鍵盤與鍵盤輸入 |
| `src/Home.jsx` | 明細：月結餘、未收款、月曆、流水帳 |
| `src/Stats.jsx` | 報表：淨利、茶園／茶廠、每月收支圖、排行、各月明細 |
| `src/Lists.jsx` | 庫存（茶罐）與客戶名單 |
| `src/Views.jsx` | 客戶詳情、茶種詳情、新增／編輯客戶與茶種、設定（匯出 CSV、主題、隱藏金額、登出） |
| `src/Login.jsx` | 4 碼密碼登入 |
| `src/ui.jsx` | 圖示、底部面板／置中視窗、右側窗格、期間切換 |
| `src/lib.js` | 金額與日期格式（台灣時間）、帳務計算、匯出 CSV |
| `src/index.css` | 全部樣式（淺色、深色） |

版面依視窗寬度切換：手機 600 以下、平板 600–1023、電腦 1024 以上（iPad 橫放用電腦版）。

Firestore 資料結構沒有變：`ledgers/{uid}` 底下 `customers`、`items`、`sales`、`expD`（茶廠支出）、`expP`（茶廠收入）、`expG`（茶園支出）六個陣列。

## 修改與發布

```sh
cd app
npm install      # 第一次才需要
npm run dev      # 本機預覽：http://localhost:5173/tea-tools/
npm run build    # 打包到 repo 根目錄，會自動刪掉舊的 assets/index-*.js
```

打包後把 `app/` 和根目錄的 `index.html`、`assets/` 一起 commit、push，GitHub Pages 約一分鐘後更新。

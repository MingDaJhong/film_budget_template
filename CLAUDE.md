# 影片拍攝成本試算表 — 專案規則

## ⛔ 推版規則（最優先）

**絕對不要擅自 `git push`。**

- 推版一律要等使用者**明確下指令**（例如「推上去」「push」「可以推了」）才能執行
- 即使功能已完成、測試全部通過、部署流程順利，也**只能停下來回報**，由使用者決定何時推
- 這條規則沒有例外，不因「改動很小」「只是修一個字」「先前已經推過類似的」而放寬
- 本地 `git commit` 同樣要先問過再做，不要為了「保存進度」自作主張建立提交

做完改動後的正確動作是：**驗證 → 回報結果 → 等指令**。

## 檔案結構

```
index.html    頁面結構
style.css     樣式（含深／淺色主題與列印樣式）
app.js        全部邏輯（計算、繪製、存檔、報價單／合約書產生）
```

三個檔案放在同一個資料夾，沒有建置流程、沒有相依套件。GitHub Pages 直接吃這三個檔案。

## ⚠️ app.js 不可 inline 回 index.html

`app.js` 的 Word 匯出功能會組一份完整 HTML 字串，裡面有字面的 `</body>`。

使用者用 **VS Code Live Server** 預覽，它會把熱重載用的 `<script>` 插在檔案裡**第一個 `</body>` 之前**。一旦 JS 是 inline 的，注入點就會落在 script 內部，注入碼自帶的 `</script>` 會把整段程式碼攔腰截斷 —— 後半段變成畫面上的純文字，整頁失效（症狀：總計空白、KPI 全是破折號、checkbox 全未勾選）。

直接開檔（file://）與 GitHub Pages 都不會重現，只有 Live Server 會壞。

## 驗證方式

**HTTP 情境**：`preview_start` 用 `.claude/launch.json` 裡的 `static`（python http.server 4173），搭配 Browser pane。

**file:// 情境**：Browser pane 會把 `file://` 轉成 data: URL 快照，localStorage 被停用、相對路徑的 `style.css` / `app.js` 也載不到，測不出東西。要改用本機 headless Chrome：

```bash
# 執行 JS 後的 DOM
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=4000 --dump-dom "file:///Volumes/code/film_budget_template/index.html"

# 截圖（同時確認 CSS 有套用）
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=4000 --window-size=1280,900 --screenshot=/tmp/shot.png \
  "file:///Volumes/code/film_budget_template/index.html"
```

另外 Browser pane 的截圖在頁面捲動後常常回傳全黑圖，這是工具限制不是頁面問題 —— 改用 DOM 量測（`getBoundingClientRect`）驗證版面，比截圖可靠。

## 語言

所有回覆、程式碼註解、commit message 一律使用**繁體中文**。

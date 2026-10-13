# Race Tracker（非官方 F1 賽事追蹤）

React + Vite + GitHub Pages + PWA 的 **免費非即時版 v1.5.2**。

## 有哪些功能？

- 年度 Grand Prix 賽程與所有週末場次，統一顯示 **台灣時間（UTC+8）**
- 車手 / 車隊年度積分榜
- **車手與車隊資料中心**：可直接從首頁或積分榜點擊進入，查看個人／車隊資料、全季分站紀錄、最佳成績和完賽紀錄
- **正式積分走勢圖**：用 Jolpica 各站結束後的車手與車隊積分榜繪圖，缺漏站次留白
- **車隊名單及同隊比較**：查看已出賽車手、雙方都有有效資料時的排位賽與正賽對戰成績
- **排位賽完整 Q1、Q2、Q3 圈速**、Sprint 衝刺賽成績與積分
- **正賽實際起跑順位與結果排名變化**，區分 DNF、DSQ、維修區起跑
- **單站隊友對比**：同車隊排位、起跑、正賽結果、Sprint 名次及積分
- 已結束比賽的車手名次、完賽狀態與積分
- OpenF1 有提供的 **歷史** Race Control 事件（包含安全車、事故調查、旗號等）
- **逐圈近似排名回放**（以歷史位置資料在每圈附近時間取樣，非官方逐圈名次）
- **輪胎 stint 策略**、各車手使用胎種及圈數、**進站停車與 Pit Lane 時間**
- **雙車手圈速比較**：歷史每圈秒數折線圖、共同圈數的時間差、Sector 1/2/3、最快圈與中位數、每段胎種平均圈速
- **事故事件整合**：中文事件摘要、車號提及標籤、按事件類型及圈數篩選；絕不自動判定誰有事故責任
- 手機版 UI 與 iPhone 加入主畫面的 PWA
- GitHub Actions 每 6 小時嘗試更新一份靜態資料快照，另外每次逐批補齊最多四站歷史分析並由 Actions Cache 保留，不需要維護後端伺服器

**本版沒有秒級即時賽況、事故肇責自動判定、手機推播。** 事件僅列出原始訊息，不會把「涉及某車手」推定為「他造成碰撞」。

## A. 上傳 GitHub Pages（免伺服器）

1. 在 GitHub 新建 **Public** Repository，例如 `f1-race-tracker`。
2. 將本 ZIP 解壓縮，把最外層 `f1-race-tracker` 資料夾內的檔案上傳到 Repository **根目錄**；記得包含隱藏資料夾 `.github/workflows/pages.yml`。
3. 進入 Repository 的 **Settings → Pages → Build and deployment → Source → GitHub Actions**。
4. 進入 **Actions → Update F1 data and deploy Pages → Run workflow**（如已自動執行也可直接看結果）。
5. 等部署成功後開啟 `https://你的帳號.github.io/f1-race-tracker/`。若 Repo 使用別的名字，網址中的路徑也跟著改；`vite.config.js` 會自動根據 Repo 名設定部署路徑。
6. iPhone Safari 開網站 → 分享 → **加入主畫面** → 選「以網頁 App 開啟」(若有此選項) → 加入。

> 初次上傳後，`public/data/season.json` 還是空白佔位。第一個 Actions 工作完成之後才會看到真實資料。

## B. 本機開發

需 Node.js 20 或更新版本，建議 Node.js 22。

```bash
npm install
python scripts/update_data.py
npm run dev
```

開啟 Vite 提示的 `http://localhost:5173`。也可先執行 `python -m unittest discover -s scripts -p 'test_*.py'` 測試整理邏輯。

## 專案結構

```text
.github/workflows/pages.yml   # 定期抓取資料並部署到 Pages
scripts/update_data.py       # Jolpica + OpenF1 歷史資料 → JSON
scripts/analysis.py          # OpenF1 歷史逐圈排名取樣、lap_duration、輪胎與進站快取
src/LapCompare.jsx           # 雙車手歷史圈速、時間差與輪胎效能
src/lap-utils.js             # 有效圈數與進站排除邏輯（內建 Node 測試）
scripts/weekend.py           # Jolpica 排位賽與 Sprint 資料分頁收集
scripts/standings_history.py # 每站正式車手／車隊積分榜，快取在 .cache/standings-history
src/Profiles.jsx            # 車手與車隊中心、官方積分歷史圖表
src/profile-utils.js        # 分站及隊友比較邏輯，具 Node 單元測試
src/Weekend.jsx             # 週末成績、名次升降、隊友比較
src/App.jsx                  # React 應用程式
src/styles.css               # RWD 介面
public/data/season.json      # 靜態資料；Actions build 時重新產生
public/sw.js                 # PWA Service Worker，網路優先/離線備援
public/manifest.webmanifest  # PWA 安裝資訊
public/icons/                # 自行製作圖示，非官方 F1 商標
vite.config.js               # 由 GitHub Repo 名稱建立正確 Pages base path
```

## 資料使用與限制

- **Jolpica F1**：https://api.jolpi.ca/docs/ ，依其使用條款，限非商業使用，資料依 **CC BY-NC-SA 4.0** 授權；需遵守授權及請求額度。若未來打算放廣告、收費或商用，請事先取得授權。
- **OpenF1**：https://openf1.org/docs/ ，本版只嘗試抓取 **已結束 12 小時以上** 的 Race Control 歷史訊息。**即時資料需付費**，不可把歷史資料當作即時直播。API 可能暫時沒有資料，畫面會顯示未提供，而不是造假事故。
- GitHub Actions 的 `schedule` 不保證定時精準觸發；Github 有可能暫停長期無活動 Repository 的排程。比賽當下看到的積分不代表即時結果。
- API 可能暫時不可用或限制流量，Workflow 可能失敗；請到 Actions 查詢錯誤與手動重跑。
- 正賽、排位、Sprint 等時程以資料來源為準；主辦單位臨時更動可能未即時反映。
- 這是 **非官方車迷專案**，與 Formula 1／FIA 無關，未使用官方商標圖示。

## 後續版本

v1.1：歷史逐圈近似位置、輪胎與進站紀錄（已完成）。v1.2：事故事件篩選、中文重點標籤與同圈聯動（已完成）。v1.3：排位賽、Sprint、起跑排名、隊友比較（已完成）。v1.4：車手與車隊中心、積分走勢、隊友比較（已完成）。要有秒級即時排名，需要另行評估合法授權的即時資料方案。

## 事件資料重要限制

事故中心會以關鍵字把歷史 Race Control 英文訊息分類，並保留英文原文與 OpenF1 資料來源。車號被提及不代表車手造成碰撞，也不代表最終裁定。部分訊息未提供完整車號、時間或裁判文件；不自動補足猜測。

### v1.2.1 修正
- 切換賽事清除上一站的事故圈數篩選
- 事故搜尋同時支援 #車號 與原始車號

## v1.3.0 新增功能

- 在每站「賽事紀錄 → 週末成績」切換排位賽、Sprint、名次升降、同隊比較。
- 來源：Jolpica `/{season}/qualifying.json` 與 `/{season}/sprint.json`（分頁每頁最多 100 筆）。資料每六小時嘗試更新，不是即時直播。
- 起跑順位取自 **Race Results 的 `grid` 欄位**，並非直接把排位賽名次當成起跑順位；有罰退或維修區起跑時兩者可能不同。
- DNF、取消資格、未起跑與維修區出發不強行計算名次升降。未收到資料時顯示空狀態，不提供假數字。
- Q1/Q2/Q3 有缺漏時明確顯示「—」；只在實際有 Sprint 的場次展示 Sprint 資料。

## v1.4.0 車手與車隊中心

- 手機底部／桌面側邊增加「車手／車隊」頁籤；積分榜與首頁前五名車手支援點擊開啟詳細頁。
- 使用現有的正賽、排位、Sprint 資料產生每站戰績、完賽、最佳名次、車隊實際出賽陣容。
- 逐站累計積分透過 **`/{season}/{round}/driverstandings`** 和 **`/{season}/{round}/constructorstandings`** 的正式歷史榜單取得。只抓取已完賽回合、快取後不重複抓取；資料源缺漏絕不自動補值。
- 「同隊比較」僅計算同一站兩人同隊且都有排名的排位賽；正賽只比較雙方被列為完賽的場次。
- 提供資料來源介紹連結，不使用未授權的車手／車隊肖像或商標。

## v1.5.0 雙車手歷史圈速分析

進入「賽事紀錄 → 已完賽分站 → 賽事分析 → 圈速比較」：
- 選擇任兩位有歷史單圈時間的車手，呈現 OpenF1 `/laps` 的 `lap_duration`，以及三段 Sector 時間（如果來源有提供）。
- 可選擇排除 OpenF1 明確標示的 **pit-out laps**，以及該車手進站前後各一圈，避免進站耗時扭曲比較。這只是進站過濾，**不代表綠旗乾淨圈**。
- 提供同圈秒差（A − B）、最快圈、中位數和換胎每段 stint 的平均耗時；未記錄的圈數保持缺漏，不以插值補齊。
- 舊版歷史賽事 JSON 未保存秒數，部署會每次最多補抓 **2 場** 的 OpenF1 歷史 `laps`，並沿用先前已快取的其他賽況資料。新建立的場次分析直接共用原本抓取的 `laps`，不重複查詢。
- 完全使用 **免費歷史 API**，不要求付費即時資料。注意天氣、交通、安全車、油量、胎齡影響圈速，不能直接解釋為純車手實力。

## v1.5.1 捲動與手機版面修正

- 頂部標題列不再使用 `position:sticky`，正常隨著頁面往下滑出畫面；手機版只有底部五個功能分頁保持固定。
- 移除全站強制平滑捲動，切換功能頁直接回到新頁頂端，避免和 iPhone Safari 的手勢及頁面切換動畫互相干擾。
- 手機頂部標題列考慮 iPhone 安全區域（瀏海／動態島）；底部保留頁面可滑動空間，避免被固定功能列遮住。
- PWA Cache 更新到 v1.5.1；iPhone 加入主畫面的 App 若仍有舊版，請完全關閉後重新開啟，必要時重新整理 Safari 網站。

## v1.5.2 頂部固定與卡片排版（取代 v1.5.1 的捲動處理）

- 頂部標題列恢復**固定顯示**，但不覆蓋內容：`main-shell` 使用兩列 Grid，第一列為標題列，第二列 `minmax(0,1fr)` 是唯一可縱向捲動的內容容器 `main-scroll`。
- 在手機用 `100dvh - (底部導覽列高度 + 安全區)` 計算主區高度，因此內容可用高度**自動扣除頂部和底部導覽列**，長清單可以滑到最後。
- 頁面切換和進入詳細頁時重設 `main-scroll.scrollTop`，避免仍使用 `window.scrollTo` 導致上面固定、下面沒有正確捲動的錯覺。
- 首頁與全年賽程的 Race Card 改成固定順序：回合數、中文賽名／日期、英文副標、賽道／賽果；長文字在文字區內省略，不讓日期和狀態擠壓標題。
- 修整卡片行距、手機版字級、車手排行榜及首頁統計數字對齊。功能及免費資料源不變。
- PWA Cache 改為 `v1.5.2`，避免舊樣式殘留。

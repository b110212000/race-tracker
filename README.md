# Race Tracker（非官方 F1 賽事追蹤）

React + Vite + GitHub Pages + PWA 的 **免費非即時版 v1.0.0**。

## 有哪些功能？

- 年度 Grand Prix 賽程與所有週末場次，統一顯示 **台灣時間（UTC+8）**
- 車手 / 車隊年度積分榜
- 已結束比賽的車手名次、完賽狀態與積分
- OpenF1 有提供的 **歷史** Race Control 事件（包含安全車、事故調查、旗號等）
- 手機版 UI 與 iPhone 加入主畫面的 PWA
- GitHub Actions 每 6 小時嘗試更新一份靜態資料快照，不需要維護後端伺服器

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

v1.1：歷史逐圈資料和進站紀錄。v1.2：事故時間軸與外部裁判公告連結。v1.3：提醒通知（需要可用的推播後端）。要有秒級即時排名，需要另行評估合法授權的即時資料方案。

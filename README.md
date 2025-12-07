# PixelAgent (MVP)

Electron + React で動くデスクトップ向けのチャットエージェント MVP です。ピクセル調キャラクターがチャット状態に応じて動き、MCP 接続数のインジケータや各種 UI 調整を備えています。

## 必要環境
- Node.js 20 系で確認
- npm 利用

## セットアップ
```bash
npm install
```

## 開発モード
```bash
npm run dev
```
- Vite の開発サーバー (renderer) と ts-node で動く Electron main プロセスを同時起動します。
- `VITE_DEV_SERVER_URL` 経由で Electron ウィンドウが http://localhost:5173 を開きます。

## テスト
- `npm run test:unit` / `npm run test:unit:watch` : Vitest（renderer は jsdom、main は node 環境）
- `npm run test:e2e` : Playwright。初回は `npx playwright install` でブラウザを取得してください。

## 主な機能
- キャラクターキャンバス：`idle / speaking` 状態に合わせたフレーム切替とオシロスコープ風エフェクト
- チャットビュー：バブル表示、タイムスタンプ、モデル名、ストリーミング中ラベル付きでスクロール追従
- 入力エリア：Enter 送信 / Shift+Enter 改行、モデル選択ドロップダウン、送信ボタン
- MCP ステータス：設定に登録されたサーバーの接続数を表示（スタブクライアント）
- 設定ダイアログ
  - LLM: デフォルトモデル / API キー / システムプロンプト、OpenRouter OAuth での API キー取得
  - UI: キャラクター列幅のドラッグ保存、スクリーン/アバターフィルター、フォント倍率、オシロライン表示、常時最前面フラグ など

## 設定の保存先
- `%APPDATA%/PixelAgent/config.json` に保存します。
- Electron `safeStorage` で LLM / MCP の API キーを暗号化して保存（利用不可の場合は平文）。
- `ui.characterPaneWidth` はリサイズ操作時に即保存し、`screenFilter` / `avatarFilter` / `fontScale` / `showCodecLines` などを UI に反映します。
- `theme` と `alwaysOnTop` は現状保存のみでウィンドウ適用は未実装です。

## レンダラー単体ビルド
```bash
npm run build:renderer
```
`dist/renderer` に静的アセットを出力します。Electron 本番バンドルは未実装です。

## 既知の制限 / TODO
- `src/main/llmService.ts` はスタブ実装。実際の LLM（OpenAI / OpenRouter 等）呼び出しは未接続。
- MCP クライアントはステータス生成のみで実プロトコル処理・ツール呼び出しは未着手。
- Electron 本番ビルド/インストーラ（electron-builder 等）は未設定。
- テーマ切替や常時最前面など一部 UI 設定は保存のみで反映未対応。

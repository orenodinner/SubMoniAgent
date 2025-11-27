# PixelAgent (MVP)

Electron + React で動くデスクトップ AI エージェントの MVP です。ピクセルキャラがチャットの状態に合わせて動きます。

## 開発環境
- Node.js 20 で確認
- npm 利用

## セットアップ
```bash
npm install
```

## 開発モード
```bash
npm run dev
```
- Vite の開発サーバー (renderer) と ts-node で動く Electron main プロセスが同時起動します。
- `VITE_DEV_SERVER_URL` 経由で Electron ウィンドウが http://localhost:5173 を開きます。

## レンダラー単体ビルド
```bash
npm run build:renderer
```
`dist/renderer` に静的アセットが出力されます。Electron 本番バンドルは未実装の簡易版です。

## 機能概要
- ヘッダーバーにアプリ名・モデル名・MCP 接続インジケータ・設定ボタンを表示
- キャラクターキャンバス：`idle / listening / thinking / speaking / error` のステートに応じてスプライト再生
- チャット履歴：バブル表示、タイムスタンプ、モデル名、ストリーミング中ラベル
- 入力エリア：Enter 送信 / Shift+Enter 改行、モデル選択ドロップダウン、送信ボタン
- 設定ダイアログ：モデル / API キー / システムプロンプト / テーマ / 常に手前に表示 の保存（ローカル JSON）
- MCP ステータス：スタブクライアントで接続数を表示（データは `config.json` の内容を使用）

## ファイル構成（主要）
- `src/main/main.ts` : Electron ウィンドウ作成、IPC、LLM/MCP スタブ
- `src/main/configStore.ts` : `%APPDATA%/PixelAgent/config.json` を読み書き
- `src/main/preload.js` : renderer へ IPC API をブリッジ
- `src/renderer/src/App.tsx` : 画面レイアウト
- `src/renderer/src/components/CharacterCanvas.tsx` : スプライト描画・アニメーション
- `src/renderer/src/store/useChatStore.ts` : Zustand ストア
- `src/renderer/src/assets/pixel-sprite.png` : 簡易スプライトシート

## 既知の制限 / TODO
- LLM 呼び出しは `src/main/llmService.ts` のスタブのみ（OpenAI 連携未実装）
- MCP クライアントもスタブ。実プロトコル処理・ツール呼び出しは未着手
- 本番ビルド/インストーラ（electron-builder）は未設定
- API キーの暗号化は未実装（平文保存）
- ホットキー起動や会話履歴保存は未実装

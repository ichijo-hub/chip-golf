export const metadata = {
  title: 'プライバシーポリシー | Chip Golf',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-2xl font-bold mb-2">プライバシーポリシー</h1>
      <p className="text-sm text-gray-500 mb-8">最終更新日: 2026年4月14日</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">1. 収集する情報</h2>
        <p className="mb-2">本アプリ（Chip Golf）は以下の情報を利用します。</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>カメラ</strong>: QRコードの読み取りにのみ使用します。撮影した映像はサーバーに送信しません。</li>
          <li><strong>ローカルストレージ</strong>: ルームコード・プレイヤーIDをお使いの端末内にのみ保存します。</li>
          <li><strong>ゲームデータ</strong>: ゲームの進行状況（プレイヤー名・チップ状態）をFirebase（Google LLC）のサーバーに保存します。個人を特定する情報は含みません。</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">2. 情報の利用目的</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>ゲームのリアルタイム同期</li>
          <li>QRコードによるルーム参加</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">3. 第三者への提供</h2>
        <p className="text-sm">収集した情報を第三者に販売・提供することはありません。ゲームデータの保存にFirebase（Google LLC）を利用しています。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">4. 広告</h2>
        <p className="text-sm">将来的にGoogle AdMob（Google LLC）による広告を表示する場合があります。広告配信のためにデバイス識別子が利用されることがあります。</p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">5. お問い合わせ</h2>
        <p className="text-sm">プライバシーに関するご質問は下記までご連絡ください。</p>
        <p className="text-sm mt-1">メール: <a href="mailto:ichijo+chipgolf@gmail.com" className="text-blue-600 underline">ichijo+chipgolf@gmail.com</a></p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">6. 変更について</h2>
        <p className="text-sm">本ポリシーは必要に応じて更新します。重要な変更がある場合はアプリ内でお知らせします。</p>
      </section>
    </main>
  );
}

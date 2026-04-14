export const metadata = {
  title: 'Privacy Policy | Chip Golf',
};

export default function PrivacyEnPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12 text-gray-800 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: April 14, 2026</p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">1. Information We Collect</h2>
        <p className="mb-2">Chip Golf uses the following information:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li><strong>Camera</strong>: Used solely for scanning QR codes. No images or video are sent to any server.</li>
          <li><strong>Local Storage</strong>: Room codes and player IDs are stored only on your device.</li>
          <li><strong>Game Data</strong>: Game progress (player names and chip states) is stored on Firebase (Google LLC) servers. No personally identifiable information is included.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">2. How We Use Information</h2>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>Real-time game synchronization between players</li>
          <li>QR code-based room joining</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">3. Sharing of Information</h2>
        <p className="text-sm">We do not sell or share your information with third parties. Game data is stored using Firebase (Google LLC).</p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">4. Advertising</h2>
        <p className="text-sm">We may display ads via Google AdMob (Google LLC) in the future. AdMob may use device identifiers for ad delivery.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">5. Contact</h2>
        <p className="text-sm">For privacy-related questions, please contact us at:</p>
        <p className="text-sm mt-1">Email: <a href="mailto:ichijo+chipgolf@gmail.com" className="text-blue-600 underline">ichijo+chipgolf@gmail.com</a></p>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">6. Changes to This Policy</h2>
        <p className="text-sm">We may update this policy from time to time. Significant changes will be communicated within the app.</p>
      </section>
    </main>
  );
}

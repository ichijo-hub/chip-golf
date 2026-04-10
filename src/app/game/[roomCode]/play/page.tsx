export function generateStaticParams() {
  return [{ roomCode: '__placeholder__' }];
}
import PlayClient from './PlayClient';
export default function Page() { return <PlayClient />; }

export function generateStaticParams() {
  return [{ roomCode: '__placeholder__' }];
}
import LobbyClient from './LobbyClient';
export default function Page() { return <LobbyClient />; }

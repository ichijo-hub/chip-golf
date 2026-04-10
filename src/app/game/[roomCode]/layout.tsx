export function generateStaticParams() {
  return [{ roomCode: '__placeholder__' }];
}

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

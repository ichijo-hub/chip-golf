'use client';

import dynamic from 'next/dynamic';

const DemoSetupClient = dynamic(() => import('./DemoSetupClient'), { ssr: false });

export default function DemoPage() {
  return <DemoSetupClient />;
}

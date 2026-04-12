'use client';

import dynamic from 'next/dynamic';

const DemoResultClient = dynamic(() => import('./DemoResultClient'), { ssr: false });

export default function DemoResultPage() {
  return <DemoResultClient />;
}

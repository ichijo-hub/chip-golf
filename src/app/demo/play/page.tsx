'use client';

import dynamic from 'next/dynamic';

const DemoPlayClient = dynamic(() => import('./DemoPlayClient'), { ssr: false });

export default function DemoPlayPage() {
  return <DemoPlayClient />;
}

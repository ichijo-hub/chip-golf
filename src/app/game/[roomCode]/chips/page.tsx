'use client';

import dynamic from 'next/dynamic';

const ChipsManageClient = dynamic(() => import('./ChipsManageClient'), { ssr: false });

export default function Page() {
  return <ChipsManageClient />;
}

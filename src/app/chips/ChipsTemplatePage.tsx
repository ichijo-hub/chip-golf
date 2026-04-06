'use client';

import dynamic from 'next/dynamic';

const ChipsTemplateClient = dynamic(() => import('./ChipsTemplateClient'), { ssr: false });

export default function ChipsTemplatePage() {
  return <ChipsTemplateClient />;
}

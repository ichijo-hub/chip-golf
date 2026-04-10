'use client';

import { useEffect, useState } from 'react';
import { checkAdminSession } from './actions';
import AdminLogin from './AdminLogin';
import ChipsTemplatePage from './ChipsTemplatePage';

export default function Page() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAdmin(checkAdminSession());
  }, []);

  if (isAdmin === null) return null;
  if (!isAdmin) return <AdminLogin onAuth={() => setIsAdmin(true)} />;
  return <ChipsTemplatePage />;
}

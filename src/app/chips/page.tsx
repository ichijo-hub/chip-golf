import { checkAdminSession } from './actions';
import AdminLogin from './AdminLogin';
import ChipsTemplatePage from './ChipsTemplatePage';

export default async function Page() {
  const isAdmin = await checkAdminSession();
  if (!isAdmin) return <AdminLogin />;
  return <ChipsTemplatePage />;
}

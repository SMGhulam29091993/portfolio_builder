/**
 * `/cms/login` (`cms-panel-shell.AC1`, `AC2`, `AC18`, `AC19`). A server component that reads the
 * query once and hands plain values to the client form, so no `useSearchParams` suspense is
 * needed. `next` is sanitised before it is used.
 */
import { safeNext } from '../../../../../lib/cms/navigation';
import { LoginForm } from './login-form';

interface LoginPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const single = (name: string) => (typeof query[name] === 'string' ? query[name] : undefined);
  return <LoginForm next={safeNext(single('next'))} notice={single('notice')} googleError={single('error')} />;
}

/**
 * The platform home at `/` (`public-site-rendering.AC20`): what the product is and where to sign
 * in or start. Shows no portfolio's data; every portfolio lives at `/<slug>`.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portfolio Builder',
  description: 'Build, design and publish your developer portfolio.',
};

const LINK = 'rounded-full px-5 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300';

export default function PlatformHome() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="flex max-w-xl flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Portfolio Builder</h1>
        <p className="text-neutral-300">
          Build your developer portfolio from ready-made sections, give it your own design, and publish it at your own address.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="/cms/register" className={`${LINK} bg-lime-300 text-neutral-950 hover:bg-lime-200`}>
            Create an account
          </a>
          <a href="/cms/login" className={`${LINK} border border-neutral-600 hover:border-neutral-400`}>
            Sign in
          </a>
        </div>
      </div>
    </main>
  );
}

'use client';
/**
 * The error page of a portfolio (`public-site-rendering.AC16`, `AC17`): the API was unreachable
 * with no earlier render to serve, or the snapshot's version is newer than this build. Plain, and
 * it reveals nothing about the cause.
 */
export default function PortfolioError() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center text-neutral-100">
      <div className="flex max-w-md flex-col gap-3">
        <h1 className="text-2xl font-semibold">This portfolio is temporarily unavailable</h1>
        <p className="text-sm text-neutral-300">Please try again in a few minutes.</p>
      </div>
    </main>
  );
}

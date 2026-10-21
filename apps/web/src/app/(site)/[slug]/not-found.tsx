/**
 * The not-published page (`public-site-rendering.AC2`): one answer for an unpublished portfolio
 * and an unknown slug. Next.js answers it with HTTP 404 and `noindex`.
 */
export default function NotPublished() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center text-neutral-100">
      <div className="flex max-w-md flex-col gap-3">
        <h1 className="text-2xl font-semibold">This portfolio has not been published yet</h1>
        <p className="text-sm text-neutral-300">Check the address, or come back later.</p>
      </div>
    </main>
  );
}

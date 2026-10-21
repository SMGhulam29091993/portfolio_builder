'use client';
/**
 * `/cms/ai` (`ai-design-studio.T10`; AC16, AC18): describe a look, choose the scope, and get a
 * proposal back. Before anything is submitted the screen shows the provider and the allowance —
 * free generations left, or the credit cost and balance. A pending proposal is polled; a ready
 * one is previewed against the real draft in the shell's preview pane (desktop and mobile)
 * without being applied, then applied or discarded; a failed one says why in plain language.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import type { DesignSpec } from '@portfolio/design-tokens';
import { createProposalRequestSchema, type CreateProposalRequest, type Proposal } from '@portfolio/contracts';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ApiError } from '../../../lib/api/client';
import {
  useAiProvider,
  useApplyProposal,
  useCreateProposal,
  useDiscardProposal,
  useProposal,
  useProposalHistory,
} from '../../../lib/api/ai-design';
import { useDesign } from '../../../lib/api/design';
import { allowanceSummary, BUY_CREDITS_HREF, providerBadge, SCOPE_OPTIONS } from '../../../lib/cms/ai-studio';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { FormSchemaProvider, SelectField, SwitchField, TextAreaField } from '../form';
import { PreviewPane } from '../preview/preview-pane';
import { Button, Notice, TextLink } from '../ui';

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

const STATUS_LABELS: Readonly<Record<Proposal['status'], string>> = {
  pending: 'Generating',
  ready: 'Ready',
  failed: 'Failed',
  applied: 'Applied',
  discarded: 'Discarded',
};

/** What a refused request means to the user. */
const REFUSALS: Readonly<Record<string, string>> = {
  GENERATION_IN_PROGRESS: 'A proposal is already being generated. Wait for it to finish.',
  PROPOSAL_NOT_READY: 'That proposal can no longer be used this way.',
  REVISION_CONFLICT: 'The design changed since this page loaded. The latest design is loaded now; apply again to replace it.',
};

type FormValues = z.input<typeof createProposalRequestSchema>;

export function AiScreen() {
  const provider = useAiProvider();
  const history = useProposalHistory();
  const design = useDesign();
  const create = useCreateProposal();
  const apply = useApplyProposal();
  const discard = useDiscardProposal();
  const notify = useCmsUi((state) => state.notify);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [creditsShort, setCreditsShort] = useState(false);
  const form = useForm<FormValues, unknown, CreateProposalRequest>({
    resolver: zodResolver(createProposalRequestSchema),
    defaultValues: { prompt: '', scope: 'both', basedOnCurrent: true },
    mode: 'onChange',
  });

  // The newest proposal is shown until another is picked from the history.
  const shownId = selectedId ?? history.data?.proposals[0]?.id ?? null;
  const shown = useProposal(shownId);
  const proposal = shown.data;
  const pending = history.data?.proposals.some((row) => row.status === 'pending') ?? false;
  const summary = provider.data ? allowanceSummary(provider.data.allowance, (iso) => DAY_FORMAT.format(new Date(iso))) : null;
  const outOfCredits = creditsShort || summary?.canGenerate === false;

  const refused = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'CREDITS_REQUIRED') {
      setCreditsShort(true);
      return;
    }
    setFailure(error instanceof ApiError ? (REFUSALS[error.code] ?? genericErrorMessage(error)) : genericErrorMessage(error));
  };

  const onSubmit = async (values: CreateProposalRequest) => {
    setFailure(null);
    try {
      const created = await create.mutateAsync(values);
      setSelectedId(created.id);
      form.reset({ ...values, prompt: '' });
    } catch (error) {
      refused(error);
    }
  };

  const onApply = async (target: Proposal) => {
    if (!design.data) return;
    setFailure(null);
    try {
      await apply.mutateAsync({ id: target.id, expectedDesignRevision: design.data.design.revision });
      notify('success', 'Proposal applied to your draft design. Publish to put it live.');
    } catch (error) {
      refused(error);
    }
  };

  const onDiscard = async (target: Proposal) => {
    setFailure(null);
    try {
      await discard.mutateAsync(target.id);
      setSelectedId(null);
      notify('success', 'Proposal discarded.');
    } catch (error) {
      refused(error);
    }
  };

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <section aria-labelledby="ai-heading" className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="ai-heading" className="text-2xl font-semibold">AI Studio</h1>
          {provider.data ? (
            <span data-testid="provider-badge" className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300">
              {providerBadge(provider.data)}
            </span>
          ) : null}
        </div>

        {provider.isError ? <Notice tone="error">{genericErrorMessage(provider.error)}</Notice> : null}
        {provider.data && !provider.data.reachable ? (
          <Notice tone="info">The design provider is not answering right now. A proposal may fail until it is back.</Notice>
        ) : null}
        {summary ? <p data-testid="allowance" className="text-sm text-neutral-300">{summary.text}</p> : null}
        {outOfCredits ? (
          <Notice tone="error">
            Not enough credits. <TextLink href={BUY_CREDITS_HREF}>Buy credits</TextLink>
          </Notice>
        ) : null}
        {failure ? <Notice tone="error">{failure}</Notice> : null}

        <FormProvider {...form}>
          <FormSchemaProvider schema={createProposalRequestSchema}>
            <form
              aria-label="New design proposal"
              onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
              noValidate
              className="flex flex-col gap-4"
            >
              <TextAreaField
                name="prompt"
                label="Describe the look you want"
                hint="For example: calm and editorial, warm off-white, a serif for headings. Colours, fonts and layouts come from the design catalogue."
                rows={3}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField name="scope" label="What to change" options={SCOPE_OPTIONS} />
                <SwitchField name="basedOnCurrent" label="Start from my current design" />
              </div>
              <div>
                <Button type="submit" disabled={pending || outOfCredits || !form.formState.isValid} busy={create.isPending}>
                  Generate proposal
                </Button>
              </div>
            </form>
          </FormSchemaProvider>
        </FormProvider>

        {proposal ? (
          <ProposalPanel
            proposal={proposal}
            applying={apply.isPending}
            discarding={discard.isPending}
            onApply={() => void onApply(proposal)}
            onDiscard={() => void onDiscard(proposal)}
          />
        ) : null}

        <section aria-labelledby="ai-history-heading" className="flex flex-col gap-3">
          <h2 id="ai-history-heading" className="text-lg font-semibold">History</h2>
          {history.isPending ? <p role="status">Loading proposals…</p> : null}
          {history.isError ? <Notice tone="error">{genericErrorMessage(history.error)}</Notice> : null}
          {history.data?.proposals.length === 0 ? <p className="text-sm text-neutral-400">No proposals yet.</p> : null}
          <ul className="flex flex-col gap-2">
            {history.data?.proposals.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  aria-current={row.id === shownId ? 'true' : undefined}
                  onClick={() => {
                    setSelectedId(row.id);
                  }}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 ${
                    row.id === shownId ? 'border-neutral-500 bg-neutral-900' : 'border-neutral-800 hover:bg-neutral-900'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{row.prompt}</span>
                  <span className="text-neutral-400">
                    {STATUS_LABELS[row.status]} · {DATE_FORMAT.format(new Date(row.createdAt))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </section>
      {proposal?.status === 'ready' && proposal.design ? (
        // The API stores a proposal's design only after validating it as a `DesignSpec` (ADR-0006).
        <PreviewPane design={proposal.design as DesignSpec} />
      ) : (
        <PreviewPane />
      )}
    </div>
  );
}

function ProposalPanel({
  proposal,
  applying,
  discarding,
  onApply,
  onDiscard,
}: {
  proposal: Proposal;
  applying: boolean;
  discarding: boolean;
  onApply: () => void;
  onDiscard: () => void;
}) {
  return (
    <section aria-labelledby="proposal-heading" data-status={proposal.status} className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-4">
      <h2 id="proposal-heading" className="text-lg font-semibold">
        Proposal — {STATUS_LABELS[proposal.status]}
      </h2>
      <p className="text-sm text-neutral-300">“{proposal.prompt}”</p>
      {proposal.status === 'pending' ? <p role="status">Generating a proposal… This can take up to a minute.</p> : null}
      {proposal.status === 'failed' && proposal.failure ? <Notice tone="error">{proposal.failure.message}</Notice> : null}
      {proposal.rationale ? <p className="text-sm text-neutral-200">{proposal.rationale}</p> : null}
      {proposal.status === 'ready' ? (
        <p className="text-sm text-neutral-400">The preview shows this proposal on your draft. Nothing changes until you apply it.</p>
      ) : null}
      {proposal.status === 'applied' ? <Notice tone="success">Applied to your draft design.</Notice> : null}
      <div className="flex flex-wrap gap-2">
        {proposal.status === 'ready' ? (
          <Button onClick={onApply} busy={applying}>
            Apply to draft
          </Button>
        ) : null}
        {proposal.status === 'ready' || proposal.status === 'failed' ? (
          <Button variant="secondary" onClick={onDiscard} busy={discarding}>
            Discard
          </Button>
        ) : null}
      </div>
    </section>
  );
}

'use client';
/**
 * `/cms/design` (`design-theme.T07`; AC10): colour editors with live contrast badges, font
 * selects per role, radius and effects, a layout variant per section, reset to the reference
 * design, and the live preview of the whole page in the edited design. Save is disabled while
 * any contrast pair fails; the controls offer catalogue entries only.
 */
import { checkContrast, COLOR_TOKENS, FONT_ROLES, MOTIONS, RADII, type ColorToken, type DesignSpec } from '@portfolio/design-tokens';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { FormProvider, useController, useForm, useFormContext, useWatch } from 'react-hook-form';

import { ApiError } from '../../../lib/api/client';
import {
  designKeys,
  useApplyPreset,
  useDeleteLayout,
  useDeletePreset,
  useDesign,
  useLayoutLibrary,
  usePresets,
  useResetDesign,
  useSaveDesign,
  useSavePreset,
  type CmsDesign,
  type DesignResponse,
} from '../../../lib/api/design';
import { designResolver } from '../../../lib/cms/design-resolver';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { ConflictDialog } from '../editor/conflict-dialog';
import { SelectField, SwitchField } from '../form';
import { PreviewPane } from '../preview/preview-pane';
import { Button, Notice, TextInput, focusRing } from '../ui';

const COLOR_LABELS: Readonly<Record<ColorToken, string>> = {
  background: 'Page background',
  surface: 'Card background',
  surfaceRaised: 'Raised card background',
  border: 'Borders and dividers',
  text: 'Main text',
  textMuted: 'Secondary text',
  accent: 'Accent colour',
  onAccent: 'Text on accent colour',
};

/** Where each colour shows, so the user knows what they are changing. */
const COLOR_HINTS: Readonly<Record<ColorToken, string>> = {
  background: 'Behind the whole page.',
  surface: 'Behind cards such as projects and the contact card.',
  surfaceRaised: 'Behind cards that sit on other cards, and hover states.',
  border: 'Lines around cards and between sections.',
  text: 'Headings and body text.',
  textMuted: 'Smaller, less important text such as dates and captions.',
  accent: 'Buttons, links, highlights and the italic heading words.',
  onAccent: 'Text and icons placed on the accent colour, such as button labels.',
};

/** Plain section names, for the library list. */
const SECTION_NAMES: Readonly<Record<string, string>> = {
  hero: 'Hero',
  about: 'About',
  work: 'Work',
  experience: 'Experience',
  stack: 'Stack',
  contact: 'Contact',
};

const SECTION_LABELS: Readonly<Record<string, string>> = {
  hero: 'Hero section layout',
  about: 'About section layout',
  work: 'Work section layout',
  experience: 'Experience section layout',
  stack: 'Stack section layout',
  contact: 'Contact section layout',
};

export function DesignScreen() {
  const design = useDesign();
  if (design.isPending) return <p role="status">Loading your design…</p>;
  if (design.isError) {
    return (
      <div className="flex max-w-md flex-col gap-3">
        <Notice tone="error">{genericErrorMessage(design.error)}</Notice>
        <Button onClick={() => void design.refetch()}>Retry</Button>
      </div>
    );
  }
  return <DesignForm initial={design.data} />;
}

function toSpec({ theme, layout }: DesignSpec): DesignSpec {
  return { theme, layout };
}

function DesignForm({ initial }: { initial: DesignResponse }) {
  const queryClient = useQueryClient();
  const save = useSaveDesign();
  const reset = useResetDesign();
  const notify = useCmsUi((state) => state.notify);
  const setDirty = useCmsUi((state) => state.setDirty);
  const [revision, setRevision] = useState(initial.design.revision);
  const [conflict, setConflict] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<DesignSpec>({ resolver: designResolver, defaultValues: toSpec(initial.design), mode: 'onChange' });
  const { formState, handleSubmit, reset: resetForm, control } = form;
  const live = useWatch({ control }) as DesignSpec;
  const contrast = checkContrast(live.theme.colors);
  const allPass = contrast.every((pair) => pair.passes);

  useEffect(() => {
    setDirty('design', formState.isDirty);
    return () => {
      setDirty('design', false);
    };
  }, [formState.isDirty, setDirty]);

  const onError = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'REVISION_CONFLICT') {
      const current = error.data.currentRevision;
      setConflict(typeof current === 'number' ? current : revision);
    } else {
      setFailure(genericErrorMessage(error));
    }
  };

  const submit = async (design: DesignSpec, expectedRevision: number) => {
    setFailure(null);
    try {
      const saved = await save.mutateAsync({ expectedRevision, design });
      setRevision(saved.revision);
      setConflict(null);
      resetForm(toSpec(saved));
      notify('success', 'Design saved.');
    } catch (error) {
      onError(error);
    }
  };

  const onReset = async () => {
    if (!window.confirm('Reset the design to the reference look? Your colour, font and layout choices are replaced.')) return;
    try {
      const saved = await reset.mutateAsync(revision);
      setRevision(saved.revision);
      resetForm(toSpec(saved));
      notify('success', 'Design reset to the reference.');
    } catch (error) {
      onError(error);
    }
  };

  const loadLatest = async () => {
    await queryClient.invalidateQueries({ queryKey: designKeys.draft });
    const latest = queryClient.getQueryData<DesignResponse>(designKeys.draft);
    if (latest) {
      setRevision(latest.design.revision);
      resetForm(toSpec(latest.design));
    }
    setConflict(null);
  };

  const fontsFor = (role: string) => initial.catalogue.fonts.filter((font) => font.role === role).map((font) => ({ value: font.id, label: font.label }));
  const library = useLayoutLibrary();
  // Each section offers the catalogue layouts, then the library layouts made for it (`design-library.AC9`).
  const layoutOptions = (section: string, variants: readonly { id: string; label: string }[]) => [
    ...variants.map((variant) => ({ value: variant.id, label: variant.label })),
    ...(library.data ?? [])
      .filter((layout) => layout.section === section)
      .map((layout) => ({ value: `custom:${layout.id}`, label: `My layout: ${layout.name}` })),
  ];
  const loadDesign = (design: CmsDesign) => {
    setRevision(design.revision);
    setConflict(null);
    resetForm(toSpec(design));
  };

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <section aria-labelledby="design-heading" className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="design-heading" className="text-2xl font-semibold">Design</h1>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void onReset()} busy={reset.isPending}>
              Reset to reference
            </Button>
            <Button type="submit" form="design-form" disabled={!formState.isDirty || !allPass || !formState.isValid} busy={save.isPending}>
              Save
            </Button>
          </div>
        </div>
        {!allPass ? <Notice tone="error">Some colours do not have enough contrast. Fix the failing pairs to save.</Notice> : null}
        {failure ? <Notice tone="error">{failure}</Notice> : null}
        <FormProvider {...form}>
          <form
            id="design-form"
            data-dirty={formState.isDirty}
            data-valid={formState.isValid}
            onSubmit={(event) => void handleSubmit((design) => submit(design, revision))(event)}
            noValidate
            className="flex flex-col gap-8"
          >
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="pb-2 text-lg font-semibold">Colours</legend>
              {COLOR_TOKENS.map((token) => (
                <ColorField key={token} token={token} />
              ))}
            </fieldset>
            <section aria-labelledby="contrast-heading" className="flex flex-col gap-2">
              <h2 id="contrast-heading" className="text-lg font-semibold">Contrast</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {contrast.map((pair) => (
                  <li
                    key={`${pair.foreground}-${pair.background}`}
                    data-contrast={pair.passes ? 'pass' : 'fail'}
                    className={`flex justify-between rounded-lg border px-3 py-2 text-sm ${pair.passes ? 'border-neutral-700' : 'border-red-400 text-red-200'}`}
                  >
                    <span>
                      {COLOR_LABELS[pair.foreground]} on {COLOR_LABELS[pair.background].toLowerCase()}
                    </span>
                    <span>
                      {pair.ratio.toFixed(2)}:1 {pair.passes ? 'Pass' : `Fail (needs ${String(pair.minimum)}:1)`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <fieldset className="grid gap-4 sm:grid-cols-3">
              <legend className="pb-2 text-lg font-semibold">Fonts</legend>
              {FONT_ROLES.map((role) => (
                <SelectField
                  key={role}
                  name={`theme.fonts.${role}`}
                  label={{ sans: 'Body text font', display: 'Headline accent font (italic words)', mono: 'Code font' }[role]}
                  hint={{ sans: 'Most of the text on the page.', display: 'The highlighted words in headings.', mono: 'The code-style card and small labels.' }[role]}
                  options={fontsFor(role)}
                />
              ))}
            </fieldset>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="pb-2 text-lg font-semibold">Shape and effects</legend>
              <SelectField name="theme.radius" label="Corner roundness" hint="How rounded cards and buttons are." options={RADII.map((radius) => ({ value: radius, label: radius }))} />
              <SelectField name="theme.effects.motion" label="Animations" hint="none turns every animation off." options={MOTIONS.map((motion) => ({ value: motion, label: motion }))} />
              <SwitchField name="theme.effects.glow" label="Soft glow behind accent elements" />
              <SwitchField name="theme.effects.dotGrid" label="Dotted background pattern" />
            </fieldset>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="pb-2 text-lg font-semibold">Layouts</legend>
              {Object.entries(initial.catalogue.variants).map(([section, variants]) => (
                <SelectField
                  key={section}
                  name={`layout.${section}`}
                  label={SECTION_LABELS[section] ?? section}
                  options={layoutOptions(section, variants)}
                />
              ))}
            </fieldset>
          </form>
        </FormProvider>
        <LibraryPanels revision={revision} dirty={formState.isDirty} onApplied={loadDesign} />
      </section>
      <PreviewPane design={live} />
      <ConflictDialog
        open={conflict !== null}
        busy={save.isPending}
        onCancel={() => {
          setConflict(null);
        }}
        onLoadLatest={() => void loadLatest()}
        onOverwrite={() => void handleSubmit((design) => submit(design, conflict ?? revision))()}
      />
    </div>
  );
}

/** A colour token: the native picker and the hex text, kept in step. */
function ColorField({ token }: { token: ColorToken }) {
  const id = useId();
  const { control } = useFormContext<DesignSpec>();
  const { field, fieldState } = useController({ name: `theme.colors.${token}`, control });
  const value = typeof field.value === 'string' ? field.value : '';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">{COLOR_LABELS[token]}</label>
      <p id={`${id}-hint`} className="text-xs text-neutral-400">{COLOR_HINTS[token]}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${COLOR_LABELS[token]} picker`}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(event) => {
            field.onChange(event.target.value);
          }}
          className={`h-9 w-12 cursor-pointer rounded border border-neutral-700 bg-transparent ${focusRing}`}
        />
        <input
          id={id}
          value={value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          aria-invalid={fieldState.error ? true : undefined}
          aria-describedby={fieldState.error ? `${id}-hint ${id}-error` : `${id}-hint`}
          className={`w-32 rounded-lg border bg-neutral-900 px-3 py-2 font-mono text-sm ${fieldState.error ? 'border-red-400' : 'border-neutral-700'} ${focusRing}`}
        />
      </div>
      {fieldState.error ? <p id={`${id}-error`} className="text-sm text-red-300">{fieldState.error.message}</p> : null}
    </div>
  );
}

/**
 * The layout library and design presets (`design-library.AC9`): layouts the AI made, each deletable
 * unless in use; presets saved from the current design, applied (replacing the form) or deleted.
 */
function LibraryPanels({ revision, dirty, onApplied }: { revision: number; dirty: boolean; onApplied: (design: CmsDesign) => void }) {
  const layouts = useLayoutLibrary();
  const presets = usePresets();
  const deleteLayout = useDeleteLayout();
  const savePreset = useSavePreset();
  const applyPreset = useApplyPreset();
  const deletePreset = useDeletePreset();
  const notify = useCmsUi((state) => state.notify);
  const [name, setName] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const explain = (error: unknown) => {
    if (error instanceof ApiError && error.code === 'LAYOUT_IN_USE') {
      const usedBy = Array.isArray(error.data.usedBy) ? (error.data.usedBy as string[]) : [];
      return `This layout is in use by ${usedBy.map((by) => (by === 'draft' ? 'your design' : 'a preset')).join(' and ')}. Choose another layout or delete the preset first.`;
    }
    if (error instanceof ApiError && error.code === 'LIBRARY_FULL') return 'The library is full. Delete one before saving another.';
    if (error instanceof ApiError && error.code === 'REVISION_CONFLICT') return 'The design changed elsewhere. Reload the page, then apply the preset again.';
    return genericErrorMessage(error);
  };
  const run = async (action: () => Promise<unknown>, done: string) => {
    setFailure(null);
    try {
      await action();
      notify('success', done);
    } catch (error) {
      setFailure(explain(error));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <section aria-labelledby="presets-heading" className="flex flex-col gap-3">
        <h2 id="presets-heading" className="text-lg font-semibold">Saved designs (presets)</h2>
        <p className="text-sm text-neutral-400">Keep a whole look — colours, fonts and layouts — and switch back to it later.</p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = name.trim();
            if (trimmed === '') return;
            void run(async () => {
              await savePreset.mutateAsync(trimmed);
              setName('');
            }, 'Design saved as a preset.');
          }}
        >
          <div className="min-w-0 flex-1">
            <TextInput label="Name for the current design" value={name} maxLength={60} onChange={(event) => { setName(event.target.value); }} hint="Saves the design as it is saved now, not unsaved changes." />
          </div>
          <Button type="submit" variant="secondary" disabled={name.trim() === ''} busy={savePreset.isPending}>
            Save as preset
          </Button>
        </form>
        {presets.data?.length === 0 ? <p className="text-sm text-neutral-400">No saved designs yet.</p> : null}
        <ul className="flex flex-col gap-2">
          {presets.data?.map((preset) => (
            <li key={preset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{preset.name}</span>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  busy={applyPreset.isPending}
                  onClick={() => {
                    if (dirty && !window.confirm('Applying this preset replaces your unsaved changes. Continue?')) return;
                    void run(async () => {
                      onApplied(await applyPreset.mutateAsync({ id: preset.id, expectedRevision: revision }));
                    }, `Applied "${preset.name}".`);
                  }}
                >
                  Apply
                </Button>
                <Button variant="ghost" aria-label={`Delete preset ${preset.name}`} onClick={() => void run(() => deletePreset.mutateAsync(preset.id), 'Preset deleted.')}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="library-heading" className="flex flex-col gap-3">
        <h2 id="library-heading" className="text-lg font-semibold">My layouts</h2>
        <p className="text-sm text-neutral-400">Layouts the AI designed for you. Choose one under Layouts above for its section.</p>
        {layouts.data?.length === 0 ? <p className="text-sm text-neutral-400">No layouts yet. Use Explore new layouts in the AI Studio to make some.</p> : null}
        <ul className="flex flex-col gap-2">
          {layouts.data?.map((layout) => (
            <li key={layout.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {layout.name} <span className="text-neutral-400">· {SECTION_NAMES[layout.section] ?? layout.section} section</span>
              </span>
              <Button variant="ghost" aria-label={`Delete layout ${layout.name}`} onClick={() => void run(() => deleteLayout.mutateAsync(layout.id), 'Layout deleted.')}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

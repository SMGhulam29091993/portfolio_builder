/**
 * `ListField` limits (`cms-panel-shell.UT07`; AC13), rendered to static markup inside a real
 * react-hook-form provider and the contract schema — no DOM needed.
 */
import { listItem, plainText } from '@portfolio/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { TextField } from './fields';
import { FormSchemaProvider } from './form-schema';
import { ListField } from './list-field';

const schema = z.object({ items: z.array(listItem({ title: plainText(20) })).min(1).max(2) });

function Harness({ count }: { count: number }) {
  const form = useForm({ defaultValues: { items: Array.from({ length: count }, (_, i) => ({ id: `i${String(i)}`, title: `T${String(i)}` })) } });
  return (
    <FormProvider {...form}>
      <FormSchemaProvider schema={schema}>
        <ListField name="items" label="Items" itemLabel="item" newItem={() => ({ title: '' })} renderItem={(path) => <TextField name={`${path}.title`} label="Title" />} />
      </FormSchemaProvider>
    </FormProvider>
  );
}

/** Whether the button whose text or aria-label contains `text` is disabled. */
function disabled(html: string, text: string): boolean {
  const buttons = html.match(/<button[^>]*>[^<]*<\/button>/g) ?? [];
  const match = buttons.find((button) => button.includes(text));
  if (!match) throw new Error(`no button "${text}"`);
  return /\sdisabled=""/.test(match);
}

describe('ListField (cms-panel-shell.UT07)', () => {
  it('disables Add at the schema maximum', () => {
    const html = renderToStaticMarkup(<Harness count={2} />);
    expect(disabled(html, 'Add item')).toBe(true);
    expect(disabled(html, 'Remove item 1')).toBe(false);
  });

  it('disables Remove at the schema minimum', () => {
    const html = renderToStaticMarkup(<Harness count={1} />);
    expect(disabled(html, 'Remove item 1')).toBe(true);
    expect(disabled(html, 'Add item')).toBe(false);
  });

  it('shows a counter from the schema limit and disables moves past the ends', () => {
    const html = renderToStaticMarkup(<Harness count={2} />);
    expect(html).toContain('2/20');
    expect(disabled(html, 'Move item 1 up')).toBe(true);
    expect(disabled(html, 'Move item 2 down')).toBe(true);
  });
});

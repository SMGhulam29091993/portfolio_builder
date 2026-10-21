/**
 * `portfolio/no-style-literals` over a fixture component (`design-theme.UT10`; AC8): a hex
 * colour, an `rgb()` call and a font family are reported; theme variables pass.
 */
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

import plugin from '@portfolio/eslint-config/plugin';

const lint = async (code: string) => {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.tsx'],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { portfolio: plugin },
        rules: { 'portfolio/no-style-literals': 'error' },
      },
    ],
  });
  const [result] = await eslint.lintText(code, { filePath: 'fixture.tsx' });
  return (result?.messages ?? []).map((message) => message.messageId);
};

describe('portfolio/no-style-literals (design-theme.UT10)', () => {
  it('reports colour and font literals', async () => {
    await expect(lint("export const A = () => <div className=\"bg-[#c0f83c]\" />;")).resolves.toEqual(['colour']);
    await expect(lint("export const B = { color: 'rgb(1, 2, 3)' };")).resolves.toEqual(['colour']);
    await expect(lint("export const C = { fontFamily: 'Inter' };")).resolves.toEqual(['font']);
    await expect(lint('export const D = `font-family: serif`;')).resolves.toEqual(['font']);
  });

  it('lets theme variables through', async () => {
    await expect(lint("export const E = () => <div className=\"bg-[var(--color-accent)] text-text font-display\" />;")).resolves.toEqual([]);
  });
});

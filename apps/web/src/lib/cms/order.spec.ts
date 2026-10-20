/** `moveBy`, `moveTo` — the overview's reorder rules (`cms-panel-shell.AC10`). */
import { describe, expect, it } from 'vitest';

import { moveBy, moveTo } from './order';

describe('reorder rules', () => {
  const order = ['about', 'work', 'experience'];

  it('moves up and down by one', () => {
    expect(moveBy(order, 'work', -1)).toEqual(['work', 'about', 'experience']);
    expect(moveBy(order, 'work', 1)).toEqual(['about', 'experience', 'work']);
  });

  it('leaves the order unchanged at the ends or for an unknown type', () => {
    expect(moveBy(order, 'about', -1)).toEqual(order);
    expect(moveBy(order, 'experience', 1)).toEqual(order);
    expect(moveBy(order, 'blog', 1)).toEqual(order);
  });

  it('moves by drag from one index to another', () => {
    expect(moveTo(order, 0, 2)).toEqual(['work', 'experience', 'about']);
  });
});

/** `pkceChallenge` against the RFC 7636 Appendix B example. */
import { describe, expect, it } from 'vitest';

import { pkceChallenge } from './pkce.js';

describe('pkceChallenge', () => {
  it('matches RFC 7636 Appendix B', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });
});

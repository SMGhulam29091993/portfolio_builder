'use client';
/**
 * Contains one broken section on the public page (`public-site-rendering` → Error Handling): the
 * section is left out, the rest of the page renders, and the failure is logged with the section
 * type only — never its content.
 *
 * A class component by necessity — React's error boundaries exist only as classes — and an
 * exception to `int-standards.nextjs.md` → Components, like the CMS preview's boundary.
 */
import { Component, type ReactNode } from 'react';

interface Props {
  readonly type: string;
  readonly children: ReactNode;
}

export class PublicSectionBoundary extends Component<Props, { readonly failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(): void {
    console.error(`public site: the "${this.props.type}" section failed to render`);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

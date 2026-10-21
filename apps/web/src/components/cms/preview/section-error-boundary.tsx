'use client';
/**
 * Keeps one broken section from blanking the preview (`cms-panel-shell` → Edge Cases;
 * `cms-panel-shell.UT09`): it shows which section failed, and the editor stays usable.
 *
 * A class component by necessity — React's error boundaries exist only as classes — and the
 * one exception to `int-standards.nextjs.md` → Components: "function components only".
 * `resetKey` clears the error when the section's data changes, so fixing the field recovers.
 * Nothing is logged: the error may echo the section's content.
 */
import { Component, type ReactNode } from 'react';

interface Props {
  readonly label: string;
  readonly resetKey: unknown;
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
  readonly resetKey: unknown;
}

export class SectionErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div role="alert" className="m-4 rounded-lg border border-red-400/60 bg-red-950/40 p-4 text-sm text-red-100">
          The {this.props.label} section could not be previewed. Check its fields; the editor still works.
        </div>
      );
    }
    return this.props.children;
  }
}

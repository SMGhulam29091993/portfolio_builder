/**
 * Layout of every signed-in CMS page (`cms-panel-shell.T03`): the panel frame around the page.
 */
import type { ReactNode } from 'react';

import { PanelShell } from '../../../../components/cms/panel/panel-shell';

export default function PanelLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <PanelShell>{children}</PanelShell>;
}

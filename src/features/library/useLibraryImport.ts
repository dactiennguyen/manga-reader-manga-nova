import { useState } from 'react';

import { t } from '../../core/i18n';
import type { ID } from '../../core/model/types';
import { pickToCache, pickerTypes } from '../../native/files';
import { appServices } from '../../state/services';
import { toast } from '../../ui';

export function useLibraryImport(onImported: (projectId: ID) => void) {
  const [importing, setImporting] = useState(false);

  const importProject = async () => {
    let picked: { path: string; name: string } | null = null;
    try {
      picked = await pickToCache(pickerTypes.allFiles);
    } catch {
      toast(t('Could not open this file'));
      return;
    }
    if (!picked) {
      return;
    }
    setImporting(true);
    try {
      onImported(await appServices().importProject(picked.path));
      toast(t('Project imported'));
    } catch {
      toast(t('This file is unreadable or is not a Manganova project'));
    } finally {
      setImporting(false);
    }
  };

  return { importing, importProject };
}

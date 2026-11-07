import { useState } from 'react';

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
      toast('Could not open this file');
      return;
    }
    if (!picked) {
      return;
    }
    setImporting(true);
    try {
      onImported(await appServices().importProject(picked.path));
      toast('Project imported');
    } catch {
      toast('This file is unreadable or is not a Mangaka project');
    } finally {
      setImporting(false);
    }
  };

  return { importing, importProject };
}

import { useState } from 'react';

import { ARCHIVE_EXTENSION, isArchiveName } from '../../core/archive/bundle';
import { pickToCache, pickerTypes, removeFile } from '../../native/files';
import { useAppNavigation } from '../../state/navigation';
import { appServices } from '../../state/services';
import { toast } from '../../ui';

export function useImportArchive() {
  const navigation = useAppNavigation();
  const [importing, setImporting] = useState(false);

  const onImport = async () => {
    if (importing) {
      return;
    }
    setImporting(true);
    let cachePath: string | null = null;
    try {
      const picked = await pickToCache(pickerTypes.allFiles);
      if (!picked) {
        return;
      }
      cachePath = picked.path;
      if (!isArchiveName(picked.name)) {
        toast(`Pick a .${ARCHIVE_EXTENSION} file`);
        return;
      }
      const projectId = await appServices().importProject(picked.path);
      toast('Project imported to your library');
      navigation.navigate('Project', { projectId });
    } catch {
      toast('Could not import this project. The file may be damaged or unsupported.');
    } finally {
      removeFile(cachePath).catch(() => undefined);
      setImporting(false);
    }
  };

  return { importing, onImport };
}

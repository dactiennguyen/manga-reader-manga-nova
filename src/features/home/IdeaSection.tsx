import { useState } from 'react';

import { t } from '../../core/i18n';
import { useSettings } from '../../state/useSettings';
import { Card, ICON, Icon, ListItem } from '../../ui';
import { CaretDownIcon, CaretRightIcon, IdeaIcon } from '../../ui/icons';
import { IdeaCard } from './IdeaCard';

/** "Start from an idea", folded away unless the person said they mostly write. */
export function IdeaSection({ empty }: { empty: boolean }) {
  const writer = useSettings(s => s.role) === 'write';
  const [open, setOpen] = useState(writer);
  return (
    <>
      <Card>
        <ListItem
          title={t('Start from an idea')}
          icon={IdeaIcon}
          right={<Icon icon={open ? CaretDownIcon : CaretRightIcon} size={ICON.md} color="text-secondary" />}
          onPress={() => setOpen(value => !value)}
        />
      </Card>
      {open && <IdeaCard empty={empty} />}
    </>
  );
}

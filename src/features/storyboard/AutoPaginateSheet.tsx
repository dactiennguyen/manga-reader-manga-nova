import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { CloseIcon } from '../../ui/icons';

import { SHOT_LABEL } from '../../core/model/constants';
import { paginate, type PagePlan } from '../../core/model/paginate';
import type { Block, ID, Scene } from '../../core/model/types';
import { plural } from '../../core/util/format';
import { Button, Card, IconButton, Sheet, Stepper, Text } from '../../ui';

const LETTERED: Block['type'][] = ['dialogue', 'narration', 'sfx'];

export function AutoPaginateSheet({
  visible,
  scenes,
  skipBlockIds,
  firstPageNumber,
  onClose,
  onApply,
}: {
  visible: boolean;
  scenes: Scene[];
  skipBlockIds: Set<ID>;
  firstPageNumber: number;
  onClose: () => void;
  onApply: (plans: PagePlan[]) => void;
}) {
  const [pages, setPages] = useState<number | null>(null);
  const natural = useMemo(() => paginate(scenes, { skipBlockIds }), [scenes, skipBlockIds]);
  const plans = useMemo(
    () => (pages === null ? natural : paginate(scenes, { pages, skipBlockIds })),
    [scenes, skipBlockIds, pages, natural],
  );
  const blocks = useMemo(() => {
    const map: Record<ID, Block> = {};
    for (const scene of scenes) {
      for (const block of scene.blocks) {
        map[block.id] = block;
      }
    }
    return map;
  }, [scenes]);
  const panelTotal = plans.reduce((sum, plan) => sum + plan.panels.length, 0);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Auto-paginate"
      subtitle={`${plural(plans.length, 'page')} · ${plural(panelTotal, 'panel')}`}
      right={<IconButton icon={CloseIcon} onPress={onClose} accessibilityLabel="Close" />}
      scroll={false}
      maxHeight="92%"
    >
      <View className="flex-row items-center px-4">
        <Text variant="label" className="flex-1">
          Pages
        </Text>
        <Stepper label="pages" value={pages ?? natural.length} onChange={setPages} min={1} max={80} />
      </View>
      <ScrollView contentContainerClassName="gap-3 p-4">
        {plans.length === 0 && <Text tone="secondary">Nothing left in the script to paginate.</Text>}
        {plans.map((plan, index) => (
          <Card key={index} className="gap-2 p-3">
            <Text variant="caption" tone="accent">
              Page {firstPageNumber + index} · {plural(plan.panels.length, 'panel')}
            </Text>
            {plan.panels.map((panel, panelIndex) => (
              <View key={panelIndex} className="gap-1 pt-2">
                <Text variant="label">
                  Panel {panelIndex + 1}
                  {panel.shot ? ` · ${SHOT_LABEL[panel.shot]}` : ''}
                </Text>
                {!!panel.description && <Text tone="secondary">{panel.description}</Text>}
                {panel.blockIds
                  .map(id => blocks[id])
                  .filter(block => block && LETTERED.includes(block.type))
                  .map(block => (
                    <Text key={block.id} variant="caption" className="pl-2">
                      {block.type === 'dialogue' ? `“${block.text}”` : block.text}
                    </Text>
                  ))}
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>
      <View className="flex-row gap-3 px-4 pt-2">
        <Button title="Cancel" variant="secondary" onPress={onClose} className="flex-1" />
        <Button
          title={`Apply ${plural(plans.length, 'page')}`}
          disabled={plans.length === 0}
          onPress={() => onApply(plans)}
          className="flex-1"
        />
      </View>
    </Sheet>
  );
}

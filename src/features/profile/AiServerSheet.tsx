import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ConnectionIcon, DoneIcon } from '../../ui/icons';

import { normalizeBaseUrl } from '../../core/ai/port';
import { t } from '../../core/i18n';
import { appServices } from '../../state/services';
import { useAiTask } from '../../state/useAiTask';
import { DEFAULT_SETTINGS, useSettings } from '../../state/useSettings';
import { AiErrorBox, AiLoading, Banner, Button, FieldLabel, Sheet, Text, TextField, toast } from '../../ui';

const DEFAULT_MODEL = DEFAULT_SETTINGS.aiModel;
const ADDRESS_MAX = 200;
const KEY_MAX = 300;
const MODEL_MAX = 80;

export function AiServerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [address, setAddress] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const { state, start, cancel } = useAiTask<string>();

  useEffect(() => {
    if (visible) {
      const settings = useSettings.getState();
      setAddress(settings.aiBaseUrl);
      setApiKey(settings.aiApiKey);
      setModel(settings.aiModel);
    } else {
      cancel();
    }
  }, [visible, cancel]);

  const resolved = normalizeBaseUrl(address);

  const edit = (apply: (value: string) => void) => (value: string) => {
    apply(value);
    if (state.status !== 'idle') {
      cancel();
    }
  };

  const test = () => {
    start(() => appServices().testAiConnection({ baseUrl: address, apiKey, model }));
  };

  const save = () => {
    const nextAddress = address.trim();
    useSettings.getState().set({
      aiBaseUrl: nextAddress,
      aiApiKey: apiKey.trim(),
      aiModel: model.trim() || DEFAULT_MODEL,
    });
    toast(nextAddress ? t('AI server saved') : t('AI turned off'));
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('AI server')} subtitle={t('Runs on a server you control')}>
      <View className="gap-3 px-4 pb-2 pt-1">
        <View className="gap-1">
          <FieldLabel>{t('Server address')}</FieldLabel>
          <TextField
            value={address}
            onChangeText={edit(setAddress)}
            onClear={() => edit(setAddress)('')}
            placeholder="ai.example.com"
            accessibilityLabel={t('Server address')}
            maxLength={ADDRESS_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text variant="caption" tone="muted">
            {t('An OpenAI-compatible server. Release builds need https. Leave empty to turn AI off.')}
          </Text>
          {!!resolved && (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {t('Connects to {address}', { address: resolved })}
            </Text>
          )}
        </View>
        <View className="gap-1">
          <FieldLabel>{t('API key (optional)')}</FieldLabel>
          <TextField
            value={apiKey}
            onChangeText={edit(setApiKey)}
            placeholder={t('Only if your server asks for one')}
            accessibilityLabel={t('API key')}
            maxLength={KEY_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>
        <View className="gap-1">
          <FieldLabel>{t('Model')}</FieldLabel>
          <TextField
            value={model}
            onChangeText={edit(setModel)}
            placeholder={DEFAULT_MODEL}
            accessibilityLabel={t('Model')}
            maxLength={MODEL_MAX}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {state.status === 'loading' && <AiLoading label={t('Contacting the server…')} onCancel={cancel} />}
        {state.status === 'done' && (
          <Banner tone="success" icon={DoneIcon} text={t('Connected. The server answered the test message.')} />
        )}
        {state.status === 'error' && <AiErrorBox message={state.message} onRetry={test} onCancel={cancel} />}
        {(state.status === 'idle' || state.status === 'done') && (
          <Button
            title={state.status === 'done' ? t('Test again') : t('Test connection')}
            variant="secondary"
            icon={ConnectionIcon}
            onPress={test}
            disabled={!resolved}
          />
        )}

        <View className="flex-row gap-3">
          <Button title={t('Cancel')} variant="ghost" onPress={onClose} className="flex-1" />
          <Button title={t('Save')} onPress={save} className="flex-1" />
        </View>
      </View>
    </Sheet>
  );
}

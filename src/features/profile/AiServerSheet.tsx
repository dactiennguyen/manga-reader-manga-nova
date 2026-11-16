import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ConnectionIcon, DoneIcon, SendIcon } from '../../ui/icons';

import { normalizeBaseUrl } from '../../core/ai/port';
import { t } from '../../core/i18n';
import { appServices } from '../../state/services';
import { useAiTask } from '../../state/useAiTask';
import { DEFAULT_SETTINGS, aiConsentGiven, useSettings } from '../../state/useSettings';
import { AiErrorBox, AiLoading, Banner, Button, FieldLabel, Sheet, SwitchRow, Text, TextField, toast } from '../../ui';

const DEFAULT_MODEL = DEFAULT_SETTINGS.aiModel;
const ADDRESS_MAX = 200;
const KEY_MAX = 300;
const MODEL_MAX = 80;

/** "ai.example.com" from "https://ai.example.com/v1": the name people recognise. */
function serverName(resolved: string): string {
  return resolved.replace(/^https?:\/\//i, '').split('/')[0];
}

export function AiServerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [address, setAddress] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  // The address the switch was turned on for: typing another address turns it off again.
  const [allowedFor, setAllowedFor] = useState('');
  const { state, start, cancel } = useAiTask<string>();

  useEffect(() => {
    if (visible) {
      const settings = useSettings.getState();
      setAddress(settings.aiBaseUrl);
      setApiKey(settings.aiApiKey);
      setModel(settings.aiModel);
      setAllowedFor(aiConsentGiven(settings) ? settings.aiConsentFor : '');
    } else {
      cancel();
    }
  }, [visible, cancel]);

  const resolved = normalizeBaseUrl(address);
  const allowed = !!resolved && allowedFor === resolved;
  const server = serverName(resolved);

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
    if (resolved && !allowed) {
      return;
    }
    useSettings.getState().set({
      aiBaseUrl: nextAddress,
      // Consent is kept with the one address it was given for (guideline 5.1.2(i)).
      aiConsentFor: resolved && allowed ? resolved : '',
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

        {!!resolved && (
          <View className="gap-2 rounded-lg bg-surface p-3">
            <Text variant="label">{t('What is sent to {server}', { server })}</Text>
            <Text variant="bodySmall" tone="secondary">
              {t(
                'Each time you use an AI tool, Manganova sends the text that request needs: the story title and logline, character profiles, world notes marked to send to AI, the relevant script, and what you type. Drawings, pictures and voice recordings are never sent.',
              )}
            </Text>
            <Text variant="bodySmall" tone="secondary">
              {t('The server is run by whoever set it up, not by Manganova. Its owner may keep or use this text under their own rules.')}
            </Text>
            <View className="-mx-3">
              <SwitchRow
                icon={SendIcon}
                title={t('Allow Manganova to send this text to {server}', { server })}
                value={allowed}
                onValueChange={value => setAllowedFor(value ? resolved : '')}
              />
            </View>
            {!allowed && (
              <Text variant="caption" tone="muted">
                {t('Turn this on to save the server. None of your text is sent until you do.')}
              </Text>
            )}
          </View>
        )}

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
          <Button title={t('Save')} onPress={save} disabled={!!resolved && !allowed} className="flex-1" />
        </View>
      </View>
    </Sheet>
  );
}

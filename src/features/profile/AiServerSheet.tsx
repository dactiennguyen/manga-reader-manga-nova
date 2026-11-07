import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CircleCheck, Wifi } from 'lucide-react-native';

import { normalizeBaseUrl } from '../../core/ai/port';
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
    toast(nextAddress ? 'AI server saved' : 'AI turned off');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="AI server" subtitle="Runs on a server you control">
      <View className="gap-3 px-4 pb-2 pt-1">
        <View className="gap-1">
          <FieldLabel>Server address</FieldLabel>
          <TextField
            value={address}
            onChangeText={edit(setAddress)}
            onClear={() => edit(setAddress)('')}
            placeholder="ai.example.com"
            accessibilityLabel="Server address"
            maxLength={ADDRESS_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text variant="caption" tone="muted">
            An OpenAI-compatible server. Release builds need https. Leave empty to turn AI
            off.
          </Text>
          {!!resolved && (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              Connects to {resolved}
            </Text>
          )}
        </View>
        <View className="gap-1">
          <FieldLabel>API key (optional)</FieldLabel>
          <TextField
            value={apiKey}
            onChangeText={edit(setApiKey)}
            placeholder="Only if your server asks for one"
            accessibilityLabel="API key"
            maxLength={KEY_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
        </View>
        <View className="gap-1">
          <FieldLabel>Model</FieldLabel>
          <TextField
            value={model}
            onChangeText={edit(setModel)}
            placeholder={DEFAULT_MODEL}
            accessibilityLabel="Model"
            maxLength={MODEL_MAX}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {state.status === 'loading' && <AiLoading label="Contacting the server…" onCancel={cancel} />}
        {state.status === 'done' && (
          <Banner tone="success" icon={CircleCheck} text="Connected. The server answered the test message." />
        )}
        {state.status === 'error' && <AiErrorBox message={state.message} onRetry={test} onCancel={cancel} />}
        {(state.status === 'idle' || state.status === 'done') && (
          <Button
            title={state.status === 'done' ? 'Test again' : 'Test connection'}
            variant="secondary"
            icon={Wifi}
            onPress={test}
            disabled={!resolved}
          />
        )}

        <View className="flex-row gap-3">
          <Button title="Cancel" variant="ghost" onPress={onClose} className="flex-1" />
          <Button title="Save" onPress={save} className="flex-1" />
        </View>
      </View>
    </Sheet>
  );
}

import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, View, useWindowDimensions } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';

import { t } from '../../core/i18n';
import { classifyScan } from '../../core/nearby/qrRead';
import { pickQrImage } from '../../native/qrImage';
import { navigationRef, useAppNavigation } from '../../state/navigation';
import { AppBar, Button, ICON, Screen, Text, toast, useColor } from '../../ui';
import { ImagesIcon, ScanIcon } from '../../ui/icons';
import { handleNearbyLink } from './deepLink';
import { ScanCamera, useBackCamera } from './scan/ScanCamera';

const FINDER_MAX = 420;
/** A code that is not ours is mentioned once, not on every frame it stays in view. */
const OTHER_QUIET_MS = 3000;

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  return active;
}

/** Four corner marks over the camera, so it reads as a viewfinder. */
function FinderCorners() {
  const corner = 'absolute h-10 w-10 border-accent';
  return (
    <View pointerEvents="none" className="absolute inset-5">
      <View className={`${corner} left-0 top-0 rounded-tl-2xl border-l-4 border-t-4`} />
      <View className={`${corner} right-0 top-0 rounded-tr-2xl border-r-4 border-t-4`} />
      <View className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-4 border-l-4`} />
      <View className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-4 border-r-4`} />
    </View>
  );
}

/** What the viewfinder shows when there is no live camera: a reason and, when it helps, a way out. */
function FinderMessage({ title, message, action }: { title: string; message: string; action?: { label: string; onPress: () => void } }) {
  const muted = useColor('text-muted');
  return (
    <View className="flex-1 items-center justify-center gap-3 p-6">
      <ScanIcon size={ICON.xxl} color={muted} />
      <Text variant="title" className="text-center">
        {title}
      </Text>
      <Text tone="muted" className="text-center">
        {message}
      </Text>
      {action && <Button title={action.label} variant="secondary" small onPress={action.onPress} />}
    </View>
  );
}

/**
 * Scans a room QR code or a friend's mangaka card inside the app, so it works even where the phone's
 * camera app does not open `manganova://` links. A photo or screenshot of the code works too.
 */
export function ScanCodeScreen() {
  const navigation = useAppNavigation();
  const muted = useColor('text-muted');
  const { width } = useWindowDimensions();
  const focused = useIsFocused();
  const appActive = useAppActive();
  const permission = useCameraPermission();
  const device = useBackCamera();
  const [reading, setReading] = useState(false);
  const done = useRef(false);
  const otherAt = useRef(0);

  // Asked for only once a camera is found: a phone without one is offered a photo, with no prompt.
  const { canRequestPermission, requestPermission } = permission;
  const hasCamera = !!device;
  useEffect(() => {
    if (hasCamera && canRequestPermission) {
      requestPermission().catch(() => undefined);
    }
  }, [hasCamera, canRequestPermission, requestPermission]);

  /** True when the text was ours and is now being opened. */
  const open = useCallback(
    (text: string): boolean => {
      if (done.current) {
        return true;
      }
      const code = classifyScan(text);
      if (code.kind === 'other') {
        return false;
      }
      done.current = true;
      navigation.goBack();
      handleNearbyLink(code.url, navigationRef);
      return true;
    },
    [navigation],
  );

  const onCode = useCallback(
    (text: string) => {
      const now = Date.now();
      if (!open(text) && now - otherAt.current > OTHER_QUIET_MS) {
        otherAt.current = now;
        toast(t('This is not a Manganova code.'));
      }
    },
    [open],
  );

  const pickPhoto = async () => {
    setReading(true);
    try {
      const text = await pickQrImage();
      if (text === undefined) {
        return;
      }
      if (!text) {
        toast(t('No QR code found in that photo.'));
      } else if (!open(text)) {
        toast(t('This is not a Manganova code.'));
      }
    } catch {
      toast(t("This file can't be read."));
    } finally {
      setReading(false);
    }
  };

  let finder;
  if (device === null) {
    finder = <FinderMessage title={t('This phone has no camera')} message={t('Pick a photo or screenshot of the QR code instead.')} />;
  } else if (!permission.hasPermission && !permission.canRequestPermission) {
    finder = (
      <FinderMessage
        title={t('Allow the camera to scan codes')}
        message={t('Manganova uses the camera only to read QR codes. You can also pick a photo of the code.')}
        action={{ label: t('Open Settings'), onPress: () => Linking.openSettings().catch(() => undefined) }}
      />
    );
  } else if (!permission.hasPermission || device === undefined) {
    finder = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color={muted} />
      </View>
    );
  } else {
    finder = (
      <>
        <ScanCamera device={device} active={focused && appActive && !done.current} onCode={onCode} />
        <FinderCorners />
      </>
    );
  }

  const side = Math.min(FINDER_MAX, width - 32);
  return (
    <Screen scroll>
      <AppBar title={t('Scan a QR code')} onBack={() => navigation.goBack()} />
      <View className="items-center gap-4">
        <View className="overflow-hidden rounded-3xl bg-raised" style={{ width: side, height: side }}>
          {finder}
        </View>
        {device !== null ? (
          <Text tone="muted" className="text-center" style={{ maxWidth: side }}>
            {t("Point at a room's QR code or a friend's mangaka card.")}
          </Text>
        ) : null}
        <Button title={t('Pick a photo of a QR code')} icon={ImagesIcon} variant="secondary" loading={reading} onPress={pickPhoto} />
      </View>
    </Screen>
  );
}

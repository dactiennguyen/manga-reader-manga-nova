import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  Camera,
  VisionCamera,
  getCameraDevice,
  isScannedCode,
  useObjectOutput,
  type CameraDevice,
  type ScannedObject,
  type ScannedObjectType,
} from 'react-native-vision-camera';

type Props = { device: CameraDevice; active: boolean; onCode: (text: string) => void };

/**
 * The back camera: undefined while the cameras are being listed, null when the phone has none (an iOS
 * Simulator, a tablet without one), so the screen can offer a photo instead of waiting forever.
 */
export function useBackCamera(): CameraDevice | null | undefined {
  const [device, setDevice] = useState<CameraDevice | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    let remove: (() => void) | undefined;
    VisionCamera.createDeviceFactory()
      .then(factory => {
        if (!alive) {
          return;
        }
        const pick = () => setDevice(getCameraDevice(factory, 'back') ?? factory.cameraDevices[0] ?? null);
        pick();
        const listener = factory.addOnCameraDevicesChangedListener(pick);
        remove = () => listener.remove();
      })
      .catch(() => alive && setDevice(null));
    return () => {
      alive = false;
      remove?.();
    };
  }, []);
  return device;
}

const QR_TYPES: ScannedObjectType[] = ['qr'];

/** iOS reads codes with the system's own detector (AVFoundation metadata output). */
function IosScanCamera({ device, active, onCode }: Props) {
  const onObjectsScanned = useCallback(
    (objects: ScannedObject[]) => {
      const code = objects.find(isScannedCode);
      if (code?.value) {
        onCode(code.value);
      }
    },
    [onCode],
  );
  const output = useObjectOutput({ types: QR_TYPES, onObjectsScanned });
  return <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} outputs={[output]} />;
}

/**
 * Android has no system detector, so it uses the ML Kit plugin. The plugin is linked on Android only
 * (react-native.config.js): its iOS pod pulls in all of ML Kit, which the system detector makes unneeded.
 * So it is required here and never imported at the top, where iOS would try to load it.
 */
function AndroidScanCamera({ device, active, onCode }: Props) {
  const { useBarcodeScannerOutput } = require('react-native-vision-camera-barcode-scanner') as typeof import('react-native-vision-camera-barcode-scanner');
  const output = useBarcodeScannerOutput({
    barcodeFormats: ['qr-code'],
    onBarcodeScanned: barcodes => {
      const value = barcodes.find(barcode => barcode.rawValue)?.rawValue;
      if (value) {
        onCode(value);
      }
    },
    onError: () => undefined,
  });
  return <Camera style={StyleSheet.absoluteFill} device={device} isActive={active} outputs={[output]} />;
}

/** The live camera with a QR reader attached. Calls `onCode` for every code it sees; the caller debounces. */
export const ScanCamera = Platform.OS === 'android' ? AndroidScanCamera : IosScanCamera;

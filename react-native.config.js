/**
 * The ML Kit barcode plugin is linked on Android only. iOS reads QR codes with the system detector
 * (VisionCamera's object output), so its pod, which pulls in all of Google ML Kit, is left out.
 * See src/features/nearby/scan/ScanCamera.tsx.
 */
module.exports = {
  dependencies: {
    'react-native-vision-camera-barcode-scanner': {
      platforms: { ios: null },
    },
  },
};

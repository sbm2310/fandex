import type { BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import ScanScreen from '@/app/scan';

// The camera can't run under Jest: CameraView is replaced by a stub that hands its
// onBarcodeScanned callback to the test, so tests can "scan" any barcode.
let scanBarcode: ((result: Pick<BarcodeScanningResult, 'data' | 'type'>) => void) | undefined;
const mockPermission = jest.fn();
const mockRequestPermission = jest.fn();

jest.mock('expo-camera', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    CameraView: (props: { onBarcodeScanned?: typeof scanBarcode }) => {
      scanBarcode = props.onBarcodeScanned;
      return <View testID="camera" />;
    },
    useCameraPermissions: () => [mockPermission(), mockRequestPermission],
  };
});

const granted = { granted: true, canAskAgain: true, status: 'granted' };

describe('Scan screen', () => {
  let dismissTo: jest.SpyInstance;

  beforeEach(() => {
    scanBarcode = undefined;
    mockPermission.mockReset();
    mockRequestPermission.mockReset();
    dismissTo = jest.spyOn(router, 'dismissTo').mockImplementation(() => undefined);
  });

  afterEach(() => dismissTo.mockRestore());

  it('asks for camera access the first time', async () => {
    mockPermission.mockReturnValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    await render(<ScanScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Allow camera access' }));

    expect(mockRequestPermission).toHaveBeenCalled();
    expect(screen.queryByTestId('camera')).toBeNull();
  });

  it('points to Settings when access was denied before', async () => {
    mockPermission.mockReturnValue({ granted: false, canAskAgain: false, status: 'denied' });
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await render(<ScanScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));

    expect(openSettings).toHaveBeenCalled();
  });

  it('returns a scanned book ISBN to the Add screen', async () => {
    mockPermission.mockReturnValue(granted);
    await render(<ScanScreen />);

    await act(() => scanBarcode?.({ data: '9780345445605', type: 'ean13' }));

    expect(dismissTo).toHaveBeenCalledWith({
      pathname: '/add',
      params: { isbn: '9780345445605', scan: expect.any(String) },
    });
  });

  it('ignores repeat reads of the same barcode', async () => {
    mockPermission.mockReturnValue(granted);
    await render(<ScanScreen />);

    await act(() => {
      scanBarcode?.({ data: '9780345445605', type: 'ean13' });
      scanBarcode?.({ data: '9780345445605', type: 'ean13' });
      scanBarcode?.({ data: '9780345445605', type: 'ean13' });
    });

    expect(dismissTo).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a non-book product', '4006381333931'],
    ['sheet music (ISMN)', '9790260000438'],
    ['a misread barcode', '9780345445606'],
  ])('rejects %s and keeps scanning', async (_, data) => {
    mockPermission.mockReturnValue(granted);
    await render(<ScanScreen />);

    await act(() => scanBarcode?.({ data, type: 'ean13' }));

    expect(screen.getByText("That's not a book barcode")).toBeOnTheScreen();
    expect(dismissTo).not.toHaveBeenCalled();

    await act(() => scanBarcode?.({ data: '9780345445605', type: 'ean13' }));
    expect(dismissTo).toHaveBeenCalledTimes(1);
  });
});

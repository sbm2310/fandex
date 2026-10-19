import { deviceName } from './device-name';

describe('deviceName', () => {
  // Real User-Agents recorded by the local API (2026-10-19), plus common browsers.
  it.each([
    ['Expo/1017880 CFNetwork/3896.100.1.2.1 Darwin/27.0.0', 'Fandex on iPhone'],
    ['Expo/57.0.9 CFNetwork/3860.400.51 Darwin/24.6.0', 'Fandex on iPhone'],
    ['okhttp/4.12.0', 'Fandex on Android'],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
      'Chrome on Mac',
    ],
    [
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
      'Chrome on Android',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Mobile/15E148 Safari/604.1',
      'Safari on iPhone',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15',
      'Safari on Mac',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0',
      'Edge on Windows',
    ],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox on Linux'],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/154.0 Mobile/15E148 Safari/604.1',
      'Chrome on iPhone',
    ],
  ])('%s → %s', (agent, name) => {
    expect(deviceName(agent)).toBe(name);
  });

  it.each([[undefined], [null], [''], ['curl/8.7.1']])('calls %p an unknown device', (agent) => {
    expect(deviceName(agent)).toBe('Unknown device');
  });
});

import { resolveApiUrl } from '@/services/api-url';

describe('resolveApiUrl', () => {
  it('uses the configured URL when set (without a trailing slash)', () => {
    expect(
      resolveApiUrl({
        configuredUrl: 'https://api.fandex.example/',
        platform: 'ios',
        devServerHost: '10.0.0.5:8081',
      }),
    ).toBe('https://api.fandex.example');
  });

  it('on web, uses the page host on the API port', () => {
    expect(
      resolveApiUrl({ platform: 'web', webLocation: { protocol: 'http:', hostname: 'localhost' } }),
    ).toBe('http://localhost:3000');
  });

  it("on a phone in development, uses the Mac's address from Expo's dev server", () => {
    expect(resolveApiUrl({ platform: 'ios', devServerHost: '192.168.1.20:8081' })).toBe(
      'http://192.168.1.20:3000',
    );
  });

  it('falls back to localhost', () => {
    expect(resolveApiUrl({ platform: 'ios' })).toBe('http://localhost:3000');
  });
});

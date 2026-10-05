import { resolveApiUrl } from '@/services/api-url';

describe('resolveApiUrl', () => {
  it('uses the configured URL when set (without a trailing slash)', () => {
    expect(
      resolveApiUrl({
        configuredUrl: 'https://api.fandex.example/',
        platform: 'ios',
        devServerHost: '10.0.0.5:8081',
        isDevelopment: true,
      }),
    ).toBe('https://api.fandex.example');
  });

  it('on web in development, uses the page host on the API port', () => {
    expect(
      resolveApiUrl({
        platform: 'web',
        webLocation: { protocol: 'http:', hostname: 'localhost', origin: 'http://localhost:8081' },
        isDevelopment: true,
      }),
    ).toBe('http://localhost:3000');
  });

  it('on web in production, uses the page origin (the API serves the web app)', () => {
    expect(
      resolveApiUrl({
        platform: 'web',
        webLocation: {
          protocol: 'https:',
          hostname: 'fandex.onrender.com',
          origin: 'https://fandex.onrender.com',
        },
        isDevelopment: false,
      }),
    ).toBe('https://fandex.onrender.com');
  });

  it("on a phone in development, uses the Mac's address from Expo's dev server", () => {
    expect(
      resolveApiUrl({ platform: 'ios', devServerHost: '192.168.1.20:8081', isDevelopment: true }),
    ).toBe('http://192.168.1.20:3000');
  });

  it('falls back to localhost', () => {
    expect(resolveApiUrl({ platform: 'ios', isDevelopment: true })).toBe('http://localhost:3000');
  });
});

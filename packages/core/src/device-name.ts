/**
 * A person-readable name for a signed-in device, from the User-Agent its requests sent:
 * "Fandex on iPhone", "Chrome on Mac", "Safari on iPhone"… The app on iOS sends Expo's
 * `Expo/… CFNetwork/… Darwin/…`, on Android OkHttp's `okhttp/…`.
 */
export function deviceName(userAgent: string | null | undefined): string {
  const agent = userAgent?.trim() ?? '';
  if (!agent) return 'Unknown device';
  if (/^Expo\/.*CFNetwork/.test(agent)) return 'Fandex on iPhone';
  if (/^okhttp\//i.test(agent)) return 'Fandex on Android';
  if (!agent.startsWith('Mozilla/')) return 'Unknown device';

  const system = operatingSystem(agent);
  const app = browser(agent);
  if (app && system) return `${app} on ${system}`;
  return app ?? (system ? `A browser on ${system}` : 'A web browser');
}

function operatingSystem(agent: string): string | undefined {
  if (/iPhone/.test(agent)) return 'iPhone';
  if (/iPad/.test(agent)) return 'iPad';
  if (/Android/.test(agent)) return 'Android';
  if (/Macintosh|Mac OS X/.test(agent)) return 'Mac';
  if (/Windows/.test(agent)) return 'Windows';
  if (/CrOS/.test(agent)) return 'ChromeOS';
  if (/Linux/.test(agent)) return 'Linux';
  return undefined;
}

/** Order matters: Edge and Opera also say "Chrome", Chrome also says "Safari". */
function browser(agent: string): string | undefined {
  if (/Edg(e|A|iOS)?\//.test(agent)) return 'Edge';
  if (/OPR\/|Opera/.test(agent)) return 'Opera';
  if (/Firefox\/|FxiOS\//.test(agent)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(agent)) return 'Chrome';
  if (/Safari\//.test(agent)) return 'Safari';
  return undefined;
}

// Whether device tilt may drive the parallax, for the whole session (UI3 Ruling A5). iOS asks for
// permission (DeviceOrientationEvent.requestPermission), which only works inside a user gesture:
// the title's « Entrer » tap calls requestTilt() synchronously. Elsewhere there is no permission
// API and tilt is simply on (a device without a gyroscope never fires the event).
export type TiltPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

export const tilt = $state<{ permission: TiltPermission }>({ permission: 'unknown' });

interface PermissionApi {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
}

export function requestTilt(): Promise<TiltPermission> {
  if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
    tilt.permission = 'unavailable';
    return Promise.resolve(tilt.permission);
  }
  const api = window.DeviceOrientationEvent as unknown as PermissionApi;
  if (typeof api.requestPermission !== 'function') {
    tilt.permission = 'granted';
    return Promise.resolve(tilt.permission);
  }
  return api
    .requestPermission()
    .then((answer) => (tilt.permission = answer === 'granted' ? 'granted' : 'denied'))
    .catch(() => (tilt.permission = 'denied'));
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestTilt, tilt } from './tiltState.svelte';

beforeEach(() => {
  tilt.permission = 'unknown';
});

afterEach(() => vi.unstubAllGlobals());

describe('requestTilt (UI3 Ruling A5)', () => {
  it('is unavailable when there is no DeviceOrientationEvent (no gyroscope / SSR)', async () => {
    vi.stubGlobal('DeviceOrientationEvent', undefined);
    await expect(requestTilt()).resolves.toBe('unavailable');
    expect(tilt.permission).toBe('unavailable');
  });

  it('is granted directly when DeviceOrientationEvent has no requestPermission (non-iOS)', async () => {
    vi.stubGlobal('DeviceOrientationEvent', class {});
    await expect(requestTilt()).resolves.toBe('granted');
    expect(tilt.permission).toBe('granted');
  });

  it('is granted when requestPermission resolves "granted"', async () => {
    vi.stubGlobal('DeviceOrientationEvent', { requestPermission: () => Promise.resolve('granted') });
    await expect(requestTilt()).resolves.toBe('granted');
    expect(tilt.permission).toBe('granted');
  });

  it('is denied when requestPermission resolves "denied"', async () => {
    vi.stubGlobal('DeviceOrientationEvent', { requestPermission: () => Promise.resolve('denied') });
    await expect(requestTilt()).resolves.toBe('denied');
    expect(tilt.permission).toBe('denied');
  });

  it('is denied when requestPermission rejects', async () => {
    vi.stubGlobal('DeviceOrientationEvent', { requestPermission: () => Promise.reject(new Error('nope')) });
    await expect(requestTilt()).resolves.toBe('denied');
    expect(tilt.permission).toBe('denied');
  });

  it('is denied, and never throws, when requestPermission throws synchronously', async () => {
    vi.stubGlobal('DeviceOrientationEvent', {
      requestPermission: () => {
        throw new Error('Permissions-Policy');
      },
    });
    await expect(requestTilt()).resolves.toBe('denied');
    expect(tilt.permission).toBe('denied');
  });
});

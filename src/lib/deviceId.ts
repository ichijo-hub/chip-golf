import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

const KEY = 'chip_golf_device_id';

export async function getDeviceId(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getId();
      return info.identifier;
    } catch {
      // プラグイン未リンク時は localStorage UUID にフォールバック
    }
  }
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

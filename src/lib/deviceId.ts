import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

const KEY = 'chip_golf_device_id';

export async function getDeviceId(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const info = await Device.getId();
    return info.identifier;
  }
  // Web フォールバック: localStorage に UUID を生成して永続化
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

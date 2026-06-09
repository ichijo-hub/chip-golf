import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { getDeviceId } from '@/lib/deviceId';
import { ChipDefinition } from '@/types';

export async function saveChipToLibrary(chip: ChipDefinition): Promise<void> {
  if (chip.chip_template_id !== null) return;
  const deviceId = await getDeviceId();
  const key = `${chip.name}__${chip.chip_type}`;
  await setDoc(
    doc(db, 'device_data', deviceId, 'chip_library', key),
    {
      name: chip.name,
      chip_type: chip.chip_type,
      point_value: chip.point_value,
      image_url: chip.image_url ?? null,
      image_scale: chip.image_scale ?? null,
      image_offset_y: chip.image_offset_y ?? null,
      condition: chip.condition ?? null,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function saveGameChipsToLibrary(chips: ChipDefinition[]): Promise<void> {
  const originals = chips.filter(c => c.chip_template_id === null);
  if (originals.length === 0) return;
  await Promise.all(originals.map(c => saveChipToLibrary(c).catch(() => {})));
}

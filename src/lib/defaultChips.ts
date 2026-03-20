import { ChipType } from '@/types';

export interface DefaultChip {
  name: string;
  chip_type: ChipType;
  point_value: number;
  sort_order: number;
}

export const DEFAULT_CHIPS: DefaultChip[] = [
  // ポジティブチップ
  { name: 'バーディー', chip_type: 'positive', point_value: 1, sort_order: 0 },
  { name: 'パー', chip_type: 'positive', point_value: 1, sort_order: 1 },
  { name: 'チップイン', chip_type: 'positive', point_value: 1, sort_order: 2 },
  { name: '砂イチ', chip_type: 'positive', point_value: 1, sort_order: 3 },
  { name: 'ニアピン', chip_type: 'positive', point_value: 1, sort_order: 4 },
  { name: '1パット', chip_type: 'positive', point_value: 1, sort_order: 5 },
  // ネガティブチップ
  { name: 'OB', chip_type: 'negative', point_value: 1, sort_order: 6 },
  { name: '池ポチャ', chip_type: 'negative', point_value: 1, sort_order: 7 },
  { name: 'バンカー', chip_type: 'negative', point_value: 1, sort_order: 8 },
  { name: '3パット', chip_type: 'negative', point_value: 1, sort_order: 9 },
  { name: '木に当てる', chip_type: 'negative', point_value: 1, sort_order: 10 },
  { name: '7打以上', chip_type: 'negative', point_value: 1, sort_order: 11 },
];

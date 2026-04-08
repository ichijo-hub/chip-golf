import { ChipType } from '@/types';

export interface DefaultChip {
  name: string;
  chip_type: ChipType;
  point_value: number;
  sort_order: number;
  image_url?: string;
  image_scale?: number;
  image_offset_y?: number;
  condition?: string;
}

export const DEFAULT_CHIPS: DefaultChip[] = [
  // ポジティブチップ
  { name: 'ホールインワン', chip_type: 'positive', point_value: 10, sort_order: 0, image_url: '/chips/HoleInOne.webp', image_scale: 1.5, image_offset_y: 36, condition: 'ティーショット1打でカップイン' },
  { name: 'イーグル', chip_type: 'positive', point_value: 3, sort_order: 1, image_url: '/chips/EAGLE.webp', image_scale: 1.5, image_offset_y: 36, condition: 'パーより2打少ないスコアでホールアウト' },
  { name: 'バーディー', chip_type: 'positive', point_value: 2, sort_order: 2, image_url: '/chips/BIRDIE.webp', image_scale: 1.5, image_offset_y: 34, condition: 'パーより1打少ないスコアでホールアウト' },
  { name: 'チップイン', chip_type: 'positive', point_value: 2, sort_order: 3, image_url: '/chips/CHIPIN.webp', image_scale: 1.4, image_offset_y: 31, condition: 'グリーン外からカップイン' },
  { name: 'ロングパット', chip_type: 'positive', point_value: 2, sort_order: 4, image_url: '/chips/LONGPUTT.webp', image_scale: 1.4, image_offset_y: 31, condition: '長距離パットがカップイン（距離は事前に決める）' },
  { name: 'パー', chip_type: 'positive', point_value: 1, sort_order: 5, image_url: '/chips/PAR.webp', image_scale: 1.0, image_offset_y: 40, condition: '規定打数でホールアウト' },
  { name: '1パット', chip_type: 'positive', point_value: 1, sort_order: 6, image_url: '/chips/1PUTT.webp', image_scale: 1.1, image_offset_y: 28, condition: 'グリーンオン後1パットでホールアウト' },
  { name: 'オンリーワン', chip_type: 'positive', point_value: 1, sort_order: 7, image_url: '/chips/ONLYONE.webp', image_scale: 1.4, image_offset_y: 20, condition: 'ティーショットで唯一フェアウェイをキープ' },
  // ネガティブチップ
  { name: 'OB', chip_type: 'negative', point_value: 2, sort_order: 8, image_url: '/chips/OB.webp', image_scale: 1.4, image_offset_y: 33, condition: 'アウトオブバウンズ' },
  { name: '池ポチャ', chip_type: 'negative', point_value: 2, sort_order: 9, image_url: '/chips/WATER.webp', image_scale: 1.3, image_offset_y: 37, condition: 'ウォーターハザードに入れる' },
  { name: '3パット', chip_type: 'negative', point_value: 2, sort_order: 10, image_url: '/chips/THREEPUTT.webp', image_scale: 1.3, image_offset_y: 33, condition: '3パット以上でホールアウト' },
  { name: 'バンカー', chip_type: 'negative', point_value: 1, sort_order: 11, image_url: '/chips/BUNKER.webp', image_scale: 1.2, image_offset_y: 27, condition: 'バンカーに入れる' },
  { name: '木に当てる', chip_type: 'negative', point_value: 1, sort_order: 12, image_url: '/chips/TREE.webp', image_scale: 1.2, image_offset_y: 34, condition: 'ショットが木に当たる' },
  { name: 'カート道', chip_type: 'negative', point_value: 1, sort_order: 13, image_url: '/chips/CART.webp', image_scale: 1.3, image_offset_y: 34, condition: 'ボールがカート道に乗る' },
  { name: 'チキンミス', chip_type: 'negative', point_value: 1, sort_order: 14, image_url: '/chips/CHICKEN.webp', image_scale: 1.2, image_offset_y: 18, condition: '極端に短いショット・空振り' },
];

import { ImageResponse } from 'next/og';
import { ChipGolfIcon } from '../icon';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(<ChipGolfIcon size={192} />, { width: 192, height: 192 });
}

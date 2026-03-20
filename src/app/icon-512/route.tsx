import { ImageResponse } from 'next/og';
import { ChipGolfIcon } from '../icon';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(<ChipGolfIcon size={512} />, { width: 512, height: 512 });
}

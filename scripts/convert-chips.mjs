import sharp from 'sharp';
import { readdir, unlink } from 'fs/promises';
import { join, extname, basename } from 'path';

const dir = 'public/chips';
const files = (await readdir(dir)).filter(f => extname(f).toLowerCase() === '.png');

for (const file of files) {
  const input = join(dir, file);
  const output = join(dir, basename(file, '.png') + '.webp');
  await sharp(input).webp({ quality: 85 }).toFile(output);
  const { size: before } = await import('fs').then(fs => fs.promises.stat(input));
  const { size: after } = await import('fs').then(fs => fs.promises.stat(output));
  console.log(`${file}: ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB (${Math.round((1-after/before)*100)}%削減)`);
  await unlink(input);
}
console.log('完了');

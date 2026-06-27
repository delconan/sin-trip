import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageIds = [
  "photo-1566073771259-6a8506099945",
  "photo-1525625293386-3f8f99389edd",
  "photo-1559339352-11d035aa65de",
  "photo-1607988795691-3d0147b43231",
  "photo-1516426122078-c23e76319801",
  "photo-1495474472287-4d71bcdd2085",
  "photo-1500530855697-b586d89ba3ee",
  "photo-1574227492706-f65b24c3688a",
  "photo-1533628635777-112b2239b1c7",
  "photo-1504674900247-0877df9cc836",
  "photo-1565967511849-76a60a516170",
  "photo-1524230572899-a752b3835840",
  "photo-1544986581-efac024faf62",
  "photo-1512058564366-18510be2db19",
  "photo-1603133872878-684f208fb84b",
  "photo-1549366021-9f761d450615",
  "photo-1531058020387-3be344556be6",
  "photo-1546026423-cc4642628d2b",
  "photo-1547592180-85f173990554",
  "photo-1501443762994-82bd5dace89a",
];

const outputDir = path.join(process.cwd(), "public", "activity-images");
await mkdir(outputDir, { recursive: true });

for (const id of imageIds) {
  const response = await fetch(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=86`);
  if (!response.ok) throw new Error(`Unable to fetch ${id}: ${response.status}`);
  const optimized = await sharp(Buffer.from(await response.arrayBuffer()))
    .resize(900, 600, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  await writeFile(path.join(outputDir, `${id}.webp`), optimized);
  console.log(`${id}.webp (${Math.round(optimized.byteLength / 1024)} KB)`);
}

/** One WebGL2 texture array from same-sized images, one layer each (M10 §5.1). */
import * as THREE from 'three';

/**
 * Loads the images and packs them, bottom row first like an image texture with flipY (so v = 0 is the
 * image's bottom), into a mipmapped sRGB `DataArrayTexture` of `size` × `size` layers.
 */
export async function loadTextureArray(urls: readonly string[], size: number): Promise<THREE.DataArrayTexture> {
  const images = await Promise.all(urls.map((url) => new THREE.ImageLoader().loadAsync(url)));
  const data = new Uint8Array(size * size * 4 * urls.length);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const row = size * 4;
  images.forEach((img, layer) => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    const base = layer * size * row;
    for (let y = 0; y < size; y++) data.set(px.subarray(y * row, (y + 1) * row), base + (size - 1 - y) * row);
  });
  const tex = new THREE.DataArrayTexture(data, size, size, urls.length);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

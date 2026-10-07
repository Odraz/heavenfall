/** One WebGL2 texture array from images, one layer each (M10 §5.1, M10 gate §2). */
import * as THREE from 'three';

/**
 * Loads the images and packs them, bottom row first like an image texture with flipY (so v = 0 is the
 * image's bottom), into a mipmapped sRGB `DataArrayTexture` of `width` × `height` layers (each image
 * is resized to it), wrapping as `wrap` (repeating by default).
 */
export async function loadTextureArray(urls: readonly string[], width: number, height = width, wrap: THREE.Wrapping = THREE.RepeatWrapping): Promise<THREE.DataArrayTexture> {
  const images = await Promise.all(urls.map((url) => new THREE.ImageLoader().loadAsync(url)));
  const data = new Uint8Array(width * height * 4 * urls.length);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const row = width * 4;
  images.forEach((img, layer) => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const px = ctx.getImageData(0, 0, width, height).data;
    const base = layer * height * row;
    for (let y = 0; y < height; y++) data.set(px.subarray(y * row, (y + 1) * row), base + (height - 1 - y) * row);
  });
  const tex = new THREE.DataArrayTexture(data, width, height, urls.length);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

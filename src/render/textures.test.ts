import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTextureArray } from './textureArray';
import { GATE_LAYER_H, GATE_LAYER_W, loadGameTextures } from './textures';

vi.mock('./textureArray', async () => {
  const T = await import('three');
  return { loadTextureArray: vi.fn(async (urls: readonly string[], w: number, h = w) => new T.DataArrayTexture(null, w, h, urls.length)) };
});

describe('game textures (M10 gate §2)', () => {
  beforeEach(() => {
    vi.mocked(loadTextureArray).mockClear();
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async () => new THREE.Texture());
  });

  it('loads the gate array only for a map with a gate', async () => {
    const none = await loadGameTextures(false);
    expect(none.terrain.gate).toBeNull();
    expect(loadTextureArray).toHaveBeenCalledTimes(1);

    vi.mocked(loadTextureArray).mockClear();
    const withGate = await loadGameTextures(true);
    expect(withGate.terrain.gate).not.toBeNull();
    expect(loadTextureArray).toHaveBeenCalledTimes(2);
    const call = vi.mocked(loadTextureArray).mock.calls.find((c) => c[0].length === 4)!;
    expect(call.slice(1)).toEqual([GATE_LAYER_W, GATE_LAYER_H, THREE.ClampToEdgeWrapping]);
  });
});

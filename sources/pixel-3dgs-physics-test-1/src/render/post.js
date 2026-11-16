// The pixel pass: turns a small, soft render of the splats into pixel art.
//
//   1. Read the low-res render with nearest sampling: one texel = one art pixel.
//   2. Alpha test instead of blending: a pixel is either the object's colour or
//      the background, decided against an ordered (Bayer) pattern. Silhouettes
//      come out hard, and anything translucent (halos, smoke, light beams)
//      becomes a dot pattern.
//   3. Snap to the palette: find the two closest palette colours and choose
//      between them with the same ordered pattern, in proportion to where the
//      colour sits between them. Smooth shading becomes dithering.

import * as THREE from "three";
import { hexToRgb } from "../noise.js";

const MAX_COLOURS = 64;

export function createPost({ lowResolution = false } = {}) {
  const uniforms = {
    source: { value: null },
    lowRes: { value: new THREE.Vector2(1, 1) },
    pixelSize: { value: 1 }, // device pixels per art pixel
    palette: { value: Array.from({ length: MAX_COLOURS }, () => new THREE.Vector3()) },
    paletteSize: { value: 0 },
    background: { value: new THREE.Vector3() },
    quantise: { value: 1 },
    dither: { value: 0 },
    crisp: { value: 1 },
    brightness: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `
      precision highp float;
      uniform sampler2D source;
      uniform vec2 lowRes;
      uniform float pixelSize, quantise, dither, crisp, brightness;
      uniform vec3 palette[${MAX_COLOURS}];
      uniform int paletteSize;
      uniform vec3 background;

      // 4×4 ordered dither threshold in (0, 1)
      float bayer(vec2 p) {
        int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
        float m[16];
        m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;
        m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
        float v = 0.0;
        for (int k = 0; k < 16; k++) if (k == i) v = m[k];
        return (v + 0.5) / 16.0;
      }

      void main() {
        vec2 cell = floor(gl_FragCoord.xy / pixelSize); // which art pixel
        vec4 s = texture2D(source, (cell + 0.5) / lowRes);
        // Spark linearises splat colours when it draws into a render target;
        // undo that so palette colours arrive exactly as authored.
        if (s.a > 0.0) s.rgb = pow(max(s.rgb / s.a, 0.0), vec3(1.0 / 2.2)) * s.a;

        float a = clamp(s.a, 0.0, 1.0);
        vec3 col = s.rgb + background * (1.0 - a);
        if (crisp > 0.5) col = a > bayer(cell + 2.0) * 0.96 + 0.02 ? s.rgb / max(s.a, 1e-4) : background;

        if (quantise > 0.5) {
          vec3 c1 = col, c2 = col; float d1 = 1e9, d2 = 1e9;
          for (int i = 0; i < ${MAX_COLOURS}; i++) {
            if (i >= paletteSize) break;
            vec3 e = col - palette[i];
            vec3 w = e * vec3(0.30, 0.59, 0.11); // weigh by how bright each channel looks
            float d = dot(w, w) + 0.25 * dot(e, e);
            if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = palette[i]; }
            else if (d < d2) { d2 = d; c2 = palette[i]; }
          }
          vec3 axis = c2 - c1;
          float t = clamp(dot(col - c1, axis) / max(dot(axis, axis), 1e-5), 0.0, 0.5);
          col = bayer(cell) < t * dither ? c2 : c1;
        }
        gl_FragColor = vec4(clamp(col * brightness, 0.0, 1.0), 1.0);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(quad);
  const camera = new THREE.Camera();

  // Palette selection is constant inside each art pixel. Resolve it once, then upscale.
  const resolved = lowResolution ? new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false,
  }) : null;
  const copy = lowResolution ? new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { source: { value: resolved.texture }, lowRes: uniforms.lowRes, pixelSize: uniforms.pixelSize },
    vertexShader: material.vertexShader,
    fragmentShader: `precision highp float;
      uniform sampler2D source; uniform vec2 lowRes; uniform float pixelSize;
      void main() { vec2 cell = floor(gl_FragCoord.xy / pixelSize);
        gl_FragColor = texture2D(source, (cell + 0.5) / lowRes); }`,
  }) : null;

  return {
    // hex colours; the background colour should be one of them
    setPalette(colours) {
      const list = [...new Set(colours)].slice(0, MAX_COLOURS);
      list.forEach((hex, i) => uniforms.palette.value[i].set(...hexToRgb(hex)));
      uniforms.paletteSize.value = list.length;
    },
    setBrightness(value) {
      if (!Number.isFinite(value) || value < .5 || value > 2) throw new RangeError("Brightness must be 0.5–2");
      uniforms.brightness.value = value;
    },
    setBackground(hex) { uniforms.background.value.set(...hexToRgb(hex)); },
    setSizes(width, height, pixelSize) {
      uniforms.lowRes.value.set(width, height);
      uniforms.pixelSize.value = pixelSize;
      resolved?.setSize(width, height);
    },
    setCrisp(on) { uniforms.crisp.value = on ? 1 : 0; },
    render(renderer, texture, quantise, dither) {
      uniforms.source.value = texture;
      uniforms.quantise.value = quantise ? 1 : 0;
      uniforms.dither.value = dither;
      if (!resolved) { renderer.render(scene, camera); return; }
      const destination = renderer.getRenderTarget(), pixelSize = uniforms.pixelSize.value;
      uniforms.pixelSize.value = 1;
      renderer.setRenderTarget(resolved);
      renderer.render(scene, camera);
      uniforms.pixelSize.value = pixelSize;
      renderer.setRenderTarget(destination);
      quad.material = copy;
      renderer.render(scene, camera);
      quad.material = material;
    },
  };
}

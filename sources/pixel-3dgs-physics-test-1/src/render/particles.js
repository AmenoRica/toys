// Things that move: embers, fireflies, falling leaves, smoke, swaying grass.
//
// Each is a Spark modifier: a few lines of GLSL that run per splat on the GPU.
// A splat gets three stable random numbers `r` from its index, so thousands of
// particles animate with no per-frame work in JavaScript.
//   p: position (edit in place)   a: opacity multiplier
//   v: per-effect parameters (x = scene radius, y = height)   c: a centre point

import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";
import { uniforms } from "./shade.js";

const HASH = `
vec3 px_hash31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}`;

const MOTION = {
  // embers climbing out of a fire
  rise: (g, t, v) => `float k = fract(${t} * 0.22 * (0.6 + r.x) + r.y);
    p.y += k * ${v}.y; p.x += 0.07 * sin(k * 9.0 + r.z * 40.0) * k; p.z += 0.07 * cos(k * 7.0 + r.x * 40.0) * k;
    ${g}.scales *= 1.0 - 0.6 * k; a *= smoothstep(0.0, 0.05, k) * (1.0 - smoothstep(0.55, 1.0, k));`,
  // dust hanging in the air
  float: (g, t) => `p += 0.07 * vec3(sin(${t} * 0.3 + r.x * 40.0), sin(${t} * 0.22 + r.y * 40.0), cos(${t} * 0.27 + r.z * 40.0));
    a *= 0.35 + 0.65 * smoothstep(0.2, 0.9, sin(${t} * (0.3 + r.z * 0.4) + r.x * 60.0) * 0.5 + 0.5);`,
  // fireflies: wander and blink
  blink: (g, t) => `p += 0.12 * vec3(sin(${t} * 0.5 + r.x * 40.0), 0.6 * sin(${t} * 0.4 + r.y * 40.0), cos(${t} * 0.45 + r.z * 40.0));
    a *= smoothstep(0.55, 0.95, sin(${t} * (0.9 + r.z) + r.x * 60.0));`,
  // sparkle in place (light on water)
  twinkle: (g, t) => `a *= smoothstep(0.6, 0.98, sin(${t} * (0.7 + r.z * 1.3) + r.x * 60.0));`,
  // wind-blown sand, wrapping around the island
  drift: (g, t, v) => `p.x = mod(p.x + ${t} * 0.16 * (0.5 + r.x) + ${v}.x, 2.0 * ${v}.x) - ${v}.x;
    p.y += 0.03 * sin(${t} * 1.3 + r.y * 30.0); a *= smoothstep(0.0, 0.25, ${v}.x - abs(p.x));`,
  // leaves tumbling down through a column of height v.y above c.y
  leaf: (g, t, v, c) => `float H = ${v}.y; p.y = ${c}.y + mod(p.y - ${c}.y - ${t} * 0.14 * (0.6 + r.x), H);
    p.x += 0.13 * sin(${t} * 0.9 + r.y * 40.0 + p.y * 3.0); p.z += 0.11 * cos(${t} * 0.7 + r.z * 40.0 + p.y * 2.5);
    a *= smoothstep(0.0, 0.1, p.y - ${c}.y) * (1.0 - smoothstep(H - 0.3, H, p.y - ${c}.y));`,
  // smoke: rises, spreads, thins out
  smoke: (g, t, v) => `float k = fract(${t} * 0.09 * (0.6 + r.x) + r.y);
    p.y += k * ${v}.y; p.x += 0.12 * k * sin(k * 6.0 + r.z * 40.0) + 0.12 * k * k; p.z += 0.1 * k * cos(k * 5.0 + r.x * 40.0);
    ${g}.scales *= 1.0 + 3.0 * k; a *= smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.3, 1.0, k)) * 0.6;`,
  // a beam sweeping around the vertical axis through c (lighthouse)
  beam: (g, t, v, c) => `float ang = ${t} * 0.7, cs = cos(ang), sn = sin(ang); vec3 d = p - ${c};
    p = ${c} + vec3(cs * d.x + sn * d.z, d.y, -sn * d.x + cs * d.z);
    ${g}.quaternion = quatQuat(vec4(0.0, sin(ang * 0.5), 0.0, cos(ang * 0.5)), ${g}.quaternion);`,
  // low mist: big flat faint splats creeping around
  fog: (g, t) => `p.x += 0.25 * sin(${t} * 0.12 + r.x * 40.0); p.z += 0.25 * cos(${t} * 0.1 + r.y * 40.0);
    p.y += 0.04 * sin(${t} * 0.3 + r.z * 30.0); a *= 0.55 + 0.45 * sin(${t} * 0.25 + r.z * 50.0);`,
  // light falling in from above
  shaft: (g, t) => `p.x += 0.08 * sin(${t} * 0.15 + r.x * 20.0); a *= 0.5 + 0.5 * sin(${t} * 0.4 + r.y * 50.0);`,
  // grass and leaves in a light wind
  sway: (g, t) => `p.x += 0.016 * sin(${t} * 1.6 + p.x * 5.0 + p.z * 3.0); p.z += 0.011 * cos(${t} * 1.3 + p.z * 4.0 - p.x * 2.0);`,
  // halos breathing with their flame
  pulse: (g, t) => `${g}.scales *= 0.93 + 0.07 * sin(${t} * 7.0 + r.x * 20.0);`,
};

export const MOTIONS = Object.keys(MOTION);

// pairs: two consecutive splats share one random seed (a particle and its halo)
export function motionFx(mode, v = new THREE.Vector3(), center = new THREE.Vector3(), pairs = false) {
  const uV = dyno.dynoVec3(v), uC = dyno.dynoVec3(center);
  return dyno.dynoBlock({ gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat }, ({ gsplat }) => {
    const node = new dyno.Dyno({
      inTypes: { gsplat: dyno.Gsplat, t: "float", v: "vec3", c: "vec3" },
      outTypes: { gsplat: dyno.Gsplat },
      inputs: { gsplat, t: uniforms.time, v: uV, c: uC },
      globals: () => [HASH],
      statements: ({ inputs: i, outputs: o }) => [`
      ${o.gsplat} = ${i.gsplat};
      {
        vec3 r = px_hash31(float(${o.gsplat}.index${pairs ? " / 2" : ""}) + 3.0);
        vec3 p = ${o.gsplat}.center; float a = 1.0;
        ${MOTION[mode](o.gsplat, i.t, i.v, i.c)}
        ${o.gsplat}.center = p; ${o.gsplat}.rgba.a *= a;
      }`],
    });
    return { gsplat: node.outputs.gsplat };
  });
}

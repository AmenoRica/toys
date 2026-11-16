// Per-splat lighting.
//
// Every splat is a "surfel": a flat disc lying on a surface. Its quaternion
// encodes the surface normal (the disc's thin axis), its colour is the surface
// colour. This Spark modifier runs on the GPU for each splat, each frame, and
// replaces that colour with the lit colour. Because the normal comes from the
// splat itself, lighting stays correct when a skeleton moves the splats.
//
// A few flags ride along in the opacity channel, which hard-edged splats do
// not otherwise need:  1.0 plain · 0.9 emissive · 0.8 two-sided · 0.7 both

import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

// brightness = ambient (darker from below, lighter from above) + key light
export const AMBIENT_LOW = 0.36, AMBIENT_HIGH = 0.58, DIFFUSE = 0.62;
const KEY_LIGHT = "normalize(vec3(0.45, 0.8, 0.4))";
export const MAX_LIGHTS = 4;

export const uniforms = {
  time: dyno.dynoFloat(0),
  camera: dyno.dynoVec3(new THREE.Vector3()),
  fog: dyno.dynoVec2(new THREE.Vector2(3, 6)), // start and end distance
  cull: dyno.dynoFloat(1), // hide splats facing away from the camera
  bands: dyno.dynoFloat(5), // cel shading: number of flat light steps, 0 = smooth
  exposure: dyno.dynoFloat(1), // brightness of the model
  worldExposure: dyno.dynoFloat(1), // brightness of the island / scene
  // point lights: [position, colour × power]
  lights: Array.from({ length: MAX_LIGHTS }, () => [dyno.dynoVec3(new THREE.Vector3(0, -99, 0)), dyno.dynoVec3(new THREE.Vector3())]),
};

const pointLight = (position, colour, falloff=9) => `{
          vec3 toLight = ${position} - p; float d = length(toLight);
          float w = (max(dot(n, toLight / d), 0.0) * 0.85 + 0.15) / (1.0 + d * d * ${falloff.toFixed(2)});
          col += (albedo * 0.85 + 0.1) * ${colour} * w;
        }`;

// world:    the splat belongs to the island / scene, not to the model
// upNormal: light it as if it faced up (grass blades, leaflets)
export function shadeFx({ world = false, upNormal = false, daylight = false, night = false } = {}) {
  const u = uniforms;
  const inputs = { cam: u.camera, fog: u.fog, cull: u.cull, bands: u.bands, exposure: world ? u.worldExposure : u.exposure };
  const inTypes = { gsplat: dyno.Gsplat, cam: "vec3", fog: "vec2", cull: "float", bands: "float", exposure: "float" };
  u.lights.forEach(([pos, col], k) => { inputs[`l${k}`] = pos; inputs[`c${k}`] = col; inTypes[`l${k}`] = "vec3"; inTypes[`c${k}`] = "vec3"; });

  return dyno.dynoBlock({ gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat }, ({ gsplat }) => {
    const node = new dyno.Dyno({
      inTypes,
      outTypes: { gsplat: dyno.Gsplat },
      inputs: { gsplat, ...inputs },
      statements: ({ inputs: i, outputs: o }) => [`
      ${o.gsplat} = ${i.gsplat};
      {
        vec3 n = quatVec(${o.gsplat}.quaternion, vec3(0.0, 0.0, 1.0));
        vec3 p = ${o.gsplat}.center;
        vec3 albedo = ${o.gsplat}.rgba.rgb;
        float flags = ${o.gsplat}.rgba.a;
        bool emissive = (flags < 0.95 && flags > 0.85) || flags < 0.75;
        bool twoSided = flags < 0.85;

        vec3 toCam = ${i.cam} - p;
        float dist = length(toCam);
        float facing = dot(n, toCam / dist);
        float alpha = 1.0;
        ${world ? "" : `if (${i.cull} > 0.5 && !twoSided && facing < -0.08) alpha = 0.0;`}
        if (twoSided && facing < 0.0) n = -n;
        ${upNormal ? "n = normalize(n * 0.3 + vec3(0.0, 1.0, 0.0));" : ""}

        float ndl = dot(n, ${KEY_LIGHT});
        float light = mix(${AMBIENT_LOW}, ${AMBIENT_HIGH}, n.y * 0.5 + 0.5) + ${DIFFUSE} * max(ndl, 0.0) + 0.22 * max(facing, 0.0);
        if (${i.bands} > 0.5) light = (floor(light * ${i.bands}) + 0.5) / ${i.bands};
        ${daylight ? 'light = mix(0.48, 0.78, n.y * 0.5 + 0.5) + 0.7 * max(ndl, 0.0);' : ''}
        ${night ? 'light = 0.30 + 0.28 * max(ndl, 0.0); albedo *= vec3(0.80, 0.88, 1.0);' : ''}
        vec3 col = albedo * light * ${i.exposure}${upNormal ? " * 0.74" : ""};
        col *= mix(vec3(0.92, 0.95, 1.05), vec3(1.04, 1.0, 0.95), step(0.0, ndl)); // cool shadows, warm light
        ${u.lights.map((_, k) => pointLight(i[`l${k}`], i[`c${k}`], night ? .12 : 9)).join("\n        ")}

        if (emissive) col = albedo * 1.15;
        else col = mix(col, vec3(0.03, 0.035, 0.05), 0.75 * smoothstep(${i.fog}.x, ${i.fog}.y, dist));
        ${o.gsplat}.rgba = vec4(clamp(col, 0.0, 1.0), alpha);
      }`],
    });
    return { gsplat: node.outputs.gsplat };
  });
}

// lights: [{ pos: THREE.Vector3, color: [r, g, b], power }], flickering like flames
export function setLights(lights, t, on = true) {
  uniforms.lights.forEach(([pos, col], k) => {
    const l = on && lights[k];
    if (!l) return col.value.set(0, 0, 0);
    const flicker = l.power * (0.86 + 0.1 * Math.sin(t * 11 + k * 2) + 0.06 * Math.sin(t * 23.7 + k));
    pos.value.copy(l.pos);
    col.value.set(l.color[0] * flicker, l.color[1] * flicker, l.color[2] * flicker);
  });
}

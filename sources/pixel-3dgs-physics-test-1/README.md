# Pixel-3DGS + Physics Test 1

Source for `docs/pixel-3dgs-physics-test-1/`. Run `npm ci`, `npm test`, then `npm run build` from this folder. The build uses the shared toys stylesheet at `../shared/base.css` in deployment.

Desktop keyboard/mouse experiment: WASD, Space jump, click disc, Esc settings. Display settings reset on reload. Rocks use approximate character support; fallen wood is not walkable. Physics runs in a worker; sustained overload can slow simulated time.

Runtime models are checked in. Upstream MIT and bundled dependency notices are included in the deployment. No analytics, server, or external CDN is used.

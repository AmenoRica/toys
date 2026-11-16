# Validation — 2026-11-16

- 48 Node tests passed on the packaged source. Production Vite build passed.
- Static deployment tested under a subdirectory, including models, cut/physics workers, shared CSS, play, disc launch, Space, Esc and settings. No console errors observed.
- Desktop and 390 × 844 layout checked. Bottom control hint removed; help lives in the settings disclosure. Mobile gameplay controls are not implemented.
- The renderer still has large bundled JS/WASM assets; initial loading may take time. No external runtime CDN or telemetry.
- This UI/publication change does not rebenchmark sustained destruction performance.

Full-window revision: removed the 834px width limit and outer margins at the user’s request. Desktop and 390 × 844 layouts checked again; the toolbar remains visible and the game fills remaining space.

> Historical QA record. Runtime PIDs, preview URLs and output paths below describe that verification session. Generated screenshots and logs remain local.

# Platform hero QA, 2026-09-10

Build: `platform-hero-01`, HTML SHA256 `555ba2d9b88e3b24e862fb906aaaa6d5789112b0a45c2d24c1849efd48d5f2fd`.

Changed the platform hero to an original static SVG portal, gave Kart Party the same card layout as every other game, and removed unused hero animation and featured-card code. No game rules, room protocol or launch behavior changed. Typecheck, oxlint and the isolated production build passed. Existing Vite dependency-directive and large-chunk warnings remain.

Owned headless browser: `party-hero-20260910`. Preview server: port 4396, PID 68072, exec session 40592. Browser closed after QA; the server remains available for the user at http://localhost:4396. No test room was created.

Checked all nine catalog entries at 1280×720, 1920×1080, 320×568, 390×844, 667×375 and 844×390. All cards have equal widths within each viewport; no document horizontal overflow; card buttons meet 44px minimums. Representative desktop, portrait and landscape screenshots visually inspected. Reduced-motion mode has no hero animation. Search field keyboard focus remains visible. Search narrows to Kitchen Rush; solo filter returns Kart Party, Blockwild and Kitchen Rush. Adding/removing a favorite updates its shelf, and Kart detail navigation returns home. No page errors recorded during these checks.

Evidence: `check.cjs`, `check-results.txt`, `home-*.png` alongside this file. Physical devices and game rounds were not retested for this presentation-only change; prior gameplay evidence is in `output/unified-room/QA.md`.

The public tunnel reported one active connection during checks. Its server, tunnel, assets and rooms were preserved; this change has not replaced the public build `unified-room-05`. Local preview metadata is in `preview.json` here.

Cleanup review: removed unused bunting math, confetti data, racing animation classes/keyframes and the featured-card prop/CSS. The requested code-golf skill could not be found under the configured skill roots or plugin cache; this simplification review was performed manually. No Prettier or git write commands were used.

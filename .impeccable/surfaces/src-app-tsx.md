---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["index.html"]
---

# Story experience: Echoes of the Cosmos

**Scope:** the whole site: opening, 8-stop journey across 4 chapters, `/rover`, `/about`, and `/film`. **Mode: Experience.**

- **Audience:** learners aged 12–17, on laptops first, often muted.
- **Job:** follow Opportunity's real 45 km route and understand which instrument made which discovery.
- **Action:** Start the journey, then Next stop and "The instrument".
- **Proof:** 21,104 traverse records, the NASA 3D model, PIA images with credits, NASA/JPL quotes.
- **Constraints:** WCAG 2.2 AA, reduced motion, a Static mode with equal content, and the honesty labels in PRODUCT.md.

## Direction contract

- **THESIS:** the whole mission is one long night exposure. The real route is a warm tungsten light trail drawn across Meridiani under rotating star arcs, and the real NASA rover is lit by hand. It refuses the category default of a navy space page with a full-bleed Mars photo and a row of chapter cards.
- **OWN-WORLD:** a photographic night, not sci-fi:
  - night `#0b1020` large fields, dusk `#1f2a4d` horizon and raised surfaces, ground `#5a3a2a` for the darkened orbital plane;
  - tungsten amber `#f2a65a` only for what moves or is selected; star white `#eef1f6` for text and star arcs;
  - NASA daylight images as warm-white "developed prints" with credits;
  - light film grain, thin star arcs, a soft photographic bloom on the trail only;
  - captions in tracked uppercase like EXIF data, with tabular numerals. No glow edges, no HUD.
- **STORY:** the visitor watches 14 years accumulate as one trail and stops 8 times. At each stop, a light-paint sweep picks out the instrument that made the finding (Purgatory: wheels; Esperance: RAT then APXS). The visitor leaves able to name the parts and retell landing → silence. The labels "Night sky and light trail are illustrative; the rover drove by day" and "Rover not to scale" stay visible.
- **FIRST VIEWPORT:** matches `design/reference/r2-assigned.html` at 1440×900:
  - top left: the small line `SOL 1 → SOL 5111 · MERIDIANI PLANUM, MARS`, then the headline "Built for 90 sols. / It kept going for 5,111." with line two in amber, then the primary button "Start the journey" directly under it;
  - right foreground: the warm-lit NASA rover;
  - behind: the orbital plane receding to the horizon, the full 45 km trail glowing, and star arcs above;
  - bottom edge: the EXIF band `EXPOSURE 14 YEARS · ROUTE 45.1 KM · 21,104 POSITION RECORDS` with source tags.
- **FORM:** a full-screen vanilla three.js stage behind a thin React text layer. Signature interaction: the light-paint reveal (the others dim, a spot sweeps, the part separates slightly, then the caption arrives). Motion grammar: the camera travels along the trail and the route never deforms. Choice 1 of 1 after two rounds (round 2 re-roll, card `assigned`). seed:b8f259fdb1512220
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Open decisions (H00–H06)

- Final colour values after contrast checks.
- Typeface: one OFL humanist sans with tabular figures, self-hosted, not from the default list.
- Trail technique: tube with bloom versus line with additive blending; measure FPS.
- Night ground: darkened PIA23178 versus a flat plane.

# Product

<!-- impeccable:product-schema 1 -->

> Captured 2026-11-01 by `impeccable init` before the hackathon. The product repo `echoes-of-the-cosmos` does not exist yet (it is created on 14/11/2026); copy this file to its root at H00. Full detail lives in `Echoes_of_the_Cosmos_Dac_ta_chi_tiet_NASA_Space_Apps_2026.md` (spec v1.1) and `research/`.

## Platform

web

## Stack

Decided in spec v1.1 (change C12): Vite + React + TypeScript shell; vanilla three.js for the 3D scenes (not React Three Fiber), driven by a pure `render(state)` from one replay state; static JSON data produced by a Python ETL; deployed on Vercel. No backend is required for P0.

## Users

- **Primary: learners aged 12–17** (confirmed). They like space but know little about Mars. They are on a laptop or a phone, with no account, often with sound off. They want to see what the rover looked like, where it went, why scientists cared about those places, and what was special. They lose interest at dense paragraphs, long narration, broken playback, or anything that needs audio to make sense.
- **Secondary: teachers and science enthusiasts.** They use the site as a 5–10 minute lesson, check the NASA sources, and pull questions for students.
- **Evaluation context, not a user:** NASA Space Apps 2026 judges score Impact, Creativity, Validity, Relevance and Presentation, mostly through a ≤ 30 s video and a quick visit to the public URL.

## Product Purpose

Echoes of the Cosmos is an educational, story-driven web replay of the Opportunity rover mission (landed 25 Jan 2004 UTC; last contact sol 5111, 10 Jun 2018; 45.16 km driven), built for the challenge *Abandoned but not Forgotten*. In 5–10 minutes, a student who has never heard of Opportunity follows the journey through time, understands at least two sourced discoveries, and can retell why the mission mattered.

Success: the mission is understood within the first 60 seconds; any checkpoint is reachable in two actions; every key scientific claim and every image carries a readable source.

## Positioning

It replays the rover's real recorded route (21,104 position records from the MER Analyst's Notebook traverse table, verified against NASA's final traverse map) in one continuous 3D world, and links **how each instrument worked** to **the discovery it made**, using NASA's official rover 3D model. Neighbouring products show a static map or an article; this one lets the learner watch where a discovery happened and open the rover to see which tool made it.

## Operating Context

- Built solo in 48 hours, 14–15/11/2026. No product code before 14/11 (possible pre-build rule); research and planning only until then.
- Seen on integrated-GPU laptops and phones, in classrooms and at home, often muted.
- Judges mostly see a ≤ 30 s video, recorded from the site's own `/film` route, plus one visit to the live URL.
- Story Mode (guided, 4 chapters, 8 events) is the main path. Explore Mode, AI Guide, Quiz and Audio are P2.

## Capabilities and Constraints

- **Language:** English only for the submission (confirmed). Vietnamese is P2, after submission.
- **P0 scope:** a 2.5D Mission Stage on the PIA23178 orbital image; a Rover Teardown from NASA's `24883_MER_static.glb`, split by material group; a story layer with 4 chapters (CH-A Arrival & Clues of Water, CH-B Stuck, Then Unstoppable, CH-C Better Water at Endeavour, CH-D Silence & Legacy); a curated FAQ per event; a `/film` render route; and a Static mode equal in content for low-end devices, reduced motion or no WebGL.
- **Data honesty:**
  - Positions carry `corrected`, `interpolated` or `gap` provenance.
  - The ground is a flat plane, because there is no elevation data.
  - The rover is shown not to scale on the map.
  - Dust storms, transitions and the landing flight are labelled *Illustrative*.
  - The last traverse record ends at sol 5081; last contact is sol 5111.
- **Terminology:**
  - "sol" is a Mars day; the landing date is written "Jan 24, 2004 (PST) / Jan 25 (UTC)".
  - The science arc is *"From harsh acid to gentler water"*. Never write "drinkable water", which is not NASA wording.
  - Write "scientists inferred" separately from "scientists directly observed".
  - Never write "proved life existed on Mars".
- **Not this product:**
  - No real rover control.
  - No per-second GPS claim.
  - No full physics simulation.
  - No login, accounts or user database.
  - No NASA endorsement.
- **Rover facts (NSSDCA 2003-032A, read 14/11):** 185 kg, six wheels on a rocker-bogie suspension, navigation cameras on the Pancam mast. Overall dimensions still have no NASA source; use a measurement from the model, labelled as such, or omit it.

## Brand Commitments

- Name: **Echoes of the Cosmos**.
- **Voice (confirmed):** a neutral narrator carries the story. A few emotional moments in the first person ("I, Opportunity"), such as the final silence, are allowed only if labelled *narrative dramatization*. They are never presented as NASA quotes or recordings.
- **NASA usage:**
  - No NASA or JPL logos, and no implied endorsement.
  - Every image uses the credit line from its own caption (JPL Image Use Policy).

## Evidence on Hand

- **Traverse data:** `research/data/raw/MERB_traverse_5130.{csv,lbl}` (SHA-256 recorded). Its quality and gap analysis is in `research/DATA_REPORT_MERB_traverse.md`.
- **Basemap:** `research/data/reference/PIA23178.jpg`, with a 2-point fit at 17.67 m/px, rotated +0.59°.
- **Rover model:** NASA's official model (`research/data/reference/model/`, gitignored; re-download URL in `research/IMPLEMENTATION_PLAN.md`), credit NASA/JPL-Caltech.
- **Checkpoints and sources:** 13 checkpoints with verbatim quotes from primary NASA/JPL pages, plus the source registry and the media/credit table, all in `research/SOURCE_RESEARCH_checkpoints.md`.
- **Media:** 8 P0 PIA images are identified with their credits. They are downloaded during the hackathon.
- **Absent, never fabricate:**
  - No user testimonials or tester results yet.
  - No NASA review or endorsement.
  - No rover dimension figures from NASA (mass 185 kg is sourced from NSSDCA).
  - No elevation data.

## Product Principles

1. **Data first, drama labelled.** Every position, number and claim traces to a NASA/JPL primary source. Anything reconstructed or emotional says so on screen.
2. **Tool → discovery.** Each chapter links what an instrument physically did to what scientists learned from it.
3. **One screen, one action.** The world moves, and reading happens in stillness: background motion calms when a learning card opens.
4. **Works muted, works slow.** Everything is understandable without sound. Every 3D scene has an equal static path.
5. **Sources are part of the experience**, inline and readable, not a footer.

## Accessibility & Inclusion

- Target WCAG 2.2 AA contrast.
- Keyboard-operable timeline and controls, with visible focus and labelled play/pause/seek.
- Honour `prefers-reduced-motion`, and add a visible Reduce motion toggle.
- Captions or transcripts for all narration; audio is never required.
- Never encode corrected / interpolated / gap by color alone.
- Modals and trays trap focus and close on Esc.

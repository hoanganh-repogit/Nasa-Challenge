# Submission text (NASA Space Apps Challenge 2026)

Ready to paste into the project submission form. Field names follow the usual Space Apps project page; check them
against the 2026 Project Submission Guide before submitting, and trim to any character limits it sets.

---

## Project name

Echoes of the Cosmos

## Challenge

Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars

## Team

Solo team · Local event: Ho Chi Minh City, Vietnam (online)

## Links

- **Final project (live site):** https://echoes-of-the-cosmos-2026.vercel.app
- **Demo video (30 s, English voice-over and captions):** https://echoes-of-the-cosmos-2026.vercel.app/film/echoes-of-the-cosmos-30s.mp4
  _(if the form asks for YouTube or Drive, upload the same file and paste that link instead)_
- **Code repository:** https://github.com/hoanganh-repogit/Nasa-Challenge
- **Research and build log (no product code):** https://github.com/hoanganh-repogit/echoes-of-the-cosmos-research

---

## High-level project summary

*(short version, about 100 words)*

Echoes of the Cosmos retells the 14-year life of NASA's Opportunity rover as one long night exposure. Its real
recorded route (21,089 positions from the MER Analyst's Notebook traverse table) is drawn as a light trail across
NASA's orbital map of Meridiani Planum, next to NASA's own 3D model of the rover. Learners aged 12–17 follow 8 stops,
from landing to the dust storm that silenced it. At each stop they see the NASA image and the evidence, and a
light-paint reveal shows which part of the rover made the discovery. Every fact links to a NASA source, and
everything illustrative is labelled.

## Project details

### What it does

Opportunity was designed for 90 Martian days and drove for more than 14 years. Since June 2018 it has rested, silent,
in Perseverance Valley: one of the "inactive monuments to Mars exploration" this challenge asks us to remember. Most
of what a student can find about it is a static map or an article. Neither shows where a discovery happened, or which
part of the rover made it.

Echoes of the Cosmos is a 5–10 minute story in the browser:

- **The journey.** 8 stops in 4 chapters: Arrival, Stuck, Better water, Silence. Each stop asks a question a teenager
  would ask ("What happens when a rover gets stuck?"), answers it in one line, and opens a "developed print": the
  NASA image with its credit, the evidence, a quote, what the evidence does *not* tell us, 3 FAQs and the sources.
- **Tool → discovery.** A light-paint reveal dims the rover and sweeps a light onto the part that did the work: the
  Rock Abrasion Tool, then the APXS, at Esperance (clay minerals, gentler water); the wheels at Purgatory dune; the
  solar arrays at the end.
- **Silence and Legacy.** An illustrative dust storm, the two real dates (last position record sol 5081, last message
  sol 5111), then the camera rises over the whole 45 km exposure and sets "What NASA wanted to know" (from NASA's own
  MER science objectives) next to "What Opportunity helped reveal", each row with its source.
- **The rover, part by part** (/rover): six parts of NASA's model, with what each is, how it works and what it found.
- **How this was made** (/about): what is real and what is illustrative, the data method, the six gaps in the
  records, every credit and all 31 sources.

### How it works

- A Python ETL turns NASA's traverse table into JSON, keeping the source row order, dropping 15 exact duplicate rows,
  finding 6 gaps, and never inventing a position.
- A tested replay engine moves the rover "hold-then-move" from record to record and never through a gap. Each position
  is labelled as recorded, between two records, or no records.
- The route is aligned to NASA's PIA23178 map with a 2-point fit (17.67 m per pixel, 0.59°); the possible offset of up
  to 0.5 km is printed on screen.
- A vanilla three.js stage draws one frame from one state (route, rover, camera, light-paint) behind a thin React
  text layer. The same pure function renders the 30-second film frame by frame.
- Content (8 stops, 24 FAQs, 6 rover parts, Legacy) is stored with source IDs and checked by a lint: every source must
  exist and be re-opened, and phrases NASA does not use ("drinkable water", "proved life") are blocked.

### Benefits and intended impact

- The goal: a student who has never heard of Opportunity can, in about 10 minutes, retell its story from landing to silence and
  name at least two discoveries and the tools that made them.
- Teachers get a ready lesson with sources they can check.
- It shows learners how scientists know things: the evidence, its limits, and the difference between data and
  illustration.
- It is open to everyone: works on phones, a Static view with the same content for low-end devices or no WebGL, a
  visible Reduce motion toggle, full keyboard use, and WCAG 2.2 AA (axe-core: 0 violations on 8 views at desktop and
  phone sizes). It works muted.

### Tools, languages and hardware

TypeScript, React 19, Vite 8, three.js 0.187, Python 3 (ETL and procedural film score), Vitest and pytest, Playwright
and axe-core (testing), ffmpeg (film), Vercel (hosting). Built on a laptop with an integrated GPU (Intel Iris Xe),
which is also the performance target.

---

## NASA Data (form: one "Link Text" + "Link Url" per row)

| Link Text | Link Url |
|---|---|
| MER Opportunity traverse table MERB_traverse_5130 (MER Analyst's Notebook, PDS Geosciences Node) | https://an.rsl.wustl.edu/mera/AN/pages/mer/mer_traverse.htm |
| Opportunity (MER-B), NSSDCA 2003-032A | https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2003-032A |
| Spirit and Opportunity Rover 3D Model (NASA/JPL-Caltech) | https://science.nasa.gov/resource/spirit-and-opportunity-rover-3d-model/ |
| PIA23178 Opportunity's Final Traverse Map | https://science.nasa.gov/photojournal/opportunitys-final-traverse-map/ |
| PIA05755 'Lion King' Panorama | https://science.nasa.gov/resource/lion-king-panorama/ |
| PIA05634 Discovery Served Up in a Bowl | https://science.nasa.gov/resource/discovery-served-up-in-a-bowl/ |
| PIA07999 Looking Back at 'Purgatory Dune' | https://www.jpl.nasa.gov/images/pia07999-looking-back-at-purgatory-dune |
| PIA08813 'Victoria Crater' at Meridiani Planum | https://science.nasa.gov/photojournal/victoria-crater-at-meridiani-planum |
| PIA14509 Arrival at 'Spirit Point' by Mars Rover Opportunity | https://www.jpl.nasa.gov/images/pia14509-arrival-at-spirit-point-by-mars-rover-opportunity/ |
| PIA17074 'Esperance' Target Examined by Opportunity | https://www.jpl.nasa.gov/images/pia17074-esperance-target-examined-by-opportunity/ |
| PIA22929 Opportunity's Last Message | https://www.jpl.nasa.gov/images/pia22929-opportunitys-last-message/ |
| Opportunity (MER-B) mission page | https://science.nasa.gov/mission/mer-opportunity/ |
| Mars Exploration Rovers: Science Instruments | https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-instruments |
| Mars Exploration Rovers: Science Objectives | https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-objectives/ |
| NASA's Opportunity Rover Mission on Mars Comes to End (JPL, 2019) | https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/ |
| All 31 NASA, JPL and NSSDCA sources, with check dates | https://echoes-of-the-cosmos-2026.vercel.app/about |

## Space Agency Partner & Other Data (form: one row each; open-source code, fonts, tools)

No Space Agency Partner data. Other resources:

| Link Text | Link Url |
|---|---|
| three.js (MIT), 3D rendering | https://threejs.org |
| React (MIT), interface | https://react.dev |
| Vite (MIT), build tool | https://vite.dev |
| Commissioner typeface (SIL Open Font License) | https://fonts.google.com/specimen/Commissioner |
| glTF Transform (MIT), compressing NASA's 3D model | https://gltf-transform.dev |
| Kokoro-82M (Apache-2.0), synthetic voice for the film voice-over | https://huggingface.co/hexgrad/Kokoro-82M |
| kokoro-onnx (MIT), runs Kokoro locally | https://github.com/thewh1teagle/kokoro-onnx |
| claude-motion sfx kit (MIT), procedural film score | https://github.com/whaleyxbt/claude-motion |
| Claude Code (Anthropic), SI coding and writing assistant | https://www.anthropic.com/claude-code |
| FFmpeg, film encoding | https://ffmpeg.org |
| Playwright, testing and frame capture | https://playwright.dev |
| axe-core, accessibility testing | https://github.com/dequelabs/axe-core |
| Vitest, unit tests | https://vitest.dev |
| Vercel, hosting | https://vercel.com |
| Space Apps challenge Resources tab | https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/?tab=resources |

## Use of Super Intelligence (SI)

**Select (all that apply):** the options for **code**, **text / writing**, and **audio / voice**. Not images, not
video generation, not data (the film's pictures are rendered by the project's own code; images and the 3D model are
NASA's; data is NASA's traverse table). If the list has a "research / summarising sources" option, select it too.

Where the indicators are (visible to judges): the film carries a visible watermark for its whole length,
"SI-generated voice-over · SI-assisted code" (also on /film); the mp4 and m4a carry an SI disclosure in their
metadata; the code is disclosed in the README, `package.json` and an `ai-disclosure` meta tag; the site's /about page
says so; full table in docs/AI_DISCLOSURE.md.

If the form also has a text box:

Claude Code (Claude Opus 5.5, Anthropic) was used as a coding and writing assistant throughout. Two Claude Code skills
were used as well: `impeccable` for design review and accessibility audit, and `teardown` for the frame-capture
tooling and the procedural sound kit. SI helped write the code and draft the text, always from NASA, JPL or NSSDCA
pages that were opened and quoted first; a content lint and a source checker verify it. The film's English
voice-over is SI-generated (Kokoro-82M, an open-weight text-to-speech model run on the author's laptop) and marked by
a visible watermark and file metadata. SI did not produce any data, image or 3D model, and no NASA logo or insignia is
used. The site has no chatbot. Details: https://github.com/hoanganh-repogit/Nasa-Challenge/blob/main/docs/AI_DISCLOSURE.md

## References

- https://github.com/hoanganh-repogit/Nasa-Challenge/blob/main/docs/DATA_METHODOLOGY.md
- https://github.com/hoanganh-repogit/Nasa-Challenge/blob/main/docs/CREDITS.md
- https://echoes-of-the-cosmos-2026.vercel.app/about (all 31 sources)
- https://github.com/hoanganh-repogit/echoes-of-the-cosmos-research (pre-event research and the build log)

## Tags

Mars, Opportunity, rover, storytelling, data visualization, education, 3D, accessibility

---

Independent educational prototype; not an official NASA product and not endorsed by NASA.

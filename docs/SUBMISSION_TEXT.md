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

## NASA data used

- **MER Opportunity traverse table `MERB_traverse_5130`**, MER Analyst's Notebook, PDS Geosciences Node (Washington
  University in St. Louis); traverse by Tim Parker. https://an.rsl.wustl.edu/mera/AN/pages/mer/mer_traverse.htm
- **Opportunity (2003-032A)**, NASA Space Science Data Coordinated Archive.
  https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2003-032A
- **Spirit and Opportunity Rover 3D Model**, NASA/JPL-Caltech.
  https://science.nasa.gov/resource/spirit-and-opportunity-rover-3d-model/
- **PIA23178 Opportunity's Final Traverse Map** (NASA/JPL-Caltech/MSSS) and 7 more NASA photojournal images: PIA05755,
  PIA05634, PIA07999, PIA08813, PIA14509, PIA17074, PIA22929.
- **NASA mission pages:** MER Science Instruments, MER Science Objectives, the Opportunity mission page, and JPL news
  releases (2004–2019).

Full list with links and check dates: https://echoes-of-the-cosmos-2026.vercel.app/about

## Space agency partner and other data

None. All data and images are from NASA, JPL or NSSDCA.

## Use of artificial intelligence

Claude Code (Claude Opus 5.5, Anthropic) was used as a coding and writing assistant throughout. Two Claude Code skills
were used as well: `impeccable` for design review and accessibility audit, and `teardown` for the frame-capture
tooling and the procedural sound kit. AI helped write the code and draft the text, always from NASA, JPL or NSSDCA
pages that were opened and quoted first; a content lint and a source checker verify it.

AI did not produce any data, image or 3D model. Every rover position comes from the traverse table, every image is a
NASA image with its credit, and the rover is NASA's own model. The film's music is synthesised by code, and its
English voice-over is a synthetic voice (Kokoro-82M, an open-weight text-to-speech model run on the author's laptop),
reading a script built from the site's sourced facts. The site has no AI chatbot. Details: https://github.com/hoanganh-repogit/Nasa-Challenge/blob/main/docs/AI_DISCLOSURE.md

## References

- https://github.com/hoanganh-repogit/Nasa-Challenge/blob/main/docs/DATA_METHODOLOGY.md
- https://github.com/hoanganh-repogit/Nasa-Challenge/blob/main/docs/CREDITS.md
- https://echoes-of-the-cosmos-2026.vercel.app/about (all 31 sources)
- https://github.com/hoanganh-repogit/echoes-of-the-cosmos-research (pre-event research and the build log)

## Tags

Mars, Opportunity, rover, storytelling, data visualization, education, 3D, accessibility

---

Independent educational prototype; not an official NASA product and not endorsed by NASA.

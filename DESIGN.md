---
name: Echoes of the Cosmos
description: Opportunity's 14 years on Mars as one long night exposure, built from NASA's own records.
colors:
  night: "#0b1020"
  dusk: "#1f2a4d"
  ground: "#5a3a2a"
  tungsten: "#f2a65a"
  star: "#eef1f6"
  star-dim: "#b3bccd"
  print: "#f6f1e7"
  print-ink: "#1a1712"
typography:
  display:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 1.6rem + 3.4vw, 4.6rem)"
    fontWeight: 640
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.3rem + 1.8vw, 2.85rem)"
    fontWeight: 620
    lineHeight: 1.06
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.1rem + 0.6vw, 1.6rem)"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.96rem + 0.2vw, 1.12rem)"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Commissioner Variable, system-ui, sans-serif"
    fontSize: "clamp(0.78rem, 0.75rem + 0.15vw, 0.86rem)"
    fontWeight: 400
    letterSpacing: "0.12em"
    fontFeature: "tnum"
rounded:
  print: "3px"
  pill: "999px"
spacing:
  gutter: "clamp(1rem, 4.5vw, 4.5rem)"
  band: "5.1rem"
components:
  button-primary:
    backgroundColor: "{colors.tungsten}"
    textColor: "{colors.night}"
    rounded: "{rounded.pill}"
    padding: "0.95rem 1.7rem"
  button-next:
    backgroundColor: "{colors.star}"
    textColor: "{colors.night}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.35rem"
  button-outline:
    textColor: "{colors.star}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.35rem"
  evidence-print:
    backgroundColor: "{colors.print}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.print}"
---

# Design System: Echoes of the Cosmos

## Overview

**Creative North Star: "Night Exposure"**

The whole mission is one long photograph. Fourteen years of driving become a single tungsten light trail drawn across a darkened orbital map of Meridiani Planum, under star arcs that turn slowly around a pole. NASA's real rover model stands in the foreground, lit by hand like a night portrait. Text sits on the picture the way print sits on a photograph: thin, quiet, and out of the way of the light.

It is photographic, not science fiction. There are no HUD frames, glow edges, scanlines or "mission control" panels. Reading happens in stillness: when a card opens, the sky stops turning. NASA's daylight images arrive as warm-white "developed prints" with their credit lines, because the evidence is the one thing on the page that is not illustrative.

Rejected directions (by the user, in shaping): sci-fi/HUD, NASA look-alike, over-sentimental, childish or gamified, and flat 2D keyline diagrams.

**Key Characteristics:**
- One dark field, one warm light. Everything else is neutral.
- Real data drawn as light; illustration always labelled as such on screen.
- EXIF-style captions: tracked uppercase, tabular numerals.
- Evidence as paper: warm-white prints with credits, set against the night.
- A single signature interaction: the light-paint reveal of one rover part.

## Colors

A night palette with exactly one warm accent, used only where light is.

### Primary
- **Tungsten** (#f2a65a): the light trail, the moving marker on the sol axis, the current chapter, the selected part, the lit turret label, and the primary "Start the journey" button. 9.36:1 on night.

### Neutral
- **Night** (#0b1020): every large field: page background, sky zenith, band.
- **Dusk** (#1f2a4d): the horizon band of the sky, raised surfaces, scrollbar thumbs, image placeholders.
- **Ground** (#5a3a2a): the darkened orbital plane and static-map placeholder.
- **Star** (#eef1f6): body text, headings, star arcs, the light "Next stop" button. 16.72:1 on night.
- **Star Dim** (#b3bccd): captions, metadata, secondary list text. 9.91:1 on night.
- **Print** (#f6f1e7): the evidence print's paper.
- **Print Ink** (#1a1712): text and links on the print.

### Named Rules
**The One Light Rule.** Tungsten is reserved for what moves or is selected: the trail, the marker, the current chapter, the pressed toggle, the lit part. Never for decoration, emphasis in prose, or headings that are not live.

**The Illustrative Dust Rule.** The Silence stop may tint the fog, sky and motes toward dust brown (#5a4636 haze, #b48d6a motes). That tint exists only there and is labelled "Dust storm is illustrative".

## Typography

**Display Font:** Commissioner Variable (self-hosted, SIL OFL), with system-ui
**Body Font:** Commissioner Variable
**Label Font:** Commissioner Variable, tracked uppercase with tabular numerals

**Character:** one humanist sans across every role; hierarchy comes from weight (400 to 650) and size, not from a second family.

### Hierarchy
- **Display** (640, clamp(2.4rem, 1.6rem + 3.4vw, 4.6rem), 1.02): the opening headline only, two lines, the second in tungsten.
- **Headline** (620, clamp(1.75rem, 1.3rem + 1.8vw, 2.85rem), 1.06): the stop question, the part name, the Legacy title.
- **Title** (600, clamp(1.25rem, 1.1rem + 0.6vw, 1.6rem), 1.3): the one-line finding under each question.
- **Body** (400, clamp(1rem, 0.96rem + 0.2vw, 1.12rem), 1.55): leads, captions, cards; measure held at 34rem in the stop column and 62–68ch elsewhere.
- **Label** (400–600, clamp(0.78rem, 0.75rem + 0.15vw, 0.86rem), 0.12em, uppercase, tabular): chapter rail, metadata line, the EXIF band, honesty labels.

### Named Rules
**The No Eyebrow Rule.** Nothing sits above a heading. Place, sol and date go in the metadata line under the question.

**The EXIF Rule.** Any live number (sol, km, records) is tabular and set in the label style, with the value in tungsten only when it is live.

## Layout

A full-screen 3D stage (vanilla three.js) behind a thin React text layer. The gutter is clamp(1rem, 4.5vw, 4.5rem). The chapter rail runs across the top; the stop column is bottom-left, at most 36rem wide; the evidence print sits on the right; the EXIF band is fixed at the bottom (5.1rem desktop, 7.6rem journey and 8.6rem opening on phones).

Panels that need more reading room (the lit part, Legacy) take the stop column's place and scroll inside it. At 720px and below, the column spans the width, the print becomes full screen, the honesty labels move under the chapter rail in two tiny lines, and the rover inset frames itself in the top half.

`/about` is a single reading column, max 46rem.

## Elevation & Depth

Depth comes from light and the photograph, not from UI chrome. The interface is flat; the only shadows are physical ones.

### Shadow Vocabulary
- **Print** (`box-shadow: 0 24px 60px -20px rgb(0 0 0 / 0.7), 0 2px 6px rgb(0 0 0 / 0.35)`): the developed print lying on the night.
- **Lamp** (`box-shadow: 0 10px 30px -12px color-mix(in oklab, #f2a65a 60%, transparent)`): the primary button's warm spill.
- **Marker** (`box-shadow: 0 0 10px 1px color-mix(in oklab, #f2a65a 70%, transparent)`): the point of light on the sol axis. It is a light source, not a halo on a surface.

### Named Rules
**The Veil Rule.** When the rover inset or Legacy needs attention, the map is veiled (up to 86% night) and the trail dimmed, never blurred.

## Shapes

Pills for every action (999px), 3px corners for paper, 50% for the marker and tool step numbers. Thin 1px rules in star at 10–22% separate rows and list items. No cards as page structure; no nested containers.

## Components

### Buttons
- **Shape:** pill (999px), min-height 2.9rem (3.4rem primary).
- **Primary:** tungsten fill, night text, lamp shadow. Used once per screen: "Start the journey".
- **Next:** star fill, night text: "Next stop", "Back to the stop", "What it all revealed".
- **Outline:** transparent, star text, star-dim 1px border: "The evidence", the part button. Expanded or pressed state turns the border and text tungsten.
- **Ghost:** night at 70%, star text, star 28% border: secondary links ("Meet the rover") and the icon-only previous button.
- **Hover / Focus:** border brightens to star; icons nudge 2px along their arrow. Focus ring 2px tungsten, offset 3px (print ink on paper).

### Evidence print
- **Corner Style:** 3px.
- **Background:** print paper, print-ink text, links underlined in ink.
- **Content order:** NASA image with title, PIA, credit, date, colour note; then the evidence, the quote with its source, "What this does not tell us", FAQ, sources.
- **Behaviour:** develops in (520ms, translate and a 0.6° settle); Esc closes and returns focus to the button.

### Band (EXIF)
- **Style:** night at 86%, 1px top rule, label typography. Live readout (sol, km, provenance) on the left; text buttons on the right (Back to the start, Reduce motion with aria-pressed, Static view); fine print below with the NASA disclaimer and "How this was made".

### Chapter rail
- **Style:** four uppercase chapter buttons over a true sol axis with stop ticks; the current chapter and the marker in tungsten.

### Light-paint reveal (signature)
The other parts dim to colour × 0.12 in 400ms, a tungsten spot sweeps an 80° arc for 900ms and stops, the chosen part warms and steps out 4cm, and only then does the caption read. Reduced motion jumps to the end state. A leader line in tungsten (1px) joins the turret to its label.

## Do's and Don'ts

### Do:
- **Do** keep the four honesty labels on screen during the journey ("Night sky and light trail are illustrative; the rover drove by day", rover not to scale, flat plane, 2-point fit), including on phones.
- **Do** give every image its own NASA credit line and every fact a source link.
- **Do** stop the sky (and the dust) while a card or panel is open, and when Reduce motion is on.
- **Do** start a camera move on the frame after React has laid out new text, so layout work never lands mid-flight.

### Don't:
- **Don't** use tungsten for anything that is not moving or selected.
- **Don't** put a kicker or eyebrow above a heading.
- **Don't** use NASA or JPL logos, NASA-style layouts, HUD frames, glow edges or scanlines.
- **Don't** blur or fade the map with opacity to focus attention; dim it with the veil and colour.
- **Don't** present the "I, Opportunity" line without its "Narrative dramatization" label.

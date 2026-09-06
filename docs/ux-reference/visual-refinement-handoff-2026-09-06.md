# MySports TV — Visual Refinement Handoff

**Purpose:**  
This document accompanies the latest visual rendering and is intended for Claude Code as a **careful visual refinement brief**, not as authorization for a broad redesign.

The goal is to improve the visual polish of the current MySports TV application while preserving the parts of the UI that are already intentionally designed and working well.

---

# 1. PRIMARY DESIGN INTENT

The application should retain its current MySports TV identity and structure, but move toward a more premium, modern broadcast-console aesthetic.

The key visual shift is:

- retain the charcoal/dark background concept;
- replace the current yellow/mustard gold with a cooler, more metallic gold;
- improve depth, hierarchy, polish, and interaction feedback;
- deploy these improvements selectively and conservatively;
- **do not disrupt carefully designed existing LIST and GRID cards.**

The accompanying rendering should be treated as a **visual direction reference**, not a literal rebuild specification.

---

# 2. IMPORTANT: PROTECT EXISTING CARD DESIGN

## LIST cards

I am currently pleased with the basis of the existing LIST cards, including:

- card shape;
- card proportions;
- content hierarchy;
- information density;
- field/content inclusion;
- team placement;
- score placement;
- network placement;
- supporting metadata;
- spacing relationships within the card.

Claude should **not redesign the fundamental LIST card structure**.

Do not:

- simplify card contents;
- remove fields;
- collapse information;
- rearrange major content zones;
- substantially alter card dimensions;
- substitute the simplified card design shown in the rendering;
- materially change the established internal information layout.

Any stylistic work on LIST cards should be **surface-level and additive**, such as:

- color treatment;
- subtle border refinement;
- minor shadow refinement;
- selected/live emphasis;
- improved hover/pressed states;
- Watch Live treatment;
- subtle My Team accent treatment;
- typography color refinement where it does not disturb hierarchy.

If a proposed visual enhancement requires changing the underlying LIST card architecture or established information layout, Claude should stop and present the proposed change before implementing it.

---

# 3. PROTECT EXISTING GRID CARD DESIGN

I am also currently pleased with the basis of the existing TV GRID cards, including:

- event block shape;
- event size relationships;
- information shown;
- team placement;
- divider structure;
- network/time relationships;
- event block layout.

Claude should **not redesign the fundamental GRID event card structure**.

Do not:

- remove existing information;
- simplify event blocks;
- change the underlying content layout;
- replace the current event card design with the simplified examples shown in the rendering;
- materially alter event geometry unless required for an approved usability fix.

Allowed refinements include:

- color;
- subtle depth;
- border refinement;
- current-time indicator styling;
- Watch Live banner styling;
- hover/press feedback;
- sticky-header visual treatment;
- selected/current-state emphasis.

---

# 4. NEW PRIMARY GOLD

The current gold/yellow should be replaced with the new approved metallic gold family.

## Core palette

**Primary metallic gold:**  
`#C6AF7A`

Suggested supporting tones:

**Highlight gold:**  
`#E0D1A5`

**Mid gold:**  
`#B39A69`

**Deep gold:**  
`#8C7650`

**Soft gold glow:**  
`rgba(198, 175, 122, 0.22)`

**Gold border / fine accent:**  
`rgba(198, 175, 122, 0.55)`

Claude should first audit all current uses of the existing yellow/gold and identify:

- global tokens;
- CSS variables;
- inline values;
- gradients;
- SVG fills;
- borders;
- button fills;
- selected-state colors;
- icon colors;
- text colors;
- hover/pressed states;
- shadows/glows.

The goal is to replace the current yellow-heavy palette with a **cooler metallic champagne-gold family** while preserving contrast and usability.

---

# 5. GOLD USAGE PHILOSOPHY

Gold should communicate:

- active state;
- selected state;
- premium action;
- Watch Live action;
- current-time emphasis;
- My Team emphasis where appropriate;
- key interaction cues.

Gold should **not** be used indiscriminately for all text or all important information.

Preferred hierarchy:

- White / near-white = primary sports information.
- Gray = secondary metadata.
- Metallic gold = selection, action, emphasis.
- Red = LIVE state.
- Network/team branding colors = remain authentic where appropriate.

This should make the app feel premium rather than yellow-heavy.

---

# 6. BUTTON AND SEGMENTED-CONTROL TREATMENT

The current segmented controls should be visually refined using the new gold.

Examples include:

- DAY / WEEK;
- ALL GAMES / MY TEAMS;
- LIST VIEW / TV GRID.

Preferred treatment:

- dark recessed control track;
- selected state in metallic gold;
- slightly darker unselected state;
- dark text on selected gold if contrast is strong;
- subtle top highlight and lower-depth treatment;
- restrained metallic gradient rather than a flat yellow fill.

Suggested selected gradient direction:

`#D8C595 → #C6AF7A → #B39A69`

This should be subtle.

Do not make the controls glossy or flashy.

Claude should preserve current dimensions and spacing unless there is a clear usability problem.

---

# 7. BACKGROUND TREATMENT

Retain the current charcoal spotlight / glow concept.

The current background direction should remain recognizable.

Existing concept:

- brighter charcoal near the upper-center area;
- darker toward the sides and bottom;
- soft radial falloff;
- dark overall presentation.

Previously established reference values include approximately:

- `#3B3B3B`
- `#232323`
- `#1B1B1B`
- `#0E0E0E`

Claude should inspect the actual current implementation before changing it.

Preferred refinement:

- preserve the same overall background identity;
- make the spotlight feel slightly softer and more premium;
- avoid obvious banding;
- optionally add extremely subtle depth/noise if technically appropriate;
- avoid decorative textures that compete with schedule content.

The background should remain understated.

---

# 8. DARK SURFACE HIERARCHY

Claude may improve the visual hierarchy between:

- page background;
- control surfaces;
- LIST cards;
- GRID surfaces;
- sticky headers;
- elevated/live states.

Suggested conceptual structure:

- Page background: darkest.
- Control surface: slightly lighter.
- Card surface: slightly lighter again.
- Live/selected/elevated surface: slightly brighter or more dimensional.

The goal is to create depth without adding heavy borders everywhere.

Do not force these exact values if they conflict with the existing design system. Audit first.

---

# 9. BORDER REFINEMENT

Where appropriate, reduce harsh or overly visible borders.

Preferred direction:

Normal card edge:
`rgba(255,255,255,0.07)` or similar subtle neutral edge.

Selected / gold-emphasized edge:
`rgba(198,175,122,0.40)` or similar.

Avoid:

- thick gold outlines around every selected element;
- excessive glowing borders;
- boxed-in appearance.

Gold should feel selective and premium.

---

# 10. WATCH LIVE TREATMENT

The approved Watch Live concept remains important.

## LIST cards

For a live/watchable event:

- retain all existing card content;
- add a compact floating Watch Live control over the upper-right corner of the existing network icon area;
- metallic gold treatment;
- do not obscure the network icon or existing information;
- keep it visually integrated with the current card.

## TV GRID

For a live/watchable event:

- retain existing grid-card structure;
- add a narrow semi-transparent metallic-gold banner reading:

**WATCH LIVE**

- position the banner directly above the horizontal divider between away and home teams;
- do not obstruct current content;
- clicking/tapping the eligible event should launch the relevant approved stream destination.

Preferred Watch Live treatment:

- metallic gold;
- dark charcoal text;
- optional small play icon;
- subtle highlight;
- no oversized button treatment.

---

# 11. LIVE STATE

Keep LIVE visually distinct from gold.

Preferred:

- small red dot;
- red LIVE label;
- gold reserved for the action to watch.

Semantic rule:

**Red = event state**  
**Gold = user action / selection**

Do not convert LIVE status to gold.

---

# 12. MY TEAM EMPHASIS

If My Team events need extra emphasis, use a restrained treatment.

Possible refinements:

- subtle gold edge;
- thin gold accent;
- small gold star;
- understated label.

Do not:

- flood the entire card with gold;
- overpower team colors;
- make My Team cards structurally different from normal cards.

The visual cue should be noticeable but controlled.

---

# 13. TYPOGRAPHY REFINEMENT

Do not remove information.

Instead, improve hierarchy through color and weight.

Preferred hierarchy:

## Primary
- team names;
- scores;
- key matchup information;
- high-contrast white / near-white.

## Secondary
- time;
- network;
- event status;
- medium emphasis.

## Tertiary
- records;
- venue;
- rankings;
- pitcher;
- conference;
- supporting metadata;
- muted gray.

Gold should not replace white as the default information color.

Claude may refine text colors and weights where this improves hierarchy without disturbing the existing card layout.

---

# 14. SPORTS FILTER / ICON ROW

Preserve existing sport choices and logos.

Potential refinement:

- selected sport gets a thin metallic-gold ring or outline;
- small soft gold halo;
- selected label becomes gold;
- unselected options remain neutral.

Avoid:

- oversized selected tiles;
- large gold blocks;
- changing the sport selector into a completely different component unless necessary.

---

# 15. TV GRID VISUAL REFINEMENT

The grid may be improved visually without changing its card structure.

Preferred enhancements:

- slightly darker network column;
- slightly differentiated time header;
- very subtle grid lines;
- metallic-gold current-time line;
- metallic-gold NOW label;
- subtle sticky-header shadow when sticky mode engages;
- improved visual separation between sticky layers and scrolling content.

Do not redesign the actual event blocks unless required by a previously approved usability change.

---

# 16. MICRO-INTERACTIONS

Claude may add restrained motion where safe.

Examples:

- segmented control slide;
- subtle button press;
- slight hover brighten on desktop;
- tiny scale/press feedback;
- soft Watch Live emphasis;
- smooth selected-state transition;
- sticky-header shadow appearing when engaged.

Preferred timing:

approximately `120ms–220ms`.

Avoid:

- bouncing;
- exaggerated easing;
- long transitions;
- flashy effects;
- animation that slows navigation.

---

# 17. GLASS / TRANSLUCENT EFFECTS

Use sparingly.

A subtle translucent treatment may work well for:

- the main control area;
- sticky control surfaces;
- sticky grid header.

Potential direction:

`rgba(20,22,24,0.84)`

with restrained backdrop blur if browser support/performance is acceptable.

Do not apply glassmorphism throughout the app.

The goal is subtle depth, not a redesign theme.

---

# 18. DO NOT OVER-APPLY THE RENDERING

The attached rendering is intentionally aspirational.

Claude should **not** blindly reproduce:

- simplified card content;
- invented card geometry;
- alternate spacing;
- fictional team/network layouts;
- different information payload;
- different proportions.

Use the rendering for:

- color direction;
- depth;
- gold treatment;
- control styling;
- overall premium feel;
- Watch Live styling;
- current-time styling;
- restrained glow;
- surface layering;
- interaction polish.

Preserve production components that are already intentionally designed.

---

# 19. IMPLEMENTATION PHILOSOPHY

The implementation should follow this priority:

## Priority 1
Apply the new gold palette consistently.

## Priority 2
Improve selected-state and segmented-control treatment.

## Priority 3
Improve background/surface depth.

## Priority 4
Improve borders, shadows, and subtle hierarchy.

## Priority 5
Apply Watch Live styling.

## Priority 6
Improve TV Grid current-time / sticky-layer styling.

## Priority 7
Add restrained micro-interactions.

## Priority 8
Consider optional effects such as subtle translucency only if they clearly improve the app.

At every step:

> Preserve existing LIST and GRID card structure and information layout unless the change is explicitly reviewed and approved.

---

# 20. REQUIRED PRE-CHANGE AUDIT

Before making styling changes, Claude should inspect the current app and produce a short audit of:

- current gold values;
- current charcoal/background values;
- global design tokens;
- card colors;
- border colors;
- selected states;
- hover/pressed states;
- text colors;
- LIVE colors;
- My Team styling;
- Watch Live implementation if already present;
- sticky grid styles;
- current card CSS/components;
- any areas where a global color change could unintentionally affect logos, network branding, or carefully tuned card treatments.

Claude should identify:

- what can be safely updated globally;
- what needs targeted styling;
- what should remain untouched.

---

# 21. MATERIAL CONFLICT RULE

If Claude determines that a proposed visual enhancement would require:

- changing LIST card geometry;
- changing GRID event geometry;
- rearranging card content;
- removing information;
- altering carefully tuned internal spacing;
- restructuring existing card markup;
- changing the behavior of a card in a material way;

Claude must stop and present the issue before implementing that change.

For each issue, explain:

1. What would need to change.
2. Why the enhancement requires it.
3. What existing design would be affected.
4. The visual benefit.
5. The risk.
6. A safer alternative if available.

Do not silently redesign carefully tuned card components.

---

# 22. DESIRED END RESULT

The finished app should feel:

- darker;
- more premium;
- less yellow;
- more metallic;
- more refined;
- more dimensional;
- more intentional;
- more like a modern broadcast interface;
- visually richer without becoming busier.

The schedule content should remain the star.

The redesign should **enhance the work already completed**, not replace it.

---

# 23. SHORT CLAUDE CODE KICKOFF PROMPT

Use this prompt with the file and rendering:

> Read this visual refinement handoff and review the accompanying MySports TV rendering before making changes.
>
> Treat the rendering as a visual-direction reference, not a literal component redesign.
>
> My existing LIST cards and TV GRID cards have been carefully designed and I am currently pleased with their core shape, content, information density, and internal layout. Preserve those elements.
>
> Your job is to apply as many of the approved visual refinements as safely possible around and on top of the current production design:
>
> - migrate the app from the current yellow/mustard gold to the approved metallic gold `#C6AF7A` family;
> - improve selected controls;
> - improve surface depth;
> - refine borders and shadows;
> - improve Watch Live styling;
> - refine the TV Grid current-time/sticky treatment;
> - add restrained premium interaction polish where appropriate.
>
> Before editing, audit the existing color tokens, styles, card components, and state treatments. Identify which enhancements can be applied globally and which require targeted changes.
>
> Do not simplify, restructure, or materially alter the existing LIST or GRID card designs without first presenting the proposed change, its benefit, its risk, and a safer alternative.
>
> If any requested styling conflicts with existing carefully tuned components, run the issue past me before changing it.
>
> Prefer conservative enhancement over unnecessary redesign.

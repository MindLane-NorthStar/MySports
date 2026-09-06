# MySports TV — Schedule Hub UI Restructure & Implementation Specification

**Document purpose:** Authoritative product, UX, navigation, interaction, and implementation specification for the next MySports TV redesign.

**Primary implementer:** Claude Code

**Status:** Design direction approved for investigation, subject to the mandatory pre-implementation audit defined below.

---

# 0. IMPORTANT: DO NOT BEGIN IMPLEMENTATION IMMEDIATELY

Before modifying production code, Claude Code must perform a **comprehensive research and architecture audit** of the existing MySports TV application.

The purpose of this phase is to determine whether any part of this specification conflicts with:

- the existing code architecture;
- routing and navigation assumptions;
- shared components;
- application state;
- data models;
- streaming/deep-link behavior;
- schedule ingestion logic;
- responsive design;
- current mobile behavior;
- current desktop behavior;
- accessibility;
- browser limitations, especially iOS Safari;
- performance;
- caching;
- virtualization;
- sticky positioning;
- scroll containers;
- URL/query-state behavior;
- event status logic;
- completed-game handling;
- week/day boundary logic;
- timezone handling;
- user preferences;
- My Teams logic;
- live-game detection;
- network/service availability logic;
- any existing production behavior that this redesign may unintentionally remove.

## Mandatory rule

**Claude Code must not silently reconcile, reinterpret, work around, or ignore any material conflict.**

If the audit surfaces a:

- conflict;
- contradiction;
- incorrect assumption;
- technical limitation;
- UX flaw;
- data-model mismatch;
- regression risk;
- unclear requirement;
- browser compatibility issue;
- route/state problem;
- potentially destructive change;
- feature that would be lost;
- better implementation pattern that materially changes this specification;

Claude must **stop before making the affected change and present the issue to Joe for review**.

Claude should explain:

1. What the issue is.
2. Where it exists in the current codebase.
3. Why it conflicts with this specification.
4. What user-visible behavior could be affected.
5. The available options.
6. Claude's recommended resolution.
7. Any tradeoffs associated with each option.

**No material product decision should be made on Joe's behalf when the current app and this specification disagree.**

This requirement applies both during the initial audit and later during implementation if new issues are discovered.

---

# 1. PRODUCT OBJECTIVE

MySports TV is fundamentally a **sports schedule and viewing-access application**.

The application should let a user quickly answer questions such as:

- What games are on today?
- What games are live right now?
- What games involving my teams are on today?
- What games do my teams have coming up?
- Where is each game airing?
- What games are airing at a specific time?
- What games are on a specific future or past date?
- What is the full schedule for a week?
- What is the weekly schedule for one sport?
- What is the weekly schedule for only my teams?
- Can I launch the relevant broadcast/stream directly when a game is live?
- Do I want to browse that information in LIST format or in a TV-guide-style GRID?

The redesign should make those questions answerable from **one coherent schedule hub**, rather than splitting the application into multiple destination pages that duplicate schedule functionality.

---

# 2. PRIMARY ARCHITECTURAL DECISION

## Replace the current primary navigation model

The current primary navigation:

- TODAY
- WEEKS
- HISTORY

should be retired.

Do **not** replace it with separate:

- Home
- Schedule
- My Teams

pages.

Instead, the application should become a **single Schedule Hub** controlled by a small number of orthogonal selectors.

The user should remain on the same primary screen and change the "prism" through which schedule data is viewed.

The primary hierarchy is:

1. **When?**
   - DAY
   - WEEK

2. **What scope?**
   - ALL GAMES
   - MY TEAMS

3. **How should it be displayed?**
   - LIST VIEW
   - TV GRID

The interaction model should feel like one powerful schedule surface rather than navigation among multiple pages.

---

# 3. NON-NEGOTIABLE DESIGN PRINCIPLE: PRESERVE LIST-CARD INFORMATION

## Existing LIST-card content must remain

This redesign is **not authorization to simplify the content of existing LIST cards**.

Claude must not:

- remove fields;
- collapse fields;
- summarize fields;
- substitute a smaller data set;
- eliminate existing records/rankings/venue/pitcher/broadcast information;
- remove completed-game information;
- remove live-game information;
- remove upcoming-game information;
- redesign the cards into lower-information mockup cards unless Joe explicitly approves that separately.

### Hard requirement

> **DO NOT REMOVE, SUMMARIZE, COLLAPSE, OR REORGANIZE EXISTING INFORMATION PRESENTLY DISPLAYED IN PRODUCTION LIST CARDS SOLELY AS PART OF THIS NAVIGATION REDESIGN.**

The existing LIST cards are treated as information-complete components.

The navigation restructure should preserve them and wrap them in a cleaner application structure.

If the current code makes preservation difficult, Claude must report that problem before making changes.

---

# 4. WATCH LIVE — NEW INTERACTION TREATMENT

The redesign adds a new visual and interaction treatment for events that are:

1. currently LIVE; and
2. have a valid broadcast destination that MySports TV can launch.

This must not be shown for a game merely because it is live if the application does not have a usable watch destination.

## 4.1 LIST View

Preserve the existing LIST-card layout and information.

For a live/watchable event:

- Add a small floating **WATCH LIVE** icon/control.
- Position it over the **upper-right corner of the existing NETWORK icon area**.
- Keep it visually compact.
- It should not obscure existing network identity or other card information.
- Gold should be the primary accent.
- It should be clearly actionable.
- It should link to the best verified broadcast destination available for that game.

Joe's design intent is that this is a **small additive control**, not a replacement for card information.

Claude should investigate whether:
- the whole network icon area should become clickable;
- only the floating Watch Live control should be clickable;
- existing card-detail click behavior could conflict with this interaction.

Any conflict must be presented to Joe before changing current card click behavior.

## 4.2 TV GRID

Preserve the existing grid-card information.

For a live/watchable game:

- Render a **narrow semi-transparent gold banner**.
- Text: **WATCH LIVE**
- Position the banner directly above the horizontal line/divider separating the away and home teams.
- The banner should feel integrated into the event block rather than like a detached button.
- It must not conceal team names, scores, time information, network identity, or other existing data.

When this WATCH LIVE banner is present:

- tapping/clicking the central body of the GRID event should launch the relevant broadcast destination;
- the live-watch interaction should feel immediate;
- hover/focus/touch behavior should make the action understandable.

Claude must audit existing GRID click behavior before changing it.

If the grid already uses the event body for a different action, Claude must surface the conflict and propose options before implementation.

---

# 5. TOP-OF-APP STRUCTURE

The top-level application should be substantially simplified.

## 5.1 App identity / utility row

Retain the MySports TV identity/header.

Utility actions such as search/settings may remain if currently useful and if they do not create unnecessary visual clutter.

Claude should audit what currently exists and recommend whether each utility should remain visible, move to another location, or be consolidated.

Do not remove existing useful utility functionality without approval.

---

# 6. PRIMARY SEGMENTED CONTROL: DAY / WEEK

Immediately beneath the app identity/header should be a prominent two-state segmented control:

**DAY | WEEK**

Rules:

- Exactly one state must always be active.
- Active state uses the app's gold selection treatment.
- Inactive state is dark/subdued.
- DAY should be the default unless current app behavior or saved-state logic supports a better persistent preference.
- If Claude recommends remembering the user's last choice, present that as a product decision before changing default behavior.

This control replaces the old distinction between separate Today and Weeks pages.

DAY and WEEK are not destinations. They are viewing modes for the same schedule hub.

---

# 7. CONTEXTUAL DAY / WEEK PICKER

Immediately below the DAY/WEEK control is the contextual date control.

## DAY mode

Example:

`‹   TODAY · SAT SEP 5   ›   [calendar]`

or an equivalent compact production treatment.

Requirements:

- Current date should be easy to identify.
- Previous/next day controls should remain easy to use.
- A calendar/date-picker affordance should remain available if currently supported.
- Eliminate redundant standalone heading text such as "DATE" if the picker already communicates that context.
- Reduce excess vertical padding above and below the date control.

## WEEK mode

Example:

`‹   AUG 31 – SEP 6   ›   [calendar]`

Requirements:

- Previous/next week controls.
- Week range clearly readable.
- Week-picker/calendar affordance if supported.
- No redundant standalone "WEEK" heading above a control that already conveys week context.
- Reduce excess vertical padding.

Claude should inspect the current picker behavior and preserve useful functionality.

---

# 8. SPORTS FILTER

Below the date/week picker:

- retain **ALL SPORTS**;
- retain the existing individual sport choices/tiles/icons;
- preserve existing sport coverage and filtering behavior.

## Mobile behavior

Preferred direction:

- one horizontal rail;
- swipe/scroll horizontally if needed;
- avoid unnecessary wrapping to multiple rows;
- selected state must be unmistakable;
- ALL SPORTS should remain first.

Do not remove sport options because they do not fit on one screen.

If horizontal rail behavior would negatively affect accessibility or current UX, Claude should identify that before implementing.

---

# 9. FILTER / VIEW CONTROL ROW

Below the sports selector should be **one compact row** containing two independent segmented controls.

## Scope selector

`ALL GAMES | MY TEAMS`

Exactly one selected.

## Presentation selector

`LIST VIEW | TV GRID`

Exactly one selected.

These should not look like four unrelated buttons.

They represent two distinct binary decisions:

- scope;
- presentation.

Preferred visual treatment:

- each pair appears as its own segmented control;
- active state uses app gold;
- inactive state uses subdued/dark treatment;
- both control groups fit on one row on common mobile widths if feasible without harming tap-target size or legibility.

Claude must test realistic narrow mobile widths.

If one row cannot meet acceptable touch-target and readability standards, Claude should surface that conflict instead of simply shrinking text below reasonable usability.

---

# 10. REMOVE REDUNDANT STATUS COPY

The current design contains status/count copy that can feel repetitive or conceptually unclear.

Examples discussed include text such as:

- ON NOW;
- airing counts;
- TBD counts;
- unavailable counts;
- other repeated explanatory/status language above the actual schedule.

The redesign should remove information that does not help the user make a viewing decision.

However, Claude must first audit how those values are computed and whether they represent:

- game state;
- broadcast assignment;
- user subscription/access state;
- schedule completeness;
- something else.

Do not delete useful data simply because the presentation is weak.

The desired conceptual separation is:

## Game state
- Upcoming
- Live
- Final / Completed

## Broadcast state
- Network/service assigned
- TV TBD

## Access state
- Available to the user
- Not available through configured services
- Unknown/unsupported

These concepts should not be mixed into ambiguous summary language.

If current data structures conflate these states, Claude must report that before attempting UI cleanup.

---

# 11. CONTENT STARTS IMMEDIATELY AFTER CONTROLS

After:

1. DAY/WEEK;
2. date/week picker;
3. sports selector;
4. ALL GAMES/MY TEAMS;
5. LIST VIEW/TV GRID;

the schedule content should begin.

Avoid unnecessary explanatory sections between the controls and schedule results.

The page should feel dense enough to be useful without becoming visually cramped.

---

# 12. DAY + LIST VIEW

This mode shows the selected day's existing production LIST cards.

Examples:

- future day → upcoming event cards;
- today → mix of upcoming/live/completed as appropriate;
- past day → completed event cards.

All existing card information remains.

## When selected date = today

Claude should investigate whether live events should receive stronger ordering/visual priority.

Possible behavior:

- live events may rise toward the top;
- upcoming games follow;
- completed games may remain in appropriate chronological/logical position.

Do not alter sorting logic without first understanding current production behavior and presenting any proposed change that could surprise users.

The redesign does not automatically authorize a new sorting model.

---

# 13. DAY + TV GRID

This mode renders the selected day's TV-guide grid.

The grid must continue to communicate:

- network/service rows;
- time axis;
- event placement;
- current production event information.

Add WATCH LIVE treatment only where appropriate.

---

# 14. WEEK + LIST VIEW

WEEK + LIST VIEW should show the entire selected week.

Preferred structure:

- group schedule results by day;
- days display sequentially;
- retain each existing LIST card's information;
- allow ALL GAMES or MY TEAMS scope filtering;
- allow sport filtering.

The weekly view should not become an entirely different component system if existing day cards can be reused cleanly.

Claude should favor reuse where feasible.

---

# 15. WEEK + TV GRID

Do **not** attempt to compress seven complete daily TV guides into one unreadable mobile grid.

Preferred behavior:

1. WEEK remains selected.
2. Display a compact day strip for the selected week:
   - MON
   - TUE
   - WED
   - THU
   - FRI
   - SAT
   - SUN
3. One day in that week is active.
4. The TV grid beneath shows the active day's normal network-by-time guide.
5. Tapping another day changes the grid while preserving WEEK context.
6. Horizontal swipe between days may be considered if implementation is robust and discoverable.

The active day should be visually obvious.

When the user enters WEEK + TV GRID, Claude should determine sensible default active-day behavior.

Possibilities include:

- today, if the current week is selected;
- first day with games;
- previously selected day;
- currently focused day from another view.

Because this is a product-state decision, Claude should review current navigation/state patterns and recommend the least surprising behavior before implementation if no existing convention clearly determines it.

---

# 16. MY TEAMS IS A FILTER, NOT A PAGE

My Teams should no longer require a separate top-level page.

Instead:

`ALL GAMES | MY TEAMS`

controls the same schedule surface.

This means a user can view:

- one day / all games / list;
- one day / my teams / list;
- one day / all games / grid;
- one day / my teams / grid;
- one week / all games / list;
- one week / my teams / list;
- one week / all games / grid;
- one week / my teams / grid.

Claude must verify that the current My Teams data source/filter logic can support all relevant combinations.

If the existing My Teams implementation is page-specific or tightly coupled to another route, Claude must surface the refactor implications before changing it.

---

# 17. HISTORY IS RETIRED AS PRIMARY NAVIGATION, NOT AS FUNCTIONALITY

The History tab/page should no longer be required as a primary schedule navigation destination **if past dates can be fully navigated through DAY/WEEK**.

Critical requirement:

- completed games remain accessible;
- completed-game LIST card information remains;
- scores/results remain;
- historical dates remain browsable;
- useful historical search functionality must not be lost accidentally.

Claude must audit the current History page carefully.

If History currently contains functionality that is **not equivalent to simply selecting a past date**, such as:

- full-text search;
- cross-date search;
- result filtering;
- score lookup;
- archive-specific sorting;
- box-score access;
- special completed-game actions;

Claude must list those functions and present options for where they should live before retiring the route.

Do not delete History functionality merely because History navigation is being removed.

---

# 18. TV GRID — STICKY TWO-AXIS BEHAVIOR

This is a major UX requirement.

When the user scrolls down and the top of the TV grid reaches a short distance below the usable top of the mobile viewport:

- the grid's time header should become sticky;
- the user should continue seeing time labels while scrolling vertically through network rows.

When scrolling horizontally:

- the network/service column should remain sticky on the left.

The upper-left intersection cell must remain correctly layered.

## Required behavior

- Sticky time ruler at top.
- Sticky network column at left.
- Sticky top-left corner/intersection.
- Correct z-index hierarchy.
- Opaque/appropriate backgrounds so underlying game tiles do not visually bleed through.
- Smooth horizontal scrolling.
- Smooth vertical scrolling.
- Touch behavior that works on mobile.
- No jitter when Safari browser chrome expands/collapses.
- Prefer dynamic viewport units such as `dvh` where appropriate rather than assuming legacy `vh` is always correct.

Claude must research current DOM/scroll-container architecture before implementing.

`position: sticky` can fail or behave unexpectedly depending on overflow ancestors, transforms, virtualized containers, and nested scroll areas.

If the current grid architecture conflicts with the sticky design, Claude must explain the options and recommended solution before substantial refactoring.

---

# 19. CURRENT-TIME / NOW BEHAVIOR

When:

- DAY is selected;
- the selected date is today;
- TV GRID is selected;

the grid should make the current viewing window easy to find.

Preferred behavior:

- horizontally position near the current time on initial entry;
- show a visible NOW/current-time indicator;
- optionally provide a quick "jump to now" control if the user scrolls away.

Claude should research:

- existing time-axis math;
- timezone handling;
- event timezone normalization;
- local-time assumptions;
- daylight-saving-time behavior.

Do not implement current-time positioning using assumptions that could misalign the guide.

Any timezone ambiguity must be surfaced.

---

# 20. TIME-OF-DAY BEHAVIOR SHOULD COME FROM DATA, NOT PAGE CHANGES

The single Schedule Hub should work naturally at all times.

Examples:

## 10:00 AM Tuesday

Likely characteristics:

- relatively few live games;
- more upcoming events;
- LIST view primarily shows upcoming schedule;
- TV Grid may default around current time but should remain useful even when the major slate begins later.

No special Home page is needed.

## 8:00 PM Friday

Likely characteristics:

- many live events;
- live Watch Live controls appear frequently;
- TV Grid current-time positioning becomes especially valuable.

## 12:30 PM Saturday

Likely characteristics:

- heavy live sports load;
- especially college football depending on season;
- GRID should make dense simultaneous events easy to navigate;
- sticky time/network axes are particularly important.

The navigation does not change based on time.

The **data state changes, not the app architecture**.

---

# 21. RESPONSIVE DESIGN

The redesign must work on:

- mobile;
- tablet;
- desktop.

Mobile is the priority for this redesign.

Claude should inspect current responsive breakpoints before changing them.

## Mobile

Goals:

- compact vertical control stack;
- no excessive blank vertical space;
- comfortable tap targets;
- horizontal sports rail if needed;
- DAY/WEEK easy to reach;
- ALL GAMES/MY TEAMS and LIST VIEW/TV GRID easy to understand;
- TV Grid scroll interactions robust;
- Watch Live action obvious without clutter.

## Desktop

The same mental model should remain.

Do not create an entirely different information architecture.

The controls may spread horizontally where space allows, but they should preserve:

- DAY/WEEK;
- date/week picker;
- sport;
- scope;
- view.

---

# 22. STATE MANAGEMENT / URL BEHAVIOR — AUDIT REQUIRED

Claude must inspect how current state is stored.

The redesigned hub potentially needs state for:

- DAY vs WEEK;
- selected date;
- selected week;
- selected day within WEEK+GRID;
- sport filter;
- ALL GAMES vs MY TEAMS;
- LIST VIEW vs TV GRID;
- TV Grid horizontal scroll/current time;
- possibly search/filter state.

Claude should determine whether these states should:

- persist in URL/query params;
- persist in route params;
- persist in client state;
- persist in local storage;
- reset on reload;
- restore on back-navigation.

Do not make these decisions casually.

Claude should report the current behavior and recommend a state model that preserves shareability, navigation expectations, and browser back/forward behavior.

If route retirement could break inbound links/bookmarks, that must be reported.

Redirect strategy may be required.

---

# 23. ROUTING MIGRATION — AUDIT REQUIRED

Claude must identify:

- current Today route(s);
- current Weeks route(s);
- current History route(s);
- any nested routes;
- links from elsewhere in the application;
- direct external links/bookmarks;
- route-specific loaders/data fetching.

Before routes are deleted or consolidated, Claude should propose:

- target route structure;
- redirects;
- compatibility handling;
- migration of route-dependent state;
- whether old URLs should continue to resolve.

No route should be removed without accounting for current dependencies.

---

# 24. DATA MODEL / EVENT STATE AUDIT

Before changing UI status logic, Claude must inspect how the app currently represents:

- scheduled;
- postponed;
- delayed;
- canceled;
- live;
- halftime/intermission;
- final;
- final/OT;
- suspended;
- TBD time;
- TBD network;
- multi-network broadcasts;
- streaming-only broadcasts;
- unavailable networks;
- user-accessible streams;
- blackouts if represented;
- deep-link availability;
- event-specific link vs service-home-page link.

The Watch Live UI must not falsely indicate a direct event launch when only a generic service landing page is available, unless Joe explicitly decides that generic service links are acceptable under the same label.

If these cases are not currently distinguished in data, Claude must report that.

---

# 25. STREAMING / DEEP-LINK AUDIT

Because MySports TV's value proposition includes one-click viewing where possible, Claude must inspect how watch destinations are currently represented.

For each supported service/network, determine whether the app has:

- direct event deep link;
- network stream link;
- app URI;
- web fallback;
- generic home-page link;
- no usable link.

Claude should identify whether the new Watch Live treatment needs multiple destination classes.

Potential labels may need to differ, for example:

- WATCH LIVE
- OPEN PEACOCK
- OPEN DIRECTV
- VIEW ON ESPN

Do not change labels without approval if the underlying capability differs materially.

A UI promising "Watch Live" must not misrepresent the actual destination.

---

# 26. ACCESSIBILITY

Claude should audit and preserve/improve:

- keyboard navigation;
- focus states;
- screen-reader labeling;
- contrast;
- touch-target size;
- semantic button/segmented-control roles;
- live-state indicators that do not rely on color alone;
- sticky grid accessibility;
- scroll discoverability.

Gold vs dark styling must meet usable contrast standards where text is involved.

The WATCH LIVE interaction must have an accessible label.

---

# 27. PERFORMANCE

The redesign should not make large weekly schedules or dense TV grids sluggish.

Claude should inspect:

- rendering volume;
- list virtualization if any;
- grid virtualization;
- memoization;
- schedule data transforms;
- filtering cost;
- image/logo loading;
- sticky positioning impact;
- horizontal grid width;
- reflow/repaint behavior.

If WEEK + LIST with all sports can produce very large DOM trees, Claude should recommend a safe strategy without removing required data.

---

# 28. VISUAL DIRECTION

Preserve the application's established identity.

Preferred characteristics:

- dark background;
- existing MySports TV visual language;
- existing gold accent;
- clear selected states;
- compact but not cramped controls;
- strong information hierarchy;
- broadcast/TV-guide feel;
- avoid unnecessary decorative redesign.

This is primarily a **navigation and usability restructure**, not a brand overhaul.

---

# 29. REFERENCE RENDERINGS

The concept renderings created during planning should be treated as:

- layout references;
- hierarchy references;
- interaction-intent references;
- visual-direction references.

They are **not exact production specifications**.

AI-generated renderings may contain:

- invented games;
- incorrect logos;
- simplified card contents;
- fictional scores;
- imperfect spacing;
- inaccurate network assignments.

Therefore:

> **REFERENCE IMAGES MUST NOT OVERRIDE THE EXISTING PRODUCTION DATA MODEL OR THE REQUIREMENT TO PRESERVE CURRENT LIST-CARD INFORMATION.**

Claude should use them to understand the desired structure, not to reproduce mock data or remove existing detail.

Recommended repository location:

`/docs/ux-reference/`

---

# 30. REQUIRED PRE-IMPLEMENTATION RESEARCH DELIVERABLE

Before editing code, Claude must return a written audit containing the following.

## A. Current architecture map

Identify:

- framework/version;
- main routes;
- relevant components;
- data-fetching paths;
- state management;
- shared schedule components;
- list-card component(s);
- grid component(s);
- sports filter components;
- My Teams logic;
- History-specific logic;
- streaming-link logic.

## B. Requirement-by-requirement feasibility analysis

For each major requirement in this document:

- already supported;
- supported with minor changes;
- requires refactor;
- conflicts with current architecture;
- unclear;
- technically risky.

## C. Conflict / contradiction report

List every discovered:

- contradiction;
- hidden assumption;
- regression risk;
- missing state;
- data-model limitation;
- routing issue;
- browser limitation;
- accessibility concern;
- performance concern.

## D. Existing functionality at risk

Explicitly identify anything the redesign could accidentally remove or degrade.

## E. Recommended implementation sequence

Provide phased implementation steps.

## F. Questions / decisions for Joe

Only include questions that materially affect implementation.

For each, explain why the answer matters.

### Mandatory stop condition

If Claude identifies any material unresolved issue in sections C, D, or F, it must **wait for Joe's decision before modifying the affected behavior**.

Claude may continue analyzing unrelated parts of the codebase, but it must not silently choose a resolution.

---

# 31. IMPLEMENTATION APPROACH

After Joe resolves material audit findings, Claude should implement incrementally.

Suggested sequence, subject to audit findings:

## Phase 1 — Route/state foundation

- establish single Schedule Hub architecture;
- preserve old-route compatibility/redirects as approved;
- establish DAY/WEEK state;
- establish selected date/week;
- preserve filter/view state.

## Phase 2 — Top controls

- remove old primary navbar;
- add DAY/WEEK segmented control;
- compact date/week picker;
- preserve sports selector;
- create one-row paired segmented controls.

## Phase 3 — LIST integration

- reuse existing LIST card components;
- verify all existing information remains;
- add Watch Live floating control;
- validate live/upcoming/completed states.

## Phase 4 — WEEK LIST

- group full week by day;
- preserve sport and My Teams filtering;
- validate large-schedule performance.

## Phase 5 — GRID integration

- preserve grid data;
- add Watch Live banner/click behavior;
- implement sticky time header;
- implement sticky network column;
- implement correct z-index layering.

## Phase 6 — WEEK GRID

- add week day strip;
- define selected-day state;
- preserve week context;
- validate swipe/day selection if approved.

## Phase 7 — Current-time behavior

- NOW indicator;
- auto-position to current time;
- jump-to-now behavior if approved.

## Phase 8 — History migration

- ensure historical browsing is preserved;
- migrate any History-only functions to approved location;
- add redirects if needed.

## Phase 9 — Responsive/accessibility/performance verification

- iPhone/mobile;
- tablet;
- desktop;
- Safari;
- Chrome;
- keyboard;
- screen reader basics;
- large schedules.

---

# 32. ACCEPTANCE CRITERIA

The redesign is not complete until the following are verified.

## Navigation

- The old TODAY / WEEKS / HISTORY primary navbar is removed from the primary UI.
- No separate HOME page is required for core schedule use.
- No separate MY TEAMS page is required for core schedule use.
- DAY/WEEK controls the time prism.
- Exactly one of DAY/WEEK is selected.
- Exactly one of ALL GAMES/MY TEAMS is selected.
- Exactly one of LIST VIEW/TV GRID is selected.

## Date / week selection

- DAY mode supports past, current, and future dates.
- WEEK mode supports past, current, and future weeks.
- Completed games remain reachable.
- Current picker functionality is not unintentionally lost.
- Vertical spacing is meaningfully reduced versus the current DATE/WEEK presentation.

## Sports

- ALL SPORTS remains.
- All currently supported sport filters remain.
- Selected state is clear.
- Mobile treatment remains usable at narrow widths.

## LIST cards

- Existing production LIST-card information remains present.
- Upcoming cards still display all current data.
- Live cards still display all current data.
- Completed cards still display all current data.
- Watch Live addition does not obscure existing content.
- Watch Live only appears when the event is live and a valid launch destination exists.

## TV Grid

- Current production grid information remains.
- WATCH LIVE banner appears only on eligible live events.
- Banner is narrow and semi-transparent gold.
- Banner sits above the away/home divider.
- Eligible grid event is clickable/tappable to launch the broadcast destination as approved.
- Time header remains visible during vertical grid scrolling after it reaches sticky position.
- Network column remains visible during horizontal scrolling.
- Top-left intersection layers correctly.
- Grid remains usable on iOS Safari.
- Today's grid can locate current time efficiently.

## WEEK

- WEEK + LIST shows the selected week's schedule grouped by day.
- WEEK + MY TEAMS works.
- WEEK + sport filter works.
- WEEK + TV GRID preserves week context and allows rapid day selection.
- The implementation does not attempt to make seven full daily grids unreadably coexist on one mobile canvas.

## History / completed games

- Historical events are still accessible.
- Any History-only capabilities identified during audit are preserved or intentionally relocated with Joe's approval.
- Old historical links/routes are handled according to the approved migration plan.

## Streaming

- Watch Live does not falsely promise direct viewing where no usable destination exists.
- Event-specific deep links are used where available.
- Generic service links are labeled according to the approved behavior.

## Regression

- Existing schedule ingestion still works.
- Existing team filtering still works.
- Existing sport filtering still works.
- Existing card content is not lost.
- Existing scores/status logic is not degraded.
- Desktop remains functional.
- Mobile remains functional.

---

# 33. CLAUDE CODE OPERATING RULES

Claude should follow these rules throughout the work:

1. **Research first.**
2. **Do not modify code before the initial audit is complete.**
3. **Do not assume mockups are technically accurate.**
4. **Do not assume current architecture supports the desired behavior. Verify it.**
5. **Do not silently resolve product conflicts.**
6. **Run material problems past Joe before changing affected code.**
7. **Preserve production LIST-card information.**
8. **Prefer reuse of proven existing components where practical.**
9. **Do not remove History functionality without identifying what it currently does.**
10. **Do not promise Watch Live unless the destination behavior supports the promise.**
11. **Test the TV Grid sticky model against actual mobile scroll architecture.**
12. **Explain any recommended deviation from this spec before implementing it.**
13. **Implement in reviewable phases rather than one giant rewrite.**
14. **After each phase, verify against the acceptance criteria.**
15. **If a later discovery invalidates an earlier assumption, stop and surface it.**

---

# 34. REQUIRED FIRST RESPONSE FROM CLAUDE CODE

After reading this specification and before making code changes, Claude's first substantive response should contain:

## 1. Understanding of the target product architecture

Explain the single Schedule Hub model in Claude's own words.

## 2. Current codebase architecture

List the routes, components, state, data flows, and dependencies that matter.

## 3. Gap analysis

Map the current implementation to the requested implementation.

## 4. Conflict / contradiction / flaw analysis

Surface anything in this specification that:

- cannot work as written;
- conflicts with current behavior;
- relies on a false assumption;
- risks data loss;
- risks UX regression;
- risks browser incompatibility;
- requires a product decision.

## 5. Functionality-preservation audit

Specifically confirm what must be preserved from:

- LIST cards;
- GRID cards;
- Today;
- Weeks;
- History;
- My Teams;
- filters;
- stream-link behavior.

## 6. Recommended implementation plan

Break it into safe phases.

## 7. Decisions required from Joe

Present all material unresolved decisions before implementation.

### Explicit instruction

**Do not begin the redesign until Joe has reviewed and resolved any material issues identified by this audit.**

---

# 35. SHORT KICKOFF PROMPT FOR THE BUILD SESSION

Use the following message to begin the Claude Code session after this file is added to the repository:

> Read `CLAUDE.md` and this complete MySports TV Schedule Hub restructure specification before making any changes.
>
> Perform the mandatory comprehensive research/audit pass first.
>
> Your job is not merely to implement what is written. Your first job is to determine whether the requested redesign conflicts with the current codebase, data model, routing, responsive behavior, browser behavior, streaming-link architecture, or existing functionality.
>
> Surface every material conflict, contradiction, flawed assumption, regression risk, missing requirement, or technically unsafe approach you identify.
>
> For each issue, explain the problem, the impact, the available options, and your recommendation.
>
> **Run every material problem past me before making the affected change. Do not silently reconcile problems or make product decisions on my behalf.**
>
> Preserve all existing production LIST-card information. The only LIST-card change authorized by this specification is the additive Watch Live treatment described in the spec.
>
> Do not write code until you have completed the audit and presented your findings and proposed implementation sequence.

---

# 36. FINAL DESIGN INTENT

The finished MySports TV application should feel like:

**One hub. One schedule. Three simple questions.**

### WHEN?
DAY / WEEK

### WHAT?
ALL GAMES / MY TEAMS

### HOW?
LIST VIEW / TV GRID

Everything else should support that model.

The redesign should reduce navigation complexity while preserving the richness of the underlying sports data and making live viewing easier, faster, and more obvious.

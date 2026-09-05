# Research Changelog — 2026-09-02 (append to research-changelog.md)

## 2026-09-02 — Brief 2: Events & Shows (Chat architecture session)
- **Requests recorded** (enhancement-register.md): NASCAR (3 series), UFC, IndyCar, WWE, AEW, studio/pregame shows.
- **Decisions (Joe):** programs supertype approved; individual sport chips; race only; UFC one card + segment timeline; purchasable content excluded (AEW PPV out); studio = pre/post bookends; hosts/locations sourced not curated; one nascar sport + series; WWE = Raw/SmackDown/PLEs, NXT out; design pass option (a) prototype-first; UFC/NASCAR odds under show_odds.
- **Correction logged:** register initially re-flagged the §21 betting-lines contradiction; it was resolved 08-31 (`show_odds`) and odds already render (prompt 13). Failure mode: memory carried a stale open item past its resolution. Rule: check handoff-status "SIX DECISIONS" before re-raising any decision.
- **Verified fetch-clean sources:** espnpressroom.com (GameDay site table), wwe.com (Drupal; Premier Shows block = calendar), paramountplus.com Sneak Peak UFC schedule (static WP), paramountpressexpress.com (CBS windows), indycar.com (season table). **JS-blank:** espn.com stories, nascar.com schedule pages.
- **Rights verified:** UFC P+ exclusive through 2033 + CBS partial windows; WWE Raw Netflix / SmackDown USA (3h) / PLEs ESPN Unlimited / SNME Peacock; AEW Dynamite TBS+HBO Max, Collision TNT+HBO Max (volatile), PPV $39.99 purchase; NASCAR Cup FOX→Prime→TNT→USA/NBC(+Peacock ×4), O'Reilly CW, Truck FS1 (2 FOX); IndyCar all FOX.
- **New standing gotcha:** ESPN `site.api.espn.com` returned Akamai 403 for ALL endpoints (incl. NFL) from the cloud workspace 09-02. Verify Actions runner; consider browser UA in adapters/espn.py.
- **Watch-task additions proposed:** GameDay/Big Noon site releases (weekly); AEW monthly WBD schedule + mid-month moves; WWE PLE carriage confirmation; NASCAR postponements.
- **Deliverables:** research-studio-shows.md, research-wwe.md, research-aew.md, research-ufc.md, research-nascar.md, research-indycar.md, research-summary-2.md, research-brief-2-events-and-shows.md, enhancement-register.md (v0.1 + decisions §7–§9).

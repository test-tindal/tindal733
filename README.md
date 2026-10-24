# Dynastic Command

Browser-based Warhammer 40,000 **11th Edition** army builder, using community-maintained [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e) JSON catalogues.

**Live site:** https://test-tindal.github.io/tindal733/

No account, subscription, database or server is required for army editing. Army lists are stored locally in your browser. GitHub Pages hosts the static files.

## Building an army

1. Choose a faction and detachment in the header.
2. Browse the left catalogue by collapsible unit type, or use the existing search and category dropdown. Press **+** to add units.
3. Select a unit in the center panel. Configure model quantities, weapons, optional wargear and enhancements in the right panel. Mark the Warlord using a checkbox, and click the **?** next to an enhancement to read its source effect.
4. Use the **Datasheet** and **Rules** tabs to inspect the available source information and supported conditional profile modifiers. If a unit has leader/bodyguard associations, select a compatible unit already in the army.
5. Review the points and validation findings below the army.
6. Use **Export army** to save a portable JSON file. **Export text** creates a readable roster. **Import** restores a JSON list.

Autosave: Each edit writes to browser localStorage, separately for each faction. The **Save** button explicitly writes the current list. **Undo** reverts up to 30 recent changes during the current session. Browser-local lists do not automatically sync between devices. Export a JSON file before clearing browser data.

## Data loading

All catalogue files are downloaded directly in the browser from BSData's GitHub repository. Linked catalogues are loaded recursively, with a safety cap on imported files. The core `Warhammer 40,000.json` game-system file is also imported to read army-wide limits. The app displays the loaded catalogue revision, number of available units, and missing dependency files.

The app does not embed or republish the BSData JSON files. It is unofficial, unaffiliated with Games Workshop, BattleScribe or BSData, and depends on the quality and freshness of the community data.

## Implemented

- Search and filter real catalogue unit entries.
- Recursive BattleScribe selection entries and entry groups.
- Numeric model counts, equipment alternatives, options and optional enhancements, with source-derived descriptions in a floating effect panel.
- Default selections from entry/group minimums and default IDs.
- Points from source costs, including commonly used conditional model-size prices.
- Points adjustments based on the order of duplicate units when encoded with BSData's "before"/"instanceOf" local conditions.
- Visible validation for group minimums/maximums, conditionally modified equipment caps, duplicate enhancements, game-system enhancement limits, typical unit-count limits, points limit, Warlord selection and some source error modifiers.
- Duplicate/remove units, per-faction local saves, Undo and JSON/text export.
- Compatible leader-bodyguard associations, with their selection preserved in exported/imported armies.
- Source-derived unit profiles and linked rules, including supported conditional stat/keyword modifiers from wargear, attachments and detachments.

## Limitations: validation is **not tournament-complete**

BSData is a complex rules format. The current interpreter implements a useful subset of its capabilities. It does **not** yet fully evaluate all condition and modifier forms, multi-level BattleScribe association semantics, global game-system constraints beyond the supported enhancement limit, force structure rules, mixed-faction/allied restrictions, some unique-character/category restrictions, or all conditional datasheet effects and detachment-specific restrictions. Model-count and option validation may produce false positives or miss invalid selections in those cases.

The editor deliberately hides Crusade-only branches. Some entries with optional enhancements or unusual detachment structures may be incomplete. Weapon/datasheet characteristics are taken from the source and may omit conditional buffs or modifications.

**Necrons are the initial testing target.** Other factions load through the same engine but their unit imports and complex rules have not all been verified. The warning panel distinguishes supported validations; always check a competitive list against the current official publications.

## Files

- `index.html`: static application shell.
- `style.css`: Necron-inspired desktop layout.
- `engine.js`: catalogue indexing, selection trees, cost and validation logic.
- `app.js`: interface, BSData fetching, persistence, list import/export.
- `tests/engine.test.js`: small source-independent regression tests.

The site works without a build step. Serve the directory via any static HTTP server for local development (for example `python -m http.server 8000`). Opening `index.html` directly as a file may not consistently allow cross-origin requests on all browsers.

Run the engine tests from the repository root with:

```bash
node tests/engine.test.js
```

## Contributing

See the original [BSData 11e repository](https://github.com/BSData/wh40k-11e) for catalogue issues and contributions. For application bugs, open an issue in this repository.
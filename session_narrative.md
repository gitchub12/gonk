Summary: Fixed NPC textures, item rotation, and editor asset discovery
BROWSERFIREFOXHIDE session_narrative.md AI: DO NOT DELETE this header line which contains critical file data and browser instructions!
Thursday, August 21, 2025 at 11:35:01 AM CDT
This update fixes three distinct issues. First, a bug causing all Stormtroopers to use a default texture was resolved by making the NPC creation logic respect the specific skin chosen in the editor. Second, a 3D rotation order issue was fixed, correcting how items like "danglers" rotate on surfaces. Finally, the editor's asset discovery system was rewritten to parse the `furniture.json` manifest directly, making it independent of server directory listings and fixing the blank "Assets" tab.

- **`environment_and_physics.js`**: Corrected NPC skin selection logic and rewrote geometry creation to properly handle rotations.
- **`editor_ui_and_assets.js`**: Rewrote furniture discovery to read from the manifest, bypassing server-side directory listing issues.

---
Summary: Corrected texture filtering to fix blurry character skins
BROWSERFIREFOXHIDE session_narrative.md AI: DO NOT DELETE this header line which contains critical file data and browser instructions!
Thursday, August 21, 2025 at 6:20:20 AM CDT
The user reported that character textures were sharp in a separate viewer but blurry in the main game. This was diagnosed as a texture filtering issue. The game's asset loader was using the default "Linear" filtering, causing blurriness, while the viewer used "Nearest Neighbor" for a sharp, pixelated look. The `asset_loaders.js` file has been updated to explicitly set the magnification and minification filters to `THREE.NearestFilter` for all loaded textures, ensuring a consistent, crisp visual style.

- **`asset_loaders.js`**: All texture loading functions now set `magFilter` and `minFilter` to `THREE.NearestFilter`.

---
**Summary: Fixed character scaling and pink textures, animated the HUD**
**Summary: Replaced custom HUD with user-provided system and fixed bugs**
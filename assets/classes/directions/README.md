# Authored class directions

Six ImageGen reference edits add true rear and left-profile views to the approved front sprites. Each source has four rear poses and four profile poses: idle, stride, attack, hurt. Right-facing profiles mirror the authored left profile; they are not mirrored frontal art.

`pack-class-directions.py` preserves sources, separates the eight connected character silhouettes, retains substantial detached spell fragments with their nearest silhouette, removes tiny isolated generation noise, quantizes each directional atlas to 64 colors with hard alpha, and packs 128 px cells with feet at row 119. Standing poses are 104 px high. The barbarian source attack faces right and is mirrored to the common left profile during packing. Long weapon poses fit within 116 px cell width. Sources and exact prompts/corrections are recorded in `atlas.json`, with the original generation locations retained.

Side/back clips hold or alternate four authored poses; they are not eight unique animation drawings. Front idle/walk/attack/hurt/death remain the original atlas. Death explicitly falls back to the original front death sequence from every viewpoint. Directional death art remains future work.

`player-sprites.js` compares actor world forward (-Z) with each actual render camera in `onBeforeRender`. It chooses front/back/side, mirrors side UVs as required, and keeps the billboard camera-facing without changing actor heading. Direction textures are acquired lazily and keep independent per-instance UV transforms while sharing class CPU/GPU sources.

Rebuild: `python pack-class-directions.py` (Pillow, NumPy, SciPy). Verify: `node --test verify-player-directions.mjs verify-player-classes.mjs verify-player-sprites.mjs`. `contact-sheet.png` shows the actual quantized packed poses: rear four, profile four; classes mage, paladin, barbarian, warlock, thief, archer.

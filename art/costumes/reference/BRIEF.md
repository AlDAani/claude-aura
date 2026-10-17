# Agent icons: brief for ChatGPT image generation

The agents panel shows a small pixel crab next to every subagent. Today every general-purpose agent gets the same plain crab. The new set gives each model family its own series of costumes: Fable, Opus, Sonnet and Haiku. Each agent gets one costume picked at random from its model's series, and keeps it for its whole life.

The panel draws a sprite at about 33×29 screen pixels, so one sprite pixel is about one screen pixel, and animates the legs and body itself. That is why the base crab must stay exactly as it is.

## Files in this folder

- `template.png` is the base crab on the 32×32 grid, at 1024×1024. Attach it to every request.
- `examples.png` shows today's costumes, for style only: astronaut, detective, engineer, chef, racer and pirate.
- `zones.png` maps where the costume may go (blue and green) and what must not change (red and purple).

## Requirements for every image

1. **Canvas.** A 1024×1024 PNG on a 32×32 grid. Every sprite pixel is an exact 32×32 px square aligned to the grid from the top-left corner, with no half pixels.
2. **Background.** Solid `#FF00FF` everywhere outside the character. No magenta or pink-purple anywhere inside the sprite.
3. **Flat colour only.** No anti-aliasing, gradients, shading, dithering, glow, shadows, texture, text, border, frame or ground.
4. **Base crab unchanged.** Body `#D97757`, eyes `#1F1E1D`, arms and four legs stay pixel for pixel as in the template: same place, size and colours. Both eyes stay fully visible.
5. **Zones.**
   - Headwear sits on top of the head, fully above the body, in rows 0–15.
   - Held props stay at the sides: left columns 0–3 or right columns 28–31, next to an arm.
   - Nothing overlaps the body, the eyes or the legs.
6. **Colours.** At most 10 colours for the costume. Every colour must read on both a dark (`#1F1E1D`) and a light (`#FFFFFF`) panel, so large areas of near-black or near-white need a mid-tone edge.
7. **Accent slot.** 2–12 pixels in exactly `#00FFFF` where the tier colour should show, such as a hat band, a badge or a light. The panel recolours them.
8. **Readable at 1:1.** Every costume part is at least 2 pixels thick, each costume has a clear silhouette of its own, and there are at most 3 single-pixel highlights.
9. **One style.** Chunky, cute, simple and front-facing, like `examples.png`.

## Series: 8 per model

Rows marked "exists" are already drawn in code and don't need generating. That leaves 26 to generate.

| File | Costume line for the prompt |
| --- | --- |
| `fable-wizard.png` | a tall deep-purple wizard hat with a bent tip and two small yellow stars |
| `fable-astronaut.png` | exists |
| `fable-knight.png` | a steel knight helmet with an open visor slit above the eyes and a red plume on top |
| `fable-royal.png` | a golden crown with three points and cyan gems |
| `fable-oracle.png` | a dark-blue hood over the head and a glowing violet orb held at the right side |
| `fable-dragon.png` | a green dragon-scale helm with two curved ivory horns |
| `fable-alchemist.png` | brass goggles pushed up on the head and a bubbling green flask held at the left side |
| `fable-stargazer.png` | a navy cap with a crescent moon and a small brass telescope held at the right side |
| `opus-detective.png` | exists |
| `opus-engineer.png` | exists |
| `opus-professor.png` | a black mortarboard with a gold tassel and a red book held at the left side |
| `opus-surgeon.png` | a teal scrub cap and a small silver scalpel held at the right side |
| `opus-judge.png` | a white curly judge's wig and a wooden gavel held at the right side |
| `opus-captain.png` | a white captain's cap with a black peak and a brass spyglass held at the right side |
| `opus-scientist.png` | safety goggles on the forehead and a test tube with blue liquid held at the left side |
| `opus-conductor.png` | a black top hat with a cyan band and a thin white baton held at the right side |
| `sonnet-chef.png` | exists |
| `sonnet-painter.png` | a red beret and a paintbrush with a blue tip held at the right side |
| `sonnet-poet.png` | a green laurel wreath and a white quill held at the right side |
| `sonnet-musician.png` | big round headphones over the head and a small orange guitar held at the left side |
| `sonnet-barista.png` | a brown cap with a cyan band and a white coffee cup held at the right side |
| `sonnet-gardener.png` | a wide straw hat and a small green watering can held at the left side |
| `sonnet-photographer.png` | a grey newsboy cap and a black camera with a cyan lens held at the right side |
| `sonnet-dj.png` | a purple beanie and a black vinyl record held at the left side |
| `haiku-racer.png` | exists |
| `haiku-pirate.png` | exists |
| `haiku-skater.png` | a backwards red cap and a small skateboard held at the left side |
| `haiku-ninja.png` | a black headband tied above the eyes with two short tails flying to the right |
| `haiku-courier.png` | a yellow courier cap and a brown parcel held at the right side |
| `haiku-sprinter.png` | a cyan sweatband and a short silver relay baton held at the right side |
| `haiku-surfer.png` | sunglasses pushed up on the head and a small striped surfboard held at the left side |
| `haiku-pilot.png` | a brown leather aviator cap with goggles on top and a short white scarf flying to the right |

## Prompt

Attach `template.png` (and `examples.png` the first time) and paste this, with `{COSTUME}` replaced by a line from the table:

```text
Pixel-art game sprite on a 32×32 grid, rendered at 1024×1024 so every sprite pixel is an exact 32×32 px square aligned to the grid from the top-left corner.

Use the attached template as the exact base: an orange crab-like creature (#D97757) with two dark eyes (#1F1E1D), stubby arms and four legs. Keep the base pixel for pixel identical: same position, size and colours. Do not redraw, shade, move or cover it, and keep both eyes fully visible.

Add this costume: {COSTUME}.

Rules:
- Headwear sits on top of the head, entirely above the body (rows 0–15). Held props stay at the sides next to an arm (left 4 or right 4 columns). Nothing overlaps the body, eyes or legs.
- Flat colours only, at most 10 colours for the costume. No anti-aliasing, gradients, shading, dithering, glow, shadows, texture, text, border or ground.
- Background: solid pure magenta #FF00FF everywhere outside the character. Never use magenta or pink-purple inside the sprite.
- Paint 2 to 12 pixels in exactly #00FFFF where an accent colour belongs (a hat band, badge or light).
- Readable at tiny size: every costume part at least 2 pixels thick, a clear silhouette, at most 3 single-pixel highlights.
- Match the style of the attached examples: chunky, cute, simple, front-facing.

Output exactly one 1024×1024 PNG with nothing else in it.
```

For each next icon in the same chat, this is enough:

```text
Same template, same rules, same style. New costume: {COSTUME}.
```

## What to keep and what to redo

Exact pixels aren't required: the import snaps the image to the grid, keys out the magenta, cuts the palette down, and puts the canonical body, eyes and legs back. Redo an image if:

- the crab changed shape, size or position;
- an eye is covered;
- the background isn't one flat magenta;
- the costume spills over the body or legs;
- it's blurry or shaded.

## Delivery

Save the PNGs into `aura-icons/in/` under the file names above. The import turns each into an animated sprite in the panel's code, maps `#00FFFF` to the tier colour, and adds it to its model's series.

The model mapping is Fable → `fable-*`, Opus → `opus-*`, Sonnet → `sonnet-*`, Haiku → `haiku-*`. Any other model keeps the plain crab. The pick is random but fixed per agent.

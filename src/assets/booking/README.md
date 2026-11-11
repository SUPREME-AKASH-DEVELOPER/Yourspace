# Booking photographs

Drop the owner's photographs here, named by key, and rebuild. No code changes.

| File | Shows on |
|---|---|
| `setup-movie.jpg` | Movie Space card |
| `setup-karaoke.jpg` | Karaoke card |
| `setup-watch.jpg` | Watch Party card |
| `setup-date.jpg` | Celebration & Date Night card (replaces the current room shot) |
| `addon-bouquet-s.jpg` / `-m` / `-l` | The three bouquets |
| `addon-cake-strawberry.jpg` / `addon-cake-chocolate.jpg` | The cakes |
| `addon-photo-15.jpg` | The 15-minute celebration video |

`.jpg`, `.jpeg`, `.png` and `.webp` all work. Use a 3:4 portrait picture
for add-ons and 16:10 for setups, at least 1440px wide; the build resizes and
converts it to WebP.

## Temporary (AI-generated) pictures

Until the real photographs arrive, a stand-in can go in with `.sample` before
the extension — `addon-bouquet-s.sample.jpg`, `addon-photo-15.sample.jpg`. It
shows with a **Sample image** badge, so nobody books expecting that exact
bouquet. When the real photograph comes, save it under the plain name
(`addon-bouquet-s.jpg`); it takes over automatically. Then delete the sample. A new add-on or setup added in
`src/data/booking.ts` gets the key `addon-<id>` or `setup-<id>`.

**In place as samples (AI-generated, badged "Sample image"):** the three bouquets
(sunflowers, pink roses and lilies, red roses) and both cakes (strawberry,
chocolate) — all `*.sample.webp`.

**Deliberately without a picture:** the celebration video (`addon-photo-15`). The
old sample showed a vintage camera and printed photographs, which was right for
the photoshoot this used to be and wrong for a video, so it was taken out rather
than left to promise the wrong thing. The card falls back to the drawn gold art.
A still from a real celebration film is what belongs here.

**Still to come from the owner:** real photographs of every add-on, and the setup photographs.
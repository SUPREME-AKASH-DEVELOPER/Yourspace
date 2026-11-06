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
| `addon-photo-15.jpg` | The 15-minute photoshoot |

`.jpg`, `.jpeg`, `.png` and `.webp` all work. Use a 4:3 landscape picture
for add-ons and 16:10 for setups, at least 1440px wide; the build resizes and
converts it to WebP.

## Temporary (AI-generated) pictures

Until the real photographs arrive, a stand-in can go in with `.sample` before
the extension — `addon-bouquet-s.sample.jpg`, `addon-photo-15.sample.jpg`. It
shows with a **Sample image** badge, so nobody books expecting that exact
bouquet. When the real photograph comes, save it under the plain name
(`addon-bouquet-s.jpg`); it takes over automatically. Then delete the sample. A new add-on or setup added in
`src/data/booking.ts` gets the key `addon-<id>` or `setup-<id>`.

**In place as samples:** the three bouquets (`addon-bouquet-s/m/l.sample.webp` — sunflowers, pink roses and lilies, red roses), AI-generated.

**Still to come from the owner:** the real bouquet photographs, the photoshoot, the cakes, and the setup photographs.

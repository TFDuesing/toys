CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  notes      TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_clients_sort ON clients(sort_order, id);

-- Seed sample data. INSERT OR IGNORE preserves user edits after the first run.
INSERT OR IGNORE INTO clients (id, name, notes, sort_order) VALUES
  (1, 'Maria Santos',
   'Prefers balayage highlights, warm caramel tones. Sensitive scalp — use sulfate-free developer only.

Last visit: root touch-up + gloss (6N base, 8G ends). Likes to keep length past shoulders, no more than half an inch off.

Schedules every 7 weeks. Prefers Saturday mornings.',
   10),
  (2, 'Jordan Ellis',
   'Textured crop, faded sides (#2 guard blended to #4). Cowlick at crown — always cut against the grain.

Uses matte clay for styling. Allergic to tea tree oil — avoid Paul Mitchell line.

Likes to chat about basketball. Tips well, always pays cash.',
   20),
  (3, 'Priya Kapoor',
   'Long layers with face-framing pieces. Very thick, coarse hair — needs thinning shears on the ends.

Does henna at home between visits (avoid bleach overlap). Likes a blowout with a round brush, lots of volume at the roots.

Comes in every 10–12 weeks. Brings chai sometimes!',
   30),
  (4, 'Deshawn Mitchell',
   'High top fade, line-up every 3 weeks. Beard trim — keep it neat, rounded at the jawline.

Uses Cantu leave-in conditioner. Scalp tends to get dry in winter — recommend tea tree shampoo (not the Paul Mitchell, the generic).

Always books the last slot on Fridays.',
   40),
  (5, 'Sophie Brennan',
   'Pixie cut, keeps it very short on the sides. Currently platinum blonde — touch up every 5 weeks (30 vol developer, Wella T18 toner).

Sensitive ears — be careful with the clippers around the nape.

Brings her daughter sometimes (age ~4, just wants a trim).',
   50),
  (6, 'Carlos Reyes',
   'Classic taper, medium length on top. Slicks it back with pomade — likes a bit of shine.

Gray blending every other visit (just the temples). Has a scar behind the left ear — work around it gently.

Referred by Maria Santos. Prefers appointments before noon.',
   60),
  (7, 'Aisha Johnson',
   'Protective styles — usually box braids or twists. Came in last time for a silk press.

Edges are delicate — don''t pull too tight around the hairline. Uses Olaplex at home.

Wants to try a copper rinse next visit. Send her a swatch photo before she comes in.',
   70),
  (8, 'Liam Kowalski',
   'Shoulder-length wavy hair, just wants a clean-up every 8 weeks. No layers — one length, blunt cut.

Doesn''t like product. Air dries only. Split ends tend to get bad — recommend a trim every 6 weeks instead.

Very quiet, prefers no small talk. Reads on his phone during the cut.',
   80);

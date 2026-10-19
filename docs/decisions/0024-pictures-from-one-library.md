# 0024. Pictures from one shared library

- Status: Accepted
- Date: 2026-10-19

## Context
People want something other than their initials, but uploads mean storing
and moderating photos of people, and a circle of friends is one tap from a
bad one. Admins can already add a photo of someone the circle remembers.

## Decision
- **Initials stay the default.** A person may choose a picture from one
  library: a style and a seed (`{ library: 'dicebear', style, seed }`) saved
  on them in the people model (`PUT /me/avatar`, the versioned save).
- **Six bundled styles, chosen for how they look** (Bright, Toon, Classic,
  Big smile, Personas, Emoji), drawn on the device by DiceBear (MIT). They're
  CC BY 4.0 or free for any use, credited in the picker. Each style is drawn
  with friendly expressions only and soft backgrounds, and loads only when
  first shown. Nothing is uploaded or fetched from another service.
- **Skin tone is a second step**, the way most apps do it: pick a picture,
  then one of five natural tones under it (light until chosen). The seed
  varies hair and features; random skin colors never come up.
  (Revised Oct 19, 2026: the first six CC0 styles looked unfinished.)
- **One face everywhere.** `Face` and `PersonAvatar` (entities/person) show a
  photo the circle added, else the chosen picture, else initials. Everyone's
  choices load once and a change shows on every screen at once.
- **Choosing is one screen:** tap your face on your profile, pick a style,
  pick one of nine (or see more), or go back to initials.

## Consequences
No photos of the living are stored for avatars. Another library is another
`library` value and its styles.

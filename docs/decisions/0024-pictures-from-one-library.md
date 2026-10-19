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
- **Six bundled styles, all public domain (CC0)**, drawn on the device by
  DiceBear (MIT). Each style loads only when first shown. Nothing is uploaded
  or fetched from another service.
- **One face everywhere.** `Face` and `PersonAvatar` (entities/person) show a
  photo the circle added, else the chosen picture, else initials. Everyone's
  choices load once and a change shows on every screen at once.
- **Choosing is one screen:** tap your face on your profile, pick a style,
  pick one of nine (or see more), or go back to initials.

## Consequences
No photos of the living are stored for avatars. Another library is another
`library` value and its styles.

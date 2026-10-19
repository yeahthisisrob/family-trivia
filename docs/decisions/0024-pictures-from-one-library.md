# 0024. Pictures: made for you, or an animal

- Status: Accepted
- Date: 2026-10-19

## Context
People want something other than their initials, but uploads mean storing
and moderating photos of people, and a circle of friends is one tap from a
bad one. Admins can already add a photo of someone the circle remembers.

## Decision
- **Initials stay the default.** A person may choose a picture, saved on them
  in the people model (`PUT /me/avatar`, the versioned save).
- **Made for you, first.** Opening the picker makes one picture with a
  low-cost image model (Stable Image Core on Bedrock, about four cents): an
  illustration of an animal or a thing that suggests what they love (from
  their knowledge index), or what they ask for in a few words. Never a
  person, a face or text. It lives in the circle's private media
  (`media/avatars/{userId}/…`); at most three a day per person. Nothing is
  used until they choose it.
- **Or an animal, then its color:** 58 bundled animals (Microsoft Fluent
  Emoji, MIT), each on one of six soft colors chosen as a second step.
- **One face everywhere.** `Face` and `PersonAvatar` (entities/person) show a
  photo the circle added, else the chosen picture, else initials. Everyone's
  choices load once; a change shows on every screen at once.
- (Revised Oct 19, 2026: the first version drew people from a library of
  styles; pictures of animals and things suit every circle better.)

## Consequences
No photos of the living are stored for avatars. Another library is another
`library` value and its styles.

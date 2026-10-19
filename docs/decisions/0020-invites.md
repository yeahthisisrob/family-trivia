# 0020. Invites: one link, a few choices, and passphrases are one of them

- Status: Accepted
- Date: 2026-10-19

## Context
Passphrases worked for a family where the admin added everyone first and
sent each person a word pair. Friends join differently: a link dropped in a
group thread, someone forwarding it to a person the admin forgot, a friend
of a friend. Asking an admin to add a person, make a passphrase and send it
before anyone can play is the friction that stops a circle from starting
(0016).

## Decision
- **An invite is a link with a few choices**, made by a circle's admin:
  - **who it's for:** anyone (they enter their own details), or one person
    the admin already added (prefilled; they confirm and sign in);
  - **which circle:** the admin's circle. The joiner sees only its name and
    kind, never the admin's other circles or anyone else's;
  - **how long:** a day, a week, a month, or until taken back;
  - **how many uses:** one, or any number;
  - **approval:** joins go straight in, or wait for the admin to say yes.
- **A passphrase is a personal invite that never expires.** Existing
  passphrases keep working; new people get links.
- **The token is the secret.** 128 random bits in the link; invites live at
  `invites/{token}.json`, outside any circle, because opening a link comes
  before signing in. A token that's expired, used up or taken back says so
  and shows nothing else.
- **Joining is signing in.** The link page asks for Google sign-in, then the
  few details the circle needs (a name; for friends, how they know the
  circle). The person is created through the same people model as the
  admin's editor (0009), linked in that circle's sign-in map (0019), and
  lands in the circle. Someone already in other circles keeps them.
- **Waiting joins** live in the circle (`joins/{id}.json`) until an admin
  approves (the person is created then) or declines.
- **Admin › Invites** makes, copies, shares (the phone's share sheet) and
  takes back links, shows uses, and lists joins waiting for a yes.

## Consequences
Starting a circle is: make it, share one link. A link only ever opens the
one circle it was made for, so sharing it can't reveal anything else. A
later change can let one link open several circles an admin runs; the
invite already stores a list.

# 0018. Your world: joining circles, splitting them, and seeing across them

- Status: Accepted
- Date: 2026-10-19

## Context
Whoever runs a deployment usually has more than one circle: a family, a
crew of old friends, maybe a second family through a partner. Over time
they will want to play two circles as one (a holiday season with family and
close friends together), then go back. And they are the one person who
knows both sides: the cousin who grew up on the same street as a friend,
the place that comes up in both circles' answers. Circles are private from
each other (0015), so nobody sees that picture.

## Decision
- **A circle's data never moves.** Joining and splitting change links, not
  stored answers, so every step can be undone.
- **Joining circles makes a joined circle.** It points at its source
  circles (`sources: [circleIdA, circleIdB]`) and has its own seasons,
  settings and new answers. Each source's people, ties and history are read
  through the link, so the joined circle's graph, Feud and look back start
  with everyone's past. Someone in both sources is one person here,
  matched by account or by an admin's "same person" link (needed for people
  without an account, such as someone remembered in both).
- **Splitting** ends the joined circle: it is archived, never deleted. Its
  seasons and answers stay readable from each source circle for the people
  who took part. The source circles carry on as they were, and joining
  them again picks up where it left off.
- **Joining needs an admin of each source.** Members are told before their
  past answers become visible to the other circle, and anyone can keep
  theirs out (`share into joined circles`, on by default only in family
  circles).
- **Your world is a private view across your own circles**
  (`frontend/src/features/your-world`, `backend/features/your-world`). It
  is open to anyone in two or more circles, built for them alone and never
  shown to anyone else:
  - one force graph (the night surface, 0011) with each circle as a
    constellation and the people in more than one as bridges;
  - the threads between circles: the same places, years, schools, songs and
    themes in different circles' answers, drawn from each circle's
    knowledge index and matched for this viewer only;
  - a timeline of their life as their circles saw it;
  - "who should meet": people from different circles who share something.
  It shows only what the viewer can already see in each circle, and no
  cross-circle match is stored or fed into another circle's AI.
- **The owner's admin** gets the same view with every circle in it, plus
  join, split and "same person" controls in Admin › Circles.

## As built (Oct 20, 2026)
- Your world is built (`GET /me/world`, the circle menu): constellations per
  circle, the same sign-in in two circles as a bridge, threads (the same
  knowledge item in more than one circle) and who should meet. Computed per
  request for the caller; accounts are matched on the server and never sent.
  The timeline, joining and splitting are still to come.

## Consequences
Circles stay simple and separate in storage, and every combination is a
reversible link on top. The knowledge index stays per circle; matching
across circles happens when the view is opened, for one viewer, so the
privacy line in 0015 holds.

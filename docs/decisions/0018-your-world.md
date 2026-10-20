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
- The timeline is built ("Your story so far"): the viewer's moments from each
  circle, oldest first, the same moment from two circles shown once. Each
  feature adds its own through `addLifeEvents` (`services/lifeEvents.ts`):
  the people service gives birth, meeting someone (a friendship's when, how
  and where), partnerships and their end, becoming a parent, someone close
  who died, and joining the circle; plans give the plans you were in and
  what someone remembered. Your world lists none of them, so a new feature
  adds moments without touching it.
- A plan's memories now keep the plan with them (title, day, who was in),
  since plans themselves are let go after 120 days and memories never are.
- Joining and splitting are built (Admin › Circles; `POST /admin/circles/join`,
  `POST /admin/circles/split`):
  - **The link lives in storage, not in features.** A joined circle's scope
    carries its `sources`. Its people files (`family/family.json`,
    `config/users.json`, the sign-in map, and the old hierarchy) are read
    through from the sources by one reader (`services/family/joinedCircles.ts`,
    registered with `services/scope.ts`), merged by `joinPeople` in
    `shared/src/joined.ts`. Who has played is an overlay: the circle's own
    record together with its sources'. No feature knows a circle is joined.
  - **One person per sign-in.** The same Google sign-in in two sources is one
    person; everyone else keeps their id, and an id two people share gets
    the circle's id after it. An admin's "same person" link for people
    without a sign-in is still to come.
  - **People are changed in the sources.** Writing a joined circle's people
    is refused (409, `PEOPLE_IN_SOURCES`); Admin › Family says so. Your own
    picture is the exception: it is saved in every source you're in.
    Pictures keep living where they were made (`media/from/{circle}/...`);
    new AI pictures are made in your own circles.
  - **Answers start fresh.** The joined circle keeps its own seasons and
    answers; the sources' past answers are not read through yet, so nobody's
    answers reach another circle without a choice (`share into joined
    circles` comes with that).
  - **Split** marks the circle ended and pauses its season; nothing is
    deleted. Joining the same circles again reopens it and its season.
  - An admin of every source circle is needed to join them.

## Consequences
Circles stay simple and separate in storage, and every combination is a
reversible link on top. The knowledge index stays per circle; matching
across circles happens when the view is opened, for one viewer, so the
privacy line in 0015 holds.

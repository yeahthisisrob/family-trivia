# 0014. Backups: versioned data, checked copies, nightly only when asked

- Status: Accepted
- Date: 2026-10-16

## Context
The app holds a family's memories: answers in their own words, the facts
about people who have since died, photos. Losing them is the one failure
that can't be fixed later (0001). S3 is durable, but a bad deploy, a bug
that overwrites a file, or a mistaken admin edit is not something S3's
durability protects against.

## Decision
- **The data bucket is versioned.** Every overwrite or delete keeps the
  version before it. This is the first line: anything can be put back.
- **Backups are full copies in a separate bucket** (`BackupBucket`, kept if
  the stack is deleted). `backend/features/backups` copies every object
  (download zips in `exports/` excepted, they are made again on request),
  then lists the copy and fails unless every file is there, and writes a
  manifest of what it copied.
  - `daily/YYYY-MM-DD/` expires after 35 days.
  - `monthly/YYYY-MM/` is the first copy of each month and is kept for good
    (moved to cheaper storage after 90 days).
- **Admins make one by hand** in Admin › Settings › Backups, which shows the
  last good copy, any failure, and the copies kept.
- **Nightly backups are a setting, off by default** (`backups.automatic`). A
  scheduled job runs every night and does nothing unless it is on, so
  turning it on needs no deploy.
- **Before any change to stored data** (a migration, a script, a one-off
  fix) make a copy first and check its count.

## Restoring
Restoring is deliberate, not a button. To put one file back, use its
previous version in the data bucket. To restore everything from a copy:

```bash
aws s3 sync s3://<backup-bucket>/daily/2026-10-16/ s3://<data-bucket>/ --exclude manifest.json
```

Make a fresh copy of the current state first, so the restore can be undone.

## Consequences
A copy costs a few cents a month for a typical family. Copies are made
server side, so photos don't pass through the Lambda. A family that never
turns on nightly backups still has versioning and whatever copies they make
by hand.

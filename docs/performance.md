# Performance and hosting

Why pages feel slow, and which lever actually moves the needle.

## The one thing that matters: put the function next to the database

Every page in this app is dynamic. Signing in, reading the roll, opening the
question bank — all of it runs server-side and talks to Postgres. A page makes
roughly three *sequential* layers of queries:

```
auth session  →  branding  →  the page's own data
```

Each layer waits for the one before it, so the round-trip time to the database
is multiplied by three before anything reaches the browser. Individual queries
within a layer already run in parallel (`Promise.all`), so that is not where
the time goes.

This makes one setting dominate everything else: **the region your Vercel
functions run in, relative to your Supabase project.**

| Setup | Function → database | Roughly, per page |
| --- | --- | --- |
| Vercel default `iad1` + Supabase Tokyo | ~170 ms each way | 500 ms+ of pure waiting |
| Vercel `hnd1` + Supabase Tokyo | ~1–3 ms | under 10 ms |

The default is the bad case. `vercel.json` therefore pins functions to `hnd1`
(Tokyo), which is where this project's Supabase instance lives:

```json
{ "regions": ["hnd1"] }
```

**If you ever move the Supabase project, change this in the same commit.** A
mismatch here is invisible — nothing breaks, everything is just slow.

### Which region is my database in?

The dashboard shows it under Project Settings → General. To confirm from the
outside, resolve the database host and look up the address:

```bash
# IPv6 prefix 2406:da14::/35 is AWS ap-northeast-1 (Tokyo)
nslookup db.<project-ref>.supabase.co
```

Vercel's matching region codes: `hnd1` Tokyo, `sin1` Singapore, `bom1` Mumbai,
`iad1` Washington DC.

## Worth considering: move the database closer to your students

Tokyo is a long way from Sri Lanka. The function-to-database hop is solved by
co-locating both in Tokyo, but students still cross the Bay of Bengal to reach
the function:

| Supabase + Vercel region | Colombo → server | Verdict |
| --- | --- | --- |
| Tokyo (`hnd1`) | ~130 ms | Works, current setup |
| Singapore (`sin1`) | ~40–50 ms | Better |
| Mumbai (`bom1`) | ~35–45 ms | Closest |

Moving means creating a new Supabase project in the chosen region, re-running
`npm run db:migrate` and `npm run db:seed` against it, and updating both
`.env.local` and the Vercel environment variables.

**That is cheap while the only data is seed data, and expensive once real
student records and assessment results exist.** If it is going to happen, it
should happen now.

## Cold starts

On Hobby, a function that has not run recently takes a second or so to wake.
The first page load after a quiet period will feel slower than the rest. This
is inherent to serverless and is not worth fighting; it matters least for a
class of students who all arrive at once, because the first request warms the
function for everyone else.

## What is *not* the problem

**Slow loads in local development are not a hosting issue.** Two separate
causes, neither of which applies in production:

1. Turbopack compiles each route the first time you visit it.
2. Measured from this machine, connections to Supabase succeed in 140–170 ms
   about three times in four, and stall for ~5.4 seconds the rest of the time.
   That stall is a TCP SYN retransmit — packet loss on connection setup,
   somewhere between this machine and the internet. It is a local network
   fault, not distance and not Supabase.

   It is also what made seeding fail repeatedly, which is why every call in
   `scripts/seed.ts` retries.

Production traffic does not take that path: the browser talks to Vercel, and
Vercel talks to Supabase over a datacentre link. A flaky home or office
connection slows down *your* browsing, not the deployed site.

If local development is painful, that connection is worth investigating on its
own terms — try a different network, and check whether antivirus or a firewall
is inspecting TLS.

## Already handled in the code

- Every list is paginated and filtered in Postgres, never in the browser
- Search uses trigram indexes, not table scans
- The question bank filters a trigger-maintained snapshot, so no joins
- `getSession` is cached per request, so six components make one auth call
- From Phase 4, statistics live in cached tables rather than being aggregated
  on every dashboard load

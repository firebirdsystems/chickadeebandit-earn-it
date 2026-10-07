# Earn It

A [Chickadee Bandit](https://chickadeebandit.com) app.

Points for adults. Earn points for what you do, on your honor or verified by someone you choose, and put them toward goals you set for yourself.

## Features

- A balance of points to use, always derived from what you earned less what you put toward goals.
- Add points for something you did, and choose who verifies it. The app remembers your last choice.
- A queue of claims waiting for you to verify: approve, change the points, or deny.
- Goals with a cost in points and a progress bar. Put points toward a goal, take them back, or share the goal.
- One list of everything you earned, labelled by how it was verified, with search.
- A home-screen badge counting the claims waiting for you.

## How points are earned

Each member chooses who verifies them:

| Choice | What happens | Who can see it |
|---|---|---|
| Nobody | You log points yourself | Only you |
| One person | You send a claim; only that person can approve or deny it, and set the points | You and that person |
| Anyone | You post a claim; the first member to respond decides it | Everyone |

Household automations can also pay points in (a streak milestone, a finished task). Those skip verification.

A balance is never stored. It is self-logged + verified + automated points, minus points put toward goals.

## Who can do what

| | You | Your verifier | Everyone else |
|---|---|---|---|
| See your self-logged points and automation awards | Yes | No | No |
| See a claim sent to one person | Yes | Yes | No |
| Decide a claim sent to one person | No | Yes | No |
| Change a claim after it is sent | No | No | No |
| Change or remove a decided claim | No | No | No |
| See an open claim | Yes | n/a | Yes |
| Decide an open claim | Shown as self-logged | n/a | First to respond |
| Undo a decision on an open claim | No | n/a | Whoever made it |
| See a goal | Yes | Only if shared | Only if shared |
| Put points toward a goal | Yes | No | No |

A steward or admin gets no extra access to any of it.

The hub enforces this table through the `row_policies` in `manifest.json`. `scenarios.json` replays each rule against the real runtime.

Two rules are recorded rather than refused, because no row policy can refuse them. A claim you address to yourself keeps `verifier_id = member_id`, and a decision you write on your own open claim is stamped `decided_by` = you. Neither can be altered afterwards, and the app counts both as self-logged, never as verified.

## Development

```bash
make setup     # once: enables the pre-push hook
npm install
npm run build  # produces dist/bundle.json and validates the manifest
npm test
bash preflight.sh
```

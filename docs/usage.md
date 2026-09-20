# Setup, recording and video

Requires **Node.js 22 or newer**. There are no npm dependencies to install.

Clone the repository and enter its directory before running the commands below:

```sh
git clone https://github.com/matthewman/jev-snake.git
cd jev-snake
```

## Try it without an API key

```sh
npm run sample
npm start
```

Open [localhost:4174](http://127.0.0.1:4174). The sample uses a **scripted controller and virtual clock**, labeled `scripted-controller (offline)`. It makes no API requests, and its zero response delay is simulated. It is not a Jev result. The sample command refuses to overwrite an existing file; use `npm run sample -- --out recordings/another-sample.json` for a new copy.

## Record Jev gameplay

```sh
npm run setup
# Open .env in your editor and set TYPESAFE_API_KEY to your own key.
npm run record
npm start
```

Run these commands from the project folder. Setup creates the ignored `.env` file and preserves an existing one. Recording loads it automatically; a key already exported in your shell takes precedence. It saves a uniquely named file under `recordings/` and verifies completed sessions. Repeat `npm run record` for a new session. `npm start` builds and serves the player at [localhost:4174](http://127.0.0.1:4174); the newest session is selected first.

The runner collects the session before playback. It prints the configuration first and each game's outcome as that game ends; the browser does not stream live moves. The default three-game session lasts at most 7.5 minutes of game time and makes at most 1,800 requests, ending earlier when the snake dies. Stop the player with Ctrl+C.

Use `npm run plan` to inspect the settings without API calls. Recording makes paid serial API calls with no retries. The request cap is not a dollar spending cap. Keys stay in the Node process; the browser only receives recordings. Output paths must be new. Provider failures, a returned model revision change, or an exhausted request cap stop the session and retain an incomplete artifact.

## Configuration and timing

Edit `demo.json` before recording a new session, or choose a configuration and output filename explicitly:

```sh
npm run record -- --config configs/demo-500ms-v1.json --out recordings/my-session.json
```

An explicit output filename must be new. If you use a separate environment file, `node --env-file=path/to/keys.env scripts/record.mjs --run` also works.

| Setting | Default |
| --- | --- |
| Model alias | `jev-latest` |
| Board | 12 × 12 |
| Movement interval | 250 ms |
| Response deadline | 1,000 ms |
| Maximum moves | 600 per take (150 seconds) |
| No-food limit | 100 moves |
| Seeds | 7307, 7411, 7523 |
| Request cap | 1,800 across the session |

The world ticks independently of inference. While a request is pending, the snake continues straight. A returned turn applies once on the first tick strictly after arrival. A response at its deadline expires. There is one pending request at a time, and unsafe but valid answers are not repaired.

Environment randomness is seeded and replayable. That does not make hosted model responses or network latency deterministic. Request bodies, returned model identities, action times, source metadata and game states are retained. Provider-reported input/output token usage is retained when available; missing usage remains unknown. Verification checks internal consistency; it does not independently attest a provider identity or measured latency. Floating aliases may resolve to new model revisions.

Past configuration files remain in `configs/` to reproduce their setup. Old recordings keep their original limits and speed. Reaching a move limit ends a take without a collision; extending the limit requires a fresh run.

Use `npm run analyze -- recordings/my-session.json` for local latency summaries, payload sizes, and terminal-decision context. These are descriptive summaries of the selected recording.

## Replay and video

Select any take, play or scrub, and choose portrait (9:16) or landscape (16:9). Movement uses exact grid steps. The response average includes completed accepted or invalid replies received by the playhead. It excludes pending requests, timeouts, cancellations and provider errors, and recalculates when seeking or changing takes. Values are end-to-end request latency, including network time, rather than model-only compute time.

Export a complete take or 30 seconds from the playhead, then select Save video. Capture runs at the original pace; keep the page visible until it finishes. Interrupted captures are discarded. Downloads are silent WebM or MP4 files depending on browser support.

Expand Configuration for the response deadline, input description and recording provenance. You can also open a local JSON recording; it stays in the tab. The CLI verifier performs stricter checks than the browser file importer.

## Saved results

`results/` contains the original JSON files, named by UTC date and experiment version. Run `npm run results:verify` to check them. The three assisted demo sessions support `npm run replay -- RESULT_ID`; the older experiments can be inspected directly as JSON. Files labeled `greedy`, `random` and `controlled-delay` use scripted controllers and simulated timing. The `input-pair` experiment always ran the named-input condition first, so its condition and run order are confounded. Earlier experiment runners are not included in this standalone repo.

## Development and sharing

```sh
npm run check       # offline tests, build, and browser-asset checks
npm run sample      # offline end-to-end example
npm run verify -- recordings/offline-sample.json
```

GitHub Actions runs these checks without API credentials. No npm dependencies means no install step or lockfile is needed. The source is [MIT licensed](../LICENSE); `private: true` in package.json prevents accidental npm publication and does not restrict GitHub sharing.

The local server binds to loopback and discovers verified files in the ignored `recordings/` folder. Do not expose this server as a public host. The static `dist/` build contains an empty recording list and no keys, real recordings, video files, or provider code. It can be hosted separately as a local-file replay viewer. New local recordings and exported videos remain ignored. Historical results are stored as original [JSON files](../results/); the static build does not copy them. Use `npm run replay -- RESULT_ID` to load a demo session into the local player.

Before distributing API recordings or performance claims, review the [TypeSafe terms](https://typesafe.ai/legal/mca) applicable to your account.

Small code map:

- `src/snake.mjs`, `random.mjs`: seeded game engine.
- `src/continuous.mjs`, `timing.mjs`: fixed-clock control loop.
- `src/jev.mjs`, `features.mjs`: native API adapter and model input.
- `src/verify*.mjs`, `artifacts.mjs`: recording validation.
- `src/replay.mjs`, `controls.mjs`, `web/`: playback, timing metrics and video UI.
- `src/virtual-clock.mjs`, `scripts/sample.mjs`: offline simulation.

Changes should pass `npm run check`. Keep credentials out of commits and issues. Use synthetic fixtures when reporting a bug; add new results with a new dated filename and retain existing files unchanged. This is an independent project, not an official TypeSafe product. Development was assisted by Codex.

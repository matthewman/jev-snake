# Jev plays Snake on a 250 ms clock

I built a Snake demo where Jev chooses each turn while the game moves every **250 milliseconds**. The clock never waits for the API: until an answer arrives, the snake continues straight.

Jev receives structured board state plus engine-calculated collision checks, food contact and distance for each move. It chooses left, straight or right; the interface displays arrow keys. The engine never replaces an unsafe answer with a safer one.

[Replay the recorded session](../README.md#try-it) without an API key.

The featured take collected **29 food in 73 seconds**, the highest score of three takes. All used `jev-1.13.0`, a 12 × 12 board, a 1,000 ms response deadline and a 600-move cap, with no retries.

| Seed | Food | Moves | Duration |
| --- | ---: | ---: | ---: |
| 7307 | 21 | 188 | 47.0 s |
| 7411 | 23 | 214 | 53.5 s |
| 7523 | 29 | 292 | 73.0 s |

All three ended in self-collisions. [Full session data](../results/2026-09-20-demo-250ms-v3.json).

## Inputs changed the decisions

Early requests often selected straight ahead, even toward a wall. I tested four input configurations on 24 fixed positions, twice per condition:

| Input | Correct decisions |
| --- | ---: |
| Original instructions and numeric state | 15/48 |
| Direct next-move question, same numeric state | 22/48 |
| Named coordinates and word heading | 30/48 |
| Numeric state plus computed move facts | 46/48 |

Clearer inputs improved decisions in this small diagnostic. Computed move facts helped most, while moving part of the reasoning into the engine. These results measure individual decisions on the tested boards. [Diagnostic data](../results/2026-09-19-input-diagnostic-v1.json).

## Identical requests produced different choices

In an earlier test using the original input format, I submitted the exact same request bytes ten times for each of five positions. Every response reported `jev-1.13.0`.

Two positions produced different actions across repeats: one split **3 left / 7 straight**, another **9 left / 1 straight**. That hosted configuration did not behave deterministically. No temperature or inference seed was supplied. [Repeated-input data](../results/2026-09-19-consistency-v1.json).

The game engine remains reproducible: the same initial seed and action sequence reproduce the board.

## Response time matters on a moving board

Across the three featured takes, **683 replies averaged 141.5 ms**, with a **211.4 ms p95**. Eleven took at least 250 ms. These measurements include network and response-parsing time.

A reply can meet the one-second deadline while missing a movement tick. Its turn then applies to a board that has already advanced. The video’s running average includes only replies received by that point.

## The snake trapped itself before the final turn

At the final decision in each take, every available direction was already lethal. All three terminal replies arrived before another movement tick.

Those endings came from positions the snake had already entered. Avoiding an immediate collision had kept it moving, but had not preserved an escape route.

The [raw JSON files](../results/) also retain the early zero-score games, later input experiments, and scripted controls.

The MIT-licensed code includes an offline scripted example, the Jev adapter, replay verification and video export. Built with Codex.

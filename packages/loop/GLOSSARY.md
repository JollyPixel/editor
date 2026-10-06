# Loop glossary

A game runs on two clocks. The display hands out **frames** whenever it is
ready to show a new picture. The game moves forward in **steps** of a fixed
length, at a steady rate it picks itself. The loop converts one into the other:
each frame pays for zero, one or several steps, then the game is drawn once.

Each term below describes the idea first. The *In code* line names where it
shows up in the API. The [architecture](./ARCHITECTURE.md) shows how the parts
fit together.

## Time

### Real time

Time measured by the computer's clock, also called wall-clock time. It keeps
going whatever the game does: during hitches, pauses and background tabs.

*In code:* the `now` timestamp given to `advance()`, `rawDelta`, and
`unscaledDelta` once clamped.

### Game time

Time as the game world lives it, also called simulation time. It usually
follows real time, but runs faster or slower with the time scale, stops while
paused, and never receives time that was clamped or dropped. Only steps
consume it.

*In code:* `frameDelta` is the game time a frame brings in.
`FrameScheduler.time` is the game time steps have consumed.

### Time scale

How fast game time runs compared to real time. `2` is double speed, `0.5` is
slow motion, `0` freezes the game. It does not change how often frames arrive
or the render cap.

*In code:* `GameLoop.timeScale`.

### Pause

Freezing game time without stopping the loop. Frames keep arriving and the game
is still drawn, so the camera and UI stay responsive, but no step runs. The
paused time is not replayed on resume.

*In code:* `GameLoop.pause()` and `resume()`. `GameLoop.step()` advances a
paused game by single steps.

## Frames and steps

### Frame

One chance to put a new picture on screen. The display decides when frames
happen, so their spacing depends on the monitor and on how busy the machine
is. A frame brings in the real time since the previous one, turns it into game
time, runs as many steps as that time pays for, and draws the game at most
once.

*In code:* one `advance(now)` call, which returns that frame's
`FrameSchedule`. `GameLoop` then calls `frame`, `fixedUpdate` for each step, and
`update`.

### Frame rate

How often frames arrive. The display and the machine set it, not the game:
usually the monitor's refresh rate, less when the machine struggles, none at
all in a hidden tab.

*In code:* decided by the [frame source](./docs/framesource.md). No option sets
it; `maxFps` limits renders, not frames.

### Step

One move of the game forward by a fixed amount of game time. Also called a
fixed step. Every step has the same length, so physics, gameplay and network
ticks give the same results on a 30 Hz laptop and a 144 Hz monitor.

*In code:* one `fixedUpdate(fixedDeltaMs, stepIndex)` call. `schedule.steps`
says how many run this frame.

### Step rate

How many steps the game runs per second of game time. The game chooses it and
the loop never adapts it.

*In code:* `fixedFps`, `60` by default.

### Step length

The game time one step covers: one second divided by the step rate, so
16.67 ms at 60 steps per second.

*In code:* `fixedDelta`, passed to `fixedUpdate` as `fixedDeltaMs`.

### Leftover time

Game time a frame brought in that is too short to pay for another step. It
carries over to the next frame, so no time is lost between frames. After a
frame it is always less than one step length.

*In code:* `FrameScheduler.accumulator`.

### How frames and steps line up

With 60 steps per second:

| Frame rate | Time per frame | Steps per frame |
| --- | --- | --- |
| 144 Hz | 6.9 ms | mostly 0, sometimes 1 |
| 60 Hz | 16.7 ms | usually 1 |
| 30 Hz | 33.3 ms | 2 |
| a 120 ms hitch | 120 ms | 7 owed, see [panic](#panic) |

Over a second the game runs about 60 steps either way. Leftover time makes up
the difference from one frame to the next.

## Drawing

### Render

Drawing the game once on screen. It happens at most once per frame, after that
frame's steps.

*In code:* `update(renderDeltaMs, alpha)`, called when `schedule.render` is
`true`.

### Render cap

An upper limit on renders per second, to save power. Frames above the cap
still arrive and still run steps; only the drawing is skipped. The cap follows
real time, so a paused game keeps drawing at the capped rate.

*In code:* `maxFps`. A capped frame has `render: false`; its time reaches the
next render through `renderDelta`.

### Alpha

How far the game is between its last step and the next one, as a fraction
from `0` (it just stepped) up to, but not including, `1` (about to step). It
is the leftover time divided by the step length.

*In code:* `schedule.alpha`, the second argument of `update`.

### Interpolation

Drawing objects between their last two stepped states, weighted by alpha.
Without it, on a display faster than the step rate, objects only move on
frames that run a step and motion stutters. In return, what you see trails the
game by up to one step.

*In code:* [`Interpolated`](./docs/interpolated.md): `push()` after each step,
`at(alpha)` when rendering.

## Overload

### Hitch

One unusually long gap between two frames: a tab switch, a breakpoint, a
garbage-collection pause, a laptop waking up.

### Clamp

Cutting a frame's real time down to a maximum before it becomes game time. A
hitch of several seconds then counts as a quarter of a second at most, so the
game does not leap forward. The time cut off never becomes game time.

*In code:* `maxFrameDelta`, `250` ms by default. The frame reports
`clamped: true` and `GameLoop` emits `clamp`.

### Spiral of death

The overload the loop guards against. A slow frame owes many steps; running
them makes the next frame slow too, so it owes even more, until the game
freezes.

### Panic

A frame owing more steps than one frame may run. The loop runs the allowed
steps and drops the rest of the game time, so the game falls a little behind
real time instead of spiraling. Repeated panics mean the machine cannot keep
up with the step rate.

*In code:* `maxStepsPerFrame`, `5` by default, multiplied by the time scale
when it is above `1` so fast-forward is not mistaken for overload. The frame
reports `panicked: true` and `GameLoop` emits `panic`.

### Dropped time

Game time thrown away by a panic. The game world never lives through it.
Clamped time is not counted here: it never became game time.

*In code:* `schedule.droppedMs` for one frame, `FrameScheduler.droppedTime`
since the last reset.

### Frame budget

A time limit for optional work inside one frame, such as draining a queue of
mesh rebuilds, so the frame still ends on time. It is measured in real time
and has nothing to do with the step limit.

*In code:* [`FrameBudget`](./docs/framebudget.md).

## Idle

### Sleep

Stopping frames entirely while nothing needs drawing, for views that only
change on input, such as editors. Unlike a pause, frames stop arriving and
nothing is drawn. The loop still counts as running.

*In code:* `GameLoop` options `keepAlive` and `trailingRenders`,
`GameLoop.sleeping`, and the `sleep` event.

### Wake

Restarting frames after a sleep, usually because of input. The idle time is
skipped, not replayed: the first frame after waking brings in no time.

*In code:* `GameLoop.invalidate()` and the `wake` event.

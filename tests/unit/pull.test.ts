import { describe, expect, it } from "vitest";
import {
  CLOSE_FRACTION,
  FLICK_MIN_DISTANCE,
  movePull,
  PULL_SLOP,
  pullVelocity,
  releasePull,
  startPull,
  type Pull,
} from "@/lib/pull";

const HEIGHT = 800;

/** A finger moving through `points` — [x, y, time in ms] — from the first one. */
function gesture(points: Array<[number, number, number]>): Pull {
  const [first, ...rest] = points;
  const [x0, y0, t0] = first!;
  return rest.reduce<Pull>((pull, [x, y, t]) => movePull(pull, x, y, t), startPull(x0, y0, t0));
}

/** A slow, steady pull straight down by `distance`, in 16 ms steps of 4 px, ending exactly there. */
function slowPull(distance: number): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  let t = 0;
  for (let y = 100; y < 100 + distance; y += 4, t += 16) points.push([200, y, t]);
  points.push([200, 100 + distance, t]);
  return points;
}

describe("reading a gesture", () => {
  it("decides nothing before the finger has moved a few pixels: a tap stays a tap", () => {
    const pull = gesture([
      [200, 100, 0],
      [203, 104, 16],
    ]);
    expect(pull.phase).toBe("pending");
    expect(releasePull(pull, HEIGHT, 30)).toBe("none");
  });

  it("recognises a mostly downward move as a pull", () => {
    expect(gesture([[200, 100, 0], [205, 140, 50]]).phase).toBe("pulling");
  });

  it("leaves an upward move to the browser: that is a scroll", () => {
    expect(gesture([[200, 100, 0], [200, 60, 50]]).phase).toBe("ignored");
  });

  it("leaves a sideways move to the browser, even one that drifts down", () => {
    expect(gesture([[200, 100, 0], [260, 130, 50]]).phase).toBe("ignored");
  });

  it("once ignored, stays ignored for the rest of the gesture", () => {
    const pull = gesture([
      [200, 100, 0],
      [200, 60, 50],
      [200, 400, 200],
    ]);
    expect(pull.phase).toBe("ignored");
  });
});

describe("following the finger", () => {
  it("lowers the sheet by the distance pulled beyond the slop: no jump when it starts", () => {
    const pull = gesture([[200, 100, 0], [200, 100 + PULL_SLOP + 1, 16], [200, 250, 100]]);
    expect(pull).toMatchObject({ phase: "pulling", offset: 150 - PULL_SLOP });
  });

  it("never goes above the top, even if the finger goes back higher than it started", () => {
    const pull = gesture([
      [200, 100, 0],
      [200, 200, 100],
      [200, 40, 300],
    ]);
    expect(pull).toMatchObject({ phase: "pulling", offset: 0 });
  });
});

describe("letting go", () => {
  it("closes after a quarter of the screen, however slowly", () => {
    const pull = gesture(slowPull(HEIGHT * CLOSE_FRACTION + PULL_SLOP));
    expect(pull.phase === "pulling" && pull.offset).toBeGreaterThanOrEqual(HEIGHT * CLOSE_FRACTION);
    expect(releasePull(pull, HEIGHT, 10_000)).toBe("close");
  });

  it("slides back after a short, slow pull", () => {
    const pull = gesture(slowPull(80));
    expect(releasePull(pull, HEIGHT, 1_000)).toBe("cancel");
  });

  it("closes after a short flick down", () => {
    const pull = gesture([
      [200, 100, 0],
      [200, 130, 20],
      [200, 180, 40],
      [200, 180 + FLICK_MIN_DISTANCE, 60],
    ]);
    expect(pullVelocity(pull, 60)).toBeGreaterThan(1);
    expect(releasePull(pull, HEIGHT, 60)).toBe("close");
  });

  it("does not take a tiny flick for a close", () => {
    const pull = gesture([
      [200, 100, 0],
      [200, 125, 10],
      [200, 140, 20],
    ]);
    expect(releasePull(pull, HEIGHT, 20)).toBe("cancel");
  });

  it("slides back when the finger was heading back up at release, however far it went", () => {
    const pull = gesture([
      [200, 100, 0],
      [200, 600, 400],
      [200, 560, 440],
      [200, 500, 480],
    ]);
    expect(releasePull(pull, HEIGHT, 480)).toBe("cancel");
  });

  it("forgets the speed of a flick the finger then held still", () => {
    const pull = gesture([
      [200, 100, 0],
      [200, 130, 20],
      [200, 180, 40],
      [200, 240, 60],
    ]);
    expect(releasePull(pull, HEIGHT, 60)).toBe("close");
    expect(pullVelocity(pull, 600)).toBe(0);
    expect(releasePull(pull, HEIGHT, 600)).toBe("cancel");
  });
});

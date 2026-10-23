/**
 * Watch phase keyframe player. Pure apart from the injected clock, so tests drive it with a fake
 * clock. Play advances one keyframe per interval and stops on the last one (it never loops). With
 * reduced motion, Play is refused and Back/Next step between stills.
 */
export interface PlayerClock {
  schedule(run: () => void, ms: number): number;
  cancel(id: number): void;
}
export interface PlayerOptions {
  count: number;
  ms: number;
  clock: PlayerClock;
  reducedMotion: () => boolean;
  /** Shows keyframe `index`; `animate` is false for stills (reduced motion or a jump). */
  show(index: number, animate: boolean): void;
  /** Play state changed (for the Play/Pause button). */
  changed?(): void;
}
export class KeyframePlayer {
  index = 0;
  playing = false;
  private timer: number | null = null;
  private dead = false;
  constructor(private o: PlayerOptions) {}
  get last() {
    return this.o.count - 1;
  }
  private stopTimer() {
    if (this.timer !== null) this.o.clock.cancel(this.timer);
    this.timer = null;
  }
  private go(index: number, animate: boolean) {
    this.index = Math.max(0, Math.min(this.last, index));
    this.o.show(this.index, animate && !this.o.reducedMotion());
  }
  /** Starts playing (from the start when at the end). Returns false when refused. */
  play(): boolean {
    if (this.dead || this.o.reducedMotion() || this.o.count < 2) return false;
    if (this.index >= this.last) this.go(0, false);
    this.playing = true;
    this.o.changed?.();
    const tick = () => {
      this.timer = null;
      if (!this.playing || this.dead) return;
      this.go(this.index + 1, true);
      if (this.index >= this.last) this.pause();
      else this.timer = this.o.clock.schedule(tick, this.o.ms);
    };
    this.stopTimer();
    this.timer = this.o.clock.schedule(tick, this.o.ms);
    return true;
  }
  pause() {
    this.stopTimer();
    if (this.playing) {
      this.playing = false;
      this.o.changed?.();
    }
  }
  next() {
    this.pause();
    this.go(this.index + 1, true);
  }
  back() {
    this.pause();
    this.go(this.index - 1, false);
  }
  restart() {
    this.pause();
    this.go(0, false);
  }
  destroy() {
    this.pause();
    this.dead = true;
  }
}

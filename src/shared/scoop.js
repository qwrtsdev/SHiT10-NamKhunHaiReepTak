// Dip-and-flip scoop shared by the Joy-Con and the phone page: ready → fill → lift → cool → ready.
// limits { dip, lift, timeout } (degrees, ms) are read every step, so they can change live.
// onScoop / onSpill get the bucket's fill before it empties.

class Scoop {
  constructor(limits, { onScoop, onSpill }) {
    Object.assign(this, { limits, onScoop, onSpill });
    this.reset();
  }

  reset() {
    this.state = 'ready';
    this.fill = 0;
    this.since = 0;
  }

  // pitch: degrees, + = tip up. level: water on screen, 0–1. now: ms. dt: seconds.
  step(pitch, level, now, dt) {
    const { dip, lift, timeout } = this.limits;
    switch (this.state) {
      case 'ready':
        if (pitch < dip) Object.assign(this, { state: 'fill', fill: 0 });
        break;
      case 'fill':
        if (level > 0) this.fill = Math.min(1, this.fill + dt * 1.4 * Math.max(0.25, Math.min(1, level / 0.15)));
        if (pitch > -10) {
          if (this.fill > 0.1) Object.assign(this, { state: 'lift', since: now });
          else this.state = 'ready';
        }
        break;
      case 'lift':
        if (pitch > lift) {
          this.onScoop(this.fill);
          Object.assign(this, { state: 'cool', since: now, fill: 0 });
        } else if (pitch < dip) {
          this.state = 'fill'; // dipped back in: keep what's in the bucket
        } else if (now - this.since > timeout) {
          this.onSpill(this.fill);
          Object.assign(this, { state: 'ready', fill: 0 });
        }
        break;
      case 'cool':
        if (now - this.since > 400) this.state = 'ready';
        break;
    }
  }
}

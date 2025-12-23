export class StateMachine {
  constructor(initial) {
    this.state = initial;
    this.handlers = new Map();
  }

  on(state, fn) {
    this.handlers.set(state, fn);
    return this;
  }

  set(state, payload) {
    this.state = state;
    const fn = this.handlers.get(state);
    if (fn) fn(payload);
  }

  is(state) {
    return this.state === state;
  }
}

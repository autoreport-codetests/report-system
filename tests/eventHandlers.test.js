/**
 * @jest-environment jsdom
 */

const { EventHandlers } = require('../app');

describe('EventHandlers.debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('fires only after the configured delay', () => {
    const fn = jest.fn();
    const debounced = EventHandlers.debounce(fn, 300);
    debounced();
    jest.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('collapses rapid calls', () => {
    const fn = jest.fn();
    const debounced = EventHandlers.debounce(fn, 300);
    debounced();
    debounced();
    debounced();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

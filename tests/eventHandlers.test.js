/**
 * @jest-environment jsdom
 */

const { EventHandlers, ApiService } = require('../app');

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

describe('EventHandlers.handleExplainClick', () => {
  test('fetches explanation and displays it', async () => {
    document.body.innerHTML = `<button class="explain-btn" data-part="Brake pad">Explain</button><div class="explanation hidden"></div>`;
    const btn = document.querySelector('.explain-btn');
    const explanationDiv = document.querySelector('.explanation');
    jest.spyOn(ApiService, 'explainIssue').mockResolvedValue('Brake pads slow the car.');

    await EventHandlers.handleExplainClick({ target: btn });

    expect(ApiService.explainIssue).toHaveBeenCalledWith('Brake pad');
    expect(explanationDiv.textContent).toBe('Brake pads slow the car.');
    expect(explanationDiv.classList.contains('hidden')).toBe(false);

    ApiService.explainIssue.mockRestore();
  });

  test('ignores clicks without button', async () => {
    document.body.innerHTML = `<div class="explanation hidden"></div>`;
    const spy = jest.spyOn(ApiService, 'explainIssue').mockResolvedValue('');
    await EventHandlers.handleExplainClick({ target: document.body });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

/**
 * @jest-environment jsdom
 */

const { ErrorHandler, ApiService, ChatManager, LoadingIndicator } = require('../app');

describe('ErrorHandler', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="error-boundary" class="hidden">
        <span id="error-message"></span>
      </div>`;
  });

  test('showError displays message and removes hidden class', () => {
    ErrorHandler.showError('Oops', 0);
    const boundary = document.getElementById('error-boundary');
    const message = document.getElementById('error-message');
    expect(message.textContent).toBe('Oops');
    expect(boundary.classList.contains('hidden')).toBe(false);
  });

  test('hideError adds hidden class', () => {
    const boundary = document.getElementById('error-boundary');
    boundary.classList.remove('hidden');
    ErrorHandler.hideError();
    expect(boundary.classList.contains('hidden')).toBe(true);
  });

  test('handleApiError uses specific message for network error', () => {
    const spy = jest.spyOn(ErrorHandler, 'showError');
    ErrorHandler.handleApiError({ name: 'TypeError', message: 'fetch failed' });
    expect(spy).toHaveBeenCalledWith('Network error. Please check your connection and try again.');
    spy.mockRestore();
  });

  test('handleApiError uses status-based message', () => {
    const spy = jest.spyOn(ErrorHandler, 'showError');
    ErrorHandler.handleApiError({ status: 404 });
    expect(spy).toHaveBeenCalledWith('The requested resource was not found.');
    spy.mockRestore();
  });

  test('showError resets existing timeout', () => {
    jest.useFakeTimers();
    ErrorHandler.showError('first', 1000);
    jest.advanceTimersByTime(500);
    ErrorHandler.showError('second', 1000);
    jest.advanceTimersByTime(500);
    const boundary = document.getElementById('error-boundary');
    expect(boundary.classList.contains('hidden')).toBe(false);
    jest.advanceTimersByTime(500);
    expect(boundary.classList.contains('hidden')).toBe(true);
    jest.useRealTimers();
  });
});

describe('ApiService.generateResponse', () => {
  beforeEach(() => {
    jest.spyOn(LoadingIndicator, 'show').mockImplementation(() => {});
    jest.spyOn(LoadingIndicator, 'hide').mockImplementation(() => {});
    jest.spyOn(ErrorHandler, 'handleApiError').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns reply on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Hello' })
    });

    const result = await ApiService.generateResponse('hi');
    expect(result).toBe('Hello');
    expect(fetch).toHaveBeenCalled();
    expect(LoadingIndicator.show).toHaveBeenCalled();
    expect(LoadingIndicator.hide).toHaveBeenCalled();
  });

  test('handles fetch error and returns fallback message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    });

    const result = await ApiService.generateResponse('hi');
    expect(ErrorHandler.handleApiError).toHaveBeenCalled();
    expect(result).toBe('Sorry, I encountered an error while processing your request. Please try again.');
  });
});

describe('ApiService.fetchWithRetry', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retries the specified number of times', async () => {
    const error = new Error('fail');
    global.fetch = jest.fn().mockRejectedValue(error);
    await expect(ApiService.fetchWithRetry('/url', {}, 3, 10)).rejects.toThrow('fail');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test('resolves when a retry succeeds', async () => {
    const success = { ok: true };
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(success);
    const res = await ApiService.fetchWithRetry('/url', {}, 3, 10);
    expect(res).toBe(success);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('ApiService.explainIssue', () => {
  beforeEach(() => {
    jest.spyOn(LoadingIndicator, 'show').mockImplementation(() => {});
    jest.spyOn(LoadingIndicator, 'hide').mockImplementation(() => {});
    jest.spyOn(ErrorHandler, 'handleApiError').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns explanation on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ explanation: 'Brake pads slow the car.' })
    });

    const result = await ApiService.explainIssue('Brake pad');
    expect(result).toBe('Brake pads slow the car.');
    expect(fetch).toHaveBeenCalled();
    expect(LoadingIndicator.show).toHaveBeenCalled();
    expect(LoadingIndicator.hide).toHaveBeenCalled();
  });

  test('handles fetch error and returns fallback', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    const result = await ApiService.explainIssue('Brake pad');
    expect(ErrorHandler.handleApiError).toHaveBeenCalled();
    expect(result).toBe('Explanation not available at this time.');
  });
});

describe('ChatManager', () => {
  test('reports missing container', async () => {
    const spy = jest.spyOn(ErrorHandler, 'showError').mockImplementation(() => {});
    await ChatManager.sendMessage('Hello', 'missing');
    expect(spy).toHaveBeenCalledWith('Chat container not found');
    spy.mockRestore();
  });

  test('shows error when ApiService fails', async () => {
    document.body.innerHTML = '<div id="chat"></div>';
    jest.spyOn(ApiService, 'generateResponse').mockRejectedValue(new Error('fail'));
    const spy = jest.spyOn(ErrorHandler, 'showError').mockImplementation(() => {});

    await ChatManager.sendMessage('Hello', 'chat');
    expect(spy).toHaveBeenCalledWith('Failed to get response from assistant');

    ApiService.generateResponse.mockRestore();
    spy.mockRestore();
  });
});


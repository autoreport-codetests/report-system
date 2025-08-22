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


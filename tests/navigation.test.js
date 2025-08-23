/**
 * @jest-environment jsdom
 */

const { App } = require('../app');

describe('mobile navigation menu', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="mobile-menu-button" aria-controls="main-navigation" aria-expanded="false"><svg></svg></button>
      <nav id="main-navigation" class="hidden">
        <button class="report-link" data-section="test"></button>
      </nav>
    `;
    App.setupEventListeners();
  });

  test('toggles aria-expanded on button click', () => {
    const button = document.getElementById('mobile-menu-button');
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  test('resets menu on desktop resize', () => {
    const button = document.getElementById('mobile-menu-button');
    button.click();
    expect(document.body.style.overflow).toBe('hidden');

    window.innerWidth = 800;
    window.dispatchEvent(new Event('resize'));

    const nav = document.getElementById('main-navigation');
    expect(nav.classList.contains('hidden')).toBe(false);
    expect(nav.classList.contains('translate-x-full')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});

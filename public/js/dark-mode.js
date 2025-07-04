// Dark Mode Utility Script
// This script provides dark mode functionality that can be used across all pages

// CSS variables for dark mode (to be included in each page's CSS)
const darkModeCSS = `
[data-theme="dark"] {
  --background: #1a202c;
  --card-bg: #2d3748;
  --text-primary: #f7fafc;
  --text-secondary: #a0aec0;
  --border-color: #4a5568;
}

[data-theme="dark"] .visit-item:hover,
[data-theme="dark"] .medication-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

[data-theme="dark"] input,
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  background: var(--card-bg);
  color: var(--text-primary);
  border-color: var(--border-color);
}

[data-theme="dark"] .btn-secondary {
  background-color: #4a5568;
  color: var(--text-primary);
}
`;

// Initialize dark mode functionality
function initDarkMode() {
  // Apply saved theme immediately to prevent flash
  const currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  
  // Add dark mode CSS if not already present
  if (!document.getElementById('dark-mode-styles')) {
    const style = document.createElement('style');
    style.id = 'dark-mode-styles';
    style.textContent = darkModeCSS;
    document.head.appendChild(style);
  }
}

// Setup dark mode toggle button
function setupDarkModeToggle(toggleId = 'darkModeToggle', iconId = 'darkModeIcon', textId = 'darkModeText') {
  const darkModeToggle = document.getElementById(toggleId);
  const darkModeIcon = document.getElementById(iconId);
  const darkModeText = document.getElementById(textId);
  
  if (!darkModeToggle) return; // Button not found on this page
  
  const currentTheme = localStorage.getItem('theme') || 'light';
  
  // Update button appearance based on current theme
  function updateDarkModeButton(theme) {
    if (theme === 'dark') {
      darkModeIcon.textContent = '☀️';
      darkModeText.textContent = 'Light';
      darkModeToggle.style.background = '#f59e0b';
    } else {
      darkModeIcon.textContent = '🌙';
      darkModeText.textContent = 'Dark';
      darkModeToggle.style.background = '#6c757d';
    }
  }
  
  updateDarkModeButton(currentTheme);
  
  darkModeToggle.onclick = function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateDarkModeButton(newTheme);
  };
}

// Create dark mode toggle HTML
function createDarkModeToggle() {
  return `
    <button id="darkModeToggle" style="background:#6c757d; color:#fff; border:none; border-radius:6px; padding:0.5rem 1rem; font-size:1rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:0.5rem; transition:background 0.2s ease;">
      <span id="darkModeIcon">🌙</span>
      <span id="darkModeText">Dark</span>
    </button>
  `;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDarkMode);
} else {
  initDarkMode();
}

// Export functions for use in other scripts
window.darkMode = {
  init: initDarkMode,
  setupToggle: setupDarkModeToggle,
  createToggle: createDarkModeToggle
}; 
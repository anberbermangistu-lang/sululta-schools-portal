// ================================================================
// THEME MANAGER — Sululta Secondary School Portal
// Handles Dark / Light mode toggle, persistence and UI sync
// ================================================================

const THEME_KEY = "sululta_theme";

export function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") {
        return saved;
    }
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export function applyTheme(theme) {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark-theme", isDark);
    if (document.body) {
        document.body.classList.toggle("dark-theme", isDark);
    }
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
    updateThemeButtons(theme);
}

export function toggleTheme() {
    const current = document.documentElement.classList.contains("dark-theme") ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    return next;
}

export function updateThemeButtons(theme) {
    const isDark = theme === "dark";
    const buttons = document.querySelectorAll(".theme-toggle-btn");
    buttons.forEach(btn => {
        btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
        btn.setAttribute("title", isDark ? "Switch to light mode" : "Switch to dark mode");
        btn.innerHTML = isDark
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="theme-icon theme-sun"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="theme-icon theme-moon"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    });
}

export function initThemeToggle() {
    const theme = getPreferredTheme();
    applyTheme(theme);

    const buttons = document.querySelectorAll(".theme-toggle-btn");
    buttons.forEach(btn => {
        btn.onclick = () => {
            toggleTheme();
        };
    });
    updateThemeButtons(theme);
}

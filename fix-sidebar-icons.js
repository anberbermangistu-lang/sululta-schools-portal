/**
 * Fix Sidebar Icons Script
 * Replaces broken emoji icons with proper SVG icons in all HTML files
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Icon SVG definitions
const icons = {
    dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    students: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    teachers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="12" cy="5" r="2"/></svg>`,
    classes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    subjects: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
    attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    results: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    timetable: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>`,
    library: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    add: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
    mark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
};

// Map navigation text to icon key
function getIconKey(text) {
    text = text.toLowerCase();
    if (text.includes('dashboard')) return 'dashboard';
    if (text.includes('student')) return 'students';
    if (text.includes('teacher')) return 'teachers';
    if (text.includes('class')) return 'classes';
    if (text.includes('subject')) return 'subjects';
    if (text.includes('attendance')) return 'attendance';
    if (text.includes('result')) return 'results';
    if (text.includes('timetable')) return 'timetable';
    if (text.includes('library')) return 'library';
    if (text.includes('logout')) return 'logout';
    if (text.includes('mark')) return 'mark';
    if (text.includes('add')) return 'add';
    return 'dashboard'; // default
}

// Process HTML file
function fixIconsInFile(filePath) {
    try {
        let content = readFileSync(filePath, 'utf8');
        let modified = false;

        // Pattern 1: <span class="nav-icon">??</span>
        // Pattern 2: <span class="nav-icon">?????</span>
        // Replace with SVG based on following nav-text
        
        const iconRegex = /<span class="nav-icon">\?+<\/span><span class="nav-text">([^<]+)<\/span>/g;
        
        content = content.replace(iconRegex, (match, navText) => {
            modified = true;
            const iconKey = getIconKey(navText);
            const svgIcon = icons[iconKey] || icons.dashboard;
            return `<span class="nav-icon">${svgIcon}</span><span class="nav-text">${navText}</span>`;
        });

        // Also fix button icons like "? Mark Attendance"
        const buttonIconRegex = /(<[^>]*btn[^>]*>)\?([^<]*<)/g;
        content = content.replace(buttonIconRegex, (match, opening, rest) => {
            modified = true;
            const iconKey = rest.toLowerCase().includes('mark') ? 'mark' : 'add';
            return `${opening}${icons[iconKey]}${rest}`;
        });

        if (modified) {
            writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Fixed icons in: ${filePath}`);
            return 1;
        }
        return 0;
    } catch (error) {
        console.error(`✗ Error processing ${filePath}:`, error.message);
        return 0;
    }
}

// Recursively find and process HTML files
function processDirectory(dirPath) {
    let count = 0;
    try {
        const items = readdirSync(dirPath);
        
        for (const item of items) {
            const fullPath = join(dirPath, item);
            const stats = statSync(fullPath);
            
            if (stats.isDirectory()) {
                // Skip node_modules, dist, .git
                if (!['node_modules', 'dist', '.git', '.kiro'].includes(item)) {
                    count += processDirectory(fullPath);
                }
            } else if (item.endsWith('.html')) {
                count += fixIconsInFile(fullPath);
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${dirPath}:`, error.message);
    }
    return count;
}

// Main execution
const rootDir = process.cwd();
console.log('🔧 Fixing sidebar icons in HTML files...\n');

const filesFixed = processDirectory(rootDir);

console.log(`\n✅ Complete! Fixed icons in ${filesFixed} file(s).`);

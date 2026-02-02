// State management
let isActive = true;
let privacyScore = 92;
let alertsCount = 3;
let lastScanTime = new Date();
let darkMode = false;

// DOM elements
const mainToggle = document.getElementById('mainToggle');
const darkModeToggle = document.getElementById('darkModeToggle');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const scoreCircle = document.getElementById('scoreCircle');
const scanBtn = document.getElementById('scanBtn');
const optimizeBtn = document.getElementById('optimizeBtn');
const alertsBtn = document.getElementById('alertsBtn');
const settingsBtn = document.getElementById('settingsBtn');
const alertsCountEl = document.getElementById('alertsCount');
const loadingScreen = document.getElementById('loadingScreen');
const notification = document.getElementById('notification');

// Initialize UI
function updateUI() {
    // Update toggle state
    mainToggle.classList.toggle('active', isActive);

    // Update dark mode
    document.body.classList.toggle('dark-mode', darkMode);

    // Update status
    statusDot.className = 'status-dot';
    if (!isActive) {
        statusDot.classList.add('warning');
        statusText.textContent = 'Disabled';
    } else if (alertsCount > 0) {
        statusDot.classList.add('warning');
        statusText.textContent = 'Monitoring';
    } else {
        statusDot.classList.add('active');
        statusText.textContent = 'Protected';
    }

    // Update privacy score
    scoreCircle.textContent = privacyScore;
    scoreCircle.className = 'score-circle';
    if (privacyScore < 50) {
        scoreCircle.classList.add('danger');
    } else if (privacyScore < 80) {
        scoreCircle.classList.add('warning');
    }

    // Update alerts count
    alertsCountEl.textContent = alertsCount;
    alertsCountEl.style.display = alertsCount > 0 ? 'block' : 'none';

    // Save state to storage
    saveState();
}

// Show notification
function showNotification(message, duration = 3000) {
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, duration);
}

// Show loading screen
function showLoading(show = true) {
    loadingScreen.style.display = show ? 'block' : 'none';
}

// Simulate scanning
function performScan() {
    showLoading(true);
    
    // Send message to content script to perform actual scan
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'scanPage'}, (response) => {
            setTimeout(() => {
                if (response && response.foundIssues) {
                    alertsCount += response.issueCount || 1;
                    privacyScore = Math.max(privacyScore - (response.severity || 5), 20);
                    showNotification('⚠️ Personal information detected!');
                } else {
                    showNotification('✅ No personal information found');
                }
                
                lastScanTime = new Date();
                updateUI();
                showLoading(false);
                updateFooter();
            }, 1500); // Minimum loading time for UX
        });
    });
}

// Update footer timestamp
function updateFooter() {
    const now = new Date();
    const diff = Math.floor((now - lastScanTime) / (1000 * 60));
    const timeText = diff === 0 ? 'just now' : diff === 1 ? '1 minute ago' : `${diff} minutes ago`;
    document.querySelector('.footer-text').textContent = `Last scan: ${timeText}`;
}

// Save state to chrome storage
function saveState() {
    const state = {
        isActive,
        privacyScore,
        alertsCount,
        lastScanTime: lastScanTime.getTime(),
        darkMode
    };
    chrome.storage.sync.set(state);
}

// Load state from chrome storage
function loadState() {
    chrome.storage.sync.get(['isActive', 'privacyScore', 'alertsCount', 'lastScanTime', 'darkMode'], (result) => {
        if (result.isActive !== undefined) isActive = result.isActive;
        if (result.privacyScore !== undefined) privacyScore = result.privacyScore;
        if (result.alertsCount !== undefined) alertsCount = result.alertsCount;
        if (result.lastScanTime) lastScanTime = new Date(result.lastScanTime);
        if (result.darkMode !== undefined) darkMode = result.darkMode;

        updateUI();
        updateFooter();
    });
}

// Event listeners for action buttons
scanBtn.addEventListener('click', () => {
    performScan();
});

optimizeBtn.addEventListener('click', () => {
    showNotification('✨ Optimizing prompt...');
    // Send message to content script to optimize
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'optimizePrompt'}, (response) => {
            if (response && response.success) {
                showNotification('✅ Prompt optimized successfully!');
            } else {
                showNotification('⚠️ No optimization needed or failed');
            }
        });
    });
});

alertsBtn.addEventListener('click', () => {
    if (alertsCount > 0) {
        // Open alerts page in a new tab for better accessibility
        chrome.tabs.create({url: chrome.runtime.getURL('alerts.html')});
    } else {
        showNotification('🎉 No alerts to show!');
    }
});

settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({url: chrome.runtime.getURL('settings.html')});
});

mainToggle.addEventListener('click', () => {
    isActive = !isActive;
    updateUI();
    showNotification(isActive ? '🛡️ Protection enabled' : '🚫 Protection disabled');
    // Send message to background to update active state
    chrome.runtime.sendMessage({action: 'updateSettings', settings: {isActive}});
 });

darkModeToggle.addEventListener('click', () => {
    darkMode = !darkMode;
    updateUI();
    showNotification(darkMode ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
});


// New feature: Expand popup to full browser page for easier accessibility
const expandBtn = document.createElement('button');
expandBtn.textContent = 'Open Full Page';
expandBtn.className = 'action-btn';
expandBtn.style.marginTop = '10px';
expandBtn.style.width = '100%';
expandBtn.style.padding = '12px';
expandBtn.style.fontWeight = '600';
expandBtn.style.fontSize = '14px';
expandBtn.style.cursor = 'pointer';

expandBtn.addEventListener('click', () => {
    chrome.tabs.create({url: chrome.runtime.getURL('fullpage.html')});
});

const quickActionsContainer = document.querySelector('.quick-actions');
if (quickActionsContainer) {
    quickActionsContainer.appendChild(expandBtn);
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    
    // Update footer time every minute
    setInterval(updateFooter, 60000);
    
    // Check if we're on a supported AI site
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const supportedSites = [
            'chat.openai.com',
            'claude.ai',
            'bard.google.com',
            'bing.com/chat'
        ];
        
        const currentUrl = tabs[0].url;
        const isSupported = supportedSites.some(site => currentUrl.includes(site));
        
        if (!isSupported) {
            scanBtn.disabled = true;
            optimizeBtn.disabled = true;
            scanBtn.style.opacity = '0.5';
            optimizeBtn.style.opacity = '0.5';
            showNotification('Navigate to an AI chat site to use PromptGuard');
        }
    });
});
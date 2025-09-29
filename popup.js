// State management
let isActive = true;
let privacyScore = 92;
let alertsCount = 3;
let lastScanTime = new Date();

// DOM elements
const mainToggle = document.getElementById('mainToggle');
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
        lastScanTime: lastScanTime.getTime()
    };
    chrome.storage.sync.set(state);
}

// Load state from chrome storage
function loadState() {
    chrome.storage.sync.get(['isActive', 'privacyScore', 'alertsCount', 'lastScanTime'], (result) => {
        if (result.isActive !== undefined) isActive = result.isActive;
        if (result.privacyScore !== undefined) privacyScore = result.privacyScore;
        if (result.alertsCount !== undefined) alertsCount = result.alertsCount;
        if (result.lastScanTime) lastScanTime = new Date(result.lastScanTime);
        
        updateUI();
        updateFooter();
    });
}

// Event listeners
mainToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    isActive = !isActive;
    updateUI();
    showNotification(isActive ? '🛡️ PromptGuard activated' : '⚠️ PromptGuard disabled');
    
    // Send message to content script
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleProtection',
            isActive: isActive
        });
    });
});

scanBtn.addEventListener('click', () => {
    if (!isActive) {
        showNotification('Please enable PromptGuard first');
        return;
    }
    performScan();
});

optimizeBtn.addEventListener('click', () => {
    if (!isActive) {
        showNotification('Please enable PromptGuard first');
        return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'optimizePrompt'}, (response) => {
            if (response && response.success) {
                showNotification('✨ Prompt optimized successfully!');
            } else {
                showNotification('✨ Prompt optimization coming soon!');
            }
        });
    });
});

alertsBtn.addEventListener('click', () => {
    if (alertsCount > 0) {
        // In a real implementation, this would open a detailed alerts view
        showNotification(`📊 You have ${alertsCount} privacy alerts`);
        chrome.tabs.create({url: chrome.runtime.getURL('alerts.html')});
    } else {
        showNotification('🎉 No alerts to show!');
    }
});

settingsBtn.addEventListener('click', () => {
    chrome.tabs.create({url: chrome.runtime.getURL('settings.html')});
});

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
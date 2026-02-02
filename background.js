console.log('PromptGuard Background Script Starting...');

// Background script for PromptGuard
class PromptGuardBackground {
    constructor() {
        console.log('PromptGuard Background Constructor called');
        this.alertsCount = 0;
        this.privacyScore = 92;
        this.isActive = true;
        this.alerts = [];
        this.setupEventListeners();
        this.initialize();
    }

    async initialize() {
        await this.loadSettings();
        this.injectOnExistingTabs();
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener(() => {
            this.initializeExtension();
        });

        // Handle messages from content script and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Handle tab updates to inject content script
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            console.log('Tab updated:', tabId, changeInfo, tab.url);
            if (changeInfo.status === 'complete' && this.isSupportedSite(tab.url)) {
                console.log('Supported site, injecting content script');
                this.injectContentScript(tabId);
            }
        });

        // Handle browser action click (fallback)
        chrome.action.onClicked.addListener((tab) => {
            this.openPopup();
        });
    }

    async injectOnExistingTabs() {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
            if (this.isSupportedSite(tab.url)) {
                console.log('Injecting on existing tab:', tab.id, tab.url);
                this.injectContentScript(tab.id);
            }
        }
    }

    initializeExtension() {
        // Set default settings
        const defaultSettings = {
            isActive: true,
            privacyScore: 92,
            alertsCount: 0,
            alerts: [],
            detectionSensitivity: 'medium',
            autoOptimize: false,
            notifications: true
        };

        chrome.storage.sync.set(defaultSettings);
        console.log('PromptGuard initialized');
    }

    async loadSettings() {
        const settings = await chrome.storage.sync.get([
            'isActive',
            'privacyScore',
            'alertsCount',
            'alerts',
            'detectionSensitivity',
            'autoOptimize',
            'notifications'
        ]);

        this.isActive = settings.isActive !== undefined ? settings.isActive : true;
        this.privacyScore = settings.privacyScore || 92;
        this.alertsCount = settings.alertsCount || 0;
        this.alerts = settings.alerts || [];

        this.updateBadge();
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'alertDetected':
                this.handleAlert(message, sender);
                sendResponse({success: true});
                break;

            case 'openPopup':
                this.openPopup();
                sendResponse({success: true});
                break;

            case 'getSettings':
                this.getSettings().then(settings => {
                    sendResponse(settings);
                });
                break;

            case 'updateSettings':
                this.updateSettings(message.settings).then(() => {
                    sendResponse({success: true});
                });
                break;

            case 'clearAlerts':
                this.clearAlerts().then(() => {
                    sendResponse({success: true});
                });
                break;

            case 'exportData':
                this.exportUserData().then(data => {
                    sendResponse(data);
                });
                break;

            default:
                sendResponse({success: false, error: 'Unknown action'});
        }
    }

    async handleAlert(message, sender) {
        this.alertsCount++;

        // Add alert to array
        const issueTypes = message.issues?.map(issue => issue.type).join(', ') || 'unknown';
        const alert = {
            message: `Personal information detected: ${issueTypes}`,
            timestamp: Date.now(),
            url: sender.tab?.url
        };
        this.alerts.push(alert);

        // Decrease privacy score based on severity
        const severityImpact = message.issues ? message.issues.length * 2 : 1;
        this.privacyScore = Math.max(this.privacyScore - severityImpact, 0);

        // Save updated stats
        await chrome.storage.sync.set({
            alertsCount: this.alertsCount,
            alerts: this.alerts,
            privacyScore: this.privacyScore
        });

        // Update badge
        this.updateBadge();

        // Show notification if enabled
        const settings = await chrome.storage.sync.get(['notifications']);
        if (settings.notifications !== false) {
            this.showNotification(message);
        }

        // Log alert for analytics (in a real app, you might send to analytics service)
        console.log('Privacy alert detected:', {
            url: sender.tab?.url,
            issues: message.issues,
            timestamp: new Date().toISOString()
        });
    }

    updateBadge() {
        const badgeText = this.alertsCount > 0 ? this.alertsCount.toString() : '';
        const badgeColor = this.isActive ? 
            (this.alertsCount > 0 ? '#dc3545' : '#28a745') : 
            '#6c757d';

        chrome.action.setBadgeText({text: badgeText});
        chrome.action.setBadgeBackgroundColor({color: badgeColor});
        
        // Update title
        const title = this.isActive ? 
            `PromptGuard - ${this.alertsCount} alerts (Score: ${this.privacyScore})` :
            'PromptGuard - Disabled';
        chrome.action.setTitle({title});
    }

    showNotification(alertMessage) {
        const issueTypes = alertMessage.issues?.map(issue => issue.type).join(', ') || 'unknown';

        chrome.notifications.create({
            type: 'basic',
            title: 'PromptGuard Alert',
            message: `Personal information detected: ${issueTypes}`,
            buttons: [
                {title: 'View Details'},
                {title: 'Dismiss'}
            ]
        });
    }

    openPopup() {
        // Open popup in a new tab for better visibility
        chrome.tabs.create({
            url: chrome.runtime.getURL('popup.html')
        });
    }

    isSupportedSite(url) {
        if (!url) return false;

        const supportedSites = [
            'chat.openai.com',
            'claude.ai',
            'bard.google.com',
            'bing.com/chat'
        ];

        const isSupported = supportedSites.some(site => url.includes(site));
        console.log('isSupportedSite:', url, isSupported);
        return isSupported;
    }

    async injectContentScript(tabId) {
        try {
            console.log('PromptGuard: Attempting to inject content script on tab', tabId);
            // Check if content script is already injected
            const results = await chrome.scripting.executeScript({
                target: {tabId},
                func: () => window.promptGuardInjected
            });

            if (!results[0]?.result) {
                console.log('PromptGuard: Injecting content script');
                // Inject content script
                await chrome.scripting.executeScript({
                    target: {tabId},
                    files: ['content.js']
                });

                await chrome.scripting.insertCSS({
                    target: {tabId},
                    files: ['content.css']
                });

                // Mark as injected
                await chrome.scripting.executeScript({
                    target: {tabId},
                    func: () => { window.promptGuardInjected = true; }
                });
                console.log('PromptGuard: Content script injected successfully');
            } else {
                console.log('PromptGuard: Content script already injected');
            }
        } catch (error) {
            console.log('Failed to inject content script:', error);
        }
    }

    async getSettings() {
        return await chrome.storage.sync.get([
            'isActive',
            'privacyScore',
            'alertsCount',
            'detectionSensitivity',
            'autoOptimize',
            'notifications'
        ]);
    }

    async updateSettings(newSettings) {
        await chrome.storage.sync.set(newSettings);
        
        // Update local variables
        if (newSettings.isActive !== undefined) this.isActive = newSettings.isActive;
        if (newSettings.privacyScore !== undefined) this.privacyScore = newSettings.privacyScore;
        if (newSettings.alertsCount !== undefined) this.alertsCount = newSettings.alertsCount;

        this.updateBadge();
    }

    async clearAlerts() {
        this.alertsCount = 0;
        this.alerts = [];
        this.privacyScore = Math.min(this.privacyScore + 10, 100); // Slight score improvement

        await chrome.storage.sync.set({
            alertsCount: 0,
            alerts: [],
            privacyScore: this.privacyScore
        });

        this.updateBadge();
    }

    async exportUserData() {
        const data = await chrome.storage.sync.get();
        const exportData = {
            settings: data,
            exportDate: new Date().toISOString(),
            version: chrome.runtime.getManifest().version
        };

        return {
            success: true,
            data: exportData
        };
    }

    logError(error) {
        console.error('PromptGuard Error:', error);
        // In a production app, you might send this to an error reporting service
    }

    // Periodic cleanup and maintenance
    async performMaintenance() {
        // Reset daily stats, clean up old data, etc.
        const now = new Date();
        const storage = await chrome.storage.local.get('lastMaintenance');
        const lastMaintenance = storage.lastMaintenance;

        if (!lastMaintenance || now - new Date(lastMaintenance) > 24 * 60 * 60 * 1000) {
            // Daily maintenance
            console.log('Performing daily maintenance');
            await chrome.storage.local.set({lastMaintenance: now.toISOString()});

            // Could add: cleanup old alerts, reset daily counters, etc.
        }
    }
}

// Initialize background script
const promptGuardBackground = new PromptGuardBackground();

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
        // View Details - open popup or alerts page
        chrome.tabs.create({url: chrome.runtime.getURL('alerts.html')});
    } else {
        // Dismiss - just clear the notification
        chrome.notifications.clear(notificationId);
    }
});

// Perform maintenance on startup
promptGuardBackground.performMaintenance();
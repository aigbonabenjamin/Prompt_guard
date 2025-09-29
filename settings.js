// Content script for PromptGuard
class PromptGuardContent {
    constructor() {
        this.isActive = true;
        this.floatingIcon = null;
        this.detectionPatterns = {
            email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
            phone: /(\+?1?[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
            ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
            creditCard: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
            address: /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)/gi
        };
        this.init();
    }

    init() {
        this.createFloatingIcon();
        this.setupMessageListener();
        this.startMonitoring();
    }

    createFloatingIcon() {
        // Remove existing icon if present
        const existing = document.querySelector('.promptguard-floating-icon');
        if (existing) {
            existing.remove();
        }

        // Create floating icon
        this.floatingIcon = document.createElement('div');
        this.floatingIcon.className = 'promptguard-floating-icon';
        this.floatingIcon.innerHTML = '<div class="icon">🛡️</div>';
        this.floatingIcon.title = 'PromptGuard - Click to open';

        // Add click event
        this.floatingIcon.addEventListener('click', () => {
            this.openPopup();
        });

        document.body.appendChild(this.floatingIcon);
    }

    openPopup() {
        // Open the extension popup (this will be handled by the browser)
        chrome.runtime.sendMessage({action: 'openPopup'});
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'scanPage':
                    this.scanPage().then(result => {
                        sendResponse(result);
                    });
                    return true; // Will respond asynchronously

                case 'toggleProtection':
                    this.isActive = message.isActive;
                    this.updateIconState();
                    sendResponse({success: true});
                    break;

                case 'optimizePrompt':
                    this.optimizeCurrentPrompt().then(result => {
                        sendResponse(result);
                    });
                    return true;

                default:
                    sendResponse({success: false, error: 'Unknown action'});
            }
        });
    }

    async scanPage() {
        if (!this.isActive) {
            return {foundIssues: false, message: 'Protection disabled'};
        }

        const textInputs = this.getTextInputElements();
        let foundIssues = false;
        let issueCount = 0;
        let detectedTypes = [];

        textInputs.forEach(input => {
            const text = input.value || input.textContent || '';
            const issues = this.detectPersonalInfo(text);
            
            if (issues.length > 0) {
                foundIssues = true;
                issueCount += issues.length;
                detectedTypes.push(...issues.map(issue => issue.type));
                this.highlightInput(input, 'danger');
                this.showTooltip(input, `Detected: ${issues.map(i => i.type).join(', ')}`);
            }
        });

        // Update icon state
        this.updateIconState(foundIssues);

        return {
            foundIssues,
            issueCount,
            detectedTypes: [...new Set(detectedTypes)],
            severity: foundIssues ? Math.min(issueCount * 3, 15) : 0
        };
    }

    detectPersonalInfo(text) {
        const detected = [];

        Object.entries(this.detectionPatterns).forEach(([type, pattern]) => {
            const matches = text.match(pattern);
            if (matches) {
                detected.push({
                    type,
                    matches: matches.length,
                    examples: matches.slice(0, 2) // First 2 matches for reference
                });
            }
        });

        return detected;
    }

    getTextInputElements() {
        const selectors = [
            'input[type="text"]',
            'input[type="email"]',
            'textarea',
            '[contenteditable="true"]',
            '[role="textbox"]',
            // AI-specific selectors
            '#prompt-textarea', // ChatGPT
            '.ProseMirror', // Claude.ai
            'textarea[placeholder*="message"]',
            'div[data-testid="textbox"]',
            '[data-slate-editor="true"]'
        ];

        return document.querySelectorAll(selectors.join(','));
    }

    highlightInput(element, type = 'warning') {
        element.classList.remove('promptguard-highlight-warning', 'promptguard-highlight-danger');
        element.classList.add(`promptguard-highlight-${type}`);

        // Remove highlight after 3 seconds
        setTimeout(() => {
            element.classList.remove(`promptguard-highlight-${type}`);
        }, 3000);
    }

    showTooltip(element, message) {
        // Remove existing tooltip
        const existingTooltip = document.querySelector('.promptguard-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'promptguard-tooltip';
        tooltip.textContent = message;

        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 10}px`;

        document.body.appendChild(tooltip);

        // Show tooltip with animation
        setTimeout(() => {
            tooltip.classList.add('show');
        }, 10);

        // Remove tooltip after 3 seconds
        setTimeout(() => {
            tooltip.classList.remove('show');
            setTimeout(() => tooltip.remove(), 200);
        }, 3000);
    }

    async optimizeCurrentPrompt() {
        if (!this.isActive) {
            return {success: false, error: 'Protection disabled'};
        }

        const textInputs = this.getTextInputElements();
        let optimized = false;

        for (const input of textInputs) {
            const text = input.value || input.textContent || '';
            if (text.trim()) {
                const optimizedText = this.optimizePromptText(text);
                if (optimizedText !== text) {
                    this.replaceInputText(input, optimizedText);
                    optimized = true;
                }
            }
        }

        return {success: optimized};
    }

    optimizePromptText(text) {
        let optimized = text;

        // Replace personal information with placeholders
        Object.entries(this.detectionPatterns).forEach(([type, pattern]) => {
            switch (type) {
                case 'email':
                    optimized = optimized.replace(pattern, '[EMAIL_ADDRESS]');
                    break;
                case 'phone':
                    optimized = optimized.replace(pattern, '[PHONE_NUMBER]');
                    break;
                case 'ssn':
                    optimized = optimized.replace(pattern, '[SSN]');
                    break;
                case 'creditCard':
                    optimized = optimized.replace(pattern, '[CREDIT_CARD]');
                    break;
                case 'address':
                    optimized = optimized.replace(pattern, '[ADDRESS]');
                    break;
            }
        });

        // Add privacy-conscious preamble if personal info was found
        if (optimized !== text) {
            optimized = `[Note: Personal information has been anonymized for privacy]\n\n${optimized}`;
        }

        return optimized;
    }

    replaceInputText(element, newText) {
        if (element.tagName.toLowerCase() === 'textarea' || element.tagName.toLowerCase() === 'input') {
            element.value = newText;
            element.dispatchEvent(new Event('input', {bubbles: true}));
        } else if (element.contentEditable === 'true') {
            element.textContent = newText;
            element.dispatchEvent(new Event('input', {bubbles: true}));
        }
    }

    updateIconState(hasAlerts = false) {
        if (!this.floatingIcon) return;

        this.floatingIcon.classList.toggle('disabled', !this.isActive);
        this.floatingIcon.classList.toggle('has-alerts', hasAlerts && this.isActive);

        // Update title
        if (!this.isActive) {
            this.floatingIcon.title = 'PromptGuard - Disabled (Click to open)';
        } else if (hasAlerts) {
            this.floatingIcon.title = 'PromptGuard - Privacy alerts detected (Click to open)';
        } else {
            this.floatingIcon.title = 'PromptGuard - Protected (Click to open)';
        }
    }

    startMonitoring() {
        // Monitor for new text inputs (dynamic content)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const textInputs = node.querySelectorAll ? 
                            node.querySelectorAll('input, textarea, [contenteditable="true"]') : [];
                        
                        textInputs.forEach(input => {
                            this.attachInputListener(input);
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Attach listeners to existing inputs
        this.getTextInputElements().forEach(input => {
            this.attachInputListener(input);
        });
    }

    attachInputListener(input) {
        // Avoid duplicate listeners
        if (input.dataset.promptguardListener) return;
        input.dataset.promptguardListener = 'true';

        let debounceTimer;
        const checkInput = () => {
            if (!this.isActive) return;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const text = input.value || input.textContent || '';
                const issues = this.detectPersonalInfo(text);

                if (issues.length > 0) {
                    this.highlightInput(input, 'warning');
                    this.updateIconState(true);
                    
                    // Send alert to background script
                    chrome.runtime.sendMessage({
                        action: 'alertDetected',
                        type: 'realtime',
                        issues: issues
                    });
                }
            }, 500);
        };

        input.addEventListener('input', checkInput);
        input.addEventListener('paste', () => setTimeout(checkInput, 100));
        
        // Also check on focus for pre-existing content
        input.addEventListener('focus', () => setTimeout(checkInput, 100));
    }

    // Performance monitoring
    measurePerformance(operation, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        console.log(`PromptGuard ${operation}: ${(end - start).toFixed(2)}ms`);
        return result;
    }

    // Error handling and reporting
    handleError(error, context) {
        console.error(`PromptGuard error in ${context}:`, error);
        
        // Send error to background script for logging
        chrome.runtime.sendMessage({
            action: 'logError',
            error: {
                message: error.message,
                stack: error.stack,
                context: context,
                url: window.location.href,
                timestamp: Date.now()
            }
        }).catch(() => {
            // Silently fail if background script is unavailable
        });
    }

    // Advanced detection patterns for different contexts
    getContextualPatterns() {
        const basePatterns = this.detectionPatterns;
        
        // Add context-specific patterns based on current site
        if (window.location.hostname.includes('openai.com')) {
            return {
                ...basePatterns,
                apiKey: /sk-[A-Za-z0-9]{48}/g, // OpenAI API keys
            };
        } else if (window.location.hostname.includes('anthropic.com')) {
            return {
                ...basePatterns,
                apiKey: /ant-[A-Za-z0-9-]{95}/g, // Anthropic API keys
            };
        }
        
        return basePatterns;
    }

    // Enhanced detection with context awareness
    detectPersonalInfoAdvanced(text) {
        const patterns = this.getContextualPatterns();
        const detected = [];

        Object.entries(patterns).forEach(([type, pattern]) => {
            const matches = text.match(pattern);
            if (matches) {
                detected.push({
                    type,
                    matches: matches.length,
                    examples: matches.slice(0, 2),
                    severity: this.getSeverityForType(type),
                    suggestions: this.getSuggestionsForType(type)
                });
            }
        });

        return detected;
    }

    getSeverityForType(type) {
        const severityMap = {
            email: 'medium',
            phone: 'medium',
            address: 'high',
            ssn: 'high',
            creditCard: 'high',
            apiKey: 'high'
        };
        return severityMap[type] || 'medium';
    }

    getSuggestionsForType(type) {
        const suggestions = {
            email: 'Use a placeholder like [EMAIL] or example@domain.com',
            phone: 'Replace with [PHONE] or use (555) XXX-XXXX format',
            address: 'Use [ADDRESS] or a generic location like "123 Main St"',
            ssn: 'Never include SSN in prompts. Use [SSN] if needed',
            creditCard: 'Never include credit card numbers. Use [CARD] placeholder',
            apiKey: 'Remove API keys immediately. Use [API_KEY] placeholder'
        };
        return suggestions[type] || 'Consider using a placeholder instead';
    }

    // Accessibility improvements
    addAccessibilitySupport() {
        // Add ARIA labels to floating icon
        if (this.floatingIcon) {
            this.floatingIcon.setAttribute('role', 'button');
            this.floatingIcon.setAttribute('aria-label', 'PromptGuard privacy protection');
            this.floatingIcon.setAttribute('tabindex', '0');
            
            // Keyboard support for floating icon
            this.floatingIcon.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.openPopup();
                }
            });
        }
    }

    // Clean up on page unload
    cleanup() {
        try {
            if (this.floatingIcon) {
                this.floatingIcon.remove();
            }
            
            // Remove event listeners
            document.querySelectorAll('[data-promptguard-listener]').forEach(element => {
                element.removeAttribute('data-promptguard-listener');
            });
            
            // Clear any remaining tooltips
            document.querySelectorAll('.promptguard-tooltip').forEach(tooltip => {
                tooltip.remove();
            });
        } catch (error) {
            this.handleError(error, 'cleanup');
        }
    }
}

// Initialize PromptGuard when content script loads
let promptGuard;

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPromptGuard);
} else {
    initPromptGuard();
}

function initPromptGuard() {
    try {
        // Only initialize on AI chat sites
        const supportedSites = [
            'chat.openai.com',
            'claude.ai',
            'bard.google.com',
            'bing.com'
        ];

        if (supportedSites.some(site => window.location.hostname.includes(site))) {
            promptGuard = new PromptGuardContent();
            
            // Add accessibility support
            promptGuard.addAccessibilitySupport();
            
            // Clean up on page unload
            window.addEventListener('beforeunload', () => {
                if (promptGuard) {
                    promptGuard.cleanup();
                }
            });
        }
    } catch (error) {
        console.error('Failed to initialize PromptGuard content script:', error);
    }
}

// Handle single-page app navigation
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        
        // Re-initialize on navigation after delay
        setTimeout(() => {
            try {
                if (promptGuard) {
                    promptGuard.cleanup();
                }
                initPromptGuard();
            } catch (error) {
                console.error('Failed to re-initialize PromptGuard:', error);
            }
        }, 1000);
    }
}).observe(document, {subtree: true, childList: true});

// Global error handler for content script
window.addEventListener('error', (event) => {
    if (promptGuard) {
        promptGuard.handleError(event.error, 'global');
    }
});

// Handle extension context invalidation
chrome.runtime.onConnect.addListener((port) => {
    port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) {
            console.log('Content script disconnected:', chrome.runtime.lastError.message);
            // Attempt to reinitialize if needed
            setTimeout(() => {
                try {
                    initPromptGuard();
                } catch (error) {
                    console.error('Failed to reinitialize after disconnect:', error);
                }
            }, 2000);
        }
    });
});
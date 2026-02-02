// Settings page script

// DOM elements
const enableProtectionInput = document.getElementById('enableProtectionInput');
const notificationsInput = document.getElementById('notificationsInput');
const autoOptimizeInput = document.getElementById('autoOptimizeInput');
const sensitivity = document.getElementById('sensitivity');
const detectEmail = document.getElementById('detectEmail');
const detectPhone = document.getElementById('detectPhone');
const detectAddress = document.getElementById('detectAddress');
const detectSSN = document.getElementById('detectSSN');
const detectCreditCard = document.getElementById('detectCreditCard');
const exportBtn = document.getElementById('exportBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const closeBtn = document.getElementById('closeBtn');

// Load settings
function loadSettings() {
    chrome.storage.sync.get(['isActive', 'notifications', 'autoOptimize', 'detectionSensitivity', 'detectEmail', 'detectPhone', 'detectAddress', 'detectSSN', 'detectCreditCard'], (result) => {
        enableProtectionInput.checked = result.isActive !== false;
        notificationsInput.checked = result.notifications !== false;
        autoOptimizeInput.checked = result.autoOptimize || false;
        sensitivity.value = result.detectionSensitivity || 'medium';
        detectEmail.checked = result.detectEmail !== false;
        detectPhone.checked = result.detectPhone !== false;
        detectAddress.checked = result.detectAddress !== false;
        detectSSN.checked = result.detectSSN !== false;
        detectCreditCard.checked = result.detectCreditCard !== false;
    });
}

// Save settings
function saveSettings() {
    const settings = {
        isActive: enableProtectionInput.checked,
        notifications: notificationsInput.checked,
        autoOptimize: autoOptimizeInput.checked,
        detectionSensitivity: sensitivity.value,
        detectEmail: detectEmail.checked,
        detectPhone: detectPhone.checked,
        detectAddress: detectAddress.checked,
        detectSSN: detectSSN.checked,
        detectCreditCard: detectCreditCard.checked
    };
    chrome.storage.sync.set(settings, () => {
        showNotification('Settings saved successfully!');
    });
}

// Event listeners
saveBtn.addEventListener('click', saveSettings);

resetBtn.addEventListener('click', () => {
    if (confirm('Reset to default settings?')) {
        chrome.storage.sync.clear(() => {
            loadSettings();
            showNotification('Settings reset to defaults.');
        });
    }
});

closeBtn.addEventListener('click', () => {
    window.close();
});

exportBtn.addEventListener('click', () => {
    chrome.storage.sync.get(null, (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'promptguard-settings.json';
        a.click();
        URL.revokeObjectURL(url);
    });
});

clearDataBtn.addEventListener('click', () => {
    if (confirm('Clear all data? This cannot be undone.')) {
        chrome.storage.sync.clear(() => {
            showNotification('All data cleared.');
            loadSettings();
        });
    }
});

// Notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);

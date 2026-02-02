// Alerts page script
let darkMode = false;

// Load settings and alerts
async function loadAlerts() {
    const settings = await chrome.storage.sync.get(['alerts', 'darkMode']);
    const alerts = settings.alerts || [];
    darkMode = settings.darkMode || false;

    updateDarkMode();

    const alertsList = document.getElementById('alertsList');
    const noAlerts = document.getElementById('noAlerts');

    if (alerts.length > 0) {
        alertsList.innerHTML = '';
        noAlerts.style.display = 'none';
        alertsList.style.display = 'block';

        // Sort alerts by timestamp (newest first)
        alerts.sort((a, b) => b.timestamp - a.timestamp);

        alerts.forEach(alert => {
            const alertItem = createAlertItem(alert);
            alertsList.appendChild(alertItem);
        });
    } else {
        alertsList.style.display = 'none';
        noAlerts.style.display = 'block';
    }
}

// Create alert item element
function createAlertItem(alert) {
    const item = document.createElement('div');
    item.className = 'alert-item';

    const header = document.createElement('div');
    header.className = 'alert-header';

    const title = document.createElement('div');
    title.className = 'alert-title';
    title.textContent = 'Privacy Alert';

    const time = document.createElement('div');
    time.className = 'alert-time';
    time.textContent = formatTime(alert.timestamp);

    header.appendChild(title);
    header.appendChild(time);

    const message = document.createElement('div');
    message.className = 'alert-message';
    message.textContent = alert.message;

    item.appendChild(header);
    item.appendChild(message);

    return item;
}

// Format timestamp
function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Update dark mode
function updateDarkMode() {
    document.body.classList.toggle('dark-mode', darkMode);
}

// Clear all alerts
async function clearAllAlerts() {
    if (confirm('Are you sure you want to clear all alerts?')) {
        await chrome.runtime.sendMessage({action: 'clearAlerts'});
        loadAlerts();
    }
}

// Event listeners
document.getElementById('backBtn').addEventListener('click', () => {
    window.close();
});

document.getElementById('clearBtn').addEventListener('click', clearAllAlerts);

// Initialize
document.addEventListener('DOMContentLoaded', loadAlerts);

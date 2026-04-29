// --- State Management ---
let queue = [];
let totalCustomersDay = 0;
let standardCounter = 1;
let priorityCounter = 1;

const AVG_WAIT_TIME_MINS = 5; // Assumed 5 mins per person

// DOM Elements
const elements = {
    form: document.getElementById('add-customer-form'),
    nameInput: document.getElementById('customer-name'),
    priorityInput: document.getElementById('customer-priority'),
    queueList: document.getElementById('queue-list'),
    totalCustomers: document.getElementById('total-customers'),
    serveNextBtn: document.getElementById('serve-next-btn'),
    nowServingToken: document.getElementById('now-serving-token'),
    nowServingName: document.getElementById('now-serving-name'),
    nextServingToken: document.getElementById('next-serving-token'),
    nextServingName: document.getElementById('next-serving-name'),
    estWaitTime: document.getElementById('est-wait-time'),
    searchInput: document.getElementById('search-input'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    themeToggle: document.getElementById('theme-toggle'),
    liveClock: document.getElementById('live-clock'),
    toastContainer: document.getElementById('toast-container')
};

// Current Filter State
let currentFilter = 'waiting'; // 'waiting', 'served', 'all'
let searchQuery = '';

// --- Initialization ---
function init() {
    setupEventListeners();
    startClock();

    // Check saved theme
    const savedTheme = localStorage.getItem('qsync-theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
}

// --- Event Listeners ---
function setupEventListeners() {
    elements.form.addEventListener('submit', handleAddCustomer);
    elements.serveNextBtn.addEventListener('click', serveNext);

    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderQueue();
    });

    elements.filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderQueue();
        });
    });

    elements.themeToggle.addEventListener('click', toggleTheme);
}

// --- Core Functions ---

function handleAddCustomer(e) {
    e.preventDefault();
    const name = elements.nameInput.value.trim();
    const isPriority = elements.priorityInput.checked;

    if (!name) return;

    let token = '';
    if (isPriority) {
        token = `P-${String(priorityCounter).padStart(3, '0')}`;
        priorityCounter++;
    } else {
        token = `T-${String(standardCounter).padStart(3, '0')}`;
        standardCounter++;
    }

    const newCustomer = {
        id: Date.now().toString(),
        token,
        name,
        isPriority,
        status: 'waiting', // 'waiting', 'serving', 'done'
        timestamp: new Date()
    };

    // Priority customers jump ahead of standard waiting customers, but behind other priorities
    if (isPriority) {
        const lastPriorityIndex = queue.findLastIndex(c => c.isPriority && c.status === 'waiting');
        const firstStandardIndex = queue.findIndex(c => !c.isPriority && c.status === 'waiting');

        if (lastPriorityIndex !== -1) {
            queue.splice(lastPriorityIndex + 1, 0, newCustomer);
        } else if (firstStandardIndex !== -1) {
            queue.splice(firstStandardIndex, 0, newCustomer);
        } else {
            queue.push(newCustomer);
        }
    } else {
        queue.push(newCustomer);
    }

    totalCustomersDay++;
    elements.totalCustomers.innerHTML = `Total Today: ${totalCustomersDay}`;

    // Reset Form
    elements.nameInput.value = '';
    elements.priorityInput.checked = false;

    showToast(`Token ${token} generated for ${name}`, 'success');

    updateUI();
}

function serveNext() {
    // Find currently serving and mark as done
    const currentServing = queue.find(c => c.status === 'serving');
    if (currentServing) {
        currentServing.status = 'done';
    }

    // Find next waiting
    const nextWaiting = queue.find(c => c.status === 'waiting');
    if (nextWaiting) {
        nextWaiting.status = 'serving';
        showToast(`Now Serving: ${nextWaiting.token} (${nextWaiting.name})`, 'info');
    } else if (currentServing) {
        showToast('Queue is now empty.', 'info');
    } else {
        showToast('No customers waiting in queue.', 'error');
    }

    updateUI();
}

function removeCustomer(id) {
    const customerDOM = document.getElementById(`item-${id}`);
    if (customerDOM) {
        customerDOM.classList.add('fade-out');
        setTimeout(() => {
            const index = queue.findIndex(c => c.id === id);
            if (index !== -1) {
                const removed = queue[index];
                queue.splice(index, 1);
                showToast(`${removed.token} removed from queue.`, 'info');
                updateUI();
            }
        }, 400); // Wait for fade-out animation
    }
}

// --- UI Updates ---

function updateUI() {
    renderQueue();
    updateNotifications();
    updateWaitTime();
}

function renderQueue() {
    elements.queueList.innerHTML = '';

    // Filter and Search Logic
    let displayQueue = queue.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchQuery) || c.token.toLowerCase().includes(searchQuery);
        let matchesFilter = true;

        if (currentFilter === 'waiting') {
            matchesFilter = c.status === 'waiting' || c.status === 'serving';
        } else if (currentFilter === 'served') {
            matchesFilter = c.status === 'done';
        }

        return matchesSearch && matchesFilter;
    });

    if (displayQueue.length === 0) {
        elements.queueList.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <p>No customers found matching criteria.</p>
            </div>
        `;
        return;
    }

    displayQueue.forEach(customer => {
        const item = document.createElement('div');
        item.className = `queue-item status-${customer.status} ${customer.isPriority ? 'item-priority' : ''}`;
        item.id = `item-${customer.id}`;

        let statusText = customer.status;
        let actionBtn = '';

        if (customer.status !== 'done') {
            actionBtn = `<button onclick="removeCustomer('${customer.id}')" title="Remove"><i class="fa-solid fa-trash-can"></i></button>`;
        }

        let priorityBadge = customer.isPriority ? `<span class="item-priority-badge">Emergency</span>` : '';

        let timeString = customer.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let detailText = `<span class="detail-text"><i class="fa-regular fa-clock"></i> Joined: ${timeString}</span>`;

        if (customer.status === 'waiting') {
            const waitingIndex = queue.filter(c => c.status === 'waiting').findIndex(c => c.id === customer.id);
            if (waitingIndex !== -1) {
                const estMins = (waitingIndex + 1) * AVG_WAIT_TIME_MINS;
                detailText += ` <span class="detail-text"><i class="fa-solid fa-hourglass-half"></i> Est. Wait: ~${estMins}m</span>`;
            }
        } else if (customer.status === 'serving') {
            detailText += ` <span class="detail-text"><i class="fa-solid fa-bolt"></i> Currently Serving</span>`;
        } else if (customer.status === 'done') {
            detailText += ` <span class="detail-text"><i class="fa-solid fa-check-double"></i> Served</span>`;
        }

        item.innerHTML = `
            <div class="item-left">
                <div class="token-circle">${customer.token}</div>
                <div class="item-info">
                    <div class="item-name-group">
                        <span class="item-name">${customer.name}</span>
                        ${priorityBadge}
                    </div>
                    <div class="item-details">${detailText}</div>
                </div>
            </div>
            <div class="item-right">
                <span class="item-status">${statusText}</span>
                <div class="item-actions">
                    ${actionBtn}
                </div>
            </div>
        `;
        elements.queueList.appendChild(item);
    });
}

function updateNotifications() {
    const currentServing = queue.find(c => c.status === 'serving');
    const waitingList = queue.filter(c => c.status === 'waiting');
    const nextWaiting = waitingList.length > 0 ? waitingList[0] : null;

    if (currentServing) {
        elements.nowServingToken.textContent = currentServing.token;
        elements.nowServingName.textContent = currentServing.name;
    } else {
        elements.nowServingToken.textContent = '--';
        elements.nowServingName.textContent = 'Waiting for customers...';
    }

    if (nextWaiting) {
        elements.nextServingToken.textContent = nextWaiting.token;
        elements.nextServingName.textContent = nextWaiting.name;
    } else {
        elements.nextServingToken.textContent = '--';
        elements.nextServingName.textContent = '--';
    }
}

function updateWaitTime() {
    const waitingCount = queue.filter(c => c.status === 'waiting').length;
    const estTime = waitingCount * AVG_WAIT_TIME_MINS;
    elements.estWaitTime.innerHTML = `<i class="fa-regular fa-clock"></i> Est. Wait: ${estTime} mins`;
}

// --- Utilities ---

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    if (currentTheme === 'dark') {
        html.setAttribute('data-theme', 'light');
        elements.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        localStorage.setItem('qsync-theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        elements.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        localStorage.setItem('qsync-theme', 'dark');
    }
}

function startClock() {
    setInterval(() => {
        const now = new Date();
        let hours = now.getHours();
        let minutes = now.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0' + minutes : minutes;

        elements.liveClock.textContent = `${hours}:${minutes} ${ampm}`;
    }, 1000);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-circle-xmark';

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Initialize application on load
init();

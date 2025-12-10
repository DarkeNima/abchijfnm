// --- Core Elements ---
const form = document.getElementById('giveaway-form');
const pageForm = document.getElementById('page-form');
const pageShare = document.getElementById('page-share');
const whatsappShareBtn = document.getElementById('whatsapp-share-btn');
const manualShareBtn = document.getElementById('manual-share-btn');
const successModal = document.getElementById('success-modal');
const debugPanel = document.getElementById('debug-panel');
const adminPanel = document.getElementById('admin-panel');

// --- Share Tracking Requirements ---
const MAX_UNIQUE_GROUPS = 8;
const MAX_TOTAL_SHARES = 18;
const MIN_SHARE_TIME_MS = 5000; // 5 seconds to prevent accidental double-counts

// --- Local Storage Keys ---
const STORAGE_KEY_FORM_DATA = 'ffGiveawayFormData';
const STORAGE_KEY_SHARE_DATA = 'ffGiveawayShareData';
const STORAGE_KEY_SUBMISSIONS = 'ffGiveawaySubmissions';
const STORAGE_KEY_UNIQUE_GROUPS = 'ffGiveawayUniqueGroups';

// --- Data Structure for Submission ---
let currentSubmission = {
    id: null,
    playerId: null,
    playerName: null,
    region: null,
    membership: null,
    walletAmount: 0,
    currency: 'LKR',
    shareData: {
        totalShares: 0,
        uniqueGroups: new Set(),
        lastShareTimestamp: 0,
    },
    winKey: null,
    timestamp: Date.now()
};

// ===================================
// 1. Utility Functions (Storage & Data)
// ===================================

/**
 * Reads the submission data from localStorage.
 * Initializes with default structure if none is found.
 */
function loadData() {
    const formDataJson = localStorage.getItem(STORAGE_KEY_FORM_DATA);
    const shareDataJson = localStorage.getItem(STORAGE_KEY_SHARE_DATA);
    
    if (formDataJson) {
        // Load basic form data
        const loadedFormData = JSON.parse(formDataJson);
        currentSubmission.id = loadedFormData.id;
        currentSubmission.playerId = loadedFormData.playerId;
        currentSubmission.playerName = loadedFormData.playerName;
        currentSubmission.region = loadedFormData.region;
        currentSubmission.membership = loadedFormData.membership;
        currentSubmission.walletAmount = loadedFormData.walletAmount;
        currentSubmission.currency = loadedFormData.currency;
        currentSubmission.winKey = loadedFormData.winKey;
        currentSubmission.timestamp = loadedFormData.timestamp;
    }

    if (shareDataJson) {
        // Load share data and convert uniqueGroups array back to a Set
        const loadedShareData = JSON.parse(shareDataJson);
        currentSubmission.shareData.totalShares = loadedShareData.totalShares || 0;
        // Ensure Set is re-created from the stored Array
        currentSubmission.shareData.uniqueGroups = new Set(loadedShareData.uniqueGroups || []);
        currentSubmission.shareData.lastShareTimestamp = loadedShareData.lastShareTimestamp || 0;
    }
}

/**
 * Saves the form and share data to localStorage.
 * Separated to allow independent updates.
 */
function saveData() {
    // Save form data (excluding the shareData object)
    const formDataToSave = {
        id: currentSubmission.id,
        playerId: currentSubmission.playerId,
        playerName: currentSubmission.playerName,
        region: currentSubmission.region,
        membership: currentSubmission.membership,
        walletAmount: currentSubmission.walletAmount,
        currency: currentSubmission.currency,
        winKey: currentSubmission.winKey,
        timestamp: currentSubmission.timestamp
    };
    localStorage.setItem(STORAGE_KEY_FORM_DATA, JSON.stringify(formDataToSave));

    // Save share data (converting Set to Array for JSON serialization)
    const shareDataToSave = {
        totalShares: currentSubmission.shareData.totalShares,
        // Convert Set to Array before saving to JSON
        uniqueGroups: Array.from(currentSubmission.shareData.uniqueGroups),
        lastShareTimestamp: currentSubmission.shareData.lastShareTimestamp,
    };
    localStorage.setItem(STORAGE_KEY_SHARE_DATA, JSON.stringify(shareDataToSave));

    // If a win key is generated, update the permanent submissions list
    if (currentSubmission.winKey) {
        updateSubmissionLog();
    }
}

/**
 * Prepares the payload for a server POST request.
 * This function should be replaced by a real implementation.
 * @param {object} payload - The complete current submission data.
 */
function submitToServer(payload) {
    // 🚧 STUB: Developer must replace this with a real backend API call (e.g., fetch)
    console.log('STUB: Data prepared for server submission:', payload);
    // Example commented-out fetch call:
    /*
    fetch('YOUR_API_ENDPOINT', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    }).then(data => {
        console.log('Server response:', data);
    }).catch(error => {
        console.error('Submission failed:', error);
    });
    */
}

/**
 * Updates the permanent list of submissions (for Admin Panel).
 */
function updateSubmissionLog() {
    let submissions = JSON.parse(localStorage.getItem(STORAGE_KEY_SUBMISSIONS) || '[]');
    
    // Check if the current submission already exists by ID
    const existingIndex = submissions.findIndex(s => s.id === currentSubmission.id);
    const logEntry = {
        id: currentSubmission.id,
        playerId: currentSubmission.playerId,
        membership: currentSubmission.membership,
        winKey: currentSubmission.winKey,
        totalShares: currentSubmission.shareData.totalShares,
        uniqueGroups: Array.from(currentSubmission.shareData.uniqueGroups).length,
        timestamp: currentSubmission.timestamp
    };

    if (existingIndex > -1) {
        // Update existing entry (e.g., when key is generated)
        submissions[existingIndex] = logEntry;
    } else {
        // Add new entry
        submissions.push(logEntry);
    }
    
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(submissions));
    
    // Also send to the server stub
    submitToServer(currentSubmission);
}


// ===================================
// 2. Validation and Form Submission (Page 1)
// ===================================

/**
 * Performs client-side validation for the entire form.
 * @param {HTMLFormElement} form - The form element.
 * @returns {boolean} - True if validation passes, false otherwise.
 */
function validateForm(form) {
    let isValid = true;

    // Reset all error messages
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

    const playerId = form.elements['playerId'].value.trim();
    const playerName = form.elements['playerName'].value.trim();
    const region = form.elements['region'].value;
    const membership = form.elements['membership'].value;
    const agreeTerms = form.elements['agreeTerms'].checked;
    const walletAmount = parseFloat(form.elements['walletAmount'].value) || 0;

    // 1. Player ID validation (6-12 digits)
    if (!/^\d{6,12}$/.test(playerId)) {
        document.getElementById('error-player-id').textContent = 'Player ID must be 6 to 12 digits.';
        isValid = false;
    }

    // 2. Player Name validation (required)
    if (playerName === '') {
        document.getElementById('error-player-name').textContent = 'Player Name is required.';
        isValid = false;
    }

    // 3. Region validation (required)
    if (region === '') {
        document.getElementById('error-region').textContent = 'Region selection is required.';
        isValid = false;
    }

    // 4. Membership validation (required)
    if (membership === '') {
        document.getElementById('error-membership').textContent = 'Membership selection is required.';
        isValid = false;
    }
    
    // 5. Wallet Amount validation (non-negative)
    if (walletAmount < 0) {
        document.getElementById('error-wallet-amount').textContent = 'Wallet amount cannot be negative.';
        isValid = false;
    }

    // 6. Terms agreement validation
    if (!agreeTerms) {
        document.getElementById('error-agree-terms').textContent = 'You must agree to the Terms & Conditions.';
        isValid = false;
    }

    return isValid;
}

/**
 * Handles the form submission event.
 */
function handleFormSubmit(event) {
    event.preventDefault();

    if (validateForm(form)) {
        // Gather and store form data
        currentSubmission.id = currentSubmission.id || Date.now().toString(36) + Math.random().toString(36).substr(2); // Unique ID for tracking
        currentSubmission.playerId = form.elements['playerId'].value.trim();
        currentSubmission.playerName = form.elements['playerName'].value.trim();
        currentSubmission.region = form.elements['region'].value;
        currentSubmission.membership = form.elements['membership'].value;
        currentSubmission.walletAmount = parseFloat(form.elements['walletAmount'].value) || 0;
        currentSubmission.currency = form.elements['currency'].value;
        
        saveData(); // Save form data

        // Display confirmation and switch page
        displaySummary();
        updateProgressUI();
        switchPage('page-share');

        // Note: Initial server submission happens when share requirements are met (in updateSubmissionLog)
    } else {
        alert('Please correct the errors in the form.');
    }
}

/**
 * Switches the active section based on the ID.
 * @param {string} pageId - The ID of the section to show.
 */
function switchPage(pageId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });
    const target = document.getElementById(pageId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
        window.scrollTo(0, 0); // Scroll to top on page switch
    }
}


// ===================================
// 3. Share Tracking (Page 2)
// ===================================

/**
 * Updates the summary box on Page 2 with the submitted data.
 */
function displaySummary() {
    document.getElementById('summary-id').textContent = currentSubmission.playerId;
    document.getElementById('summary-name').textContent = currentSubmission.playerName;
    document.getElementById('summary-region').textContent = currentSubmission.region;
    document.getElementById('summary-membership').textContent = currentSubmission.membership;
    
    let currencySymbol = currentSubmission.currency === 'LKR' ? 'Rs.' : '$';
    let formattedAmount = currentSubmission.walletAmount.toFixed(2);
    document.getElementById('summary-wallet').textContent = `${currencySymbol} ${formattedAmount} ${currentSubmission.currency}`;
}

/**
 * Creates the prefilled WhatsApp share message.
 * @returns {string} The URL-encoded share message.
 */
function createShareMessage() {
    const id = currentSubmission.playerId;
    const name = currentSubmission.playerName;
    const region = currentSubmission.region;
    const dummyLink = encodeURIComponent(window.location.origin); // Use current origin as dummy link

    const message = `🎄 Free Fire Christmas Giveaway! 🎁 Claim a FREE ${currentSubmission.membership} and win big!

PlayerID: ${id}
Name: ${name}
Region: ${region}

Join and claim your membership here: ${dummyLink}`;

    return encodeURIComponent(message);
}

/**
 * Handles the click on the main WhatsApp share button.
 * Opens the WhatsApp deep link.
 */
function handleWhatsappShareClick() {
    const message = createShareMessage();
    // Use the wa.me/?text=... format which generally works best on both mobile and web
    const whatsappUrl = `https://wa.me/?text=${message}`; 
    window.open(whatsappUrl, '_blank');
}

/**
 * Increments the share counters (both total and unique groups)
 * based on the group name provided.
 * @param {string} groupName - The name/identifier of the group shared to.
 */
function incrementShare(groupName) {
    const now = Date.now();

    // 1. Anti-cheating check: Minimum time between shares
    if (now - currentSubmission.shareData.lastShareTimestamp < MIN_SHARE_TIME_MS) {
        document.getElementById('error-share-group').textContent = `Please wait ${MIN_SHARE_TIME_MS / 1000} seconds between shares.`;
        return;
    }
    document.getElementById('error-share-group').textContent = '';

    // Clean up group name for unique tracking
    const normalizedGroup = groupName.trim().toLowerCase();
    
    let countedAsUnique = false;
    if (normalizedGroup !== '' && currentSubmission.shareData.uniqueGroups.size < MAX_UNIQUE_GROUPS) {
        if (!currentSubmission.shareData.uniqueGroups.has(normalizedGroup)) {
            currentSubmission.shareData.uniqueGroups.add(normalizedGroup);
            countedAsUnique = true;
        }
    }

    let countedAsTotal = false;
    if (currentSubmission.shareData.totalShares < MAX_TOTAL_SHARES) {
        currentSubmission.shareData.totalShares++;
        countedAsTotal = true;
    }

    if (countedAsTotal || countedAsUnique) {
        currentSubmission.shareData.lastShareTimestamp = now;
        saveData();
        updateProgressUI();
        
        // Reset the group input field after a successful count
        document.getElementById('group-name').value = '';
    } else if (currentSubmission.shareData.totalShares >= MAX_TOTAL_SHARES && currentSubmission.shareData.uniqueGroups.size >= MAX_UNIQUE_GROUPS) {
        document.getElementById('error-share-group').textContent = 'Share requirements already met!';
    } else {
        // If the group was a repeat and total shares maxed, give a message
        document.getElementById('error-share-group').textContent = 'This group name has already been counted, or the maximum share count has been reached.';
    }
}

/**
 * Handles the click on the manual "I Shared Successfully" button.
 */
function handleManualShareClick() {
    const groupName = document.getElementById('group-name').value.trim();
    if (groupName === '') {
        document.getElementById('error-share-group').textContent = 'Please enter the group name or number you shared to.';
        return;
    }
    
    incrementShare(groupName);
}

/**
 * Updates the visual progress bars and checks for completion.
 */
function updateProgressUI() {
    const groupsProgress = currentSubmission.shareData.uniqueGroups.size;
    const totalProgress = currentSubmission.shareData.totalShares;

    // Update numbers
    document.getElementById('progress-groups').textContent = groupsProgress;
    document.getElementById('progress-total').textContent = totalProgress;

    // Calculate and update progress bar widths
    const groupsPercent = Math.min(100, (groupsProgress / MAX_UNIQUE_GROUPS) * 100);
    const totalPercent = Math.min(100, (totalProgress / MAX_TOTAL_SHARES) * 100);

    document.getElementById('progress-bar-groups').style.width = `${groupsPercent}%`;
    document.getElementById('progress-bar-total').style.width = `${totalPercent}%`;

    // Update checklists
    const groupsChecklist = document.getElementById('groups-checklist');
    const totalSharesChecklist = document.getElementById('total-shares-checklist');

    if (groupsProgress >= MAX_UNIQUE_GROUPS) {
        groupsChecklist.innerHTML = '<i class="fas fa-check-circle"></i> Complete';
        groupsChecklist.classList.add('complete');
    } else {
        groupsChecklist.innerHTML = `<i class="fas fa-times-circle"></i> ${MAX_UNIQUE_GROUPS - groupsProgress} groups remaining`;
        groupsChecklist.classList.remove('complete');
    }

    if (totalProgress >= MAX_TOTAL_SHARES) {
        totalSharesChecklist.innerHTML = '<i class="fas fa-check-circle"></i> Complete';
        totalSharesChecklist.classList.add('complete');
    } else {
        totalSharesChecklist.innerHTML = `<i class="fas fa-times-circle"></i> ${MAX_TOTAL_SHARES - totalProgress} shares remaining`;
        totalSharesChecklist.classList.remove('complete');
    }

    // Check for unlock condition
    if (groupsProgress >= MAX_UNIQUE_GROUPS && totalProgress >= MAX_TOTAL_SHARES) {
        unlockMembershipKey();
    }
}


// ===================================
// 4. Unlocking and Key Generation (Page 3)
// ===================================

/**
 * Generates a secure-looking alphanumeric key with dashes.
 * Format: FF-XXXX-XXXX-XXXX
 * @returns {string} The generated key.
 */
function generateKey() {
    const segments = 4;
    const segmentLength = 4;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'FF-';

    // Helper to generate a segment
    const generateSegment = () => {
        let segment = '';
        if (window.crypto && window.crypto.getRandomValues) {
            // Use secure random values if available (better security)
            const randomBytes = new Uint8Array(segmentLength);
            window.crypto.getRandomValues(randomBytes);
            for (let i = 0; i < segmentLength; i++) {
                segment += chars[randomBytes[i] % chars.length];
            }
        } else {
            // Fallback to less secure Math.random()
            for (let i = 0; i < segmentLength; i++) {
                segment += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        return segment;
    };

    for (let i = 0; i < segments; i++) {
        if (i > 0) key += '-';
        key += generateSegment();
    }
    
    return key;
}

/**
 * Triggers key generation and displays the success modal.
 */
function unlockMembershipKey() {
    // Only generate key once
    if (!currentSubmission.winKey) {
        currentSubmission.winKey = generateKey();
        saveData(); // Save the key
    }
    
    // Update the key display and show modal
    document.getElementById('membership-key-output').textContent = currentSubmission.winKey;
    successModal.classList.remove('hidden');
    
    // Disable share buttons
    whatsappShareBtn.disabled = true;
    manualShareBtn.disabled = true;
    
    // Submit the complete record to server stub
    updateSubmissionLog();
}


// ===================================
// 5. Success Modal Actions
// ===================================

/**
 * Copies the key to the clipboard.
 */
function copyKey() {
    const key = document.getElementById('membership-key-output').textContent;
    navigator.clipboard.writeText(key).then(() => {
        alert('Membership Key copied to clipboard!');
    }).catch(err => {
        console.error('Could not copy text: ', err);
        alert('Failed to copy key. Please copy it manually.');
    });
}

/**
 * Prepares and sends the key to the user's own WhatsApp.
 */
function sendKeyViaWhatsapp() {
    const key = document.getElementById('membership-key-output').textContent;
    const message = `🎉 Here is your Free Fire Membership Key: ${key}. 
Your membership will be activated within 24 hours.`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

/**
 * Downloads the key as a TXT file.
 */
function downloadKey() {
    const key = document.getElementById('membership-key-output').textContent;
    const filename = 'FreeFire_Membership_Key.txt';
    const textContent = `Free Fire Christmas Membership Key:\n\n${key}\n\nActivation Note: Your membership will be activated within 24 hours. Please do not share this key publicly.`;
    
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(textContent));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}


// ===================================
// 6. Admin Panel (Hidden Feature)
// ===================================

/**
 * Checks for the admin query parameter and enables the panel.
 */
function checkAdminPanel() {
    const urlParams = new URLSearchParams(window.location.search);
    const isAdmin = urlParams.get('admin') === 'true';
    
    if (isAdmin) {
        switchPage('admin-panel'); // Switch to admin panel
        loadAdminSubmissions();
        document.getElementById('clear-localstorage-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to clear ALL local storage data for this site? This cannot be undone.')) {
                localStorage.clear();
                alert('Local storage cleared! Reloading page.');
                window.location.reload();
            }
        });
    }
}

/**
 * Loads and displays submissions in the admin panel.
 */
function loadAdminSubmissions() {
    const submissions = JSON.parse(localStorage.getItem(STORAGE_KEY_SUBMISSIONS) || '[]');
    const list = document.getElementById('submission-list');
    list.innerHTML = ''; // Clear existing list

    if (submissions.length === 0) {
        list.innerHTML = '<li>No submissions found in localStorage.</li>';
        return;
    }

    submissions.forEach(sub => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>ID:</strong> ${sub.playerId} (${sub.membership})<br>
            <strong>Key:</strong> <code style="color: ${sub.winKey ? 'green' : 'red'};">${sub.winKey || 'PENDING'}</code><br>
            <strong>Progress:</strong> ${sub.uniqueGroups}/${MAX_UNIQUE_GROUPS} Groups | ${sub.totalShares}/${MAX_TOTAL_SHARES} Shares<br>
            <small>Log Time: ${new Date(sub.timestamp).toLocaleString()}</small>
            <hr>
        `;
        list.appendChild(li);
    });
}


// ===================================
// 7. Event Listeners & Initialization
// ===================================

/**
 * Initialization function.
 */
function init() {
    loadData(); // Load any previously stored data

    // Check for admin mode before switching to the main page
    checkAdminPanel();

    // If data loaded and a Player ID exists, skip the form and go to share page
    if (currentSubmission.playerId && !document.getElementById('admin-panel').classList.contains('active')) {
        displaySummary();
        updateProgressUI();
        switchPage('page-share');
        // If key already generated, show the modal right away (e.g., after reload)
        if (currentSubmission.winKey) {
            document.getElementById('membership-key-output').textContent = currentSubmission.winKey;
            successModal.classList.remove('hidden');
        }
    }

    // Form Submission Listener
    form.addEventListener('submit', handleFormSubmit);

    // Main WhatsApp Share Button Listener
    whatsappShareBtn.addEventListener('click', handleWhatsappShareClick);
    
    // Manual Share Confirmation Listener
    manualShareBtn.addEventListener('click', handleManualShareClick);
    
    // Success Modal Listeners
    document.getElementById('copy-key-btn').addEventListener('click', copyKey);
    document.getElementById('whatsapp-key-btn').addEventListener('click', sendKeyViaWhatsapp);
    document.getElementById('download-key-btn').addEventListener('click', downloadKey);
    document.getElementById('close-modal-btn').addEventListener('click', () => successModal.classList.add('hidden'));

    // Debug Panel Listeners (visible only if ?debug=true or on desktop)
    if (window.innerWidth >= 768 || new URLSearchParams(window.location.search).has('debug')) {
        debugPanel.classList.remove('hidden');
    }
    
    document.getElementById('debug-share-btn').addEventListener('click', () => {
        // Simulate a total share increase without unique group or anti-cheat check
        if (currentSubmission.shareData.totalShares < MAX_TOTAL_SHARES) {
            currentSubmission.shareData.totalShares++;
            saveData();
            updateProgressUI();
        }
    });

    document.getElementById('debug-group-btn').addEventListener('click', () => {
        // Simulate a unique group increase
        if (currentSubmission.shareData.uniqueGroups.size < MAX_UNIQUE_GROUPS) {
            // Use a unique group name for debugging
            currentSubmission.shareData.uniqueGroups.add(`debug-group-${Date.now()}`);
            saveData();
            updateProgressUI();
        }
    });

    // Simple warning if localStorage is cleared
    if (localStorage.length === 0 && currentSubmission.playerId) {
        console.warn("Local storage seems to be clear. Share progress will be lost.");
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', init);

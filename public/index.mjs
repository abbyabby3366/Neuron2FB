const elements = {
    fbTabs: document.getElementById('fb-tabs'),
    otherConfigList: document.getElementById('other-config-list'),
    welcomeScreen: document.getElementById('welcome-screen'),
    fbView: document.getElementById('fb-view'),
    editorScreen: document.getElementById('editor-screen'),
    currentFbName: document.getElementById('current-fb-name'),
    fbTitleControls: document.getElementById('fb-title-controls'),
    fbMetaParams: document.getElementById('fb-meta-params'),
    targetAccountCards: document.getElementById('target-account-cards'),
    referenceAccountCards: document.getElementById('reference-account-cards'),
    targetCount: document.getElementById('target-count'),
    referenceCount: document.getElementById('reference-count'),
    jsonEditor: document.getElementById('json-editor'),
    currentFilename: document.getElementById('current-filename'),
    saveBtn: document.getElementById('save-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    deleteFbBtn: document.getElementById('delete-fb-btn'),
    new2fbBtn: document.getElementById('new-2fb-btn'),
    newConfigModal: document.getElementById('new-config-modal'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    createConfigBtn: document.getElementById('create-config-btn'),
    newFilenameInput: document.getElementById('new-filename'),
    // Delete Confirmation
    deleteConfirmModal: document.getElementById('delete-confirm-modal'),
    deleteConfirmInput: document.getElementById('delete-confirm-input'),
    confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
    cancelDeleteBtn: document.getElementById('cancel-delete-btn'),
    deleteFilenameTarget: document.getElementById('delete-filename-target'),
    // Settings Modal
    fbSettingsModal: document.getElementById('fb-settings-modal'),
    settingsForm: document.getElementById('settings-form'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    settingsModalTitle: document.getElementById('settings-modal-title'),
};

// Safety check: ensure all essential elements exist
const missingElements = Object.entries(elements)
    .filter(([key, el]) => !el && !['otherConfigList', 'saveSettingsBtn'].includes(key))
    .map(([key]) => key);

if (missingElements.length > 0) {
    console.warn('Missing essential DOM elements:', missingElements);
}

let allConfigs = [];
let current2fb = null;
let currentFile = null;
let linkedConfigs = {}; // Stores content of accounts in the active 2fb

// --- API Calls ---

async function fetchAllConfigs() {
    try {
        const res = await fetch('/api/configs');
        allConfigs = await res.json();
        renderNav();

        // 1. Check localStorage for last selection
        const last2fb = localStorage.getItem('last2fb');
        if (last2fb && allConfigs.includes(last2fb)) {
            load2fb(last2fb);
        } else {
            // 2. Default to first 2fb*.json if none saved
            const firstFb = allConfigs.find(f => f.startsWith('2fb'));
            if (firstFb) load2fb(firstFb);
        }
    } catch (err) {
        console.error('Error fetching configs:', err);
    }
}

async function load2fb(filename) {
    try {
        current2fb = filename;
        currentFile = null;
        const res = await fetch(`/api/configs/${filename}`);
        const fbConfig = await res.json();
        
        elements.welcomeScreen.classList.add('hidden');
        elements.editorScreen.classList.add('hidden');
        elements.fbView.classList.remove('hidden');
        elements.currentFbName.textContent = filename;
        
        renderFbMeta(fbConfig);
        await loadLinkedAccounts(fbConfig);
        
        // Save selection to localStorage
        localStorage.setItem('last2fb', filename);
        
        // Update active tab
        document.querySelectorAll('#fb-tabs li').forEach(li => {
            li.classList.toggle('active', li.dataset.filename === filename);
        });
        document.querySelectorAll('#other-config-list li').forEach(li => li.classList.remove('active'));
        
    } catch (err) {
        console.error('Error loading 2fb:', err);
    }
}

async function loadLinkedAccounts(fbConfig) {
    const targets = fbConfig.targetAccsGroup || [];
    const unusedTargets = fbConfig.unusedTargetAccsGroup || [];
    const refs = fbConfig.referenceAccsGroup || [];
    const unusedRefs = fbConfig.unusedReferenceAccsGroup || [];
    
    elements.targetCount.textContent = targets.length;
    elements.referenceCount.textContent = refs.length;
    
    linkedConfigs = {};
    elements.targetAccountCards.innerHTML = '<p class="loading">Loading accounts...</p>';
    elements.referenceAccountCards.innerHTML = '<p class="loading">Loading accounts...</p>';

    const loadGroup = async (group, unusedGroup, container, groupType) => {
        container.innerHTML = '';
        const allAccs = [
            ...group.map(id => ({ id, isUsed: true })),
            ...unusedGroup.map(id => ({ id, isUsed: false }))
        ];

        const promises = allAccs.map(async ({ id: accId, isUsed }) => {
            try {
                const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
                const res = await fetch(`/api/configs/${filename}`);
                if (res.ok) {
                    const data = await res.json();
                    linkedConfigs[filename] = data;
                    renderAccountCard(accId, data, container, isUsed, groupType);
                } else {
                    renderErrorCard(accId, container);
                }
            } catch (e) {
                renderErrorCard(accId, container);
            }
        });
        await Promise.all(promises);
        
        // Add "Add Account" button if not present in the header
        const accordion = container.closest('.account-group');
        const header = accordion?.querySelector('.accordion-header');
        if (header && !header.querySelector('.add-acc-btn')) {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-acc-btn';
            addBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
            `;
            addBtn.onclick = (e) => {
                e.stopPropagation();
                addAccountToGroup(groupType);
            };
            header.appendChild(addBtn);
        }
    };

    await Promise.all([
        loadGroup(targets, unusedTargets, elements.targetAccountCards, 'targetAccsGroup'),
        loadGroup(refs, unusedRefs, elements.referenceAccountCards, 'referenceAccsGroup')
    ]);
}

async function addAccountToGroup(groupType) {
    const accId = prompt(`Enter account ID (e.g. test_acc) to add to ${groupType}:`);
    if (!accId) return;

    try {
        const res = await fetch(`/api/configs/${current2fb}`);
        const fbConfig = await res.json();
        
        if (!fbConfig[groupType]) fbConfig[groupType] = [];
        fbConfig[groupType].push(accId);

        const saveRes = await fetch(`/api/configs/${current2fb}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbConfig, null, 2)
        });

        if (saveRes.ok) {
            showToast(`Added ${accId} to ${groupType}!`);
            load2fb(current2fb);
        } else {
            showToast('Failed to add account', 'error');
        }
    } catch (err) {
        console.error('Error adding account:', err);
        showToast('Error adding account', 'error');
    }
}

async function loadSingleFile(filename) {
    try {
        currentFile = filename;
        current2fb = null;
        const res = await fetch(`/api/configs/${filename}`);
        const data = await res.json();
        
        elements.welcomeScreen.classList.add('hidden');
        elements.fbView.classList.add('hidden');
        elements.editorScreen.classList.remove('hidden');
        elements.currentFilename.textContent = filename;
        elements.jsonEditor.value = JSON.stringify(data, null, 2);
        
        // Update active class
        document.querySelectorAll('#other-config-list li').forEach(li => {
            li.classList.toggle('active', li.dataset.filename === filename);
        });
        document.querySelectorAll('#fb-tabs li').forEach(li => li.classList.remove('active'));
        
    } catch (err) {
        console.error('Error loading file:', err);
    }
}

// --- Rendering ---

function renderNav() {
    elements.fbTabs.innerHTML = '';
    
    allConfigs.forEach(file => {
        if (file.startsWith('2fb')) {
            const li = document.createElement('li');
            li.textContent = file.replace('.json', '');
            li.dataset.filename = file;
            li.addEventListener('click', () => load2fb(file));
            elements.fbTabs.appendChild(li);
        }
    });
}

function renderFbMeta(config) {
    elements.fbMetaParams.innerHTML = '';
    elements.fbTitleControls.innerHTML = '';
    
    const is2fb0 = current2fb === '2fb0.json';
    
    if (is2fb0) {
        // Render compact controls next to title
        ['run', 'autobet'].forEach(key => {
            if (config[key] !== undefined) {
                const span = document.createElement('span');
                span.className = 'compact-control';
                span.innerHTML = `
                    <label class="switch-sm">
                        <input type="checkbox" class="fb-input" data-key="${key}" ${config[key] ? 'checked' : ''} id="compact-${key}">
                        <span class="slider round"></span>
                    </label>
                    <label for="compact-${key}" class="toggle-label">${key}</label>
                `;
                elements.fbTitleControls.appendChild(span);
            }
        });

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'settings-icon-btn';
        settingsBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
        `;
        settingsBtn.title = 'Settings';
        settingsBtn.onclick = () => openSettingsModal(config);
        elements.fbTitleControls.appendChild(settingsBtn);
        
        elements.fbMetaParams.classList.add('hidden');
    } else {
        // Standard grid view for other configs
        elements.fbMetaParams.classList.remove('hidden');
        const params = ['run', 'autobet', 'cooldownTimeInSeconds', 'msBetweenSBB2FB'];
        params.forEach(key => {
            if (config[key] !== undefined) {
                const div = document.createElement('div');
                div.className = 'param-item';
                div.innerHTML = `
                    <span class="param-label">${key}</span>
                    <input type="${typeof config[key] === 'number' ? 'number' : 'checkbox'}" 
                           class="fb-input" 
                           data-key="${key}" 
                           ${typeof config[key] === 'boolean' && config[key] ? 'checked' : ''} 
                           value="${config[key]}">
                `;
                elements.fbMetaParams.appendChild(div);
            }
        });
    }
}

function openSettingsModal(config) {
    elements.settingsModalTitle.textContent = `Settings: ${current2fb}`;
    elements.settingsForm.innerHTML = '';
    
    const hiddenParams = ['cooldownTimeInSeconds', 'msBetweenSBB2FB', 'successBetListKey'];
    
    hiddenParams.forEach(key => {
        if (config[key] !== undefined) {
            renderSettingsField(key, config[key], elements.settingsForm);
        }
    });

    if (config.brainParams) {
        const brainHeader = document.createElement('h4');
        brainHeader.textContent = 'Brain Parameters';
        brainHeader.style.margin = '10px 0 5px';
        brainHeader.style.fontSize = '0.8rem';
        elements.settingsForm.appendChild(brainHeader);
        
        Object.keys(config.brainParams).forEach(key => {
            renderSettingsField(key, config.brainParams[key], elements.settingsForm, 'brainParams');
        });
    }

    elements.fbSettingsModal.classList.remove('hidden');
    elements.saveSettingsBtn.style.display = 'none'; // Hide save button initially
}

function renderSettingsField(key, value, container, parentKey = null) {
    const field = document.createElement('div');
    const isBool = typeof value === 'boolean';
    field.className = `settings-field ${isBool ? 'checkbox-field' : ''}`;
    
    field.innerHTML = `
        <label>${key}</label>
        <input type="${isBool ? 'checkbox' : typeof value === 'number' ? 'number' : 'text'}" 
               data-key="${key}" 
               ${parentKey ? `data-parent="${parentKey}"` : ''}
               ${isBool && value ? 'checked' : ''} 
               value="${value}">
    `;
    container.appendChild(field);
}

async function saveSettingsFromModal() {
    if (!current2fb) return;
    const fbRes = await fetch(`/api/configs/${current2fb}`);
    const fbConfig = await fbRes.json();
    
    elements.settingsForm.querySelectorAll('input').forEach(input => {
        const key = input.dataset.key;
        const parent = input.dataset.parent;
        const isBool = input.type === 'checkbox';
        const value = isBool ? input.checked : 
                     input.type === 'number' ? Number(input.value) : input.value;
        
        if (parent) {
            if (!fbConfig[parent]) fbConfig[parent] = {};
            fbConfig[parent][key] = value;
        } else {
            fbConfig[key] = value;
        }
    });

    try {
        const res = await fetch(`/api/configs/${current2fb}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbConfig, null, 2)
        });
        if (res.ok) {
            showToast('Settings saved');
            elements.fbSettingsModal.classList.add('hidden');
            load2fb(current2fb); // Refresh view after manual save
        }
    } catch (e) {
        showToast('Save failed', 'error');
    }
}

function renderAccountCard(accId, data, container, isUsed, groupType) {
    const card = document.createElement('div');
    card.className = `acc-card ${isUsed ? '' : 'is-unused'}`;
    
    // Logo detection
    const lowerId = accId.toLowerCase();
    let logoSrc = '';
    if (lowerId.startsWith('sbo')) logoSrc = 'sbo-logo.png';
    else if (lowerId.startsWith('ps')) logoSrc = 'ps-logo.png';

    card.innerHTML = `
        <label class="switch">
            <input type="checkbox" class="acc-toggle" data-acc="${accId}" data-group="${groupType}" ${isUsed ? 'checked' : ''}>
            <span class="slider"></span>
        </label>
        <div class="acc-card-logo">
            ${logoSrc ? `<img src="${logoSrc}" alt="${accId.slice(0, 3)}">` : ''}
        </div>
        <div class="acc-card-header">
            <span class="acc-id">${accId}</span>
        </div>
        <div class="acc-summary">
            <div class="field">
                <span class="param-label">Mode</span>
                <span class="param-value">${data.mode || 'N/A'}</span>
            </div>
            <div class="field">
                <span class="param-label">Cap</span>
                <span class="param-value">${data.stakeInput?.capital || 'N/A'}</span>
            </div>
        </div>
        <div class="acc-actions">
            <button class="edit-acc-btn" data-acc="${accId}" title="Edit JSON">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
            </button>
        </div>
    `;
    
    card.querySelector('.edit-acc-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
        loadSingleFile(filename);
    });
    
    container.appendChild(card);
}

function renderErrorCard(accId, container) {
    const card = document.createElement('div');
    card.className = 'acc-card error';
    card.innerHTML = `<span class="acc-id">${accId}</span><p>Config not found</p>`;
    container.appendChild(card);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '8px';
    toast.style.background = type === 'success' ? '#10b981' : '#ef4444';
    toast.style.color = 'white';
    toast.style.zIndex = '1000';
    toast.style.animation = 'slideUp 0.3s ease-out';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// --- Event Listeners ---

elements.saveBtn.addEventListener('click', async () => {
    const content = elements.jsonEditor.value;
    try {
        const json = JSON.parse(content);
        const res = await fetch(`/api/configs/${currentFile}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json)
        });
        if (res.ok) showToast('Saved!');
    } catch (e) {
        showToast('Invalid JSON', 'error');
    }
});

async function saveAll() {
    try {
        if (!current2fb) return;
        
        // 1. Save 2FB Meta Params
        const fbRes = await fetch(`/api/configs/${current2fb}`);
        const fbConfig = await fbRes.json();
        
        document.querySelectorAll('.fb-input').forEach(input => {
            const key = input.dataset.key;
            const value = input.type === 'checkbox' ? input.checked : Number(input.value);
            fbConfig[key] = value;
        });

        // 2. Save account toggles (Used/Unused move)
        const groups = {
            targetAccsGroup: [],
            unusedTargetAccsGroup: [],
            referenceAccsGroup: [],
            unusedReferenceAccsGroup: []
        };

        document.querySelectorAll('.acc-toggle').forEach(toggle => {
            const accId = toggle.dataset.acc;
            const groupType = toggle.dataset.group;
            const isUsed = toggle.checked;
            
            if (groupType === 'targetAccsGroup') {
                if (isUsed) groups.targetAccsGroup.push(accId);
                else groups.unusedTargetAccsGroup.push(accId);
            } else if (groupType === 'referenceAccsGroup') {
                if (isUsed) groups.referenceAccsGroup.push(accId);
                else groups.unusedReferenceAccsGroup.push(accId);
            }
        });

        Object.assign(fbConfig, groups);

        const saveFbRes = await fetch(`/api/configs/${current2fb}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbConfig, null, 2)
        });

        if (saveFbRes.ok) showToast('All changes saved automatically');
        else showToast('Save failure', 'error');

    } catch (e) {
        console.error('Save failed:', e);
        showToast('Save failed', 'error');
    }
}

let saveTimeout = null;
function debouncedSaveAll() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveAll, 500);
}

elements.new2fbBtn.addEventListener('click', () => {
    elements.newFilenameInput.value = '2fb1.json';
    elements.newConfigModal.classList.remove('hidden');
});

elements.cancelModalBtn.addEventListener('click', () => elements.newConfigModal.classList.add('hidden'));

elements.cancelSettingsBtn.addEventListener('click', () => {
    elements.fbSettingsModal.classList.add('hidden');
    load2fb(current2fb); // Final refresh to ensure UI is in sync
});

elements.saveSettingsBtn.addEventListener('click', saveSettingsFromModal);

// Show save button only when edited
elements.settingsForm.addEventListener('input', () => {
    elements.saveSettingsBtn.style.display = 'inline-flex';
});

elements.createConfigBtn.addEventListener('click', async () => {
    const filename = elements.newFilenameInput.value.trim();
    if (!filename) return;
    const res = await fetch(`/api/configs/${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: false, targetAccsGroup: [], referenceAccsGroup: [] }, null, 2)
    });
    if (res.ok) {
        elements.newConfigModal.classList.add('hidden');
        await fetchAllConfigs();
        load2fb(filename);
    }
});

// Secure Delete Logic
elements.deleteFbBtn.addEventListener('click', () => {
    elements.deleteFilenameTarget.textContent = current2fb;
    elements.deleteConfirmInput.value = '';
    elements.confirmDeleteBtn.disabled = true;
    elements.deleteConfirmModal.classList.remove('hidden');
});

elements.deleteConfirmInput.addEventListener('input', (e) => {
    elements.confirmDeleteBtn.disabled = e.target.value !== current2fb;
});

elements.confirmDeleteBtn.addEventListener('click', async () => {
    const filename = current2fb;
    try {
        const res = await fetch(`/api/configs/${filename}`, { method: 'DELETE' });
        if (res.ok) {
            elements.deleteConfirmModal.classList.add('hidden');
            showToast(`${filename} deleted`);
            elements.fbView.classList.add('hidden');
            elements.welcomeScreen.classList.remove('hidden');
            await fetchAllConfigs();
        }
    } catch (err) {
        showToast('Delete failed', 'error');
    }
});

elements.cancelDeleteBtn.addEventListener('click', () => {
    elements.deleteConfirmModal.classList.add('hidden');
});

// Auto-save on change
elements.fbView.addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('fb-input') || target.classList.contains('acc-toggle')) {
        // Immediate UI feedback for account toggles
        if (target.classList.contains('acc-toggle')) {
            const card = target.closest('.acc-card');
            if (card) card.classList.toggle('is-unused', !target.checked);
        }
        debouncedSaveAll();
    }
});

// Accordion (Delegation)
document.addEventListener('click', (e) => {
    const header = e.target.closest('.accordion-header');
    if (header) {
        header.parentElement.classList.toggle('active');
    }
});

// Initialize
window.addEventListener('load', fetchAllConfigs);

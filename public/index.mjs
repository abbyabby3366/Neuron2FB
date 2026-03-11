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
    const refs = fbConfig.referenceAccsGroup || [];
    
    elements.targetCount.textContent = targets.length;
    elements.referenceCount.textContent = refs.length;
    
    linkedConfigs = {};
    elements.targetAccountCards.innerHTML = '<p class="loading">Loading accounts...</p>';
    elements.referenceAccountCards.innerHTML = '<p class="loading">Loading accounts...</p>';

    const loadGroup = async (group, container, groupType) => {
        container.innerHTML = '';
        const promises = group.map(async (accId) => {
            try {
                const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
                const res = await fetch(`/api/configs/${filename}`);
                if (res.ok) {
                    const data = await res.json();
                    linkedConfigs[filename] = data;
                    renderAccountCard(accId, data, container);
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
            addBtn.innerHTML = '+';
            addBtn.onclick = (e) => {
                e.stopPropagation();
                addAccountToGroup(groupType);
            };
            header.appendChild(addBtn);
        }
    };

    await Promise.all([
        loadGroup(targets, elements.targetAccountCards, 'targetAccsGroup'),
        loadGroup(refs, elements.referenceAccountCards, 'referenceAccsGroup')
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
                    <input type="checkbox" class="fb-input" data-key="${key}" ${config[key] ? 'checked' : ''} id="compact-${key}">
                    <label for="compact-${key}">${key}</label>
                `;
                elements.fbTitleControls.appendChild(span);
            }
        });

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'settings-icon-btn';
        settingsBtn.innerHTML = '⚙️';
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

async function saveSettings() {
    if (!current2fb) return;
    const fbRes = await fetch(`/api/configs/${current2fb}`);
    const fbConfig = await fbRes.json();
    
    elements.settingsForm.querySelectorAll('input').forEach(input => {
        const key = input.dataset.key;
        const parent = input.dataset.parent;
        const value = input.type === 'checkbox' ? input.checked : 
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
            showToast('Settings saved automatically');
            // We don't necessarily want to refresh load2fb here because it would close the modal or reset its state
            // But we should update the meta params in the background
            const fbConfigLocal = await (await fetch(`/api/configs/${current2fb}`)).json();
            renderFbMeta(fbConfigLocal);
        }
    } catch (e) {
        showToast('Save failed', 'error');
    }
}

let settingsSaveTimeout = null;
function debouncedSaveSettings() {
    if (settingsSaveTimeout) clearTimeout(settingsSaveTimeout);
    settingsSaveTimeout = setTimeout(saveSettings, 500);
}

function renderAccountCard(accId, data, container) {
    const card = document.createElement('div');
    card.className = 'acc-card';
    card.innerHTML = `
        <div class="acc-card-header">
            <span class="acc-id">${accId}</span>
            <label class="switch">
                <input type="checkbox" class="acc-toggle" data-acc="${accId}" ${data.autoBet ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        <div class="acc-summary">
            <div class="field">
                <span class="param-label">Mode</span>
                <span class="param-value">${data.mode || 'N/A'}</span>
            </div>
            <div class="field">
                <span class="param-label">Capital</span>
                <span class="param-value">${data.stakeInput?.capital || 'N/A'}</span>
            </div>
        </div>
        <button class="edit-acc-btn" data-acc="${accId}" title="Edit JSON">✎</button>
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

        const saveFbRes = await fetch(`/api/configs/${current2fb}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbConfig, null, 2)
        });

        // 2. Save account toggles
        const accPromises = Array.from(document.querySelectorAll('.acc-toggle')).map(async (toggle) => {
            const accId = toggle.dataset.acc;
            const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
            const config = linkedConfigs[filename];
            if (config) {
                config.autoBet = toggle.checked;
                return fetch(`/api/configs/${filename}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config, null, 2)
                });
            }
        });

        await Promise.all(accPromises);
        
        if (saveFbRes.ok) showToast('All changes saved automatically');
        else showToast('Partial save failure', 'error');

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
// Auto-save settings on change
elements.settingsForm.addEventListener('change', debouncedSaveSettings);

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
    if (e.target.classList.contains('fb-input') || e.target.classList.contains('acc-toggle')) {
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

import { state, saveAccountConfig, fetchAccountConfig } from './api.js';
import { elements, showToast } from './ui.js';
import { openBrainParamsModal, openStakeInputModal, openBrowserDetailsModal } from './modals.js';

export async function loadLinkedAccounts(fbConfig, renderAccountCard) {
    const targets = fbConfig.targetAccsGroup || [];
    const unusedTargets = fbConfig.unusedTargetAccsGroup || [];
    const refs = fbConfig.referenceAccsGroup || [];
    const unusedRefs = fbConfig.unusedReferenceAccsGroup || [];
    
    elements.targetCount.textContent = targets.length;
    elements.referenceCount.textContent = refs.length;
    
    state.linkedConfigs = {};
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
                const data = await fetchAccountConfig(filename);
                if (data) {
                    state.linkedConfigs[filename] = data;
                    renderAccountCard(accId, data, container, isUsed, groupType);
                } else {
                    import('./render.js').then(m => m.renderErrorCard(accId, container));
                }
            } catch (e) {
                import('./render.js').then(m => m.renderErrorCard(accId, container));
            }
        });
        await Promise.all(promises);
    };

    await Promise.all([
        loadGroup(targets, unusedTargets, elements.targetAccountCards, 'targetAccsGroup'),
        loadGroup(refs, unusedRefs, elements.referenceAccountCards, 'referenceAccsGroup')
    ]);
}

export function renderAccountCard(accId, data, container, isUsed, groupType) {
    const card = document.createElement('div');
    card.className = `acc-card ${isUsed ? '' : 'is-unused'}`;
    
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
            <div class="field" style="margin-right: 8px;">
                <label class="switch switch-sm" title="AutoBet">
                    <input type="checkbox" class="autobet-toggle" data-acc="${accId}" ${data.autoBet ? 'checked' : ''}>
                    <span class="slider round"></span>
                </label>
                <span class="param-label" style="margin-left: 4px; cursor: pointer;" onclick="this.previousElementSibling.click()">AutoBet</span>
            </div>
            <div class="field">
                <input type="text" class="quick-input website-input" placeholder="Website" value="${data.user?.website || ''}" title="${data.user?.website || ''}" autocomplete="off" data-lpignore="true">
            </div>
            <div class="field">
                <input type="text" class="quick-input username-input" placeholder="Username" value="${data.user?.username || ''}" autocomplete="off" data-lpignore="true">
            </div>
            <div class="field">
                <input type="password" class="quick-input password-input" placeholder="Password" value="${data.user?.password || ''}" autocomplete="new-password" data-lpignore="true">
            </div>
        </div>
        <div class="acc-actions">
            <button class="focus-btn" title="Focus Chrome Window">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                </svg>
            </button>
            <div class="dropdown">
                <button class="menu-btn" title="More options">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
                <div class="dropdown-content">
                    <a href="#" class="menu-item brain-params-opt">Brain Params</a>
                    <a href="#" class="menu-item stake-input-opt">Stake Input</a>
                    <a href="#" class="menu-item browser-details-opt">Browser Details</a>
                    <a href="#" class="menu-item view-odds-opt disabled">View all odds</a>
                    <hr>
                    <a href="#" class="menu-item edit-json-opt">Edit JSON</a>
                    <hr>
                    <a href="#" class="menu-item delete-json-opt" style="color: #ff4d4d;">Delete JSON</a>
                </div>
            </div>
        </div>
    `;
    
    // AutoBet toggle
    card.querySelector('.autobet-toggle').addEventListener('change', async (e) => {
        const checkbox = e.target;
        const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
        const currentData = await fetchAccountConfig(filename);
        if (currentData) {
            currentData.autoBet = checkbox.checked;
            const ok = await saveAccountConfig(filename, currentData);
            if (ok) showToast(`AutoBet ${checkbox.checked ? 'enabled' : 'disabled'} for ${accId}`);
            else checkbox.checked = !checkbox.checked;
        }
    });

    // Quick Input Listeners
    const saveQuickInput = async (e, field) => {
        const input = e.target;
        const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
        const currentData = await fetchAccountConfig(filename);
        if (currentData) {
            if (!currentData.user) currentData.user = {};
            currentData.user[field] = input.value;
            const ok = await saveAccountConfig(filename, currentData);
            if (ok) {
                showToast(`${field} updated for ${accId}`);
                state.linkedConfigs[filename] = currentData;
            }
        }
    };

    const websiteInput = card.querySelector('.website-input');
    if (websiteInput) websiteInput.addEventListener('change', (e) => saveQuickInput(e, 'website'));

    const usernameInput = card.querySelector('.username-input');
    if (usernameInput) usernameInput.addEventListener('change', (e) => saveQuickInput(e, 'username'));

    const passwordInput = card.querySelector('.password-input');
    if (passwordInput) passwordInput.addEventListener('change', (e) => saveQuickInput(e, 'password'));

    // Focus button
    const focusBtn = card.querySelector('.focus-btn');
    if (focusBtn) {
        focusBtn.onclick = async () => {
            try {
                const res = await fetch(`/api/focus/${accId}`, { method: 'POST' });
                const result = await res.json();
                if (result.success) {
                    showToast(`Focused ${accId}`);
                } else {
                    showToast(result.message || 'Focus failed', 'error');
                }
            } catch (e) {
                showToast('Cannot reach server', 'error');
            }
        };
    }

    // Dropdown Actions
    const dropdown = card.querySelector('.dropdown');
    const menuBtn = card.querySelector('.menu-btn');
    
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        closeAllMenus();
        dropdown.classList.toggle('active');
    };

    const saveAndNotify = async (updatedData) => {
        const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
        const ok = await saveAccountConfig(filename, updatedData);
        if (ok) {
            showToast('Changes saved successfully');
            // Update local state and UI
            state.linkedConfigs[filename] = updatedData;
            const newCard = renderAccountCard(accId, updatedData, container, isUsed, groupType);
            container.replaceChild(newCard, card);
        }
    };

    card.querySelector('.brain-params-opt').onclick = (e) => {
        e.preventDefault();
        openBrainParamsModal(accId, data, saveAndNotify);
        dropdown.classList.remove('active');
    };

    card.querySelector('.stake-input-opt').onclick = (e) => {
        e.preventDefault();
        openStakeInputModal(accId, data, saveAndNotify);
        dropdown.classList.remove('active');
    };

    card.querySelector('.browser-details-opt').onclick = (e) => {
        e.preventDefault();
        openBrowserDetailsModal(accId, data, saveAndNotify);
        dropdown.classList.remove('active');
    };

    card.querySelector('.edit-json-opt').onclick = (e) => {
        e.preventDefault();
        const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
        import('./api.js').then(m => {
             // Coordinate with main to load single file
             window.dispatchEvent(new CustomEvent('loadSingleFile', { popup: false, detail: filename }));
        });
        dropdown.classList.remove('active');
    };

    if (card.querySelector('.delete-json-opt')) {
        card.querySelector('.delete-json-opt').onclick = (e) => {
            e.preventDefault();
            const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
            
            // Setup modal
            elements.deleteAccFilenameTarget.textContent = filename;
            elements.deleteAccConfirmInput.value = '';
            elements.confirmDeleteAccBtn.disabled = true;
            
            window.dispatchEvent(new CustomEvent('requestDeleteAccount', { 
                detail: { filename, accId, groupType, card } 
            }));
            
            elements.deleteAccConfirmModal.classList.remove('hidden');
            dropdown.classList.remove('active');
        };
    }

    container.appendChild(card);
    return card;
}

function truncate(str, n) {
    return (str.length > n) ? str.slice(0, n-1) + '&hellip;' : str;
}

function closeAllMenus() {
    document.querySelectorAll('.dropdown.active').forEach(d => d.classList.remove('active'));
}

document.addEventListener('click', () => closeAllMenus());

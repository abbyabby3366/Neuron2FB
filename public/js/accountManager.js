import { state, saveAccountConfig, fetchAccountConfig } from './api.js';
import { elements, showToast } from './ui.js';
import { openBrainParamsModal, openStakeInputModal, openBrowserDetailsModal, openScheduleModal, openSuccessBetListModal, getBrainParamsClipboard, getBrainParamsClipboardSource } from './modals.js';
import { isWithinWindows } from './timeUtils.js';

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

        // Sort by numeric suffix so cards always render in ascending order (sbo0, sbo1, sbo2...)
        allAccs.sort((a, b) => {
            const numA = parseInt((a.id.match(/(\d+)$/) || [0, 0])[1], 10);
            const numB = parseInt((b.id.match(/(\d+)$/) || [0, 0])[1], 10);
            return numA - numB;
        });

        // Fetch all configs concurrently for speed, then render in sorted order
        const results = await Promise.all(allAccs.map(async ({ id: accId, isUsed }) => {
            try {
                const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
                const data = await fetchAccountConfig(filename);
                return { accId, filename, data, isUsed, error: false };
            } catch (e) {
                return { accId, data: null, isUsed, error: true };
            }
        }));

        for (const { accId, filename, data, isUsed, error } of results) {
            if (!error && data) {
                state.linkedConfigs[filename] = data;
                renderAccountCard(accId, data, container, isUsed, groupType);
            } else {
                const m = await import('./render.js');
                m.renderErrorCard(accId, container);
            }
        }
    };

    await Promise.all([
        loadGroup(targets, unusedTargets, elements.targetAccountCards, 'targetAccsGroup'),
        loadGroup(refs, unusedRefs, elements.referenceAccountCards, 'referenceAccsGroup')
    ]);
}

export function renderAccountCard(accId, data, container, isUsed, groupType) {
    const card = document.createElement('div');
    const outOfHoursClass = isWithinWindows(data.openingHours) ? '' : 'out-of-hours';
    card.className = `acc-card ${isUsed ? '' : 'is-unused'} ${outOfHoursClass}`;
    
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
            <button class="paste-brain-btn" title="Paste Brain Params">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
            </button>
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
                    <a href="#" class="menu-item success-bets-opt">Success Bet List</a>
                    <a href="#" class="menu-item schedule-opt">Opening Hours</a>
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

    // Paste Brain Params button
    const pasteBrainBtn = card.querySelector('.paste-brain-btn');
    if (pasteBrainBtn) {
        pasteBrainBtn.onclick = () => {
            const clip = getBrainParamsClipboard();
            if (!clip) {
                showToast('Nothing copied yet — copy from Brain Params modal first', 'error');
                return;
            }
            // Show warning confirmation
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.style.cssText = 'z-index:10001;';
            overlay.innerHTML = `
                <div class="modal-content" style="max-width:420px;">
                    <h3 style="color:#f59e0b;display:flex;align-items:center;gap:8px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Overwrite Warning
                    </h3>
                    <p style="color:var(--text-secondary);margin:12px 0;line-height:1.6;">
                        This will <strong style="color:#ef4444;">replace all brain params</strong> for <strong>${accId}</strong> with the copied values. The old values will be lost.
                    </p>
                    <div class="modal-footer">
                        <button id="card-paste-cancel-btn" class="btn btn-secondary">Cancel</button>
                        <button id="card-paste-confirm-btn" class="btn btn-danger">Overwrite</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('card-paste-cancel-btn').onclick = () => overlay.remove();
            document.getElementById('card-paste-confirm-btn').onclick = async () => {
                overlay.remove();
                const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
                const currentData = await fetchAccountConfig(filename);
                if (currentData) {
                    currentData.brainParams = { ...clip };
                    const ok = await saveAccountConfig(filename, currentData);
                    if (ok) {
                        const sourceAccId = getBrainParamsClipboardSource() || 'Unknown';
                        showToast(`Brain params ${sourceAccId} pasted & saved for ${accId}`);
                        state.linkedConfigs[filename] = currentData;
                    } else {
                        showToast('Save failed', 'error');
                    }
                }
            };
        };
    }

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

    card.querySelector('.brain-params-opt').onclick = async (e) => {
        e.preventDefault();
        dropdown.classList.remove('active');
        const filename = accId.endsWith('.json') ? accId : `${accId}.json`;
        const freshData = await fetchAccountConfig(filename);
        openBrainParamsModal(accId, freshData || data, saveAndNotify);
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

    card.querySelector('.success-bets-opt').onclick = (e) => {
        e.preventDefault();
        openSuccessBetListModal(accId);
        dropdown.classList.remove('active');
    };

    card.querySelector('.schedule-opt').onclick = (e) => {
        e.preventDefault();
        openScheduleModal(accId, data, saveAndNotify);
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

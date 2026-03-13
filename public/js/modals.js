import { elements, showToast } from './ui.js';
import { state, load2fb } from './api.js';

export function openSettingsModal(config, renderFbMeta, loadLinkedAccounts) {
    // Prepare a flat structure for the specialized modal
    const flatConfig = { ...config };
    if (config.brainParams) {
        Object.assign(flatConfig, config.brainParams);
    }

    const sections = [
        {
            title: 'General Configuration',
            fields: ['run', 'autobet', 'cooldownTimeInSeconds', 'msBetweenSBB2FB', 'successBetListKey'],
            columns: 2
        },
        {
            title: 'EV & Odds (Brain)',
            fields: ['maxEV', 'minEV', 'maxOdds', 'minOdds'],
            columns: 2
        },
        {
            title: 'Market Allowances (Brain)',
            fields: [
                'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 
                'allowFirstHalf', 'allowRegularTime',
                'allowAHMarketParamsRegex', 'allowOUMarketParamsRegex', 'disallowedMatchMinutes'
            ],
            fullWidthFields: ['allowAHMarketParamsRegex', 'allowOUMarketParamsRegex', 'disallowedMatchMinutes'],
            columns: 2
        },
        {
            title: 'Repetition & Limits (Brain)',
            fields: [
                'maxNumberOfRepeatBets', 'maxNumberOfRepeatedEvents', 'maxNumberOfRepeatedEventsAH', 
                'maxNumberOfRepeatedEventsOU', 'maxNumberOfRepeatedEvents1X2', 'maxNumberOfRepeatedEvents1stHalf',
                'sameGameDelayInSeconds'
            ],
            columns: 2
        },
        {
            title: 'Logic & Filtering (Brain)',
            fields: [
                'matchLeagueBoolean', 'whitelistLeague', 'blacklistLeague', 
                'consoleLogPendingBetList', 'fuzzMatchMinScore', 'dataStaleTimeInSeconds'
            ],
            columns: 2
        },
        {
            title: 'Failure Timings (Brain)',
            fields: [
                'timeBetweenTicketFail', 'timeBetweenOddsFail', 'timeBetweenEVFail', 
                'timeBetweenRefMaxStakeFail', 'timeBetweenTargetMaxStakeFail'
            ],
            columns: 2
        }
    ];

    renderSpecializedModal(`Settings: ${state.current2fb}`, flatConfig, async (updatedFlat) => {
        // Unflatten the config
        const newConfig = { ...updatedFlat };
        const brainKeys = [
            'maxEV', 'minEV', 'maxOdds', 'minOdds',
            'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 'allowFirstHalf', 'allowRegularTime',
            'allowAHMarketParamsRegex', 'allowOUMarketParamsRegex', 'disallowedMatchMinutes',
            'maxNumberOfRepeatBets', 'maxNumberOfRepeatedEvents', 'maxNumberOfRepeatedEventsAH', 
            'maxNumberOfRepeatedEventsOU', 'maxNumberOfRepeatedEvents1X2', 'maxNumberOfRepeatedEvents1stHalf',
            'sameGameDelayInSeconds', 'matchLeagueBoolean', 'whitelistLeague', 'blacklistLeague', 
            'consoleLogPendingBetList', 'fuzzMatchMinScore', 'dataStaleTimeInSeconds',
            'timeBetweenTicketFail', 'timeBetweenOddsFail', 'timeBetweenEVFail', 
            'timeBetweenRefMaxStakeFail', 'timeBetweenTargetMaxStakeFail'
        ];

        newConfig.brainParams = {};
        brainKeys.forEach(k => {
            if (updatedFlat[k] !== undefined) {
                newConfig.brainParams[k] = updatedFlat[k];
                delete newConfig[k];
            }
        });

        // Save using the existing save logic structure
        try {
            const res = await fetch(`/api/configs/${state.current2fb}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig, null, 2)
            });
            if (res.ok) {
                showToast('Settings saved');
                if (renderFbMeta && loadLinkedAccounts) {
                    const { loadLinkedAccounts: lla } = await import('./accountManager.js');
                    const { renderFbMeta: rfm } = await import('./render.js');
                    load2fb(state.current2fb, elements, rfm, (cfg) => lla(cfg, (id, data, container, isUsed, type) => {
                        import('./accountManager.js').then(m => m.renderAccountCard(id, data, container, isUsed, type));
                    }));
                }
            }
        } catch (e) {
            showToast('Save failed', 'error');
        }
    }, { sections, modalClass: 'modal-lg' });
}

export function renderSettingsField(key, value, container, parentKey = null) {
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

export async function saveSettingsFromModalSelection(renderFbMeta, loadLinkedAccounts) {
    if (!state.current2fb) return;
    const fbRes = await fetch(`/api/configs/${state.current2fb}`);
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
        const res = await fetch(`/api/configs/${state.current2fb}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fbConfig, null, 2)
        });
        if (res.ok) {
            showToast('Settings saved');
            elements.fbSettingsModal.classList.add('hidden');
            if (renderFbMeta && loadLinkedAccounts) {
                const { loadLinkedAccounts: lla } = await import('./accountManager.js');
                const { renderFbMeta: rfm } = await import('./render.js');
                load2fb(state.current2fb, elements, rfm, (cfg) => lla(cfg, (id, data, container, isUsed, type) => {
                    import('./accountManager.js').then(m => m.renderAccountCard(id, data, container, isUsed, type));
                }));
            }
        }
    } catch (e) {
        showToast('Save failed', 'error');
    }
}

// Specialized Modals

export function openBrainParamsModal(accId, data, onSave) {
    const config = data.brainParams || {};
    const sections = [
        {
            title: 'EV & Odds Parameters',
            fields: ['maxEV', 'minEV', 'maxOdds', 'minOdds', 'maxEVCap'],
            columns: 2
        },
        {
            title: 'Market Allowances',
            fields: [
                'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 
                'allowFirstHalf', 'allowRegularTime',
                'allowAHMarketParamsRegex', 'allowOUMarketParamsRegex', 'timePeriodOfBetPlaced',
                'disallowedMatchMinutes'
            ],
            fullWidthFields: ['allowAHMarketParamsRegex', 'allowOUMarketParamsRegex', 'timePeriodOfBetPlaced', 'disallowedMatchMinutes'],
            columns: 2
        },
        {
            title: 'Vig & Stake Limits',
            fields: [
                'minVig', 'maxVig', 'minRefVig', 'maxRefVig',
                'minTargetMaxStake', 'maxTargetMaxStake', 'minRefMaxStake', 'maxRefMaxStake'
            ],
            columns: 2
        },
        {
            title: 'Repetition & Limits',
            fields: [
                'maxNumberOfRepeatBets', 'maxNumberOfRepeatedEvents', 'maxNumberOfRepeatedEventsAH', 
                'maxNumberOfRepeatedEventsOU', 'maxNumberOfRepeatedEvents1X2', 'maxNumberOfRepeatedEvents1stHalf',
                'sameGameDelay', 'sameGameDelayInSeconds'
            ],
            columns: 2
        },
        {
            title: 'Logic & Filtering',
            fields: [
                'matchLeagueBoolean', 'whitelistLeague', 'blacklistLeague', 
                'consoleLogPendingBetList', 'fuzzMatchMinScore', 'dataStaleTimeInSeconds'
            ],
            columns: 2
        },
        {
            title: 'Failure Timings (Seconds)',
            fields: [
                'timeBetweenTicketFail', 'timeBetweenOddsFail', 'timeBetweenEVFail', 
                'timeBetweenRefMaxStakeFail', 'timeBetweenTargetMaxStakeFail'
            ],
            columns: 2
        },
        {
            title: 'Other Parameters',
            fields: Object.keys(config).filter(k => 
                ![
                    'maxEV', 'minEV', 'maxOdds', 'minOdds', 'maxEVCap',
                    'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 'allowFirstHalf', 'allowRegularTime', 
                    'allowAHMarketParamsRegex', 'allowOUMarketParamsRegex', 'timePeriodOfBetPlaced', 'disallowedMatchMinutes',
                    'maxNumberOfRepeatBets', 'maxNumberOfRepeatedEvents', 'maxNumberOfRepeatedEventsAH', 
                    'maxNumberOfRepeatedEventsOU', 'maxNumberOfRepeatedEvents1X2', 'maxNumberOfRepeatedEvents1stHalf',
                    'sameGameDelay', 'sameGameDelayInSeconds', 'matchLeagueBoolean', 'whitelistLeague', 'blacklistLeague', 
                    'consoleLogPendingBetList', 'fuzzMatchMinScore', 'dataStaleTimeInSeconds',
                    'timeBetweenTicketFail', 'timeBetweenOddsFail', 'timeBetweenEVFail', 
                    'timeBetweenRefMaxStakeFail', 'timeBetweenTargetMaxStakeFail',
                    'minVig', 'maxVig', 'minRefVig', 'maxRefVig',
                    'minTargetMaxStake', 'maxTargetMaxStake', 'minRefMaxStake', 'maxRefMaxStake'
                ].includes(k)
            ),
            columns: 2
        }
    ];

    renderSpecializedModal(`Brain Params: ${accId}`, config, (updatedConfig) => {
        data.brainParams = updatedConfig;
        onSave(data);
    }, { sections, modalClass: 'modal-lg' });
}

export function openStakeInputModal(accId, data, onSave) {
    const config = data.stakeInput || {};
    const fieldsOrder = ['calcStakeMethod', 'capital', 'round', 'maxBet', 'EVForceCut', 'flatRatio', 'kellyMultiplier', 'sameWinRatio'];
    
    renderSpecializedModal(`Stake Input: ${accId}`, config, (updatedConfig) => {
        data.stakeInput = updatedConfig;
        onSave(data);
    }, {
        fieldsOrder,
        customRender: {
            calcStakeMethod: (key, value) => {
                const options = ['flat', 'kelly', 'samewin'];
                return `
                    <label>${key}</label>
                    <select data-key="${key}">
                        ${options.map(opt => `<option value="${opt}" ${opt === value ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                `;
            }
        }
    });
}

export function openBrowserDetailsModal(accId, data, onSave) {
    const config = {
        userAgent: data.user?.userAgent || "",
        modHeaderIP: data.user?.modHeaderIP || "",
        targetBrowserRestartIntervalInMins: data.targetBrowserRestartIntervalInMins || 0
    };
    
    renderSpecializedModal(`Browser Details: ${accId}`, config, (updatedFields) => {
        if (!data.user) data.user = {};
        data.user.userAgent = updatedFields.userAgent;
        data.user.modHeaderIP = updatedFields.modHeaderIP;
        data.targetBrowserRestartIntervalInMins = Number(updatedFields.targetBrowserRestartIntervalInMins);
        onSave(data);
    });
}

function renderSpecializedModal(title, config, onSave, options = {}) {
    elements.settingsModalTitle.textContent = title;
    elements.settingsForm.innerHTML = '';
    
    // Reset modal size
    elements.fbSettingsModal.querySelector('.modal-content').className = 'modal-content';
    if (options.modalClass) {
        elements.fbSettingsModal.querySelector('.modal-content').classList.add(options.modalClass);
    }
    
    if (options.sections) {
        options.sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = 'settings-section';
            
            if (section.title) {
                const sectionTitle = document.createElement('div');
                sectionTitle.className = 'settings-section-title';
                sectionTitle.textContent = section.title;
                sectionDiv.appendChild(sectionTitle);
            }
            
            const fieldsContainer = document.createElement('div');
            fieldsContainer.className = section.columns === 2 ? 'settings-grid-2' : '';
            
            section.fields.forEach(key => {
                const value = config[key];
                if (value === undefined && !section.fields.includes(key)) return;
                
                const fieldDiv = renderFieldContent(key, value, options.customRender);
                if (section.fullWidthFields && section.fullWidthFields.includes(key)) {
                    fieldDiv.classList.add('full-width');
                }
                fieldsContainer.appendChild(fieldDiv);
            });
            
            sectionDiv.appendChild(fieldsContainer);
            elements.settingsForm.appendChild(sectionDiv);
        });
    } else {
        const fields = options.fieldsOrder || Object.keys(config);
        fields.forEach(key => {
            const value = config[key];
            if (value === undefined && !options.fieldsOrder) return;
            const fieldDiv = renderFieldContent(key, value, options.customRender);
            elements.settingsForm.appendChild(fieldDiv);
        });
    }

    elements.saveSettingsBtn.style.display = 'inline-flex';
    elements.saveSettingsBtn.onclick = () => {
        const updated = {};
        elements.settingsForm.querySelectorAll('input, select').forEach(input => {
            const key = input.dataset.key;
            if (input.tagName === 'SELECT') {
                updated[key] = input.value;
            } else {
                updated[key] = input.type === 'checkbox' ? input.checked : 
                              input.type === 'number' ? Number(input.value) : input.value;
            }
        });
        onSave(updated);
        elements.fbSettingsModal.classList.add('hidden');
    };

    elements.fbSettingsModal.classList.remove('hidden');
}

function renderFieldContent(key, value, customRender) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'settings-field';
    
    if (customRender && customRender[key]) {
        fieldDiv.innerHTML = customRender[key](key, value);
    } else {
        const isBool = typeof value === 'boolean';
        fieldDiv.innerHTML = `
            <label title="${key}">${key}</label>
            <input type="${isBool ? 'checkbox' : typeof value === 'number' ? 'number' : 'text'}" 
                   data-key="${key}" 
                   ${isBool && value ? 'checked' : ''} 
                   value="${value === undefined ? '' : value}">
        `;
    }
    return fieldDiv;
}

export async function openLeagueFilterModal() {
    try {
        const res = await fetch('/api/league-filter');
        const config = await res.json();
        
        elements.settingsModalTitle.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; padding-right: 20px;">
                <span>League Filter Configuration</span>
                <button id="edit-league-json-btn" class="btn btn-secondary btn-xs" style="font-size: 0.7rem; padding: 4px 8px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    Edit JSON Directly
                </button>
            </div>
        `;
        elements.settingsForm.innerHTML = '';
        
        // Setup direct edit click
        setTimeout(() => {
            const editBtn = document.getElementById('edit-league-json-btn');
            if (editBtn) {
                editBtn.onclick = () => {
                    elements.fbSettingsModal.classList.add('hidden');
                    window.dispatchEvent(new CustomEvent("loadSingleFile", { detail: 'leagueFilter.json' }));
                };
            }
        }, 0);
        
        Object.keys(config).forEach(accId => {
            const accData = config[accId];
            
            const section = document.createElement('div');
            section.className = 'settings-section';
            section.style.marginBottom = '20px';
            section.style.padding = '15px';
            section.style.background = 'rgba(255,255,255,0.03)';
            section.style.borderRadius = '8px';
            
            const title = document.createElement('div');
            title.className = 'settings-section-title';
            title.style.fontSize = '1rem';
            title.style.display = 'flex';
            title.style.alignItems = 'center';
            title.style.gap = '8px';
            title.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                ${accId}
            `;
            section.appendChild(title);
            
            const grid = document.createElement('div');
            grid.className = 'settings-grid-1';
            
            // Whitelist
            const whiteField = document.createElement('div');
            whiteField.className = 'league-filter-field';
            whiteField.innerHTML = `
                <label>Whitelist</label>
                <textarea data-acc="${accId}" data-type="whitelist">${(accData.whitelist || []).join(', ')}</textarea>
            `;
            grid.appendChild(whiteField);
            
            // Blacklist
            const blackField = document.createElement('div');
            blackField.className = 'league-filter-field';
            blackField.style.marginTop = '15px';
            blackField.innerHTML = `
                <label>Blacklist</label>
                <textarea data-acc="${accId}" data-type="blacklist">${(accData.blacklist || []).join(', ')}</textarea>
            `;
            grid.appendChild(blackField);
            
            section.appendChild(grid);
            elements.settingsForm.appendChild(section);
        });

        // Add "Add New Account" Section at the bottom
        const addSection = document.createElement('div');
        addSection.className = 'settings-section';
        addSection.style.marginTop = '10px';
        addSection.style.border = '1px dashed var(--accent-color)';
        addSection.innerHTML = `
            <div class="settings-section-title" style="color: var(--accent-color);">+ Add New Account</div>
            <div class="settings-grid-1" style="padding: 10px;">
                <div class="settings-field">
                    <label>Account ID (e.g. sbo7)</label>
                    <input type="text" id="new-league-acc-id" placeholder="sbo7" style="width:100%; height:32px; background:#1e1e1e; border:1px solid #333; color:white; padding:4px 8px; border-radius:4px;">
                </div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button id="add-league-acc-btn" class="btn btn-primary btn-xs" style="flex: 1;">Add Row</button>
                </div>
            </div>
        `;
        elements.settingsForm.appendChild(addSection);

        // Logic for "Add Row" button
        setTimeout(() => {
            const addBtn = document.getElementById('add-league-acc-btn');
            const newIdInput = document.getElementById('new-league-acc-id');
            if (addBtn && newIdInput) {
                addBtn.onclick = () => {
                    const newId = newIdInput.value.trim();
                    if (!newId) return showToast('Please enter an account ID', 'error');
                    
                    // Add new row to the UI
                    const newSection = document.createElement('div');
                    newSection.className = 'settings-section';
                    newSection.style.marginBottom = '20px';
                    newSection.style.padding = '15px';
                    newSection.style.background = 'rgba(255,255,255,0.03)';
                    newSection.style.borderRadius = '8px';
                    newSection.innerHTML = `
                        <div class="settings-section-title" style="font-size: 1rem; display: flex; align-items: center; gap: 8px;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                            ${newId}
                        </div>
                        <div class="settings-grid-1">
                            <div class="league-filter-field" style="margin-bottom: 12px;">
                                <label>Whitelist</label>
                                <textarea data-acc="${newId}" data-type="whitelist"></textarea>
                            </div>
                            <div class="league-filter-field">
                                <label>Blacklist</label>
                                <textarea data-acc="${newId}" data-type="blacklist"></textarea>
                            </div>
                        </div>
                    `;
                    // Insert before the "Add New Account" section
                    elements.settingsForm.insertBefore(newSection, addSection);
                    newIdInput.value = '';
                    showToast(`Added row for ${newId}`);
                };
            }
        }, 0);

        elements.saveSettingsBtn.style.display = 'inline-flex';
        elements.saveSettingsBtn.onclick = async () => {
            const updated = {};
            elements.settingsForm.querySelectorAll('textarea').forEach(ta => {
                const acc = ta.dataset.acc;
                const type = ta.dataset.type;
                if (!updated[acc]) updated[acc] = { whitelist: [], blacklist: [] };
                
                const val = ta.value.split(',').map(s => s.trim()).filter(s => s !== '');
                updated[acc][type] = val;
            });
            
            try {
                const saveRes = await fetch('/api/league-filter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updated, null, 2)
                });
                
                if (saveRes.ok) {
                    showToast('League filter saved');
                    elements.fbSettingsModal.classList.add('hidden');
                } else {
                    showToast('Failed to save league filter', 'error');
                }
            } catch (e) {
                showToast('Save error', 'error');
            }
        };

        elements.fbSettingsModal.classList.remove('hidden');
    } catch (err) {
        showToast('Failed to load league filter', 'error');
    }
}

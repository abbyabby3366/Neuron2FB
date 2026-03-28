import { elements, showToast } from './ui.js';
import { state, load2fb } from './api.js';

// In-memory clipboard for brain params copy/paste
let _brainParamsClipboard = null;

export function openSettingsModal(config, renderFbMeta, loadLinkedAccounts) {
    // Prepare a flat structure for the specialized modal
    const flatConfig = { ...config };
    if (config.brainParams) {
        Object.assign(flatConfig, config.brainParams);
    }

    const sections = [
        {
            title: 'General Configuration',
            fields: ['run', 'autobet', 'cooldownTimeInSeconds', 'msBetweenSBB2FB', 'delayBetweenSetupInSeconds', 'successBetListKey', 'openingHours'],
            fullWidthFields: ['openingHours'],
            columns: 2
        },
        {
            title: 'EV & Odds (Brain)',
            fields: ['maxEV', 'minEV', 'oddsRanges'],
            fullWidthFields: ['oddsRanges'],
            columns: 2
        },
        {
            title: 'Market Allowances (Brain)',
            fields: [
                'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 
                'allowFirstHalf', 'allowRegularTime',
                'allowAHMarketParamsRegex', 'allowOverMarketParamsRegex', 'allowUnderMarketParamsRegex', 'disallowedMatchMinutes'
            ],
            fullWidthFields: ['allowAHMarketParamsRegex', 'allowOverMarketParamsRegex', 'allowUnderMarketParamsRegex', 'disallowedMatchMinutes'],
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
        // Start from original config to preserve keys not in the form (targetAccsGroup, referenceAccsGroup, etc.)
        const newConfig = { ...config };
        
        // Apply top-level form field updates
        const topLevelFields = ['run', 'autobet', 'cooldownTimeInSeconds', 'msBetweenSBB2FB', 'delayBetweenSetupInSeconds', 'successBetListKey', 'openingHours'];
        topLevelFields.forEach(k => {
            if (updatedFlat[k] !== undefined) {
                newConfig[k] = updatedFlat[k];
            }
        });

        const brainKeys = [
            'maxEV', 'minEV', 'oddsRanges',
            'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 'allowFirstHalf', 'allowRegularTime',
            'allowAHMarketParamsRegex', 'allowOverMarketParamsRegex', 'allowUnderMarketParamsRegex', 'disallowedMatchMinutes',
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
            }
        });

        // Preserve any remaining brainParams keys not in the form
        if (config.brainParams) {
            Object.keys(config.brainParams).forEach(k => {
                if (newConfig.brainParams[k] === undefined) {
                    newConfig.brainParams[k] = config.brainParams[k];
                }
            });
        }

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
    }, { 
        sections, 
        modalClass: 'modal-lg'
    });
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
            fields: ['maxEV', 'minEV', 'oddsRanges', 'maxEVCap'],
            fullWidthFields: ['oddsRanges'],
            columns: 2
        },
        {
            title: 'Market Allowances',
            fields: [
                'editSpecificMarketLines',
                'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 
                'allowFirstHalf', 'allowRegularTime',
                'allowAHMarketParamsRegex', 'allowOverMarketParamsRegex', 'allowUnderMarketParamsRegex', 'timePeriodOfBetPlaced',
                'disallowedMatchMinutes'
            ],
            fullWidthFields: ['editSpecificMarketLines', 'allowAHMarketParamsRegex', 'allowOverMarketParamsRegex', 'allowUnderMarketParamsRegex', 'timePeriodOfBetPlaced', 'disallowedMatchMinutes'],
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
                    'maxEV', 'minEV', 'oddsRanges', 'maxEVCap',
                    'allowOver', 'allowUnder', 'allowHandicap', 'allow1X2', 'allowFirstHalf', 'allowRegularTime', 
                    'allowAHMarketParamsRegex', 'allowOverMarketParamsRegex', 'allowUnderMarketParamsRegex', 'timePeriodOfBetPlaced', 'disallowedMatchMinutes',
                    'maxNumberOfRepeatBets', 'maxNumberOfRepeatedEvents', 'maxNumberOfRepeatedEventsAH', 
                    'maxNumberOfRepeatedEventsOU', 'maxNumberOfRepeatedEvents1X2', 'maxNumberOfRepeatedEvents1stHalf',
                    'sameGameDelay', 'sameGameDelayInSeconds', 'matchLeagueBoolean', 'whitelistLeague', 'blacklistLeague', 
                    'consoleLogPendingBetList', 'fuzzMatchMinScore', 'dataStaleTimeInSeconds',
                    'timeBetweenTicketFail', 'timeBetweenOddsFail', 'timeBetweenEVFail', 
                    'timeBetweenRefMaxStakeFail', 'timeBetweenTargetMaxStakeFail',
                    'minVig', 'maxVig', 'minRefVig', 'maxRefVig',
                    'minTargetMaxStake', 'maxTargetMaxStake', 'minRefMaxStake', 'maxRefMaxStake',
                    'allowHtOver', 'allowHtUnder', 'allowFtOver', 'allowFtUnder', 'allowHtAh', 'allowFtAh',
                    'htOverMarketParams', 'htUnderMarketParams', 'ftOverMarketParams', 'ftUnderMarketParams',
                    'htAhMarketParams', 'ftAhMarketParams'
                ].includes(k)
            ),
            columns: 2
        }
    ];

    renderSpecializedModal(`Brain Params: ${accId}`, config, (updatedConfig) => {
        // Merge market line params from the sub-modal (they're not form inputs)
        const marketKeys = [
            'allowHtOver', 'allowHtUnder', 'allowFtOver', 'allowFtUnder', 'allowHtAh', 'allowFtAh',
            'htOverMarketParams', 'htUnderMarketParams', 'ftOverMarketParams', 'ftUnderMarketParams',
            'htAhMarketParams', 'ftAhMarketParams'
        ];
        for (const k of marketKeys) {
            if (config[k] !== undefined) updatedConfig[k] = config[k];
        }
        data.brainParams = updatedConfig;
        onSave(data);
    }, { 
        sections, 
        modalClass: 'modal-lg',
        copyPaste: true,
        customRender: {
            editSpecificMarketLines: () => `
                <button type="button" class="btn btn-primary btn-sm" id="open-market-lines-btn2" onclick="document.dispatchEvent(new CustomEvent('openMarketLinesConfig2', { detail: 'brain' }))">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                    Edit Specific Market Lines
                </button>
                <span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 12px; align-self: center;">(Note: The filters here will overlap with the filters below)</span>
            `
        }
    });

    const evtHandler2 = () => {
        openMarketParamsEditorModal(config, (newParams) => {
            Object.assign(config, newParams);
        });
    };
    document.removeEventListener('openMarketLinesConfig2', document._marketLinesConfigHandler2);
    document._marketLinesConfigHandler2 = (e) => {
        if (e.detail === 'brain') evtHandler2();
    };
    document.addEventListener('openMarketLinesConfig2', document._marketLinesConfigHandler2);
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

export function openScheduleModal(accId, data, onSave) {
    const config = {
        openingHours: data.openingHours || []
    };
    
    renderSpecializedModal(`Opening Hours: ${accId}`, config, (updatedFields) => {
        data.openingHours = updatedFields.openingHours;
        onSave(data);
    }, {
        sections: [
            {
                title: 'Operation Schedule',
                fields: ['openingHours'],
                fullWidthFields: ['openingHours'],
                columns: 1
            }
        ]
    });
}

function renderSpecializedModal(title, config, onSave, options = {}) {
    elements.settingsForm.innerHTML = '';
    
    // Reset modal size
    elements.fbSettingsModal.querySelector('.modal-content').className = 'modal-content';
    if (options.modalClass) {
        elements.fbSettingsModal.querySelector('.modal-content').classList.add(options.modalClass);
    }

    // Title with optional copy/paste buttons
    if (options.copyPaste) {
        elements.settingsModalTitle.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;padding-right:20px;">
                <span>${title}</span>
                <div style="display:flex;gap:6px;">
                    <button id="brain-copy-btn" class="btn btn-secondary btn-xs" title="Copy all params" style="display:flex;align-items:center;gap:4px;font-size:0.72rem;padding:4px 8px;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copy
                    </button>
                    <button id="brain-paste-btn" class="btn btn-secondary btn-xs" title="Paste params from clipboard" style="display:flex;align-items:center;gap:4px;font-size:0.72rem;padding:4px 8px;${_brainParamsClipboard ? '' : 'opacity:0.4;cursor:not-allowed;'}">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                        Paste
                    </button>
                </div>
            </div>
        `;
        // Wire up copy/paste after DOM is ready
        setTimeout(() => {
            const copyBtn = document.getElementById('brain-copy-btn');
            const pasteBtn = document.getElementById('brain-paste-btn');

            if (copyBtn) {
                copyBtn.onclick = () => {
                    // Read current form values
                    const snapshot = {};
                    elements.settingsForm.querySelectorAll('input, select').forEach(input => {
                        const key = input.dataset.key;
                        if (!key) return;
                        const isJson = input.dataset.keyJson === 'true';
                        if (input.tagName === 'SELECT') {
                            snapshot[key] = input.value;
                        } else if (isJson) {
                            try { snapshot[key] = JSON.parse(input.value); } catch { snapshot[key] = input.value; }
                        } else {
                            snapshot[key] = input.type === 'checkbox' ? input.checked :
                                            input.type === 'number' ? Number(input.value) : input.value;
                        }
                    });
                    _brainParamsClipboard = snapshot;
                    showToast('Brain params copied to clipboard');
                    // Enable paste button
                    if (pasteBtn) {
                        pasteBtn.style.opacity = '1';
                        pasteBtn.style.cursor = 'pointer';
                    }
                };
            }

            if (pasteBtn) {
                pasteBtn.onclick = () => {
                    if (!_brainParamsClipboard) {
                        showToast('Nothing copied yet', 'error');
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
                                This will <strong style="color:#ef4444;">replace all current brain params</strong> with the copied values. The old values will be lost.
                            </p>
                            <div class="modal-footer">
                                <button id="paste-cancel-btn" class="btn btn-secondary">Cancel</button>
                                <button id="paste-confirm-btn" class="btn btn-danger">Overwrite</button>
                            </div>
                        </div>
                    `;
                    document.body.appendChild(overlay);

                    document.getElementById('paste-cancel-btn').onclick = () => overlay.remove();
                    document.getElementById('paste-confirm-btn').onclick = () => {
                        // Apply clipboard values to form fields
                        const clip = _brainParamsClipboard;
                        elements.settingsForm.querySelectorAll('input, select').forEach(input => {
                            const key = input.dataset.key;
                            if (!key || clip[key] === undefined) return;
                            const isJson = input.dataset.keyJson === 'true';
                            if (input.tagName === 'SELECT') {
                                input.value = clip[key];
                            } else if (isJson) {
                                input.value = typeof clip[key] === 'string' ? clip[key] : JSON.stringify(clip[key]);
                            } else if (input.type === 'checkbox') {
                                input.checked = !!clip[key];
                            } else {
                                input.value = clip[key];
                            }
                        });
                        overlay.remove();
                        showToast('Brain params pasted successfully');
                    };
                };
            }
        }, 0);
    } else {
        elements.settingsModalTitle.textContent = title;
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
            const isJson = input.dataset.keyJson === 'true';
            if (input.tagName === 'SELECT') {
                updated[key] = input.value;
            } else if (isJson) {
                try {
                    updated[key] = JSON.parse(input.value);
                } catch (e) {
                    updated[key] = input.value;
                }
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
    } else if (Array.isArray(value)) {
        const isOddsRanges = key === 'oddsRanges';
        const isOpeningHours = key === 'openingHours';
        const tipContent = isOddsRanges
            ? `<strong>Format:</strong> Array of [min, max] pairs. Odds pass if within <em>any</em> range.<br><strong>Malay:</strong> <code>[[-1,-0.4],[0.35,1]]</code> — negative &amp; positive<br><strong>EU (all):</strong> <code>[[1.01,400]]</code> — single wide range`
            : isOpeningHours
            ? `<strong>Format:</strong> Array of <code>"HHmm-HHmm"</code> time windows (24h).<br><strong>Example:</strong> <code>["0000-0500","0800-1400","1600-0000"]</code><br><strong>Overnight:</strong> <code>["2200-0600"]</code> — crosses midnight<br><strong>Empty []</strong> = always open.`
            : '';
        fieldDiv.innerHTML = `
            <label title="${key}">${key}${tipContent ? `<span class="field-info-wrap"><button type="button" class="field-info-btn" tabindex="-1">ⓘ</button><span class="field-info-tooltip">${tipContent}</span></span>` : ''}</label>
            <input type="text" 
                   data-key="${key}" 
                   data-key-json="true"
                   value='${JSON.stringify(value)}'
                   placeholder='${isOpeningHours ? 'e.g. ["0900-1200","1400-2300"]' : 'e.g. [[-1,-0.4],[0.35,1]]'}'>
        `;
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

export async function openSuccessBetListModal(accId) {
    const modalContent = elements.fbSettingsModal.querySelector('.modal-content');
    modalContent.className = 'modal-content modal-lg';

    elements.settingsModalTitle.textContent = `Success Bet List: ${accId}`;
    elements.settingsForm.innerHTML = '<p class="loading">Loading bets...</p>';
    elements.saveSettingsBtn.style.display = 'none';
    elements.fbSettingsModal.classList.remove('hidden');

    // Get the successBetListKey from the current 2fb config
    let successBetListKey = null;
    try {
        const res = await fetch(`/api/configs/${state.current2fb}`);
        const fbConfig = await res.json();
        successBetListKey = fbConfig.successBetListKey || null;
    } catch (e) { /* ignore */ }

    let currentMode = 'acc'; // 'acc' or 'all'
    let currentPeriod = 'today';
    let currentPage = 1;
    const limit = 50;

    async function fetchAndRender() {
        elements.settingsForm.innerHTML = '<p class="loading">Loading bets...</p>';

        const params = new URLSearchParams({ page: currentPage, limit, period: currentPeriod });
        if (currentMode === 'acc') {
            params.set('acc', accId);
        } else if (successBetListKey) {
            params.set('key', successBetListKey);
        }

        try {
            const res = await fetch(`/api/success-bets?${params}`);
            const result = await res.json();
            renderContent(result);
        } catch (e) {
            elements.settingsForm.innerHTML = '<p style="color:#ef4444;padding:20px;">Failed to load success bet list</p>';
        }
    }

    function renderContent(result) {
        const { data, pagination } = result;
        elements.settingsForm.innerHTML = '';

        // --- Controls bar ---
        const controls = document.createElement('div');
        controls.className = 'sbl-controls';

        // Mode toggle
        const modeToggle = document.createElement('div');
        modeToggle.className = 'sbl-mode-toggle';
        modeToggle.innerHTML = `
            <button class="sbl-mode-btn ${currentMode === 'acc' ? 'active' : ''}" data-mode="acc">This Account</button>
            <button class="sbl-mode-btn ${currentMode === 'all' ? 'active' : ''}" data-mode="all">All (${successBetListKey || 'key'})</button>
        `;
        controls.appendChild(modeToggle);

        // Period filter
        const periodFilter = document.createElement('div');
        periodFilter.className = 'sbl-period-filter';
        const periods = [
            { value: 'today', label: 'Today' },
            { value: 'yesterday', label: 'Yesterday' },
            { value: '7d', label: 'Last 7 Days' },
            { value: 'week', label: 'Last Week' },
            { value: 'month', label: 'Last Month' }
        ];
        periods.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `sbl-period-btn ${currentPeriod === p.value ? 'active' : ''}`;
            btn.textContent = p.label;
            btn.dataset.period = p.value;
            periodFilter.appendChild(btn);
        });
        controls.appendChild(periodFilter);

        elements.settingsForm.appendChild(controls);

        // --- Stats bar ---
        const stats = document.createElement('div');
        stats.className = 'sbl-stats';
        stats.textContent = `${pagination.total} bet${pagination.total !== 1 ? 's' : ''} found`;
        elements.settingsForm.appendChild(stats);

        // --- Table ---
        if (data.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'sbl-empty';
            empty.innerHTML = `
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.3;margin-bottom:12px;">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                <p>No bets found for this period</p>
            `;
            elements.settingsForm.appendChild(empty);
        } else {
            const tableWrap = document.createElement('div');
            tableWrap.className = 'sbl-table-wrap';

            const table = document.createElement('table');
            table.className = 'sbl-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Acc</th>
                        <th>Home</th>
                        <th>Away</th>
                        <th>League</th>
                        <th>Market</th>
                        <th>Param</th>
                        <th>Odds</th>
                        <th>Period</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(bet => `
                        <tr>
                            <td class="sbl-time">${bet.timeScraped || '-'}</td>
                            <td>${bet.acc || '-'}</td>
                            <td>${bet.homeName || '-'}</td>
                            <td>${bet.awayName || '-'}</td>
                            <td class="sbl-league">${bet.leagueName || '-'}</td>
                            <td>${bet.marketIdDescription || '-'}</td>
                            <td>${bet.marketParam ?? '-'}</td>
                            <td class="sbl-odds">${bet.odds ?? '-'}</td>
                            <td>${bet.periodIdDescription || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            tableWrap.appendChild(table);
            elements.settingsForm.appendChild(tableWrap);
        }

        // --- Pagination ---
        if (pagination.totalPages > 1) {
            const paginationDiv = document.createElement('div');
            paginationDiv.className = 'sbl-pagination';
            paginationDiv.innerHTML = `
                <button class="sbl-page-btn" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>← Prev</button>
                <span class="sbl-page-info">Page ${pagination.page} of ${pagination.totalPages}</span>
                <button class="sbl-page-btn" data-page="next" ${currentPage >= pagination.totalPages ? 'disabled' : ''}>Next →</button>
            `;
            elements.settingsForm.appendChild(paginationDiv);
        }

        // --- Event listeners ---
        elements.settingsForm.querySelectorAll('.sbl-mode-btn').forEach(btn => {
            btn.onclick = () => {
                currentMode = btn.dataset.mode;
                currentPage = 1;
                fetchAndRender();
            };
        });

        elements.settingsForm.querySelectorAll('.sbl-period-btn').forEach(btn => {
            btn.onclick = () => {
                currentPeriod = btn.dataset.period;
                currentPage = 1;
                fetchAndRender();
            };
        });

        elements.settingsForm.querySelectorAll('.sbl-page-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.dataset.page === 'prev' && currentPage > 1) currentPage--;
                else if (btn.dataset.page === 'next' && currentPage < pagination.totalPages) currentPage++;
                fetchAndRender();
            };
        });
    }

    await fetchAndRender();
}

// Global delegated tooltip handler — works for all dynamically created tooltips
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.field-info-btn');
    if (btn) {
        e.stopPropagation();
        const wrap = btn.closest('.field-info-wrap');
        // Close other tooltips
        document.querySelectorAll('.field-info-wrap.active').forEach(w => {
            if (w !== wrap) w.classList.remove('active');
        });
        wrap.classList.toggle('active');
        // Position tooltip with fixed coords
        if (wrap.classList.contains('active')) {
            const tooltip = wrap.querySelector('.field-info-tooltip');
            const rect = btn.getBoundingClientRect();
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = (rect.bottom + 6) + 'px';
        }
        return;
    }
    // Close all tooltips when clicking outside
    if (!e.target.closest('.field-info-wrap')) {
        document.querySelectorAll('.field-info-wrap.active').forEach(w => w.classList.remove('active'));
    }
});

export function openMarketParamsEditorModal(config, onSaveParams) {
    const modal = document.getElementById('market-params-modal');
    const container = document.getElementById('market-params-container');
    const saveBtn = document.getElementById('save-market-params-btn');
    const cancelBtn = document.getElementById('cancel-market-params-btn');
    const tabs = modal.querySelectorAll('.tab-btn');

    // Make local copies of the market params
    let localConfig = {
        htOverMarketParams: Array.isArray(config.htOverMarketParams) ? [...config.htOverMarketParams] : [],
        htUnderMarketParams: Array.isArray(config.htUnderMarketParams) ? [...config.htUnderMarketParams] : [],
        ftOverMarketParams: Array.isArray(config.ftOverMarketParams) ? [...config.ftOverMarketParams] : [],
        ftUnderMarketParams: Array.isArray(config.ftUnderMarketParams) ? [...config.ftUnderMarketParams] : [],
        htAhMarketParams: Array.isArray(config.htAhMarketParams) ? [...config.htAhMarketParams] : [],
        ftAhMarketParams: Array.isArray(config.ftAhMarketParams) ? [...config.ftAhMarketParams] : [],
        allowHtOver: config.allowHtOver === true || config.allowHtOver === undefined,
        allowHtUnder: config.allowHtUnder === true || config.allowHtUnder === undefined,
        allowFtOver: config.allowFtOver === true || config.allowFtOver === undefined,
        allowFtUnder: config.allowFtUnder === true || config.allowFtUnder === undefined,
        allowHtAh: config.allowHtAh === true || config.allowHtAh === undefined,
        allowFtAh: config.allowFtAh === true || config.allowFtAh === undefined
    };

    let currentTab = 'htOver';

    const renderGrid = () => {
        const isAh = currentTab.toLowerCase().includes('ah');
        let html = '';
        
        const enabledKey = 'allow' + currentTab.charAt(0).toUpperCase() + currentTab.slice(1);
        const paramsKey = currentTab + 'MarketParams';
        
        // Generate Checkboxes
        let checkboxes = [];
        if (isAh) {
            for (let i = -10; i <= 10; i += 0.25) {
                checkboxes.push(i);
            }
        } else {
            for (let i = 0.5; i <= 10; i += 0.25) {
                checkboxes.push(i);
            }
        }

        const isEnabled = localConfig[enabledKey];
        
        // Convert legacy "Bet All" string to actual numerical values
        if (localConfig[paramsKey].includes("Bet All")) {
            localConfig[paramsKey] = [...checkboxes];
        }
        const selectedParams = localConfig[paramsKey];
        
        const isBetAll = checkboxes.length > 0 && checkboxes.every(val => selectedParams.includes(val));

        // Header Actions
        html += `
            <div class="market-header-actions">
                <div class="market-enable-toggle">
                    <label class="switch switch-sm">
                        <input type="checkbox" id="market-enable-checkbox" ${isEnabled ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                    <span class="toggle-label">Enable Market</span>
                </div>
                <div class="helper-btns ${!isEnabled ? 'disabled-view' : ''}">
                    <button class="btn btn-xs btn-secondary helper-btn" data-action="selectAll">Select All</button>
                    ${isAh ? `
                        <button class="btn btn-xs btn-secondary helper-btn" data-action="selectPos">Select (+)</button>
                        <button class="btn btn-xs btn-secondary helper-btn" data-action="selectNeg">Select (-)</button>
                    ` : ''}
                    <button class="btn btn-xs btn-secondary helper-btn" data-action="clearAll">Clear</button>
                </div>
            </div>
        `;

        html += `<div class="market-params-content ${!isEnabled ? 'disabled-view' : ''}">`;

        // Bet All Checkbox
        html += `
            <div class="market-bet-all-wrapper">
                <label>
                    <input type="checkbox" id="market-bet-all-checkbox" ${isBetAll ? 'checked' : ''}>
                    Bet All Lines
                </label>
            </div>
        `;

        html += `<div class="market-params-grid">`;


        checkboxes.forEach(val => {
            const isChecked = selectedParams.includes(val);
            html += `
                <label class="checkbox-label ${isChecked ? 'is-checked' : ''}">
                    <input type="checkbox" class="market-param-cb" value="${val}" ${isChecked ? 'checked' : ''}>
                    ${val > 0 && isAh ? '+' + val : val}
                </label>
            `;
        });

        html += `</div></div>`;
        container.innerHTML = html;

        // Attach event listeners
        document.getElementById('market-enable-checkbox').addEventListener('change', (e) => {
            localConfig[enabledKey] = e.target.checked;
            renderGrid();
        });

        document.getElementById('market-bet-all-checkbox').addEventListener('change', (e) => {
            if (e.target.checked) {
                localConfig[paramsKey] = [...checkboxes];
            } else {
                localConfig[paramsKey] = [];
            }
            renderGrid();
        });

        container.querySelectorAll('.market-param-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const val = parseFloat(e.target.value);
                if (e.target.checked) {
                    if (!localConfig[paramsKey].includes(val)) localConfig[paramsKey].push(val);
                } else {
                    localConfig[paramsKey] = localConfig[paramsKey].filter(p => p !== val);
                }
                const label = e.target.closest('.checkbox-label');
                if (e.target.checked) label.classList.add('is-checked');
                else label.classList.remove('is-checked');
            });
        });

        container.querySelectorAll('.helper-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'selectAll') {
                    localConfig[paramsKey] = checkboxes;
                } else if (action === 'clearAll') {
                    localConfig[paramsKey] = [];
                } else if (action === 'selectPos') {
                    localConfig[paramsKey] = checkboxes.filter(v => v > 0);
                } else if (action === 'selectNeg') {
                    localConfig[paramsKey] = checkboxes.filter(v => v < 0);
                }
                renderGrid();
            });
        });
    };

    // Reset tabs to initial state (htOver) on every open
    tabs.forEach(t => {
        t.classList.remove('active');
        if (t.dataset.tab === 'htOver') t.classList.add('active');
    });

    tabs.forEach(tab => {
        tab.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            renderGrid();
        };
    });

    renderGrid();
    modal.classList.remove('hidden');

    cancelBtn.onclick = () => {
        modal.classList.add('hidden');
    };

    saveBtn.onclick = () => {
        modal.classList.add('hidden');
        onSaveParams(localConfig);
    };
}

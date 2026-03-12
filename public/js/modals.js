import { elements, showToast } from './ui.js';
import { state, load2fb } from './api.js';

export function openSettingsModal(config) {
    elements.settingsModalTitle.textContent = `Settings: ${state.current2fb}`;
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
    elements.saveSettingsBtn.style.display = 'none'; 
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
            load2fb(state.current2fb, elements, renderFbMeta, loadLinkedAccounts);
        }
    } catch (e) {
        showToast('Save failed', 'error');
    }
}

// Specialized Modals

export function openBrainParamsModal(accId, data, onSave) {
    const config = data.brainParams || {};
    renderSpecializedModal(`Brain Params: ${accId}`, config, (updatedConfig) => {
        data.brainParams = updatedConfig;
        onSave(data);
    });
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
    
    const fields = options.fieldsOrder || Object.keys(config);
    
    fields.forEach(key => {
        const value = config[key];
        if (value === undefined && !options.fieldsOrder) return;
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'settings-field';
        
        if (options.customRender && options.customRender[key]) {
            fieldDiv.innerHTML = options.customRender[key](key, value);
        } else {
            const isBool = typeof value === 'boolean';
            fieldDiv.innerHTML = `
                <label>${key}</label>
                <input type="${isBool ? 'checkbox' : typeof value === 'number' ? 'number' : 'text'}" 
                       data-key="${key}" 
                       ${isBool && value ? 'checked' : ''} 
                       value="${value || ''}">
            `;
        }
        elements.settingsForm.appendChild(fieldDiv);
    });

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

import { state } from './api.js';
import { elements } from './ui.js';
import { openSettingsModal } from './modals.js';

export function renderNav(load2fb) {
    elements.fbTabs.innerHTML = '';
    state.allConfigs.forEach(file => {
        if (file.startsWith('2fb')) {
            const li = document.createElement('li');
            li.textContent = file.replace('.json', '');
            li.dataset.filename = file;
            li.addEventListener('click', () => load2fb(file));
            elements.fbTabs.appendChild(li);
        }
    });
}

export function renderFbMeta(config) {
    elements.fbMetaParams.innerHTML = '';
    elements.fbTitleControls.innerHTML = '';
    
    const is2fb0 = state.current2fb === '2fb0.json';
    
    if (is2fb0) {
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

export function renderErrorCard(accId, container) {
    const card = document.createElement('div');
    card.className = 'acc-card error';
    card.innerHTML = `<span class="acc-id">${accId}</span><p>Config not found</p>`;
    container.appendChild(card);
}

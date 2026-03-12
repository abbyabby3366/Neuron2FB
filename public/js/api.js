import { showToast } from './ui.js';

export const state = {
    allConfigs: [],
    current2fb: null,
    currentFile: null,
    linkedConfigs: {}
};

export async function fetchAllConfigs(renderNav, load2fb) {
    try {
        const res = await fetch('/api/configs');
        state.allConfigs = await res.json();
        renderNav();

        const last2fb = localStorage.getItem('last2fb');
        if (last2fb && state.allConfigs.includes(last2fb)) {
            load2fb(last2fb);
        } else {
            const firstFb = state.allConfigs.find(f => f.startsWith('2fb'));
            if (firstFb) load2fb(firstFb);
        }
    } catch (err) {
        console.error('Error fetching configs:', err);
    }
}

export async function load2fb(filename, elements, renderFbMeta, loadLinkedAccounts) {
    try {
        state.current2fb = filename;
        state.currentFile = null;
        const res = await fetch(`/api/configs/${filename}`);
        const fbConfig = await res.json();
        
        elements.welcomeScreen.classList.add('hidden');
        elements.editorScreen.classList.add('hidden');
        elements.fbView.classList.remove('hidden');
        elements.currentFbName.textContent = filename;
        
        renderFbMeta(fbConfig);
        await loadLinkedAccounts(fbConfig);
        
        localStorage.setItem('last2fb', filename);
        
        document.querySelectorAll('#fb-tabs li').forEach(li => {
            li.classList.toggle('active', li.dataset.filename === filename);
        });
        document.querySelectorAll('#other-config-list li').forEach(li => li.classList.remove('active'));
    } catch (err) {
        console.error('Error loading 2fb:', err);
    }
}

export async function saveAccountConfig(filename, data) {
    try {
        const res = await fetch(`/api/configs/${filename}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data, null, 2)
        });
        return res.ok;
    } catch (err) {
        console.error('Error saving account config:', err);
        return false;
    }
}

export async function fetchAccountConfig(filename) {
    try {
        const res = await fetch(`/api/configs/${filename}`);
        if (res.ok) return await res.json();
    } catch (err) {
        console.error('Error fetching account config:', err);
    }
    return null;
}

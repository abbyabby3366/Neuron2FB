export const elements = {
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
    backFromEditorBtn: document.getElementById('back-from-editor-btn'),
    deleteFbBtn: document.getElementById('delete-fb-btn'),
    leagueFilterBtn: document.getElementById('league-filter-btn'),
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
    // Delete Account Confirmation
    deleteAccConfirmModal: document.getElementById('delete-acc-confirm-modal'),
    deleteAccConfirmInput: document.getElementById('delete-acc-confirm-input'),
    confirmDeleteAccBtn: document.getElementById('confirm-delete-acc-btn'),
    cancelDeleteAccBtn: document.getElementById('cancel-delete-acc-btn'),
    deleteAccFilenameTarget: document.getElementById('delete-acc-filename-target'),
    // Settings Modal
    fbSettingsModal: document.getElementById('fb-settings-modal'),
    settingsForm: document.getElementById('settings-form'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    settingsModalTitle: document.getElementById('settings-modal-title'),
};

export function showToast(message, type = 'success') {
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

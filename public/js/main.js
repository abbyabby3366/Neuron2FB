import { elements, showToast } from "./ui.js";
import { state, fetchAllConfigs, load2fb } from "./api.js";
import { renderNav, renderFbMeta } from "./render.js";
import { loadLinkedAccounts, renderAccountCard } from "./accountManager.js";
import { saveSettingsFromModalSelection } from "./modals.js";

// --- Initialization ---

async function init() {
  // Shared parameters for loaders
  const boundLoad2fb = (filename) =>
    load2fb(filename, elements, renderFbMeta, (cfg) =>
      loadLinkedAccounts(cfg, renderAccountCard),
    );

  // Initial fetch
  await fetchAllConfigs(() => renderNav(boundLoad2fb), boundLoad2fb);

  // Global event listeners
  setupEventListeners(boundLoad2fb);
}

function setupEventListeners(load2fb) {
  elements.saveBtn.addEventListener("click", async () => {
    const content = elements.jsonEditor.value;
    try {
      const json = JSON.parse(content);
      const res = await fetch(`/api/configs/${state.currentFile}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (res.ok) showToast("Saved!");
    } catch (e) {
      showToast("Invalid JSON", "error");
    }
  });

  elements.backFromEditorBtn.addEventListener("click", () => {
    elements.editorScreen.classList.add("hidden");
    const last2fb = localStorage.getItem("last2fb");
    if (last2fb) {
      load2fb(last2fb);
    } else {
      elements.welcomeScreen.classList.remove("hidden");
    }
  });

  elements.new2fbBtn.addEventListener("click", () => {
    elements.newFilenameInput.value = "2fb1.json";
    elements.newConfigModal.classList.remove("hidden");
  });

  elements.cancelModalBtn.addEventListener("click", () =>
    elements.newConfigModal.classList.add("hidden"),
  );

  elements.cancelSettingsBtn.addEventListener("click", () => {
    elements.fbSettingsModal.classList.add("hidden");
    load2fb(state.current2fb);
  });

  elements.saveSettingsBtn.addEventListener("click", () =>
    saveSettingsFromModalSelection(renderFbMeta, (cfg) =>
      loadLinkedAccounts(cfg, renderAccountCard),
    ),
  );

  elements.createConfigBtn.addEventListener("click", async () => {
    const filename = elements.newFilenameInput.value.trim();
    if (!filename) return;
    const res = await fetch(`/api/configs/${filename}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        { run: false, targetAccsGroup: [], referenceAccsGroup: [] },
        null,
        2,
      ),
    });
    if (res.ok) {
      elements.newConfigModal.classList.add("hidden");
      await fetchAllConfigs(() => renderNav(load2fb), load2fb);
      load2fb(filename);
    }
  });

  // Secure Delete
  elements.deleteFbBtn.addEventListener("click", () => {
    elements.deleteFilenameTarget.textContent = state.current2fb;
    elements.deleteConfirmInput.value = "";
    elements.confirmDeleteBtn.disabled = true;
    elements.deleteConfirmModal.classList.remove("hidden");
  });

  elements.deleteConfirmInput.addEventListener("input", (e) => {
    elements.confirmDeleteBtn.disabled = e.target.value !== state.current2fb;
  });

  elements.confirmDeleteBtn.addEventListener("click", async () => {
    const filename = state.current2fb;
    try {
      const res = await fetch(`/api/configs/${filename}`, { method: "DELETE" });
      if (res.ok) {
        elements.deleteConfirmModal.classList.add("hidden");
        showToast(`${filename} deleted`);
        elements.fbView.classList.add("hidden");
        elements.welcomeScreen.classList.remove("hidden");
        await fetchAllConfigs(() => renderNav(load2fb), load2fb);
      }
    } catch (err) {
      showToast("Delete failed", "error");
    }
  });

  elements.cancelDeleteBtn.addEventListener("click", () => {
    elements.deleteConfirmModal.classList.add("hidden");
  });

  // Accordion
  document.addEventListener("click", (e) => {
    const header = e.target.closest(".accordion-header");
    if (header) {
      header.parentElement.classList.toggle("active");
    }
  });

  // Auto-save logic (debounced)
  let saveTimeout = null;
  const debouncedSaveAll = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      if (!state.current2fb) return;
      const res = await fetch(`/api/configs/${state.current2fb}`);
      const fbConfig = await res.json();

      document.querySelectorAll(".fb-input").forEach((input) => {
        const key = input.dataset.key;
        const value =
          input.type === "checkbox" ? input.checked : Number(input.value);
        fbConfig[key] = value;
      });

      const groups = {
        targetAccsGroup: [],
        unusedTargetAccsGroup: [],
        referenceAccsGroup: [],
        unusedReferenceAccsGroup: [],
      };

      document.querySelectorAll(".acc-toggle").forEach((toggle) => {
        const accId = toggle.dataset.acc;
        const groupType = toggle.dataset.group;
        const isUsed = toggle.checked;

        if (groupType === "targetAccsGroup") {
          if (isUsed) groups.targetAccsGroup.push(accId);
          else groups.unusedTargetAccsGroup.push(accId);
        } else if (groupType === "referenceAccsGroup") {
          if (isUsed) groups.referenceAccsGroup.push(accId);
          else groups.unusedReferenceAccsGroup.push(accId);
        }
      });

      Object.assign(fbConfig, groups);

      const saveFbRes = await fetch(`/api/configs/${state.current2fb}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbConfig, null, 2),
      });

      if (saveFbRes.ok) showToast("All changes saved");
    }, 500);
  };

  elements.fbView.addEventListener("change", (e) => {
    if (
      e.target.classList.contains("fb-input") ||
      e.target.classList.contains("acc-toggle")
    ) {
      if (e.target.classList.contains("acc-toggle")) {
        const card = e.target.closest(".acc-card");
        if (card) card.classList.toggle("is-unused", !e.target.checked);
      }
      debouncedSaveAll();
    }
  });

  // Custom events for inter-module communication
  window.addEventListener("loadSingleFile", async (e) => {
    const filename = e.detail;
    state.currentFile = filename;
    state.current2fb = null;
    const res = await fetch(`/api/configs/${filename}`);
    const data = await res.json();

    elements.welcomeScreen.classList.add("hidden");
    elements.fbView.classList.add("hidden");
    elements.editorScreen.classList.remove("hidden");
    elements.currentFilename.textContent = filename;
    elements.jsonEditor.value = JSON.stringify(data, null, 2);

    document.querySelectorAll("#other-config-list li").forEach((li) => {
      li.classList.toggle("active", li.dataset.filename === filename);
    });
    document
      .querySelectorAll("#fb-tabs li")
      .forEach((li) => li.classList.remove("active"));
  });
}

window.addEventListener("load", init);

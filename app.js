(() => {
  "use strict";

  const CONFIG = window.TRACKER_CONFIG || {};
  const OWNER = String(CONFIG.owner || "BiniFn");
  const REPO = String(CONFIG.repo || "one-piece-tracker");
  const BRANCH = String(CONFIG.branch || "main");
  const STATE_PATH = String(CONFIG.statePath || "data/state.json");
  const OWNER_NAME = String(CONFIG.ownerDisplayName || "Bini");
  const API_ROOT = "https://api.github.com";
  const RAW_ROOT = `https://raw.githubusercontent.com/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/${encodeURIComponent(BRANCH)}`;

  // Chapter ranges for the main manga story arcs. Anime-only filler arcs are omitted.
  const ARCS = [
    { saga: "East Blue Saga", name: "Romance Dawn", start: 1, end: 7 },
    { saga: "East Blue Saga", name: "Orange Town", start: 8, end: 21 },
    { saga: "East Blue Saga", name: "Syrup Village", start: 22, end: 41 },
    { saga: "East Blue Saga", name: "Baratie", start: 42, end: 68 },
    { saga: "East Blue Saga", name: "Arlong Park", start: 69, end: 95 },
    { saga: "East Blue Saga", name: "Loguetown", start: 96, end: 100 },
    { saga: "Arabasta Saga", name: "Reverse Mountain", start: 101, end: 105 },
    { saga: "Arabasta Saga", name: "Whisky Peak", start: 106, end: 114 },
    { saga: "Arabasta Saga", name: "Little Garden", start: 115, end: 129 },
    { saga: "Arabasta Saga", name: "Drum Island", start: 130, end: 154 },
    { saga: "Arabasta Saga", name: "Arabasta", start: 155, end: 217 },
    { saga: "Sky Island Saga", name: "Jaya", start: 218, end: 236 },
    { saga: "Sky Island Saga", name: "Skypiea", start: 237, end: 302 },
    { saga: "Water 7 Saga", name: "Long Ring Long Land", start: 303, end: 321 },
    { saga: "Water 7 Saga", name: "Water 7", start: 322, end: 374 },
    { saga: "Water 7 Saga", name: "Enies Lobby", start: 375, end: 430 },
    { saga: "Water 7 Saga", name: "Post-Enies Lobby", start: 431, end: 441 },
    { saga: "Thriller Bark Saga", name: "Thriller Bark", start: 442, end: 489 },
    { saga: "Summit War Saga", name: "Sabaody Archipelago", start: 490, end: 513 },
    { saga: "Summit War Saga", name: "Amazon Lily", start: 514, end: 524 },
    { saga: "Summit War Saga", name: "Impel Down", start: 525, end: 549 },
    { saga: "Summit War Saga", name: "Marineford", start: 550, end: 580 },
    { saga: "Summit War Saga", name: "Post-War", start: 581, end: 597 },
    { saga: "Fish-Man Island Saga", name: "Return to Sabaody", start: 598, end: 602 },
    { saga: "Fish-Man Island Saga", name: "Fish-Man Island", start: 603, end: 653 },
    { saga: "Dressrosa Saga", name: "Punk Hazard", start: 654, end: 699 },
    { saga: "Dressrosa Saga", name: "Dressrosa", start: 700, end: 801 },
    { saga: "Four Emperors Saga", name: "Zou", start: 802, end: 824 },
    { saga: "Four Emperors Saga", name: "Whole Cake Island", start: 825, end: 902 },
    { saga: "Four Emperors Saga", name: "Levely", start: 903, end: 908 },
    { saga: "Four Emperors Saga", name: "Wano Country", start: 909, end: 1057 },
    { saga: "Final Saga", name: "Egghead", start: 1058, end: 1125 },
    { saga: "Final Saga", name: "Elbaph", start: 1126, end: 9999 }
  ];

  const $ = (id) => document.getElementById(id);
  const elements = {
    chapterNumber: $("chapterNumber"), arcName: $("arcName"), sagaName: $("sagaName"),
    arcRange: $("arcRange"), arcProgressFill: $("arcProgressFill"), arcProgressText: $("arcProgressText"),
    currentStatus: $("currentStatus"), lastUpdated: $("lastUpdated"), nextChapter: $("nextChapter"),
    syncState: $("syncState"), syncText: $("syncText"), openAdmin: $("openAdmin"), closeAdmin: $("closeAdmin"),
    adminPanel: $("adminPanel"), lockedView: $("lockedView"), editorView: $("editorView"),
    githubToken: $("githubToken"), unlockButton: $("unlockButton"), unlockMessage: $("unlockMessage"),
    lockButton: $("lockButton"), progressForm: $("progressForm"), chapterInput: $("chapterInput"),
    statusInput: $("statusInput"), saveButton: $("saveButton"), saveMessage: $("saveMessage")
  };

  let currentState = { chapter: 324, status: "Reading Water 7.", updatedAt: null };
  let ownerToken = "";

  function findArc(chapter) {
    return ARCS.find((arc) => chapter >= arc.start && chapter <= arc.end) || null;
  }

  function formatUpdatedAt(value) {
    if (!value) return "Not yet";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not yet";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function render(state) {
    const chapter = Number.isInteger(Number(state.chapter)) && Number(state.chapter) > 0 ? Number(state.chapter) : 324;
    const arc = findArc(chapter);
    const status = typeof state.status === "string" && state.status.trim() ? state.status.trim() : "No status yet.";

    elements.chapterNumber.replaceChildren(document.createTextNode(String(chapter)), Object.assign(document.createElement("span"), { textContent: "." }));
    elements.currentStatus.textContent = status;
    elements.lastUpdated.textContent = formatUpdatedAt(state.updatedAt);
    elements.nextChapter.textContent = String(chapter + 1);

    if (arc) {
      const progress = Math.max(0, Math.min(100, ((chapter - arc.start + 1) / (arc.end - arc.start + 1)) * 100));
      elements.arcName.textContent = arc.name;
      elements.sagaName.textContent = arc.saga;
      elements.arcRange.textContent = `Ch. ${arc.start.toLocaleString()}–${arc.end.toLocaleString()}`;
      elements.arcProgressFill.style.width = `${progress}%`;
      elements.arcProgressText.textContent = `${Math.round(progress)}%`;
    } else {
      elements.arcName.textContent = "Not found";
      elements.sagaName.textContent = "Unknown";
      elements.arcRange.textContent = "No arc data";
      elements.arcProgressFill.style.width = "0%";
      elements.arcProgressText.textContent = "—";
    }
    elements.chapterInput.value = String(chapter);
    elements.statusInput.value = status === "No status yet." ? "" : status;
  }

  function setSync(message, isError = false) {
    elements.syncText.textContent = message;
    elements.syncState.classList.toggle("error", isError);
  }

  function setMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  async function loadState() {
    try {
      const response = await fetch(`${RAW_ROOT}/${STATE_PATH}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Could not read the public data file (${response.status}).`);
      const data = await response.json();
      if (!Number.isInteger(Number(data.chapter)) || Number(data.chapter) < 1) throw new Error("The chapter in data/state.json is invalid.");
      currentState = {
        chapter: Number(data.chapter),
        status: typeof data.status === "string" ? data.status : "No status yet.",
        updatedAt: data.updatedAt || null
      };
      render(currentState);
      setSync("UP TO DATE");
    } catch (error) {
      render(currentState);
      setSync("COULD NOT LOAD LATEST UPDATE", true);
      console.warn("Could not refresh the public One Piece log:", error);
    }
  }

  function openAdminPanel() {
    elements.adminPanel.hidden = false;
    elements.adminPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function lockEditor() {
    ownerToken = "";
    elements.githubToken.value = "";
    elements.lockedView.hidden = false;
    elements.editorView.hidden = true;
    setMessage(elements.unlockMessage, "");
    setMessage(elements.saveMessage, "");
  }

  async function unlockEditor() {
    const token = elements.githubToken.value.trim();
    if (!token) {
      setMessage(elements.unlockMessage, "Enter your GitHub key.", true);
      return;
    }

    elements.unlockButton.disabled = true;
    elements.unlockButton.textContent = "CHECKING…";
    setMessage(elements.unlockMessage, "Checking your key…");

    try {
      const response = await fetch(`${API_ROOT}/user`, {
        headers: {
          "Accept": "application/vnd.github+json",
          "Authorization": `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28"
        },
        cache: "no-store"
      });
      if (!response.ok) {
        if (response.status === 401) throw new Error("GitHub did not accept this key. Check that it is correct and still works.");
        throw new Error(`Could not check the key (${response.status}).`);
      }
      const user = await response.json();
      if (!user.login || user.login.toLowerCase() !== OWNER.toLowerCase()) {
        throw new Error(`Only the ${OWNER} GitHub account can edit this page.`);
      }

      ownerToken = token;
      elements.lockedView.hidden = true;
      elements.editorView.hidden = false;
      elements.chapterInput.value = String(currentState.chapter);
      elements.statusInput.value = currentState.status;
      setMessage(elements.unlockMessage, "");
      setMessage(elements.saveMessage, `Signed in as ${user.login}.`);
    } catch (error) {
      setMessage(elements.unlockMessage, error.message || "Could not check this key.", true);
    } finally {
      elements.unlockButton.disabled = false;
      elements.unlockButton.textContent = "UNLOCK";
    }
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  async function saveProgress(event) {
    event.preventDefault();
    if (!ownerToken) {
      lockEditor();
      setMessage(elements.unlockMessage, "You are locked out. Enter your key again.", true);
      return;
    }

    const chapter = Number(elements.chapterInput.value);
    const status = elements.statusInput.value.trim();
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 9999) {
      setMessage(elements.saveMessage, "Enter a chapter number from 1 to 9999.", true);
      return;
    }
    if (!status || status.length > 120) {
      setMessage(elements.saveMessage, "Enter a status (up to 120 characters).", true);
      return;
    }

    elements.saveButton.disabled = true;
    elements.saveButton.textContent = "SAVING…";
    setMessage(elements.saveMessage, "Saving to GitHub…");

    try {
      const headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${ownerToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      };
      const fileUrl = `${API_ROOT}/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${STATE_PATH.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(BRANCH)}`;
      const existingResponse = await fetch(fileUrl, { headers, cache: "no-store" });
      if (!existingResponse.ok) {
        const problem = await existingResponse.json().catch(() => ({}));
        throw new Error(problem.message || `Could not load the saved data (${existingResponse.status}).`);
      }
      const existingFile = await existingResponse.json();
      const updatedState = {
        chapter,
        status,
        updatedAt: new Date().toISOString()
      };
      const putUrl = `${API_ROOT}/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${STATE_PATH.split("/").map(encodeURIComponent).join("/")}`;
      const updateResponse = await fetch(putUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Update chapter to ${chapter}`,
          content: encodeBase64Utf8(`${JSON.stringify(updatedState, null, 2)}\n`),
          sha: existingFile.sha,
          branch: BRANCH
        })
      });
      if (!updateResponse.ok) {
        const problem = await updateResponse.json().catch(() => ({}));
        if (updateResponse.status === 409 || updateResponse.status === 422) {
          throw new Error("GitHub detected a file conflict. Reload the page and try again.");
        }
        throw new Error(problem.message || `Could not save the update (${updateResponse.status}).`);
      }

      currentState = updatedState;
      render(currentState);
      setSync("SAVED TO GITHUB");
      setMessage(elements.saveMessage, "Saved! Your friends can see the update now.");
    } catch (error) {
      setMessage(elements.saveMessage, error.message || "Could not save the update.", true);
    } finally {
      elements.saveButton.disabled = false;
      elements.saveButton.textContent = 'SAVE';
    }
  }

  elements.openAdmin.addEventListener("click", openAdminPanel);
  elements.closeAdmin.addEventListener("click", () => { elements.adminPanel.hidden = true; });
  elements.unlockButton.addEventListener("click", unlockEditor);
  elements.githubToken.addEventListener("keydown", (event) => { if (event.key === "Enter") unlockEditor(); });
  elements.lockButton.addEventListener("click", lockEditor);
  elements.progressForm.addEventListener("submit", saveProgress);

  render(currentState);
  loadState();
})();

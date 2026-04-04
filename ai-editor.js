const promptEl = document.getElementById("prompt");
const askAiBtn = document.getElementById("askAi");
const applyBtn = document.getElementById("applyEdit");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const contentArea = document.getElementById("contentArea");
let proposedHtml = "";

askAiBtn.onclick = async () => {
  const instruction = promptEl.value.trim();
  if (!instruction) return statusEl.textContent = "Enter an edit instruction first.";
  statusEl.textContent = "Generating edit with Gemma...";
  try {
    const res = await fetch("/api/gemma", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ instruction, currentHtml: contentArea.innerHTML })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Gemma request failed");
    proposedHtml = data.updatedHtml || "";
    previewEl.innerHTML = proposedHtml;
    statusEl.textContent = "Preview ready.";
  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
  }
};

applyBtn.onclick = async () => {
  if (!proposedHtml) return statusEl.textContent = "Generate a preview first.";
  statusEl.textContent = "Submitting edit...";
  try {
    const res = await fetch("/api/commit-edit", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        filePath: "index.html",
        targetSelector: "#contentArea",
        replacementHtml: proposedHtml
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Commit failed");
    contentArea.innerHTML = proposedHtml;
    statusEl.textContent = "Committed successfully.";
  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
  }
};

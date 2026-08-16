const delayInput = document.getElementById("gaDelay");
const saved = document.getElementById("saved");

chrome.storage.local.get("ga_delay_ms").then(({ ga_delay_ms }) => {
  if (ga_delay_ms) delayInput.value = ga_delay_ms;
});

document.getElementById("save").addEventListener("click", async () => {
  await chrome.storage.local.set({ ga_delay_ms: Number(delayInput.value) });
  saved.textContent = "Saved.";
  setTimeout(() => (saved.textContent = ""), 1500);
});

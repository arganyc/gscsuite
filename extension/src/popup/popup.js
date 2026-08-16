import { generateIndexNowKey } from "../modules/indexnow.js";

const send = (msg) => chrome.runtime.sendMessage(msg);
const $ = (id) => document.getElementById(id);

// ---- tabs ----
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $(`panel-${tab.dataset.tab}`).classList.add("active");
  });
});

// ---- license badge ----
async function refreshLicenseBadge() {
  const res = await send({ type: "LICENSE_STATE" });
  const plan = res?.data?.plan || "free";
  $("planBadge").textContent = plan[0].toUpperCase() + plan.slice(1);
}
refreshLicenseBadge();

$("activateLicense").addEventListener("click", async () => {
  const licenseKey = $("licenseKeyInput").value.trim();
  if (!licenseKey) return;
  $("licenseStatus").textContent = "Activating…";
  const res = await send({ type: "LICENSE_ACTIVATE", licenseKey });
  $("licenseStatus").textContent = res.ok ? `Active: ${res.data.plan}` : `Error: ${res.error}`;
  if (res.ok) refreshLicenseBadge();
});

// ---- dashboard ----
async function loadSites() {
  const res = await send({ type: "LIST_SITES" });
  const select = $("siteSelect");
  select.innerHTML = "";
  if (!res.ok) {
    select.innerHTML = `<option>Sign-in required — click a query action</option>`;
    return;
  }
  for (const site of res.data) {
    const opt = document.createElement("option");
    opt.value = site.siteUrl;
    opt.textContent = site.siteUrl;
    select.appendChild(opt);
  }
}
loadSites();

let lastRows = [];
$("runQuery").addEventListener("click", async () => {
  const siteUrl = $("siteSelect").value;
  const startDate = $("dateFrom").value;
  const endDate = $("dateTo").value;
  if (!siteUrl || !startDate || !endDate) return;
  const res = await send({
    type: "QUERY_SEARCH_ANALYTICS",
    siteUrl,
    opts: { startDate, endDate, dimensions: ["query"], rowLimit: 200 },
  });
  const tbody = document.querySelector("#statsTable tbody");
  tbody.innerHTML = "";
  if (!res.ok) {
    tbody.innerHTML = `<tr><td colspan="5">${res.error}</td></tr>`;
    return;
  }
  lastRows = res.data;
  for (const row of res.data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${row.keys?.[0] ?? ""}</td><td>${row.clicks}</td><td>${row.impressions}</td><td>${(row.ctr * 100).toFixed(1)}%</td><td>${row.position.toFixed(1)}</td>`;
    tbody.appendChild(tr);
  }
  $("exportCsv").disabled = res.data.length === 0;
});

$("exportCsv").addEventListener("click", () => {
  const header = "query,clicks,impressions,ctr,position\n";
  const csv = header + lastRows.map((r) => `"${r.keys?.[0] ?? ""}",${r.clicks},${r.impressions},${r.ctr},${r.position}`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: "gsc-export.csv" });
});

// ---- bulk inspect ----
$("runInspect").addEventListener("click", async () => {
  const siteUrl = $("siteSelect").value;
  const urls = $("inspectUrls").value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!siteUrl || !urls.length) return;
  $("inspectResults").innerHTML = "";
  $("inspectProgress").textContent = `0 / ${urls.length}`;
  const res = await send({ type: "BULK_INSPECT", siteUrl, urls });
  if (!res.ok) {
    $("inspectProgress").textContent = `Error: ${res.error}`;
    return;
  }
  $("inspectProgress").textContent = `Done: ${res.data.length} / ${urls.length}`;
  for (const r of res.data) {
    const li = document.createElement("li");
    const verdict = r.result?.indexStatusResult?.verdict || r.error || "unknown";
    li.textContent = `${r.url} — ${verdict}`;
    $("inspectResults").appendChild(li);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "BULK_INSPECT_PROGRESS") {
    $("inspectProgress").textContent = `${msg.progress.done} / ${msg.progress.total} — ${msg.progress.url}`;
  }
  if (msg.type === "INDEXNOW_PROGRESS") {
    $("inProgress").textContent = `Batch ${msg.progress.batch}/${msg.progress.totalBatches} — ${msg.progress.result.ok ? "OK" : msg.progress.result.error}`;
  }
  if (msg.type === "GSC_AUTOMATION_PROGRESS") {
    $("gaProgress").textContent = `${msg.progress.done} / ${msg.progress.total}`;
    const li = document.createElement("li");
    li.textContent = `${msg.progress.result.url} — ${msg.progress.result.ok ? "OK" : msg.progress.result.error || msg.progress.result.note}`;
    $("gaResults").appendChild(li);
  }
});

// ---- IndexNow ----
$("genKey").addEventListener("click", () => {
  const key = generateIndexNowKey();
  $("inKeyValue").value = key;
  const host = $("inKeyHost").value.trim() || "example.com";
  $("keyFileHint").textContent = `https://${host}/${key}.txt`;
});

$("runIndexNow").addEventListener("click", async () => {
  const host = $("inKeyHost").value.trim();
  const key = $("inKeyValue").value.trim();
  const urls = $("inUrls").value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!host || !key || !urls.length) return;
  $("inProgress").textContent = "Submitting…";
  const res = await send({ type: "INDEXNOW_SUBMIT", params: { host, key, urls } });
  $("inProgress").textContent = res.ok ? "Submitted." : `Error: ${res.error}`;
});

// ---- Google unofficial actions ----
async function runGoogleAction(action) {
  const urls = $("gaUrls").value.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!urls.length) return;
  $("gaResults").innerHTML = "";
  $("gaProgress").textContent = `0 / ${urls.length}`;
  const res = await send({ type: "GSC_AUTOMATION_RUN", urls, action });
  if (!res.ok) $("gaProgress").textContent = `Error: ${res.error}`;
}
$("runRequestIndex").addEventListener("click", () => runGoogleAction("index"));
$("runRemoveUrl").addEventListener("click", () => runGoogleAction("remove"));

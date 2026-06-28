const LAYOUT_FORMULAS = {
  side: { text: "H<sub>р</sub> = H<sub>0</sub> − P − C/2", hint: "Боковой подвод — рис. 2.3" },
  top: { text: "H<sub>р</sub> = H<sub>0</sub>", hint: "P не используется" },
  siphon: { text: "H<sub>р</sub> = H<sub>0</sub> − C/2", hint: "P = C автоматически" },
  symmetric: { text: "H<sub>р</sub> = H<sub>0</sub> − C/8", hint: "P = C/2 автоматически" },
};

const WIZARD_STEPS = [
  { id: 1, label: "Отливка" },
  { id: 2, label: "S₁ и ЛС" },
  { id: 3, label: "Hр" },
  { id: 4, label: "Итог" },
];

let alloys = [];
let currentStep = 1;
let s1ManualOverride = false;

function formatRatio(ratio) {
  return ratio.join(":");
}

function mmToM(mm) {
  return mm != null && !Number.isNaN(mm) ? mm / 1000 : undefined;
}

function estimateWallThickness(massKg) {
  return Math.round(Math.max(3, Math.min(40, 8 * Math.cbrt(massKg / 10))) * 10) / 10;
}

function calcStaticHead(layout, h0, c, p) {
  const half = c / 2;
  const map = {
    side: [h0 - p - half, "Hр = H₀ − P − C/2"],
    top: [h0, "Hр = H₀"],
    siphon: [h0 - half, "Hр = H₀ − C/2"],
    symmetric: [h0 - c / 8, "Hр = H₀ − C/8"],
  };
  const [head] = map[layout] || map.side;
  return [Math.max(head, 0.01)];
}

function getAlloy() {
  return alloys.find((a) => a.id === document.getElementById("alloy_id").value);
}

function getMassKg(form) {
  const v = form?.elements?.casting_mass_kg?.value ?? document.querySelector('[name="casting_mass_kg"]')?.value;
  return v !== "" && v != null ? parseFloat(v) : undefined;
}

function getWallMm(form) {
  let wall = num(form, "wall_thickness_mm");
  const mass = getMassKg(form);
  if (wall == null && mass != null) wall = estimateWallThickness(mass);
  return wall;
}

/* ── View mode ── */

function initViewMode() {
  const saved = localStorage.getItem("foundry-view-mode");
  const initial = saved || (window.matchMedia("(min-width: 900px)").matches ? "desktop" : "mobile");
  setViewMode(initial, false);

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => setViewMode(btn.dataset.view, true));
  });
}

function setViewMode(mode, persist) {
  document.body.classList.remove("view-mobile", "view-desktop");
  document.body.classList.add(mode === "desktop" ? "view-desktop" : "view-mobile");
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === mode);
  });
  if (persist) localStorage.setItem("foundry-view-mode", mode);
}

/* ── Wizard ── */

function initWizardProgress() {
  const nav = document.getElementById("wizard-progress");
  nav.innerHTML = WIZARD_STEPS.map(
    (s) => `<button type="button" class="progress-step" data-goto="${s.id}" aria-label="Шаг ${s.id}: ${s.label}">
      <span class="progress-num">${s.id}</span><span class="progress-label">${s.label}</span></button>`
  ).join("");

  nav.querySelectorAll(".progress-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = parseInt(btn.dataset.goto, 10);
      if (target < currentStep || validateStepsUpTo(target - 1)) goToStep(target);
    });
  });

  document.getElementById("wizard-back").addEventListener("click", () => goToStep(currentStep - 1));
  document.getElementById("wizard-next").addEventListener("click", onWizardNext);
}

function goToStep(step) {
  step = Math.max(1, Math.min(WIZARD_STEPS.length, step));
  currentStep = step;

  document.querySelectorAll(".wizard-screen").forEach((el) => {
    el.classList.toggle("is-active", parseInt(el.dataset.step, 10) === step);
  });

  document.querySelectorAll(".progress-step").forEach((btn) => {
    const n = parseInt(btn.dataset.goto, 10);
    btn.classList.toggle("is-current", n === step);
    btn.classList.toggle("is-done", n < step);
  });

  document.getElementById("wizard-back").disabled = step === 1;
  const nextBtn = document.getElementById("wizard-next");
  nextBtn.textContent = step === 3 ? "Рассчитать" : step === 4 ? "Новый расчёт" : "Далее";

  if (step === 2) updateS1Step();
  if (step === 3) updateLayoutDiagram();
  if (step === 4) window.scrollTo({ top: 0, behavior: "smooth" });
  TelegramBridge?.syncWizard(step);
}

function onWizardNext() {
  if (currentStep === 4) {
    goToStep(1);
    return;
  }
  if (!validateStep(currentStep)) return;
  if (currentStep === 3) {
    runCalculation(document.getElementById("calc-form"));
    goToStep(4);
    return;
  }
  goToStep(currentStep + 1);
}

function validateStep(step) {
  const form = document.getElementById("calc-form");
  form.querySelector(".wizard-error")?.remove();

  if (step === 1) {
    const mass = getMassKg(form);
    if (!form.alloy_id.value) return showWizardError("Выберите сплав");
    if (!mass || mass <= 0) return showWizardError("Укажите массу отливки");
  }
  if (step === 2) {
    const s1 = parseFloat(document.getElementById("s1_display").value);
    if (!s1 || s1 <= 0) return showWizardError("Коэффициент S₁ должен быть больше 0");
    document.getElementById("s1_hidden").value = s1;
  }
  if (step === 3) {
    const h0 = parseFloat(document.getElementById("sprue_height_mm").value);
    if (!h0 || h0 < 10) return showWizardError("Укажите H₀ (не менее 10 мм)");
  }
  return true;
}

function validateStepsUpTo(step) {
  for (let s = 1; s <= step; s++) {
    if (!validateStep(s)) return false;
  }
  return true;
}

function showWizardError(msg) {
  const form = document.getElementById("calc-form");
  const div = document.createElement("div");
  div.className = "error wizard-error";
  div.textContent = msg;
  form.querySelector(".wizard-screen.is-active .screen-inner")?.appendChild(div);
  return false;
}

/* ── Alloys & S₁ ── */

function initGatingSystemSelect() {
  const sel = document.getElementById("gating_system_class");
  sel.innerHTML = S1Coefficients.GATING_SYSTEMS.map(
    (g) => `<option value="${g.id}">${g.label}</option>`
  ).join("");
}

function updateAlloyInfo() {
  const alloy = getAlloy();
  const info = document.getElementById("alloy-info");
  if (!alloy) return (info.innerHTML = "");
  const type = alloy.system_type === "constricting" ? "сужающаяся" : "расширяющаяся";
  const minSec = alloy.system_type === "constricting" ? "питатель" : "стояк";
  info.innerHTML = `
    <strong>${alloy.name}</strong> · ${type} система · мин. сечение — <strong>${minSec}</strong><br>
    F<sub>пит</sub>:F<sub>колл</sub>:F<sub>ст</sub> = ${formatRatio(alloy.area_ratio)}`;
  s1ManualOverride = false;
  updateS1Step();
}

function updateS1Step() {
  const alloy = getAlloy();
  const form = document.getElementById("calc-form");
  if (!alloy) return;

  const steelFields = document.getElementById("s1-steel-fields");
  const alFields = document.getElementById("s1-al-fields");
  const genericNote = document.getElementById("s1-generic-note");

  steelFields.hidden = !S1Coefficients.isSteel(alloy.id);
  alFields.hidden = !S1Coefficients.isAluminum(alloy.id);
  genericNote.hidden = S1Coefficients.isSteel(alloy.id) || S1Coefficients.isAluminum(alloy.id);

  if (genericNote.hidden === false) {
    genericNote.textContent =
      "Для этого сплава таблицы S₁ из учебника не приведены — значение оценим по толщине стенки δ (формулы 2.2–2.3) или базе сплава.";
  }

  updateGatingDiagram();
  refreshSuggestedS1(form);
}

function refreshSuggestedS1(form) {
  if (s1ManualOverride) return;
  const alloy = getAlloy();
  if (!alloy) return;

  const mass = getMassKg(form) ?? 10;
  const wallMm = getWallMm(form);
  const result = S1Coefficients.suggestS1(alloy, {
    tempLevel: form.steel_pour_temp?.value ?? "normal",
    supplyMethod: form.steel_supply_method?.value ?? "bottom",
    alMoldKind: form.al_casting_method?.value ?? "sand",
    alLsType: form.al_ls_type?.value ?? "conventional",
    massKg: mass,
    wallMm,
  });

  document.getElementById("s1_display").value = result.value;
  document.getElementById("s1_hidden").value = result.value;
  document.getElementById("s1-source").textContent = result.source;

  if (result.tableId && REFERENCE_IMAGES[result.tableId]) {
    const ref = REFERENCE_IMAGES[result.tableId];
    document.getElementById("s1-table-figure").hidden = false;
    document.getElementById("s1-table-img").src = ref.file;
    document.getElementById("s1-table-caption").textContent = ref.caption;
  } else {
    document.getElementById("s1-table-figure").hidden = true;
  }
}

function updateGatingDiagram() {
  const id = parseInt(document.getElementById("gating_system_class").value, 10);
  const ref = REFERENCE_IMAGES[id];
  if (!ref) return;
  const fig = document.getElementById("ls-diagram");
  const img = document.getElementById("s1-ref-img");
  fig?.classList.add("is-updating");
  img.onload = () => fig?.classList.remove("is-updating");
  img.src = ref.file;
  document.getElementById("s1-ref-caption").textContent = ref.caption;
}

function initAlloys() {
  const select = document.getElementById("alloy_id");
  const groups = {};
  for (const a of alloys) (groups[a.group] ??= []).push(a);
  for (const [group, items] of Object.entries(groups)) {
    const og = document.createElement("optgroup");
    og.label = group;
    for (const a of items) {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      og.appendChild(opt);
    }
    select.appendChild(og);
  }
  updateAlloyInfo();
}

/* ── Geometry ── */

function updateLayoutDiagram() {
  const layout = document.getElementById("gating_layout").value;
  const f = LAYOUT_FORMULAS[layout] || LAYOUT_FORMULAS.side;
  document.getElementById("layout-formula").innerHTML =
    `<strong>Формула:</strong> ${f.text}<br><span class="formula-hint">${f.hint}</span>`;

  const pField = document.getElementById("p-field");
  const pInput = document.getElementById("inlet_distance_mm");
  if (layout === "top") {
    pField.hidden = true;
    pInput.value = 0;
  } else if (layout === "siphon") {
    pField.hidden = true;
    pInput.value = document.getElementById("casting_height_mm").value || 0;
  } else if (layout === "symmetric") {
    pField.hidden = true;
    const c = parseFloat(document.getElementById("casting_height_mm").value) || 0;
    pInput.value = Math.round(c / 2);
  } else {
    pField.hidden = false;
  }
  updateHeadPreview();
}

function updateHeadPreview() {
  const layout = document.getElementById("gating_layout").value;
  const h0 = mmToM(parseFloat(document.getElementById("sprue_height_mm").value)) ?? 0.25;
  const c = mmToM(parseFloat(document.getElementById("casting_height_mm").value)) ?? 0;
  let p = mmToM(parseFloat(document.getElementById("inlet_distance_mm").value)) ?? 0;
  if (layout === "top") p = 0;
  else if (layout === "siphon") p = c;
  else if (layout === "symmetric") p = c / 2;

  const [hr] = calcStaticHead(layout, h0, c, p);
  document.getElementById("head-preview").innerHTML = `
    <span class="result-preview-label">Статический напор</span>
    <span class="result-preview-value">H<sub>р</sub> ≈ <strong>${hr.toFixed(3).replace(".", ",")} м</strong></span>`;
}

/* ── Payload & calculation ── */

function num(form, name) {
  const v = form.elements[name]?.value;
  return v !== undefined && v !== "" ? parseFloat(v) : undefined;
}

function int(form, name) {
  const v = form.elements[name]?.value;
  return v !== undefined && v !== "" ? parseInt(v, 10) : undefined;
}

function buildPayload(form) {
  let wallMm = num(form, "wall_thickness_mm");
  const mass = num(form, "casting_mass_kg");
  const wallAuto = wallMm == null && mass != null;
  if (wallAuto) wallMm = estimateWallThickness(mass);

  const layout = form.gating_layout.value;
  const cMm = num(form, "casting_height_mm") ?? 0;
  let pMm = num(form, "inlet_distance_mm") ?? 0;
  if (layout === "top") pMm = 0;
  else if (layout === "siphon") pMm = cMm;
  else if (layout === "symmetric") pMm = cMm / 2;

  const s1 = num(form, "s1_display") ?? num(form, "pouring_time_coefficient_s");

  const p = {
    alloy_id: form.alloy_id.value,
    casting_mass_kg: mass,
    riser_mass_kg: num(form, "riser_mass_kg") ?? 0,
    castings_per_mold: int(form, "castings_per_mold") ?? 1,
    wall_thickness_mm: wallMm,
    feeder_count: int(form, "feeder_count") ?? 1,
    collector_count: int(form, "collector_count") ?? 1,
    mold_moisture: form.mold_moisture.value,
    filter_screen: form.filter_screen.checked,
    thin_walled: form.thin_walled.checked,
    gating_layout: layout,
    sprue_height_m: mmToM(num(form, "sprue_height_mm")),
    casting_height_m: mmToM(cMm),
    inlet_distance_m: mmToM(pMm),
    pouring_time_method: "auto",
    pouring_time_coefficient_s: s1,
    iterate_mass: true,
    sprue_shape: "circle",
    collector_shape: "trapezoid",
    feeder_shape: "trapezoid",
    feeder_aspect_ratio: 3,
    slag_particle_diameter_mm: 2,
    slag_density_kg_m3: 4500,
    _wall_auto: wallAuto,
    _s1_source: document.getElementById("s1-source")?.textContent ?? "",
  };

  for (const k of ["static_head_m", "pouring_time_s", "discharge_coefficient"]) {
    const v = num(form, k);
    if (v !== undefined) p[k] = v;
  }

  return p;
}

function showResults(r, payload) {
  document.getElementById("results-error").hidden = true;
  document.getElementById("results-loading").hidden = true;

  const autoLines = [];
  if (payload._wall_auto) autoLines.push(`δ ≈ ${payload.wall_thickness_mm} мм (оценка)`);
  if (payload._s1_source) autoLines.push(`S₁: ${payload._s1_source}`);
  autoLines.push(r.pouring_time_formula);
  autoLines.push(r.static_head_formula);

  document.getElementById("auto-info").innerHTML =
    `<p><strong>Автоматически:</strong> ${autoLines.join(" · ")}</p>`;

  document.getElementById("summary").innerHTML = `
    <div class="stat"><div class="stat-label">Сплав</div><div class="stat-value stat-sm">${r.alloy_name}</div></div>
    <div class="stat"><div class="stat-label">Масса</div><div class="stat-value">${r.total_metal_mass_kg} кг</div></div>
    <div class="stat"><div class="stat-label">τ</div><div class="stat-value">${r.pouring_time_s} с</div></div>
    <div class="stat"><div class="stat-label">Hр</div><div class="stat-value">${r.static_head_m} м</div></div>
    <div class="stat"><div class="stat-label">μ</div><div class="stat-value">${r.discharge_coefficient}</div></div>
    <div class="stat"><div class="stat-label">Fпит:Fколл:Fст</div><div class="stat-value stat-sm">${r.area_ratio}</div></div>`;

  const sections = [
    { name: "① Воронка", flow: r.funnel.mass_flow_kg_s, dim: r.funnel.description },
    { name: "② Стояк", area: r.sprue.area_mm2, dim: r.sprue.dimensions.description, v: r.sprue.dimensions.velocity_m_s },
    { name: "③ Коллектор", area: r.collector.area_mm2, dim: r.collector.dimensions.description, v: r.collector.dimensions.velocity_m_s },
    { name: "④ Питатель", area: r.feeder_single.area_mm2, dim: r.feeder_single.dimensions.description, v: r.feeder_single.dimensions.velocity_m_s },
    { name: "④ Все питатели", area: r.feeder_total.area_mm2, dim: r.feeder_total.dimensions.description },
  ];
  document.getElementById("sections").innerHTML = sections.map((s) => `
    <div class="section-item"><h3>${s.name}</h3>
    ${s.flow != null
      ? `<div class="section-area section-flow">${s.flow} кг/с</div>`
      : `<div class="section-area">${s.area.toLocaleString("ru-RU")} мм²</div>`}
    <div class="section-dim">${s.dim}${s.v != null ? ` · ${s.v} м/с` : ""}</div></div>`).join("");

  document.getElementById("extra").innerHTML = `
    <div class="extra-grid">
      <div><span>Стояк</span><strong>${r.velocities.sprue_m_s} м/с</strong></div>
      <div><span>Коллектор</span><strong>${r.velocities.collector_m_s} м/с</strong></div>
      <div><span>Питатель</span><strong>${r.velocities.feeder_m_s} м/с</strong></div>
      <div><span>Ø стояка</span><strong>${r.sprue_bottom_diameter_mm} / ${r.sprue_top_diameter_mm} мм</strong></div>
      <div><span>L коллектора</span><strong>${r.collector_min_length_mm} мм</strong></div>
    </div>`;

  const m = r.mass_breakdown;
  document.getElementById("mass").innerHTML = `
    <div class="extra-grid">
      <div><span>Питатели</span><strong>${m.feeder_kg} кг</strong></div>
      <div><span>Коллектор</span><strong>${m.collector_kg} кг</strong></div>
      <div><span>Стояк</span><strong>${m.sprue_kg} кг</strong></div>
      <div><span>Всего ЛС</span><strong>${m.total_kg} кг</strong></div>
    </div>
    <p class="field-hint">Итераций: ${m.iteration_count}</p>`;

  document.getElementById("notes").innerHTML = r.notes.length
    ? r.notes.map((n) => `<p class="${n.startsWith("⚠") ? "warning" : ""}">${n}</p>`).join("")
    : "";
}

function runCalculation(form) {
  form.querySelector(".wizard-error")?.remove();
  document.getElementById("results-error").hidden = true;
  document.getElementById("results-loading").hidden = false;

  const payload = buildPayload(form);
  const displayPayload = { ...payload };
  delete payload._wall_auto;
  delete payload._s1_source;

  fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error((await res.json()).detail || "Ошибка расчёта");
      return res.json();
    })
    .then((r) => showResults(r, displayPayload))
    .catch((err) => {
      document.getElementById("results-loading").hidden = true;
      const errEl = document.getElementById("results-error");
      errEl.textContent = err.message;
      errEl.hidden = false;
    });
}

/* ── Init ── */

function bindEvents() {
  document.getElementById("alloy_id").addEventListener("change", updateAlloyInfo);
  document.getElementById("gating_layout").addEventListener("change", updateLayoutDiagram);
  document.getElementById("gating_system_class").addEventListener("change", updateGatingDiagram);

  const s1Inputs = ["steel_pour_temp", "steel_supply_method", "al_casting_method", "al_ls_type"];
  s1Inputs.forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      s1ManualOverride = false;
      refreshSuggestedS1(document.getElementById("calc-form"));
    });
  });

  document.querySelector('[name="casting_mass_kg"]')?.addEventListener("input", () => {
    s1ManualOverride = false;
    refreshSuggestedS1(document.getElementById("calc-form"));
  });
  document.getElementById("wall_thickness_mm")?.addEventListener("input", () => {
    s1ManualOverride = false;
    refreshSuggestedS1(document.getElementById("calc-form"));
  });

  document.getElementById("s1_display")?.addEventListener("input", () => {
    s1ManualOverride = true;
    document.getElementById("s1_hidden").value = document.getElementById("s1_display").value;
  });

  ["sprue_height_mm", "casting_height_mm", "inlet_distance_mm"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      const layout = document.getElementById("gating_layout").value;
      if (layout === "siphon") {
        document.getElementById("inlet_distance_mm").value = document.getElementById("casting_height_mm").value;
      } else if (layout === "symmetric") {
        const c = parseFloat(document.getElementById("casting_height_mm").value) || 0;
        document.getElementById("inlet_distance_mm").value = Math.round(c / 2);
      }
      updateHeadPreview();
    });
  });

  document.getElementById("calc-form").addEventListener("submit", (e) => e.preventDefault());
}

async function loadAlloys() {
  alloys = await (await fetch("/api/alloys")).json();
  initAlloys();
  goToStep(1);
  updateLayoutDiagram();
}

initViewMode();
TelegramBridge?.init({
  onNext: () => document.getElementById("wizard-next").click(),
  onBack: () => {
    if (currentStep > 1) document.getElementById("wizard-back").click();
    else window.Telegram?.WebApp?.close();
  },
});
initWizardProgress();
initGatingSystemSelect();
bindEvents();
loadAlloys();

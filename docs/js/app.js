const LAYOUT_FORMULAS = {
  side: { text: "H<sub>р</sub> = H<sub>0</sub> − P − C/2", hint: "Боковой подвод — стандартная схема из рис. 2.3" },
  top: { text: "H<sub>р</sub> = H<sub>0</sub>", hint: "P не используется (металл заходит сверху)" },
  siphon: { text: "H<sub>р</sub> = H<sub>0</sub> − C/2", hint: "P = C — автоматически" },
  symmetric: { text: "H<sub>р</sub> = H<sub>0</sub> − C/8", hint: "P = C/2 — автоматически" },
};

function formatRatio(ratio) {
  return ratio.join(":");
}

function mmToM(mm) {
  return mm != null && !Number.isNaN(mm) ? mm / 1000 : undefined;
}

function estimateWallThickness(massKg) {
  return Math.round(Math.max(3, Math.min(40, 8 * Math.cbrt(massKg / 10))) * 10) / 10;
}

function updateAlloyInfo() {
  const alloy = ALLOYS.find((a) => a.id === document.getElementById("alloy_id").value);
  const info = document.getElementById("alloy-info");
  if (!alloy) return (info.innerHTML = "");
  const type = alloy.system_type === "constricting" ? "сужающаяся" : "расширяющаяся";
  const minSec = alloy.system_type === "constricting" ? "питатель" : "стояк";
  info.innerHTML = `
    <strong>${alloy.name}</strong><br>
    ${type} система · минимальное сечение — <strong>${minSec}</strong><br>
    Соотношение F<sub>пит</sub>:F<sub>колл</sub>:F<sub>ст</sub> = ${formatRatio(alloy.area_ratio)}`;

  const coeffId = getCoeffTableId(alloy.id);
  if (coeffId) {
    const sel = document.getElementById("help-image-select");
    if (sel) {
      sel.value = String(coeffId);
      updateHelpImage();
    }
  }
}

function initHelpSelect() {
  const sel = document.getElementById("help-image-select");
  if (!sel) return;
  sel.innerHTML = REFERENCE_IMAGE_LIST.map(
    (item) => `<option value="${item.id}">${item.label}</option>`
  ).join("");
  sel.value = "7";
  updateHelpImage();
}

function updateHelpImage() {
  const id = parseInt(document.getElementById("help-image-select").value, 10);
  const ref = REFERENCE_IMAGES[id];
  if (!ref) return;
  document.getElementById("help-image").src = ref.file;
  document.getElementById("help-image").alt = ref.caption;
  document.getElementById("help-caption").textContent = ref.caption;
}

function initAlloys() {
  const select = document.getElementById("alloy_id");
  const groups = {};
  for (const a of ALLOYS) (groups[a.group] ??= []).push(a);
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

function updateLayoutDiagram() {
  const layout = document.getElementById("gating_layout").value;
  const f = LAYOUT_FORMULAS[layout] || LAYOUT_FORMULAS.side;
  document.getElementById("layout-formula").innerHTML =
    `<strong>Формула:</strong> ${f.text}<br><span style="color:var(--muted);font-size:0.85rem">${f.hint}</span>`;

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

  const [hr] = FoundryEngine.calcStaticHead(layout, h0, c, p);
  document.getElementById("head-preview").innerHTML = `
    <span class="result-preview-label">Получится статический напор</span>
    <span class="result-preview-value">H<sub>р</sub> ≈ <strong>${hr.toFixed(3).replace(".", ",")} м</strong></span>`;
}

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
    steel_wall_type: form.steel_wall_type?.value ?? "thick",
    feeder_attachment: form.feeder_attachment?.value ?? "to_riser",
    gating_layout: layout,
    sprue_height_m: mmToM(num(form, "sprue_height_mm")),
    casting_height_m: mmToM(cMm),
    inlet_distance_m: mmToM(pMm),
    pouring_time_method: "auto",
    iterate_mass: true,
    sprue_shape: form.sprue_shape?.value ?? "circle",
    sprue_taper: form.sprue_taper?.value ?? "constricting_down",
    sprue_draft_mm: num(form, "sprue_draft_mm") ?? 5,
    collector_shape: form.collector_shape?.value ?? "trapezoid",
    feeder_shape: form.feeder_shape?.value ?? "trapezoid",
    feeder_aspect_ratio: num(form, "feeder_aspect_ratio") ?? 3,
    slag_particle_diameter_mm: 2,
    slag_density_kg_m3: 4500,
    _wall_auto: wallAuto,
  };

  for (const k of ["static_head_m", "pouring_time_s", "discharge_coefficient", "overrun_factor", "area_ratio_feeder", "area_ratio_collector", "area_ratio_sprue"]) {
    const v = num(form, k);
    if (v !== undefined) p[k] = k === "overrun_factor" ? v / 100 : v;
  }
  const tol = num(form, "iteration_tolerance");
  if (tol !== undefined) p.iteration_tolerance = tol / 100;

  return p;
}

function showResults(r, payload) {
  document.getElementById("results-placeholder").hidden = true;
  document.getElementById("results-body").hidden = false;

  const autoLines = [];
  if (payload._wall_auto) autoLines.push(`Толщина стенки δ ≈ ${payload.wall_thickness_mm} мм (оценка по массе)`);
  autoLines.push(`Время заливки: ${r.pouring_time_formula}`);
  autoLines.push(`Статический напор: ${r.static_head_formula}`);
  document.getElementById("auto-info").innerHTML =
    `<p><strong>Рассчитано автоматически:</strong> ${autoLines.join(" · ")}</p>`;

  document.getElementById("summary").innerHTML = `
    <div class="stat"><div class="stat-label">Сплав</div><div class="stat-value" style="font-size:0.85rem">${r.alloy_name}</div></div>
    <div class="stat"><div class="stat-label">Масса металла</div><div class="stat-value">${r.total_metal_mass_kg} кг</div></div>
    <div class="stat"><div class="stat-label">Время заливки τ</div><div class="stat-value">${r.pouring_time_s} с</div></div>
    <div class="stat"><div class="stat-label">Напор Hр</div><div class="stat-value">${r.static_head_m} м</div></div>
    <div class="stat"><div class="stat-label">Коэфф. μ</div><div class="stat-value">${r.discharge_coefficient}</div></div>
    <div class="stat"><div class="stat-label">Fпит:Fколл:Fст</div><div class="stat-value" style="font-size:0.95rem">${r.area_ratio}</div></div>`;

  const sections = [
    { name: "① Воронка", flow: r.funnel.mass_flow_kg_s, dim: r.funnel.description },
    { name: "② Стояк", area: r.sprue.area_mm2, dim: r.sprue.dimensions.description, v: r.sprue.dimensions.velocity_m_s },
    { name: "③ Коллектор", area: r.collector.area_mm2, dim: r.collector.dimensions.description, v: r.collector.dimensions.velocity_m_s },
    { name: "④ Питатель (один)", area: r.feeder_single.area_mm2, dim: r.feeder_single.dimensions.description, v: r.feeder_single.dimensions.velocity_m_s },
    { name: "④ Питатели (все)", area: r.feeder_total.area_mm2, dim: r.feeder_total.dimensions.description },
  ];
  document.getElementById("sections").innerHTML = sections.map((s) => `
    <div class="section-item"><h3>${s.name}</h3>
    ${s.flow != null
      ? `<div class="section-area section-flow">${s.flow} кг/с</div>`
      : `<div class="section-area">${s.area.toLocaleString("ru-RU")} мм²</div>`}
    <div class="section-dim">${s.dim}${s.v != null ? ` · скорость ${s.v} м/с` : ""}</div></div>`).join("");

  document.getElementById("extra").innerHTML = `
    <div class="extra-grid">
      <div><span>Скорость в стояке</span><strong>${r.velocities.sprue_m_s} м/с</strong></div>
      <div><span>В коллекторе</span><strong>${r.velocities.collector_m_s} м/с</strong></div>
      <div><span>В питателе</span><strong>${r.velocities.feeder_m_s} м/с</strong></div>
      <div><span>Ø стояка низ / верх</span><strong>${r.sprue_bottom_diameter_mm} / ${r.sprue_top_diameter_mm} мм</strong></div>
      <div><span>Мин. длина коллектора</span><strong>${r.collector_min_length_mm} мм</strong></div>
    </div>`;

  const m = r.mass_breakdown;
  document.getElementById("mass").innerHTML = `
    <div class="extra-grid">
      <div><span>Питатели</span><strong>${m.feeder_kg} кг</strong></div>
      <div><span>Коллектор</span><strong>${m.collector_kg} кг</strong></div>
      <div><span>Стояк</span><strong>${m.sprue_kg} кг</strong></div>
      <div><span>Всего ЛС</span><strong>${m.total_kg} кг</strong></div>
    </div>
    <p class="field-hint" style="margin:0.5rem 0 0">Уточнено за ${m.iteration_count} итераций (масса металла + литники)</p>`;

  document.getElementById("notes").innerHTML = r.notes.length
    ? r.notes.map((n) => `<p class="${n.startsWith("⚠") ? "warning" : ""}">${n}</p>`).join("")
    : "";

  document.getElementById("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function runCalculation(form) {
  form.querySelector(".error")?.remove();
  try {
    const payload = buildPayload(form);
    showResults(FoundryEngine.calculateGatingSystem(payload, ALLOYS), payload);
  } catch (err) {
    const div = document.createElement("div");
    div.className = "error";
    div.textContent = err.message;
    form.appendChild(div);
  }
}

document.getElementById("alloy_id").addEventListener("change", updateAlloyInfo);
document.getElementById("gating_layout").addEventListener("change", updateLayoutDiagram);
document.getElementById("help-image-select").addEventListener("change", updateHelpImage);
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

document.getElementById("calc-form").addEventListener("submit", (e) => {
  e.preventDefault();
  runCalculation(e.target);
});

initAlloys();
initHelpSelect();
updateLayoutDiagram();

const LAYOUT_CAPTIONS = {
  side: "Рис. 2.3 · боковая подводка: H<sub>р</sub> = H<sub>0</sub> − P − C/2",
  top: "Рис. 2.3 · верхняя подводка: H<sub>р</sub> = H<sub>0</sub>",
  siphon: "Рис. 2.3 · сифонная подводка: H<sub>р</sub> = H<sub>0</sub> − C/2",
  symmetric: "Рис. 2.3 · симметричная: H<sub>р</sub> = H<sub>0</sub> − C/8",
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
  info.innerHTML = `<strong>${alloy.name}</strong> · ${type}<br>ρ=${alloy.density_kg_m3} · μ=${alloy.discharge_coefficient_wet}/${alloy.discharge_coefficient_dry} · ${formatRatio(alloy.area_ratio)}${alloy.notes ? `<br><em>${alloy.notes}</em>` : ""}`;
  updateCoeffTable(alloy.id);
}

function updateCoeffTable(alloyId) {
  const figure = document.getElementById("coeff-table-figure");
  const tableId = getCoeffTableId(alloyId);
  if (!tableId) {
    figure.hidden = true;
    return;
  }
  const ref = REFERENCE_IMAGES[tableId];
  figure.hidden = false;
  document.getElementById("ref-coeff-img").src = ref.file;
  document.getElementById("ref-coeff-img").alt = ref.caption;
  document.getElementById("ref-coeff-caption").textContent = ref.caption;
}

function updateSystemIllustration() {
  const id = parseInt(document.getElementById("system-illustration").value, 10);
  const ref = REFERENCE_IMAGES[id];
  document.getElementById("ref-system-img").src = ref.file;
  document.getElementById("ref-system-img").alt = ref.caption;
  document.getElementById("system-caption").textContent = ref.caption;
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
  const headRef = REFERENCE_IMAGES[7];
  document.getElementById("ref-head-img").src = headRef.file;
  document.getElementById("layout-caption").innerHTML =
    `${headRef.caption} · ${LAYOUT_CAPTIONS[layout] || LAYOUT_CAPTIONS.side}`;

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

  const [hr, formula] = FoundryEngine.calcStaticHead(layout, h0, c, p);
  document.getElementById("head-preview").innerHTML =
    `Расчётный H<sub>р</sub> ≈ <strong>${hr.toFixed(3).replace(".", ",")} м</strong> · ${formula}`;
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

function renderResults(r, payload) {
  document.getElementById("results").hidden = false;

  const autoParts = [];
  if (payload._wall_auto) autoParts.push(`δ ≈ ${payload.wall_thickness_mm} мм (оценка по массе)`);
  autoParts.push(`τ: ${r.pouring_time_formula}`);
  autoParts.push(`H<sub>р</sub>: ${r.static_head_formula}`);
  document.getElementById("auto-info").innerHTML = `<p>Автоматически: ${autoParts.join(" · ")}</p>`;

  document.getElementById("summary").innerHTML = `
    <div class="stat"><div class="stat-label">Сплав</div><div class="stat-value">${r.alloy_name}</div></div>
    <div class="stat"><div class="stat-label">G total</div><div class="stat-value">${r.total_metal_mass_kg} кг</div></div>
    <div class="stat"><div class="stat-label">τ</div><div class="stat-value">${r.pouring_time_s} с</div></div>
    <div class="stat"><div class="stat-label">Hр</div><div class="stat-value">${r.static_head_m} м</div></div>
    <div class="stat"><div class="stat-label">μ</div><div class="stat-value">${r.discharge_coefficient}</div></div>
    <div class="stat"><div class="stat-label">Fпит:Fколл:Fст</div><div class="stat-value">${r.area_ratio}</div></div>`;
  document.getElementById("extra").innerHTML = `
    <div class="extra-grid">
      <div><span>ν стояк</span><strong>${r.velocities.sprue_m_s} м/с</strong></div>
      <div><span>ν коллектор</span><strong>${r.velocities.collector_m_s} м/с</strong></div>
      <div><span>ν питатель</span><strong>${r.velocities.feeder_m_s} м/с</strong></div>
      <div><span>dст / dст.в</span><strong>${r.sprue_bottom_diameter_mm} / ${r.sprue_top_diameter_mm} мм</strong></div>
      <div><span>lколл min</span><strong>${r.collector_min_length_mm} мм</strong></div>
    </div>`;
  const sections = [
    { name: r.funnel.name, flow: r.funnel.mass_flow_kg_s, dim: r.funnel.description },
    { name: r.sprue.name, area: r.sprue.area_mm2, dim: r.sprue.dimensions.description, v: r.sprue.dimensions.velocity_m_s },
    { name: r.collector.name, area: r.collector.area_mm2, dim: r.collector.dimensions.description, v: r.collector.dimensions.velocity_m_s },
    { name: r.feeder_single.name, area: r.feeder_single.area_mm2, dim: r.feeder_single.dimensions.description, v: r.feeder_single.dimensions.velocity_m_s },
    { name: r.feeder_total.name, area: r.feeder_total.area_mm2, dim: r.feeder_total.dimensions.description },
  ];
  document.getElementById("sections").innerHTML = sections.map((s) => `
    <div class="section-item"><h3>${s.name}</h3>
    ${s.flow != null ? `<div class="section-area section-flow">${s.flow} кг/с</div>` : `<div class="section-area">${s.area.toLocaleString("ru-RU")} мм²</div>`}
    <div class="section-dim">${s.dim}${s.v != null ? ` · ν=${s.v} м/с` : ""}</div></div>`).join("");
  const m = r.mass_breakdown;
  document.getElementById("mass").innerHTML = `<h3 class="mass-title">Gл.с (${m.iteration_count} итер.)</h3>
    <div class="extra-grid">
      <div><span>Питатели</span><strong>${m.feeder_kg} кг</strong></div>
      <div><span>Коллектор</span><strong>${m.collector_kg} кг</strong></div>
      <div><span>Стояк</span><strong>${m.sprue_kg} кг</strong></div>
      <div><span>Σ</span><strong>${m.total_kg} кг</strong></div>
    </div>`;
  document.getElementById("notes").innerHTML = r.notes.map((n) => `<p class="${n.startsWith("⚠") ? "warning" : ""}">${n}</p>`).join("");
}

function runCalculation(form) {
  form.querySelector(".error")?.remove();
  try {
    const payload = buildPayload(form);
    renderResults(FoundryEngine.calculateGatingSystem(payload, ALLOYS), payload);
  } catch (err) {
    const div = document.createElement("div");
    div.className = "error";
    div.textContent = err.message;
    form.appendChild(div);
  }
}

document.getElementById("alloy_id").addEventListener("change", updateAlloyInfo);
document.getElementById("gating_layout").addEventListener("change", updateLayoutDiagram);
document.getElementById("system-illustration").addEventListener("change", updateSystemIllustration);
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
updateLayoutDiagram();
updateSystemIllustration();

let alloys = [];

async function loadAlloys() {
  alloys = await (await fetch("/api/alloys")).json();
  const select = document.getElementById("alloy_id");
  select.innerHTML = "";
  const groups = {};
  for (const a of alloys) {
    (groups[a.group] ??= []).push(a);
  }
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

function formatRatio(ratio) {
  return ratio.map((v) => (Number.isInteger(v) ? v : v)).join(":");
}

function updateAlloyInfo() {
  const alloy = alloys.find((a) => a.id === document.getElementById("alloy_id").value);
  const info = document.getElementById("alloy-info");
  if (!alloy) return (info.innerHTML = "");
  const type = alloy.system_type === "constricting" ? "сужающаяся" : "расширяющаяся";
  const smallest = alloy.system_type === "constricting" ? "питатель" : "стояк";
  info.innerHTML = `
    <strong>${alloy.name}</strong> · ${type}<br>
    ρ=${alloy.density_kg_m3} · μ=${alloy.discharge_coefficient_wet}/${alloy.discharge_coefficient_dry}
    · Fпит:Fколл:Fст=${formatRatio(alloy.area_ratio)} · min сеч.=${smallest}
    ${alloy.notes ? `<br><em>${alloy.notes}</em>` : ""}`;
}

function num(form, name) {
  const v = form.elements[name]?.value;
  return v !== undefined && v !== "" ? parseFloat(v) : undefined;
}

function int(form, name) {
  const v = form.elements[name]?.value;
  return v !== undefined && v !== "" ? parseInt(v, 10) : undefined;
}

function checked(form, name) {
  return form.elements[name]?.checked === true;
}

function buildPayload(form) {
  const payload = {
    alloy_id: form.alloy_id.value,
    casting_mass_kg: num(form, "casting_mass_kg"),
    riser_mass_kg: num(form, "riser_mass_kg") ?? 0,
    castings_per_mold: int(form, "castings_per_mold") ?? 1,
    wall_thickness_mm: num(form, "wall_thickness_mm"),
    feeder_count: int(form, "feeder_count") ?? 1,
    collector_count: int(form, "collector_count") ?? 1,
    mold_moisture: form.mold_moisture.value,
    filter_screen: checked(form, "filter_screen"),
    thin_walled: checked(form, "thin_walled"),
    steel_wall_type: form.steel_wall_type.value,
    feeder_attachment: form.feeder_attachment.value,
    gating_layout: form.gating_layout.value,
    sprue_height_m: num(form, "sprue_height_m"),
    casting_height_m: num(form, "casting_height_m"),
    inlet_distance_m: num(form, "inlet_distance_m"),
    pouring_time_method: form.pouring_time_method.value,
    iterate_mass: checked(form, "iterate_mass"),
    sprue_shape: form.sprue_shape.value,
    sprue_taper: form.sprue_taper.value,
    sprue_draft_mm: num(form, "sprue_draft_mm"),
    collector_shape: form.collector_shape.value,
    feeder_shape: form.feeder_shape.value,
    feeder_aspect_ratio: num(form, "feeder_aspect_ratio"),
    slag_particle_diameter_mm: num(form, "slag_particle_diameter_mm"),
    slag_density_kg_m3: num(form, "slag_density_kg_m3"),
  };

  const optionalFloats = [
    "static_head_m", "pouring_time_s", "pouring_time_coefficient_s",
    "discharge_coefficient", "overrun_factor", "feeder_length_m",
    "collector_length_m", "wall_thickness_at_feeder_mm",
    "area_ratio_feeder", "area_ratio_collector", "area_ratio_sprue",
    "pour_temperature_c", "carbon_equivalent",
  ];
  for (const k of optionalFloats) {
    const v = num(form, k);
    if (v !== undefined) payload[k] = k === "overrun_factor" ? v / 100 : v;
  }

  const tol = num(form, "iteration_tolerance");
  if (tol !== undefined) payload.iteration_tolerance = tol / 100;

  return payload;
}

function renderResults(r) {
  document.getElementById("results").hidden = false;

  document.getElementById("summary").innerHTML = `
    <div class="stat"><div class="stat-label">Сплав</div><div class="stat-value">${r.alloy_name}</div></div>
    <div class="stat"><div class="stat-label">G total</div><div class="stat-value">${r.total_metal_mass_kg} кг</div></div>
    <div class="stat"><div class="stat-label">τ</div><div class="stat-value">${r.pouring_time_s} с</div></div>
    <div class="stat"><div class="stat-label">Hр</div><div class="stat-value">${r.static_head_m} м</div></div>
    <div class="stat"><div class="stat-label">μ</div><div class="stat-value">${r.discharge_coefficient}</div></div>
    <div class="stat"><div class="stat-label">Fпит:Fколл:Fст</div><div class="stat-value">${r.area_ratio}</div></div>
  `;

  document.getElementById("extra").innerHTML = `
    <div class="extra-grid">
      <div><span>ν стояк</span><strong>${r.velocities.sprue_m_s} м/с</strong></div>
      <div><span>ν коллектор</span><strong>${r.velocities.collector_m_s} м/с</strong></div>
      <div><span>ν питатель</span><strong>${r.velocities.feeder_m_s} м/с</strong></div>
      <div><span>ν всплытия шлака</span><strong>${r.velocities.slag_float_m_s} м/с</strong></div>
      <div><span>dст / dст.в</span><strong>${r.sprue_bottom_diameter_mm} / ${r.sprue_top_diameter_mm} мм</strong></div>
      <div><span>lколл min</span><strong>${r.collector_min_length_mm} мм</strong></div>
      ${r.filter_screen_area_mm2 ? `<div><span>F сетки</span><strong>${r.filter_screen_area_mm2.toLocaleString("ru-RU")} мм²</strong></div>` : ""}
      ${r.feeder_recommended_height_mm ? `<div><span>h питателя</span><strong>${r.feeder_recommended_height_mm} мм</strong></div>` : ""}
    </div>`;

  const sections = [
    { name: r.funnel.name, area: null, flow: r.funnel.mass_flow_kg_s, dim: r.funnel.description },
    { name: r.sprue.name, area: r.sprue.area_mm2, dim: r.sprue.dimensions.description, v: r.sprue.dimensions.velocity_m_s },
    { name: r.collector.name, area: r.collector.area_mm2, dim: r.collector.dimensions.description, v: r.collector.dimensions.velocity_m_s },
    { name: r.feeder_single.name, area: r.feeder_single.area_mm2, dim: r.feeder_single.dimensions.description, v: r.feeder_single.dimensions.velocity_m_s },
    { name: r.feeder_total.name, area: r.feeder_total.area_mm2, dim: r.feeder_total.dimensions.description },
  ];

  document.getElementById("sections").innerHTML = sections.map((s) => `
    <div class="section-item">
      <h3>${s.name}</h3>
      ${s.flow != null
        ? `<div class="section-area section-flow">${s.flow} кг/с</div>`
        : `<div class="section-area">${s.area.toLocaleString("ru-RU")} мм²</div>`}
      <div class="section-dim">${s.dim}${s.v != null ? ` · ν=${s.v} м/с` : ""}</div>
    </div>`).join("");

  const m = r.mass_breakdown;
  document.getElementById("mass").innerHTML = `
    <h3 class="mass-title">Масса литниковой системы (${m.iteration_count} итер.)</h3>
    <div class="extra-grid">
      <div><span>Питатели</span><strong>${m.feeder_kg} кг</strong></div>
      <div><span>Коллектор</span><strong>${m.collector_kg} кг</strong></div>
      <div><span>Стояк</span><strong>${m.sprue_kg} кг</strong></div>
      <div><span>Воронка</span><strong>${m.funnel_kg} кг</strong></div>
      <div><span>Σ Gл.с</span><strong>${m.total_kg} кг</strong></div>
    </div>`;

  document.getElementById("notes").innerHTML = r.notes.map(
    (n) => `<p class="${n.startsWith("⚠") ? "warning" : ""}">${n}</p>`
  ).join("");
}

document.getElementById("alloy_id").addEventListener("change", updateAlloyInfo);

document.getElementById("calc-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  form.querySelector(".error")?.remove();
  try {
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload(form)),
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Ошибка расчёта");
    renderResults(await res.json());
  } catch (err) {
    const div = document.createElement("div");
    div.className = "error";
    div.textContent = err.message;
    form.appendChild(div);
  }
});

loadAlloys();

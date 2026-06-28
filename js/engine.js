/**
 * Движок расчёта литниковой системы (порт Python → JS для GitHub Pages).
 */
(function (global) {
  "use strict";

  const G = 9.81;
  const FUNNEL_TABLE = [
    [1.5, 1, 50, 18],
    [2.5, 2, 60, 23],
    [3.5, 3, 75, 27],
    [5.0, 4, 90, 30],
  ];
  const POURING_S_THIN_WALL = [[3.5, 1.66], [6.0, 1.85], [15.0, 2.2]];
  const POURING_S_LARGE = [[10, 1.0], [20, 1.35], [40, 1.5], [Infinity, 1.7]];
  const THIN_WALLED_RATIO = [1.0, 1.06, 1.11];
  const STEEL_THICK_RATIO = [1.0, 1.05, 1.1];
  const STEEL_THIN_RATIO = [1.0, 1.1, 1.2];
  const FILTER_AREA_DIVISOR = 1.1;
  const CARBON_EQUIVALENT = { gray_cast_iron: 4.1, ductile_cast_iron: 3.9 };
  const DEFAULT_POUR_TEMP_C = {
    gray_cast_iron: 1340, ductile_cast_iron: 1380, carbon_steel: 1520,
    low_alloy_steel: 1540, stainless_steel: 1580, al_silicon: 720,
    al_copper: 750, bronze: 1100, brass: 1050, copper: 1150, zinc: 420, magnesium: 720,
  };

  function interpolateTable(table, value) {
    for (const [threshold, coeff] of table) {
      if (value <= threshold) return coeff;
    }
    return table[table.length - 1][1];
  }

  function m2ToMm2(a) { return a * 1e6; }
  function mm2ToM2(a) { return a * 1e-6; }
  function diameterFromArea(mm2) { return 2 * Math.sqrt(mm2 / Math.PI); }
  function squareSide(mm2) { return Math.sqrt(mm2); }
  function rectangleFromArea(mm2, ar) {
    const s = Math.sqrt(mm2 / ar);
    return [s, s * ar];
  }
  function formatRatio(r) {
    return r.map((v) => (Number.isInteger(v) ? String(v) : String(v))).join(":");
  }

  function calcStaticHead(layout, h0, c, p) {
    const half = c / 2;
    const map = {
      side: [h0 - p - half, "Hр = H₀ − P − C/2"],
      top: [h0, "Hр = H₀"],
      siphon: [h0 - half, "Hр = H₀ − C/2"],
      symmetric: [h0 - c / 8, "Hр = H₀ − C/8"],
    };
    const [head, formula] = map[layout] || map.side;
    return [Math.max(head, 0.01), formula];
  }

  function calcPouringTime(alloy, totalMass, method, wallMm, coeffS, manual) {
    if (manual != null) return [manual, "Задано вручную"];
    if (method === "thin_sqrt") {
      const s = coeffS ?? (wallMm ? interpolateTable(POURING_S_THIN_WALL, wallMm) : alloy.pouring_time_s);
      return [Math.max(alloy.min_pouring_time_s, s * Math.sqrt(totalMass)), `τ = S·√G, S = ${s} (формула 2.2)`];
    }
    if (method === "large_cube") {
      const d = wallMm ?? 20;
      const s = coeffS ?? interpolateTable(POURING_S_LARGE, d);
      return [Math.max(alloy.min_pouring_time_s, d * s * Math.cbrt(totalMass)), `τ = δ·S·∛G (формула 2.3)`];
    }
    if (totalMass <= 500 && wallMm) {
      const s = coeffS ?? interpolateTable(POURING_S_THIN_WALL, wallMm);
      return [Math.max(alloy.min_pouring_time_s, s * Math.sqrt(totalMass)), `τ = S·√G (авто, 2.2)`];
    }
    if (totalMass > 500 && wallMm) {
      const s = coeffS ?? interpolateTable(POURING_S_LARGE, wallMm);
      return [Math.max(alloy.min_pouring_time_s, wallMm * s * Math.cbrt(totalMass)), `τ = δ·S·∛G (авто, 2.3)`];
    }
    const tau = alloy.pouring_time_s * Math.sqrt(totalMass);
    return [Math.max(alloy.min_pouring_time_s, tau), `τ = S·√G, S = ${alloy.pouring_time_s} (по сплаву)`];
  }

  function calcSmallestAreaM2(m, rho, tau, mu, hr) {
    return m / (rho * tau * mu * Math.sqrt(2 * G * hr));
  }

  function calcVelocity(flow, rho, areaM2) {
    return areaM2 <= 0 ? 0 : flow / (rho * areaM2);
  }

  function calcSlagFloat(dM, rhoM, rhoS) {
    const d = rhoM - rhoS;
    return d <= 0 ? 0 : Math.sqrt(2 * G * dM * d / rhoM);
  }

  function calcCollectorMinLen(hM, vColl, vFloat) {
    return vFloat <= 0 ? 0 : 1.2 * hM * vColl / vFloat;
  }

  function calcMinFeederHeight(tC, cEq) {
    if (cEq == null) return null;
    return Math.max(3, 3.5 - 0.01 * (tC - (1670 - 124 * cEq)));
  }

  function trapezoidDims(areaM2) {
    const a = Math.sqrt(areaM2 / 1.0625);
    return [a, 0.7 * a, 1.25 * a];
  }

  function defaultLengths(mass) {
    if (mass <= 5) return [0.04, 0.15, 0.20];
    if (mass <= 50) return [0.06, 0.25, 0.30];
    if (mass <= 500) return [0.10, 0.40, 0.45];
    return [0.15, 0.60, 0.70];
  }

  function coneMass(h, r1, r2, rho) {
    return (Math.PI * rho * h / 3) * (r1 * r1 + r1 * r2 + r2 * r2);
  }

  function estimateFunnelMass(cupD, rho) {
    const h = (cupD / 1000) * 0.8;
    const r = cupD / 2000;
    return coneMass(h, r, r * 1.4, rho);
  }

  function estimateGatingMass(p) {
    const feeder = p.feederArea * p.feederLen * p.rho * p.feederCount;
    const coll = p.collArea * p.collLen * p.rho * p.collCount;
    const rb = Math.sqrt(Math.max(p.sprueBottom, 0) / Math.PI);
    const rt = Math.sqrt(Math.max(p.sprueTop, 0) / Math.PI);
    const sprue = coneMass(p.sprueH, rb, rt, p.rho);
    return { feeder_kg: feeder, collector_kg: coll, sprue_kg: sprue, funnel_kg: p.funnelMass, total_kg: feeder + coll + sprue + p.funnelMass };
  }

  function resolveRatio(alloy, req) {
    if (req.area_ratio_feeder != null && req.area_ratio_collector != null && req.area_ratio_sprue != null) {
      return [req.area_ratio_feeder, req.area_ratio_collector, req.area_ratio_sprue];
    }
    if (req.thin_walled && alloy.system_type === "constricting") return THIN_WALLED_RATIO;
    if (alloy.group === "Сталь") return req.steel_wall_type === "thin" ? STEEL_THIN_RATIO : STEEL_THICK_RATIO;
    return alloy.area_ratio;
  }

  function resolveStaticHead(req) {
    if (req.static_head_m != null) return [req.static_head_m, "Задано вручную"];
    return calcStaticHead(req.gating_layout || "side", req.sprue_height_m ?? 0.25, req.casting_height_m ?? 0, req.inlet_distance_m ?? 0);
  }

  function selectFunnel(flow) {
    for (const [maxF, num, cup, sprue] of FUNNEL_TABLE) {
      if (flow <= maxF) return [num, cup, sprue];
    }
    return [5, 120 + flow * 10, 40 + flow * 3];
  }

  function areasFromSmallest(smallest, ratio, feederCount, collCount) {
    const [rf, rc, rs] = ratio;
    const base = smallest / Math.min(rf, rc, rs);
    return [base * rs, (base * rc) / collCount, (base * rf) / feederCount, base * rf];
  }

  function buildSection(area, shape, label, aspectRatio, lengthMm, velocity) {
    const v = velocity != null ? Math.round(velocity * 1000) / 1000 : null;
    if (shape === "trapezoid") {
      const [a, b, h] = trapezoidDims(mm2ToM2(area));
      return {
        shape: "trapezoid", area_mm2: Math.round(area * 100) / 100,
        width_mm: Math.round(a * 1000 * 100) / 100, height_mm: Math.round(h * 1000 * 100) / 100,
        description: `${label} трапеция ${(a * 1000).toFixed(1)}/${(b * 1000).toFixed(1)}×${(h * 1000).toFixed(1)} мм`,
        length_mm: lengthMm, velocity_m_s: v,
      };
    }
    if (shape === "circle") {
      const d = diameterFromArea(area);
      return { shape: "circle", area_mm2: Math.round(area * 100) / 100, diameter_mm: Math.round(d * 100) / 100, description: `${label} Ø${d.toFixed(1)} мм`, length_mm: lengthMm, velocity_m_s: v };
    }
    if (shape === "square") {
      const s = squareSide(area);
      return { shape: "square", area_mm2: Math.round(area * 100) / 100, side_mm: Math.round(s * 100) / 100, description: `${label} ${s.toFixed(1)}×${s.toFixed(1)} мм`, length_mm: lengthMm, velocity_m_s: v };
    }
    const [w, h] = rectangleFromArea(area, aspectRatio ?? 3);
    return { shape: "rectangle", area_mm2: Math.round(area * 100) / 100, width_mm: Math.round(w * 100) / 100, height_mm: Math.round(h * 100) / 100, description: `${label} ${w.toFixed(1)}×${h.toFixed(1)} мм`, length_mm: lengthMm, velocity_m_s: v };
  }

  function sprueDiameters(sprueMm2, n, taper, draft) {
    const d = diameterFromArea(sprueMm2 / n);
    if (taper === "expanding_up") return [d, d];
    return [d, d + 2 * draft];
  }

  function getAlloy(alloys, id) {
    const a = alloys.find((x) => x.id === id);
    if (!a) throw new Error(`Неизвестный сплав: ${id}`);
    return a;
  }

  function calculateGatingSystem(req, alloys) {
    const alloy = getAlloy(alloys, req.alloy_id);
    const areaRatio = resolveRatio(alloy, req);
    const [staticHead, staticFormula] = resolveStaticHead(req);
    const mu = req.discharge_coefficient ?? (req.mold_moisture === "dry" ? alloy.discharge_coefficient_dry : alloy.discharge_coefficient_wet);
    const overrun = req.overrun_factor ?? alloy.overrun_factor;
    const baseMass = req.casting_mass_kg + (req.riser_mass_kg ?? 0);
    let totalMass = baseMass * (1 + overrun);
    let iterationCount = 0;
    let pouringTime = 0;
    let pouringFormula = "";
    let sprueMm2 = 0, collMm2 = 0, feederSingle = 0, feederTotal = 0;

    for (let i = 0; i < 20; i++) {
      iterationCount = i + 1;
      [pouringTime, pouringFormula] = calcPouringTime(alloy, totalMass, req.pouring_time_method || "auto", req.wall_thickness_mm, req.pouring_time_coefficient_s, req.pouring_time_s);
      let smallest = m2ToMm2(calcSmallestAreaM2(totalMass, alloy.density_kg_m3, pouringTime, mu, staticHead));
      if (req.filter_screen && alloy.system_type === "constricting") smallest /= FILTER_AREA_DIVISOR;
      [sprueMm2, collMm2, feederSingle, feederTotal] = areasFromSmallest(smallest, areaRatio, req.feeder_count ?? 1, req.collector_count ?? 1);
      if (!req.iterate_mass) break;

      const [defF, defC, defH] = defaultLengths(req.casting_mass_kg);
      const fLen = req.feeder_length_m ?? defF;
      const cLen = req.collector_length_m ?? defC;
      const sH = req.sprue_height_m ?? defH;
      const [, cupD] = selectFunnel(totalMass / pouringTime).slice(1);
      const funnelMass = estimateFunnelMass(cupD, alloy.density_kg_m3);
      const [dBot, dTop] = sprueDiameters(sprueMm2, req.castings_per_mold ?? 1, req.sprue_taper || "constricting_down", req.sprue_draft_mm ?? 5);
      const bd = estimateGatingMass({
        rho: alloy.density_kg_m3, feederArea: mm2ToM2(feederSingle), feederLen: fLen, feederCount: req.feeder_count ?? 1,
        collArea: mm2ToM2(collMm2), collLen: cLen, collCount: req.collector_count ?? 1,
        sprueBottom: Math.PI * (dBot / 2000) ** 2, sprueTop: Math.PI * (dTop / 2000) ** 2, sprueH: sH, funnelMass,
      });
      const newTotal = baseMass + bd.total_kg;
      if (i > 0 && Math.abs(newTotal - totalMass) / totalMass <= (req.iteration_tolerance ?? 0.03)) {
        totalMass = newTotal;
        break;
      }
      totalMass = newTotal;
    }

    const massFlow = totalMass / pouringTime;
    const [funnelNum, cupD, sprueTopD] = selectFunnel(massFlow);
    const vSprue = calcVelocity(massFlow, alloy.density_kg_m3, mm2ToM2(sprueMm2));
    const vColl = calcVelocity(massFlow, alloy.density_kg_m3, mm2ToM2(collMm2 * (req.collector_count ?? 1)));
    const vFeeder = calcVelocity(massFlow, alloy.density_kg_m3, mm2ToM2(feederTotal));
    const vSlag = calcSlagFloat((req.slag_particle_diameter_mm ?? 2) / 1000, alloy.density_kg_m3, req.slag_density_kg_m3 ?? 4500);
    const [, , trapH] = trapezoidDims(mm2ToM2(collMm2));
    const collMinLen = calcCollectorMinLen(trapH, vColl, vSlag);
    const [, , feederTrapH] = trapezoidDims(mm2ToM2(feederSingle));
    const cEq = req.carbon_equivalent ?? CARBON_EQUIVALENT[alloy.id];
    const tPour = req.pour_temperature_c ?? DEFAULT_POUR_TEMP_C[alloy.id];
    const hMin = tPour && cEq != null ? calcMinFeederHeight(tPour, cEq) : null;
    let hRec = feederTrapH * 1000;
    if (req.feeder_attachment === "to_casting" && req.wall_thickness_at_feeder_mm) {
      hRec = Math.max(Math.min(hRec, req.wall_thickness_at_feeder_mm - 4), hMin ?? 3);
    }
    const [dBottom, dTop] = sprueDiameters(sprueMm2, req.castings_per_mold ?? 1, req.sprue_taper || "constricting_down", req.sprue_draft_mm ?? 5);
    const [defF, defC, defH] = defaultLengths(req.casting_mass_kg);
    const feederLenMm = (req.feeder_length_m ?? defF) * 1000;
    const collLenMm = Math.max(req.collector_length_m ?? defC, collMinLen) * 1000;
    const filterArea = req.filter_screen ? feederTotal / FILTER_AREA_DIVISOR : null;
    const finalMass = estimateGatingMass({
      rho: alloy.density_kg_m3, feederArea: mm2ToM2(feederSingle), feederLen: feederLenMm / 1000, feederCount: req.feeder_count ?? 1,
      collArea: mm2ToM2(collMm2), collLen: collLenMm / 1000, collCount: req.collector_count ?? 1,
      sprueBottom: Math.PI * (dBottom / 2000) ** 2, sprueTop: Math.PI * (dTop / 2000) ** 2,
      sprueH: req.sprue_height_m ?? defH, funnelMass: estimateFunnelMass(cupD, alloy.density_kg_m3),
    });

    const notes = [
      "F = G / (ρ · τ · μ · √(2g · Hр)) — формула (2.1).",
      `Hр: ${staticFormula} = ${staticHead.toFixed(3)} м.`,
      `τ: ${pouringFormula}.`,
      `Наименьшее сечение — ${alloy.system_type === "constricting" ? "питатель" : "стояк"}. Fпит:Fколл:Fст = ${formatRatio(areaRatio)}.`,
      "Расчёт выполнен локально в браузере (GitHub Pages).",
    ];
    if (req.iterate_mass) notes.push(`Итерационное уточнение: ${iterationCount} шаг(ов), Gл.с = ${finalMass.total_kg.toFixed(2)} кг.`);
    if (req.filter_screen) notes.push(`Фильтровальная сетка: Fф.с = Fп / ${FILTER_AREA_DIVISOR}.`);
    if (collMinLen * 1000 > collLenMm) notes.push(`⚠ Мин. длина коллектора: ${(collMinLen * 1000).toFixed(0)} мм (формула 2.7).`);
    if (hMin && hRec < hMin) notes.push(`⚠ Высота питателя ${hRec.toFixed(1)} мм < мин. ${hMin.toFixed(1)} мм (2.6).`);
    if (massFlow > 5) notes.push(`⚠ Расход ${massFlow.toFixed(1)} кг/с — литниковая чаша (табл. 1.2–1.4).`);
    if (alloy.notes) notes.push(alloy.notes);

    const feederShape = req.feeder_shape === "trapezoid" || !req.feeder_shape ? "trapezoid" : req.feeder_shape;

    return {
      alloy_id: alloy.id, alloy_name: alloy.name,
      system_type: alloy.system_type === "constricting" ? "сужающаяся" : "расширяющаяся",
      casting_mass_kg: req.casting_mass_kg, riser_mass_kg: req.riser_mass_kg ?? 0,
      gating_mass_kg: Math.round(finalMass.total_kg * 1000) / 1000,
      total_metal_mass_kg: Math.round((baseMass + finalMass.total_kg) * 1000) / 1000,
      pouring_time_s: Math.round(pouringTime * 100) / 100, pouring_time_formula: pouringFormula,
      static_head_m: Math.round(staticHead * 10000) / 10000, static_head_formula: staticFormula,
      discharge_coefficient: mu, feeder_count: req.feeder_count ?? 1, collector_count: req.collector_count ?? 1,
      castings_per_mold: req.castings_per_mold ?? 1, area_ratio: formatRatio(areaRatio),
      smallest_element: alloy.system_type === "constricting" ? "питатель" : "стояк",
      volume_flow_m3_s: Math.round((massFlow / alloy.density_kg_m3) * 1e6) / 1e6,
      filter_screen_area_mm2: filterArea != null ? Math.round(filterArea * 100) / 100 : null,
      collector_min_length_mm: Math.round(collMinLen * 1000 * 10) / 10,
      feeder_min_height_mm: hMin != null ? Math.round(hMin * 10) / 10 : null,
      feeder_recommended_height_mm: Math.round(hRec * 10) / 10,
      sprue_bottom_diameter_mm: Math.round(dBottom * 100) / 100,
      sprue_top_diameter_mm: Math.round(dTop * 100) / 100,
      velocities: { sprue_m_s: Math.round(vSprue * 1000) / 1000, collector_m_s: Math.round(vColl * 1000) / 1000, feeder_m_s: Math.round(vFeeder * 1000) / 1000, slag_float_m_s: Math.round(vSlag * 10000) / 10000 },
      mass_breakdown: {
        feeder_kg: Math.round(finalMass.feeder_kg * 1000) / 1000, collector_kg: Math.round(finalMass.collector_kg * 1000) / 1000,
        sprue_kg: Math.round(finalMass.sprue_kg * 1000) / 1000, funnel_kg: Math.round(finalMass.funnel_kg * 1000) / 1000,
        total_kg: Math.round(finalMass.total_kg * 1000) / 1000, iteration_count: iterationCount,
      },
      funnel: {
        name: "Литниковая воронка", mass_flow_kg_s: Math.round(massFlow * 100) / 100,
        funnel_number: funnelNum, cup_diameter_mm: cupD, sprue_top_diameter_mm: Math.round(sprueTopD * 10) / 10,
        description: `Воронка №${funnelNum}, чаша Ø${cupD} мм, dст.в = ${sprueTopD.toFixed(0)} мм`,
      },
      sprue: { name: "Стояк", area_mm2: Math.round(sprueMm2 * 100) / 100, dimensions: buildSection(sprueMm2, req.sprue_shape || "circle", "Стояк", 3, null, vSprue) },
      collector: { name: "Литниковый ход (коллектор)", area_mm2: Math.round(collMm2 * 100) / 100, dimensions: buildSection(collMm2, req.collector_shape || "trapezoid", "Коллектор", 3, Math.round(collLenMm * 10) / 10, vColl) },
      feeder_single: { name: "Питатель (один)", area_mm2: Math.round(feederSingle * 100) / 100, dimensions: buildSection(feederSingle, feederShape, "Питатель", req.feeder_aspect_ratio ?? 3, Math.round(feederLenMm * 10) / 10, vFeeder) },
      feeder_total: {
        name: "Питатели (суммарно)", area_mm2: Math.round(feederTotal * 100) / 100,
        dimensions: { shape: "total", area_mm2: Math.round(feederTotal * 100) / 100, description: `Σ ${req.feeder_count ?? 1} питателей = ${feederTotal.toFixed(1)} мм²`, velocity_m_s: Math.round(vFeeder * 1000) / 1000 },
      },
      notes,
    };
  }

  global.FoundryEngine = { calculateGatingSystem, getAlloy, calcStaticHead };
})(typeof window !== "undefined" ? window : globalThis);

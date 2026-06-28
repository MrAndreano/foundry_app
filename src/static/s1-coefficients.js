/**
 * Коэффициент S₁ по таблицам учебника (рис. для стали и алюминия).
 */
(function (global) {
  "use strict";

  const STEEL_IDS = ["carbon_steel", "low_alloy_steel", "stainless_steel"];
  const AL_IDS = ["al_silicon", "al_copper"];

  const STEEL_S1 = {
    normal: { bottom: 1.3, half: 1.4, top: 1.55 },
    elevated: { bottom: 1.45, half: 1.55, top: 1.7 },
  };

  const AL_S1 = {
    sand: {
      conventional: [[2, 1.7], [5, 2.1], [10, 2.3], [Infinity, 2.4]],
      vertical_slot: [[15, 2.7], [30, 2.8], [70, 3.0], [Infinity, 3.0]],
    },
    metal_mold: {
      conventional: [[2, 2.2], [5, 2.4], [10, 2.5], [Infinity, 2.6]],
      vertical_slot: [[15, 3.3], [30, 3.6], [70, 4.0], [Infinity, 4.0]],
    },
  };

  const POURING_S_THIN = [[3.5, 1.66], [6.0, 1.85], [15.0, 2.2]];
  const POURING_S_LARGE = [[10, 1.0], [20, 1.35], [40, 1.5], [Infinity, 1.7]];

  const GATING_SYSTEMS = [
    { id: "3", label: "Класс I — газопроницаемые стенки (рис. 1.2)" },
    { id: "4", label: "Класс I — газонепроницаемые стенки (рис. 1.3)" },
    { id: "5", label: "Класс II — вид IIА (рис. 1.4)" },
    { id: "6", label: "Класс II — вид IIB (рис. 1.5)" },
  ];

  function interpolate(table, value) {
    for (const [threshold, coeff] of table) {
      if (value <= threshold) return coeff;
    }
    return table[table.length - 1][1];
  }

  function isSteel(alloyId) {
    return STEEL_IDS.includes(alloyId);
  }

  function isAluminum(alloyId) {
    return AL_IDS.includes(alloyId);
  }

  function getSteelS1(tempLevel, supplyMethod) {
    const row = STEEL_S1[tempLevel] || STEEL_S1.normal;
    return row[supplyMethod] ?? row.bottom;
  }

  function getAlS1(moldKind, lsType, massKg) {
    const table = AL_S1[moldKind]?.[lsType] || AL_S1.sand.conventional;
    return interpolate(table, massKg);
  }

  function getGenericS(alloy, wallMm, massKg) {
    if (wallMm && massKg <= 500) return interpolate(POURING_S_THIN, wallMm);
    if (wallMm && massKg > 500) return interpolate(POURING_S_LARGE, wallMm);
    return alloy?.pouring_time_s ?? 2.0;
  }

  function suggestS1(alloy, opts) {
    const {
      tempLevel = "normal",
      supplyMethod = "bottom",
      alMoldKind = "sand",
      alLsType = "conventional",
      massKg = 10,
      wallMm,
    } = opts;

    if (!alloy) return { value: 2, source: "Значение по умолчанию" };

    if (isSteel(alloy.id)) {
      const value = getSteelS1(tempLevel, supplyMethod);
      return {
        value,
        source: `Таблица S₁ для стали · ${tempLevel === "elevated" ? "повышенная" : "нормальная"} T · подвод «${supplyLabel(supplyMethod)}»`,
        tableId: 1,
      };
    }

    if (isAluminum(alloy.id)) {
      const value = getAlS1(alMoldKind, alLsType, massKg);
      return {
        value,
        source: `Таблица S₁ для алюминия · ${alMoldKind === "metal_mold" ? "кокиль" : "песок"} · ${alLsType === "vertical_slot" ? "щелевая ЛС" : "обычная ЛС"} · G = ${massKg} кг`,
        tableId: 2,
      };
    }

    const value = getGenericS(alloy, wallMm, massKg);
    const via = wallMm
      ? massKg <= 500
        ? "формула 2.2 по δ"
        : "формула 2.3 по δ"
      : "база сплава";
    return { value, source: `S ≈ ${value} (${via})`, tableId: null };
  }

  function supplyLabel(method) {
    return (
      {
        bottom: "снизу / толстые части",
        half: "на половине высоты",
        top: "сверху / тонкие части",
      }[method] || method
    );
  }

  global.S1Coefficients = {
    GATING_SYSTEMS,
    isSteel,
    isAluminum,
    suggestS1,
    getSteelS1,
    getAlS1,
    getGenericS,
  };
})(typeof window !== "undefined" ? window : globalThis);

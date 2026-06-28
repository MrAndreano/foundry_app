/**
 * Иллюстрации из учебника (resourse/res.txt ↔ N.png).
 */
(function (global) {
  "use strict";

  const IMG_PREFIX = (() => {
    const src = (document.currentScript && document.currentScript.src) || "";
    return src.includes("/static/") ? "/static/" : "";
  })();

  function imgPath(num) {
    return `${IMG_PREFIX}img/book/${num}.png`;
  }

  global.REFERENCE_IMAGES = {
    1: {
      file: imgPath(1),
      caption: "Значения коэффициента S₁ для стальных отливок",
      alloys: ["carbon_steel", "low_alloy_steel", "stainless_steel"],
    },
    2: {
      file: imgPath(2),
      caption: "Значения коэффициента S₁ для отливок из алюминиевых сплавов",
      alloys: ["al_silicon", "al_copper"],
    },
    3: {
      file: imgPath(3),
      caption: "Литниковые системы класса I при газопроницаемых стенках канала (рис. 1.2)",
    },
    4: {
      file: imgPath(4),
      caption: "Литниковые системы класса I при газонепроницаемых стенках канала (рис. 1.3)",
    },
    5: {
      file: imgPath(5),
      caption: "Литниковые системы класса II вида IIА (рис. 1.4)",
    },
    6: {
      file: imgPath(6),
      caption: "Литниковые системы класса II вида IIB (рис. 1.5)",
    },
    7: {
      file: imgPath(7),
      caption: "Расчётный напор Hр: H₀, C, P (рис. 2.3)",
    },
  };

  global.REFERENCE_IMAGE_LIST = [
    { id: 7, label: "Рис. 2.3 — расчётный напор Hр (H₀, C, P)" },
    { id: 1, label: "Таблица S₁ — стальные отливки" },
    { id: 2, label: "Таблица S₁ — алюминиевые сплавы" },
    { id: 3, label: "Рис. 1.2 — ЛС класса I, газопроницаемые стенки" },
    { id: 4, label: "Рис. 1.3 — ЛС класса I, газонепроницаемые стенки" },
    { id: 5, label: "Рис. 1.4 — ЛС класса II, вид IIА" },
    { id: 6, label: "Рис. 1.5 — ЛС класса II, вид IIB" },
  ];

  global.getCoeffTableId = function (alloyId) {
    for (const id of [1, 2]) {
      const ref = global.REFERENCE_IMAGES[id];
      if (ref.alloys && ref.alloys.includes(alloyId)) return id;
    }
    return null;
  };
})(typeof window !== "undefined" ? window : globalThis);

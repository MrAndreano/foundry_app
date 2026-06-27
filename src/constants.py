"""Справочные таблицы и константы из методики расчёта ЛПС."""

from __future__ import annotations

FUNNEL_TABLE: list[tuple[float, int, float, float]] = [
    (1.5, 1, 50, 18),
    (2.5, 2, 60, 23),
    (3.5, 3, 75, 27),
    (5.0, 4, 90, 30),
]

POURING_S_THIN_WALL: list[tuple[float, float]] = [
    (3.5, 1.66),
    (6.0, 1.85),
    (15.0, 2.2),
]

POURING_S_LARGE: list[tuple[float, float]] = [
    (10.0, 1.0),
    (20.0, 1.35),
    (40.0, 1.50),
    (float("inf"), 1.70),
]

GRAVITY_M_S2 = 9.81

THIN_WALLED_RATIO = (1.0, 1.06, 1.11)
STEEL_THICK_RATIO = (1.0, 1.05, 1.1)
STEEL_THIN_RATIO = (1.0, 1.1, 1.2)

FILTER_AREA_DIVISOR = 1.1

DEFAULT_SLAG_PARTICLE_D_MM = 2.0
DEFAULT_SLAG_DENSITY_KG_M3 = 4500

CARBON_EQUIVALENT: dict[str, float] = {
    "gray_cast_iron": 4.1,
    "ductile_cast_iron": 3.9,
}

DEFAULT_POUR_TEMP_C: dict[str, float] = {
    "gray_cast_iron": 1340,
    "ductile_cast_iron": 1380,
    "carbon_steel": 1520,
    "low_alloy_steel": 1540,
    "stainless_steel": 1580,
    "al_silicon": 720,
    "al_copper": 750,
    "bronze": 1100,
    "brass": 1050,
    "copper": 1150,
    "zinc": 420,
    "magnesium": 720,
}

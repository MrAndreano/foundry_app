"""База литейных сплавов по методике расчёта типовых ЛПС (Озанн–Диттерт)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


SystemType = Literal["constricting", "expanding"]


@dataclass(frozen=True, slots=True)
class Alloy:
    id: str
    name: str
    group: str
    density_kg_m3: float
    system_type: SystemType
    """Сужающаяся (чугун, сталь) или расширяющаяся (цветные) система."""
    area_ratio: tuple[float, float, float]
    """Соотношение площадей Fпит : Fколл : Fст (питатель : коллектор : стояк)."""
    discharge_coefficient_wet: float
    """Коэффициент расхода μ при заливке в сырую форму."""
    discharge_coefficient_dry: float
    """Коэффициент расхода μ при заливке в сухую форму."""
    pouring_time_s: float
    """Коэффициент S в формуле τ = S·√G (G — масса с литником, кг)."""
    min_pouring_time_s: float
    overrun_factor: float
    """Начальный припуск на литниковую систему (уточняется итерацией)."""
    notes: str = ""


ALLOYS: dict[str, Alloy] = {
    "gray_cast_iron": Alloy(
        id="gray_cast_iron",
        name="Серый чугун (СЧ)",
        group="Чугун",
        density_kg_m3=7000,
        system_type="constricting",
        area_ratio=(1.0, 1.2, 1.4),
        discharge_coefficient_wet=0.40,
        discharge_coefficient_dry=0.50,
        pouring_time_s=2.2,
        min_pouring_time_s=4.0,
        overrun_factor=0.15,
        notes="Сужающаяся система. Fпит:Fколл:Fст = 1:1,2:1,4 (формула 2.4).",
    ),
    "ductile_cast_iron": Alloy(
        id="ductile_cast_iron",
        name="Высокопрочный чугун (ВЧ)",
        group="Чугун",
        density_kg_m3=7100,
        system_type="constricting",
        area_ratio=(1.0, 1.2, 1.4),
        discharge_coefficient_wet=0.38,
        discharge_coefficient_dry=0.48,
        pouring_time_s=2.2,
        min_pouring_time_s=5.0,
        overrun_factor=0.18,
        notes="Для тонкостенных отливок допустимо 1:1,06:1,11.",
    ),
    "carbon_steel": Alloy(
        id="carbon_steel",
        name="Углеродистая сталь",
        group="Сталь",
        density_kg_m3=7800,
        system_type="constricting",
        area_ratio=(1.0, 1.3, 1.5),
        discharge_coefficient_wet=0.32,
        discharge_coefficient_dry=0.40,
        pouring_time_s=2.4,
        min_pouring_time_s=6.0,
        overrun_factor=0.20,
        notes="Толстостенные отливки: 1:1,05:1,1; тонкостенные: 1:1,1:1,2.",
    ),
    "low_alloy_steel": Alloy(
        id="low_alloy_steel",
        name="Низколегированная сталь",
        group="Сталь",
        density_kg_m3=7850,
        system_type="constricting",
        area_ratio=(1.0, 1.1, 1.2),
        discharge_coefficient_wet=0.30,
        discharge_coefficient_dry=0.38,
        pouring_time_s=2.5,
        min_pouring_time_s=7.0,
        overrun_factor=0.22,
    ),
    "stainless_steel": Alloy(
        id="stainless_steel",
        name="Коррозионностойкая сталь",
        group="Сталь",
        density_kg_m3=7900,
        system_type="constricting",
        area_ratio=(1.0, 1.1, 1.2),
        discharge_coefficient_wet=0.28,
        discharge_coefficient_dry=0.35,
        pouring_time_s=2.6,
        min_pouring_time_s=8.0,
        overrun_factor=0.25,
    ),
    "al_silicon": Alloy(
        id="al_silicon",
        name="Алюминиевый сплав Al-Si",
        group="Цветные",
        density_kg_m3=2650,
        system_type="expanding",
        area_ratio=(5.0, 2.5, 1.0),
        discharge_coefficient_wet=0.45,
        discharge_coefficient_dry=0.55,
        pouring_time_s=1.6,
        min_pouring_time_s=2.0,
        overrun_factor=0.12,
        notes="Расширяющаяся система. Fпит:Fколл:Fст = 4–6:2–3:1 (формула 2.5).",
    ),
    "al_copper": Alloy(
        id="al_copper",
        name="Алюминиевый сплав Al-Cu",
        group="Цветные",
        density_kg_m3=2800,
        system_type="expanding",
        area_ratio=(5.0, 2.5, 1.0),
        discharge_coefficient_wet=0.42,
        discharge_coefficient_dry=0.52,
        pouring_time_s=1.7,
        min_pouring_time_s=2.5,
        overrun_factor=0.14,
    ),
    "bronze": Alloy(
        id="bronze",
        name="Бронза",
        group="Цветные",
        density_kg_m3=8800,
        system_type="expanding",
        area_ratio=(3.0, 2.0, 1.0),
        discharge_coefficient_wet=0.35,
        discharge_coefficient_dry=0.42,
        pouring_time_s=1.9,
        min_pouring_time_s=4.0,
        notes="Fпит:Fколл:Fст = 2–4:2:1 (формула 2.6).",
    ),
    "brass": Alloy(
        id="brass",
        name="Латунь",
        group="Цветные",
        density_kg_m3=8500,
        system_type="expanding",
        area_ratio=(3.0, 2.0, 1.0),
        discharge_coefficient_wet=0.38,
        discharge_coefficient_dry=0.45,
        pouring_time_s=1.8,
        min_pouring_time_s=3.5,
        overrun_factor=0.16,
    ),
    "copper": Alloy(
        id="copper",
        name="Медь",
        group="Цветные",
        density_kg_m3=8900,
        system_type="expanding",
        area_ratio=(3.0, 2.0, 1.0),
        discharge_coefficient_wet=0.32,
        discharge_coefficient_dry=0.40,
        pouring_time_s=2.0,
        min_pouring_time_s=5.0,
        overrun_factor=0.20,
    ),
    "zinc": Alloy(
        id="zinc",
        name="Цинковый сплав (Zamak)",
        group="Цветные",
        density_kg_m3=6600,
        system_type="expanding",
        area_ratio=(4.0, 2.0, 1.0),
        discharge_coefficient_wet=0.50,
        discharge_coefficient_dry=0.58,
        pouring_time_s=1.3,
        min_pouring_time_s=1.5,
        overrun_factor=0.10,
        notes="Для литья под давлением параметры могут отличаться.",
    ),
    "magnesium": Alloy(
        id="magnesium",
        name="Магниевый сплав",
        group="Цветные",
        density_kg_m3=1800,
        system_type="expanding",
        area_ratio=(5.0, 2.5, 1.0),
        discharge_coefficient_wet=0.44,
        discharge_coefficient_dry=0.52,
        pouring_time_s=1.4,
        min_pouring_time_s=2.0,
        overrun_factor=0.15,
        notes="Требуется защитная атмосфера при заливке.",
    ),
}


def list_alloys() -> list[Alloy]:
    return list(ALLOYS.values())


def get_alloy(alloy_id: str) -> Alloy:
    if alloy_id not in ALLOYS:
        raise KeyError(f"Неизвестный сплав: {alloy_id}")
    return ALLOYS[alloy_id]

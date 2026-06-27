"""
Расчёт литниковой системы по методу Озанна–Диттерта (формулы 2.1–2.10).

Цепочка: Воронка → Стояк → Литниковый ход (коллектор) → Питатель
"""

from __future__ import annotations

import math

from src.alloys import Alloy, get_alloy
from src.constants import (
    CARBON_EQUIVALENT,
    DEFAULT_POUR_TEMP_C,
    DEFAULT_SLAG_DENSITY_KG_M3,
    DEFAULT_SLAG_PARTICLE_D_MM,
    FILTER_AREA_DIVISOR,
    FUNNEL_TABLE,
    GRAVITY_M_S2,
    STEEL_THICK_RATIO,
    STEEL_THIN_RATIO,
    THIN_WALLED_RATIO,
)
from src.hydraulics import (
    calc_collector_min_length_m,
    calc_min_feeder_height_mm,
    calc_pouring_time,
    calc_slag_float_velocity_m_s,
    calc_smallest_area_m2,
    calc_static_head,
    calc_trapezoid_dimensions_m,
    calc_velocity_m_s,
)
from src.mass import (
    default_element_lengths,
    estimate_funnel_mass_kg,
    estimate_gating_mass,
)
from src.models import (
    CalculationRequest,
    CalculationResult,
    FunnelResult,
    GatingSectionResult,
    MassBreakdownResult,
    SectionDimensions,
    VelocityResult,
)

G = GRAVITY_M_S2


def _m2_to_mm2(area_m2: float) -> float:
    return area_m2 * 1e6


def _mm2_to_m2(area_mm2: float) -> float:
    return area_mm2 * 1e-6


def _diameter_from_area(area_mm2: float) -> float:
    return 2 * math.sqrt(area_mm2 / math.pi)


def _square_side_from_area(area_mm2: float) -> float:
    return math.sqrt(area_mm2)


def _rectangle_from_area(area_mm2: float, aspect_ratio: float) -> tuple[float, float]:
    short = math.sqrt(area_mm2 / aspect_ratio)
    return short, short * aspect_ratio


def _format_ratio(ratio: tuple[float, float, float]) -> str:
    def fmt(v: float) -> str:
        return str(int(v)) if v == int(v) else f"{v:g}"

    return f"{fmt(ratio[0])}:{fmt(ratio[1])}:{fmt(ratio[2])}"


def _resolve_area_ratio(alloy: Alloy, request: CalculationRequest) -> tuple[float, float, float]:
    if (
        request.area_ratio_feeder is not None
        and request.area_ratio_collector is not None
        and request.area_ratio_sprue is not None
    ):
        return (
            request.area_ratio_feeder,
            request.area_ratio_collector,
            request.area_ratio_sprue,
        )
    if request.thin_walled and alloy.system_type == "constricting":
        return THIN_WALLED_RATIO
    if alloy.group == "Сталь":
        return STEEL_THIN_RATIO if request.steel_wall_type == "thin" else STEEL_THICK_RATIO
    return alloy.area_ratio


def _resolve_static_head(request: CalculationRequest) -> tuple[float, str]:
    if request.static_head_m is not None:
        return request.static_head_m, "Задано вручную"
    h0 = request.sprue_height_m or 0.25
    c = request.casting_height_m if request.casting_height_m is not None else 0.0
    p = request.inlet_distance_m if request.inlet_distance_m is not None else 0.0
    return calc_static_head(request.gating_layout, h0, c, p)


def _select_funnel(mass_flow_kg_s: float) -> tuple[int, float, float]:
    for max_flow, number, cup_d, sprue_d in FUNNEL_TABLE:
        if mass_flow_kg_s <= max_flow:
            return number, cup_d, sprue_d
    return 5, 120 + mass_flow_kg_s * 10, 40 + mass_flow_kg_s * 3


def _areas_from_smallest(
    smallest_mm2: float,
    ratio: tuple[float, float, float],
    feeder_count: int,
    collector_count: int,
) -> tuple[float, float, float, float]:
    r_feeder, r_collector, r_sprue = ratio
    base = smallest_mm2 / min(r_feeder, r_collector, r_sprue)
    sprue_mm2 = base * r_sprue
    collector_total_mm2 = base * r_collector
    feeder_total_mm2 = base * r_feeder
    return (
        sprue_mm2,
        collector_total_mm2 / collector_count,
        feeder_total_mm2 / feeder_count,
        feeder_total_mm2,
    )


def _build_section(
    area_mm2: float,
    shape: str,
    label: str,
    aspect_ratio: float = 3.0,
    length_mm: float | None = None,
    velocity_m_s: float | None = None,
) -> SectionDimensions:
    if shape == "trapezoid":
        a, b, h = calc_trapezoid_dimensions_m(_mm2_to_m2(area_mm2))
        desc = f"{label} трапеция {a*1000:.1f}/{b*1000:.1f}×{h*1000:.1f} мм"
        return SectionDimensions(
            shape="trapezoid",
            area_mm2=round(area_mm2, 2),
            width_mm=round(a * 1000, 2),
            height_mm=round(h * 1000, 2),
            description=desc,
            length_mm=length_mm,
            velocity_m_s=round(velocity_m_s, 3) if velocity_m_s else None,
        )
    if shape == "circle":
        d = _diameter_from_area(area_mm2)
        return SectionDimensions(
            shape="circle",
            area_mm2=round(area_mm2, 2),
            diameter_mm=round(d, 2),
            description=f"{label} Ø{d:.1f} мм",
            length_mm=length_mm,
            velocity_m_s=round(velocity_m_s, 3) if velocity_m_s else None,
        )
    if shape == "square":
        side = _square_side_from_area(area_mm2)
        return SectionDimensions(
            shape="square",
            area_mm2=round(area_mm2, 2),
            side_mm=round(side, 2),
            description=f"{label} {side:.1f}×{side:.1f} мм",
            length_mm=length_mm,
            velocity_m_s=round(velocity_m_s, 3) if velocity_m_s else None,
        )
    w, h = _rectangle_from_area(area_mm2, aspect_ratio)
    return SectionDimensions(
        shape="rectangle",
        area_mm2=round(area_mm2, 2),
        width_mm=round(w, 2),
        height_mm=round(h, 2),
        description=f"{label} {w:.1f}×{h:.1f} мм",
        length_mm=length_mm,
        velocity_m_s=round(velocity_m_s, 3) if velocity_m_s else None,
    )


def _sprue_diameters_mm(
    sprue_area_mm2: float,
    castings_per_mold: int,
    taper: str,
    draft_mm: float,
) -> tuple[float, float]:
    """dст в узком месте и dст.в (формула после 2.1)."""
    area_per_casting_mm2 = sprue_area_mm2 / castings_per_mold
    d_bottom = _diameter_from_area(area_per_casting_mm2)
    if taper == "expanding_up":
        return d_bottom, d_bottom
    return d_bottom, d_bottom + 2 * draft_mm


def _feeder_height_recommendation(
    request: CalculationRequest,
    alloy: Alloy,
    trapezoid_h_mm: float,
) -> tuple[float | None, float | None]:
    c_eq = request.carbon_equivalent or CARBON_EQUIVALENT.get(alloy.id)
    t_pour = request.pour_temperature_c or DEFAULT_POUR_TEMP_C.get(alloy.id)
    h_min = calc_min_feeder_height_mm(t_pour, c_eq) if t_pour and c_eq else None

    if request.feeder_attachment == "to_casting" and request.wall_thickness_at_feeder_mm:
        h_rec = min(trapezoid_h_mm, request.wall_thickness_at_feeder_mm - 4.0)
        h_rec = max(h_rec, h_min or 3.0)
        return h_min, h_rec
    return h_min, trapezoid_h_mm


def calculate_gating_system(request: CalculationRequest) -> CalculationResult:
    alloy = get_alloy(request.alloy_id)
    area_ratio = _resolve_area_ratio(alloy, request)
    static_head_m, static_head_formula = _resolve_static_head(request)

    mu = request.discharge_coefficient
    if mu is None:
        mu = (
            alloy.discharge_coefficient_dry
            if request.mold_moisture == "dry"
            else alloy.discharge_coefficient_wet
        )

    initial_overrun = request.overrun_factor if request.overrun_factor is not None else alloy.overrun_factor
    base_mass = request.casting_mass_kg + request.riser_mass_kg
    total_mass = base_mass * (1 + initial_overrun)
    gating_mass = 0.0
    iteration_count = 0
    pouring_time = 0.0
    pouring_formula = ""

    sprue_mm2 = collector_mm2 = feeder_single_mm2 = feeder_total_mm2 = 0.0

    for iteration in range(20):
        iteration_count = iteration + 1
        pouring_time, pouring_formula = calc_pouring_time(
            alloy,
            total_mass,
            request.pouring_time_method,
            request.wall_thickness_mm,
            request.pouring_time_coefficient_s,
            request.pouring_time_s,
        )
        smallest_m2 = calc_smallest_area_m2(
            total_mass, alloy.density_kg_m3, pouring_time, mu, static_head_m
        )
        smallest_mm2 = _m2_to_mm2(smallest_m2)

        if request.filter_screen and alloy.system_type == "constricting":
            smallest_mm2 /= FILTER_AREA_DIVISOR

        sprue_mm2, collector_mm2, feeder_single_mm2, feeder_total_mm2 = _areas_from_smallest(
            smallest_mm2,
            area_ratio,
            request.feeder_count,
            request.collector_count,
        )

        if not request.iterate_mass:
            break

        def_l_f, def_l_c, def_h_s = default_element_lengths(request.casting_mass_kg)
        feeder_len = request.feeder_length_m or def_l_f
        collector_len = request.collector_length_m or def_l_c
        sprue_h = request.sprue_height_m or def_h_s

        funnel_num, cup_d, _ = _select_funnel(total_mass / pouring_time)
        funnel_mass = estimate_funnel_mass_kg(cup_d, alloy.density_kg_m3)
        d_bottom, d_top = _sprue_diameters_mm(
            sprue_mm2,
            request.castings_per_mold,
            request.sprue_taper,
            request.sprue_draft_mm,
        )
        sprue_bottom_m2 = math.pi * (d_bottom / 2000) ** 2
        sprue_top_m2 = math.pi * (d_top / 2000) ** 2

        breakdown = estimate_gating_mass(
            alloy.density_kg_m3,
            _mm2_to_m2(feeder_single_mm2),
            feeder_len,
            request.feeder_count,
            _mm2_to_m2(collector_mm2),
            collector_len,
            request.collector_count,
            sprue_bottom_m2,
            sprue_top_m2,
            sprue_h,
            funnel_mass,
        )
        new_gating_mass = breakdown.total_kg
        new_total = base_mass + new_gating_mass

        if iteration > 0 and abs(new_total - total_mass) / total_mass <= request.iteration_tolerance:
            gating_mass = new_gating_mass
            total_mass = new_total
            break

        gating_mass = new_gating_mass
        total_mass = new_total

    mass_flow = total_mass / pouring_time
    volume_flow = mass_flow / alloy.density_kg_m3
    funnel_num, cup_d, sprue_top_d = _select_funnel(mass_flow)

    smallest_element = "питатель" if alloy.system_type == "constricting" else "стояк"
    system_type_ru = "сужающаяся" if alloy.system_type == "constricting" else "расширяющаяся"

    v_sprue = calc_velocity_m_s(mass_flow, alloy.density_kg_m3, _mm2_to_m2(sprue_mm2))
    v_collector = calc_velocity_m_s(
        mass_flow, alloy.density_kg_m3, _mm2_to_m2(collector_mm2 * request.collector_count)
    )
    v_feeder = calc_velocity_m_s(mass_flow, alloy.density_kg_m3, _mm2_to_m2(feeder_total_mm2))

    slag_d_m = request.slag_particle_diameter_mm / 1000
    v_slag = calc_slag_float_velocity_m_s(slag_d_m, alloy.density_kg_m3, request.slag_density_kg_m3)

    _, _, trap_h_m = calc_trapezoid_dimensions_m(_mm2_to_m2(collector_mm2))
    collector_min_length_m = calc_collector_min_length_m(trap_h_m, v_collector, v_slag)

    _, _, feeder_trap_h_m = calc_trapezoid_dimensions_m(_mm2_to_m2(feeder_single_mm2))
    h_min, h_rec = _feeder_height_recommendation(
        request,
        alloy,
        feeder_trap_h_m * 1000,
    )

    d_bottom, d_top = _sprue_diameters_mm(
        sprue_mm2, request.castings_per_mold, request.sprue_taper, request.sprue_draft_mm
    )

    def_l_f, def_l_c, def_h_s = default_element_lengths(request.casting_mass_kg)
    feeder_len_mm = (request.feeder_length_m or def_l_f) * 1000
    collector_len_mm = (request.collector_length_m or max(collector_min_length_m, def_l_c)) * 1000

    filter_area = feeder_total_mm2 / FILTER_AREA_DIVISOR if request.filter_screen else None

    final_breakdown = estimate_gating_mass(
        alloy.density_kg_m3,
        _mm2_to_m2(feeder_single_mm2),
        feeder_len_mm / 1000,
        request.feeder_count,
        _mm2_to_m2(collector_mm2),
        collector_len_mm / 1000,
        request.collector_count,
        math.pi * (d_bottom / 2000) ** 2,
        math.pi * (d_top / 2000) ** 2,
        request.sprue_height_m or def_h_s,
        estimate_funnel_mass_kg(cup_d, alloy.density_kg_m3),
    )

    notes: list[str] = [
        "F = G / (ρ · τ · μ · √(2g · Hр)) — формула (2.1).",
        f"Hр: {static_head_formula} = {static_head_m:.3f} м.",
        f"τ: {pouring_formula}.",
        f"Наименьшее сечение — {smallest_element}. Fпит:Fколл:Fст = {_format_ratio(area_ratio)}.",
    ]
    if request.iterate_mass:
        notes.append(
            f"Итерационное уточнение массы ЛПС: {iteration_count} шаг(ов), "
            f"Gл.с = {final_breakdown.total_kg:.2f} кг (формулы 2.9–2.10)."
        )
    if request.filter_screen:
        notes.append(f"Фильтровальная сетка: Fф.с = Fп / {FILTER_AREA_DIVISOR:g}.")
    if collector_min_length_m * 1000 > collector_len_mm:
        notes.append(
            f"⚠ Мин. длина коллектора для шлакоотделения: {collector_min_length_m*1000:.0f} мм "
            f"(формула 2.7, νв = {v_slag:.3f} м/с)."
        )
    if h_min and h_rec and h_rec < h_min:
        notes.append(f"⚠ Высота питателя {h_rec:.1f} мм < минимальной {h_min:.1f} мм (формула 2.6).")
    if mass_flow > 5.0:
        notes.append(f"⚠ Расход {mass_flow:.1f} кг/с — рекомендуется литниковая чаша (табл. 1.2–1.4).")
    if alloy.notes:
        notes.append(alloy.notes)

    return CalculationResult(
        alloy_id=alloy.id,
        alloy_name=alloy.name,
        system_type=system_type_ru,
        casting_mass_kg=request.casting_mass_kg,
        riser_mass_kg=request.riser_mass_kg,
        gating_mass_kg=round(final_breakdown.total_kg, 3),
        total_metal_mass_kg=round(base_mass + final_breakdown.total_kg, 3),
        pouring_time_s=round(pouring_time, 2),
        pouring_time_formula=pouring_formula,
        static_head_m=round(static_head_m, 4),
        static_head_formula=static_head_formula,
        discharge_coefficient=mu,
        feeder_count=request.feeder_count,
        collector_count=request.collector_count,
        castings_per_mold=request.castings_per_mold,
        area_ratio=_format_ratio(area_ratio),
        smallest_element=smallest_element,
        volume_flow_m3_s=round(volume_flow, 6),
        filter_screen_area_mm2=round(filter_area, 2) if filter_area else None,
        collector_min_length_mm=round(collector_min_length_m * 1000, 1),
        feeder_min_height_mm=round(h_min, 1) if h_min else None,
        feeder_recommended_height_mm=round(h_rec, 1) if h_rec else None,
        sprue_bottom_diameter_mm=round(d_bottom, 2),
        sprue_top_diameter_mm=round(d_top, 2),
        velocities=VelocityResult(
            sprue_m_s=round(v_sprue, 3),
            collector_m_s=round(v_collector, 3),
            feeder_m_s=round(v_feeder, 3),
            slag_float_m_s=round(v_slag, 4),
        ),
        mass_breakdown=MassBreakdownResult(
            feeder_kg=round(final_breakdown.feeder_kg, 3),
            collector_kg=round(final_breakdown.collector_kg, 3),
            sprue_kg=round(final_breakdown.sprue_kg, 3),
            funnel_kg=round(final_breakdown.funnel_kg, 3),
            total_kg=round(final_breakdown.total_kg, 3),
            iteration_count=iteration_count,
        ),
        funnel=FunnelResult(
            name="Литниковая воронка",
            mass_flow_kg_s=round(mass_flow, 2),
            funnel_number=funnel_num,
            cup_diameter_mm=cup_d,
            sprue_top_diameter_mm=round(sprue_top_d, 1),
            description=f"Воронка №{funnel_num}, чаша Ø{cup_d} мм, dст.в = {sprue_top_d:.0f} мм",
        ),
        sprue=GatingSectionResult(
            name="Стояк",
            area_mm2=round(sprue_mm2, 2),
            dimensions=_build_section(
                sprue_mm2,
                request.sprue_shape,
                "Стояк",
                velocity_m_s=v_sprue,
            ),
        ),
        collector=GatingSectionResult(
            name="Литниковый ход (коллектор)",
            area_mm2=round(collector_mm2, 2),
            dimensions=_build_section(
                collector_mm2,
                request.collector_shape,
                "Коллектор",
                length_mm=round(collector_len_mm, 1),
                velocity_m_s=v_collector,
            ),
        ),
        feeder_single=GatingSectionResult(
            name="Питатель (один)",
            area_mm2=round(feeder_single_mm2, 2),
            dimensions=_build_section(
                feeder_single_mm2,
                request.feeder_shape if request.feeder_shape != "trapezoid" else "trapezoid",
                "Питатель",
                request.feeder_aspect_ratio,
                length_mm=round(feeder_len_mm, 1),
                velocity_m_s=v_feeder,
            ),
        ),
        feeder_total=GatingSectionResult(
            name="Питатели (суммарно)",
            area_mm2=round(feeder_total_mm2, 2),
            dimensions=SectionDimensions(
                shape="total",
                area_mm2=round(feeder_total_mm2, 2),
                description=f"Σ {request.feeder_count} питателей = {feeder_total_mm2:.1f} мм²",
                velocity_m_s=round(v_feeder, 3),
            ),
        ),
        notes=notes,
    )

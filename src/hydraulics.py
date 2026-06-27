"""Гидравлические расчёты: напор, время заливки, скорости, шлак."""

from __future__ import annotations

import math

from src.alloys import Alloy
from src.constants import GRAVITY_M_S2, POURING_S_LARGE, POURING_S_THIN_WALL


def interpolate_table(table: list[tuple[float, float]], value: float) -> float:
    for threshold, coeff in table:
        if value <= threshold:
            return coeff
    return table[-1][1]


def calc_static_head(
    layout: str,
    sprue_height_m: float,
    casting_height_m: float,
    inlet_distance_m: float,
) -> tuple[float, str]:
    c_half = casting_height_m / 2
    formulas = {
        "side": (sprue_height_m - inlet_distance_m - c_half, "Hр = H₀ − P − C/2"),
        "top": (sprue_height_m, "Hр = H₀"),
        "siphon": (sprue_height_m - c_half, "Hр = H₀ − C/2"),
        "symmetric": (sprue_height_m - casting_height_m / 8, "Hр = H₀ − C/8"),
    }
    if layout not in formulas:
        raise ValueError(f"Неизвестная схема подводки: {layout}")
    head, formula = formulas[layout]
    return max(head, 0.01), formula


def calc_pouring_time(
    alloy: Alloy,
    total_mass_kg: float,
    method: str,
    wall_thickness_mm: float | None,
    coefficient_s: float | None,
    manual_time_s: float | None,
) -> tuple[float, str]:
    if manual_time_s is not None:
        return manual_time_s, "Задано вручную"

    if method == "thin_sqrt":
        s = coefficient_s or (
            interpolate_table(POURING_S_THIN_WALL, wall_thickness_mm)
            if wall_thickness_mm
            else alloy.pouring_time_s
        )
        tau = s * math.sqrt(total_mass_kg)
        return max(alloy.min_pouring_time_s, tau), f"τ = S·√G, S = {s:g} (формула 2.2)"

    if method == "large_cube":
        delta = wall_thickness_mm or 20.0
        s = coefficient_s or interpolate_table(POURING_S_LARGE, delta)
        tau = delta * s * (total_mass_kg ** (1 / 3))
        return max(alloy.min_pouring_time_s, tau), f"τ = δ·S·∛G, δ = {delta:g} мм (формула 2.3)"

    if total_mass_kg <= 500 and wall_thickness_mm:
        s = coefficient_s or interpolate_table(POURING_S_THIN_WALL, wall_thickness_mm)
        tau = s * math.sqrt(total_mass_kg)
        return max(alloy.min_pouring_time_s, tau), f"τ = S·√G, S = {s:g} (авто, формула 2.2)"

    if total_mass_kg > 500 and wall_thickness_mm:
        delta = wall_thickness_mm
        s = coefficient_s or interpolate_table(POURING_S_LARGE, delta)
        tau = delta * s * (total_mass_kg ** (1 / 3))
        return max(alloy.min_pouring_time_s, tau), f"τ = δ·S·∛G (авто, формула 2.3)"

    tau = alloy.pouring_time_s * math.sqrt(total_mass_kg)
    return max(alloy.min_pouring_time_s, tau), f"τ = S·√G, S = {alloy.pouring_time_s:g} (по сплаву)"


def calc_smallest_area_m2(
    total_mass_kg: float,
    density_kg_m3: float,
    pouring_time_s: float,
    discharge_coefficient: float,
    static_head_m: float,
) -> float:
    hydraulic = math.sqrt(2 * GRAVITY_M_S2 * static_head_m)
    return total_mass_kg / (density_kg_m3 * pouring_time_s * discharge_coefficient * hydraulic)


def calc_velocity_m_s(mass_flow_kg_s: float, density_kg_m3: float, area_m2: float) -> float:
    if area_m2 <= 0:
        return 0.0
    return mass_flow_kg_s / (density_kg_m3 * area_m2)


def calc_slag_float_velocity_m_s(
    particle_diameter_m: float,
    metal_density_kg_m3: float,
    slag_density_kg_m3: float,
) -> float:
    delta_rho = metal_density_kg_m3 - slag_density_kg_m3
    if delta_rho <= 0:
        return 0.0
    return math.sqrt(2 * GRAVITY_M_S2 * particle_diameter_m * delta_rho / metal_density_kg_m3)


def calc_collector_min_length_m(
    collector_height_m: float,
    collector_velocity_m_s: float,
    float_velocity_m_s: float,
) -> float:
    if float_velocity_m_s <= 0:
        return 0.0
    return 1.2 * collector_height_m * collector_velocity_m_s / float_velocity_m_s


def calc_min_feeder_height_mm(pour_temp_c: float, carbon_equivalent: float | None) -> float | None:
    if carbon_equivalent is None:
        return None
    inner = pour_temp_c - (1670 - 124 * carbon_equivalent)
    return max(3.0, 3.5 - 0.01 * inner)


def calc_trapezoid_dimensions_m(area_m2: float) -> tuple[float, float, float]:
    a = math.sqrt(area_m2 / 1.0625)
    return a, 0.7 * a, 1.25 * a

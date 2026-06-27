"""Оценка массы литниковой системы и итерационное уточнение."""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class GatingMassBreakdown:
    feeder_kg: float
    collector_kg: float
    sprue_kg: float
    funnel_kg: float
    total_kg: float


def _cone_frustum_mass_kg(
    height_m: float,
    bottom_radius_m: float,
    top_radius_m: float,
    density_kg_m3: float,
) -> float:
    return (
        math.pi
        * density_kg_m3
        * height_m
        / 3
        * (bottom_radius_m**2 + bottom_radius_m * top_radius_m + top_radius_m**2)
    )


def estimate_gating_mass(
    density_kg_m3: float,
    feeder_area_m2: float,
    feeder_length_m: float,
    feeder_count: int,
    collector_area_m2: float,
    collector_length_m: float,
    collector_count: int,
    sprue_bottom_area_m2: float,
    sprue_top_area_m2: float,
    sprue_height_m: float,
    funnel_mass_kg: float,
) -> GatingMassBreakdown:
    feeder_kg = feeder_area_m2 * feeder_length_m * density_kg_m3 * feeder_count
    collector_kg = collector_area_m2 * collector_length_m * density_kg_m3 * collector_count
    r_bottom = math.sqrt(max(sprue_bottom_area_m2, 0) / math.pi)
    r_top = math.sqrt(max(sprue_top_area_m2, 0) / math.pi)
    sprue_kg = _cone_frustum_mass_kg(sprue_height_m, r_bottom, r_top, density_kg_m3)
    total = feeder_kg + collector_kg + sprue_kg + funnel_mass_kg
    return GatingMassBreakdown(
        feeder_kg=feeder_kg,
        collector_kg=collector_kg,
        sprue_kg=sprue_kg,
        funnel_kg=funnel_mass_kg,
        total_kg=total,
    )


def default_element_lengths(casting_mass_kg: float) -> tuple[float, float, float]:
    if casting_mass_kg <= 5:
        return 0.04, 0.15, 0.20
    if casting_mass_kg <= 50:
        return 0.06, 0.25, 0.30
    if casting_mass_kg <= 500:
        return 0.10, 0.40, 0.45
    return 0.15, 0.60, 0.70


def estimate_funnel_mass_kg(cup_diameter_mm: float, density_kg_m3: float) -> float:
    h_m = cup_diameter_mm / 1000 * 0.8
    r = cup_diameter_mm / 2000
    return _cone_frustum_mass_kg(h_m, r, r * 1.4, density_kg_m3)

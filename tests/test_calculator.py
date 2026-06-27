"""Тесты калькулятора литниковой системы."""

import math

from src.calculator import calculate_gating_system
from src.constants import GRAVITY_M_S2
from src.hydraulics import calc_static_head
from src.models import CalculationRequest


def test_constricting_smallest_is_feeder():
    result = calculate_gating_system(
        CalculationRequest(
            alloy_id="gray_cast_iron",
            casting_mass_kg=12,
            feeder_count=6,
            pouring_time_s=7.6,
            static_head_m=0.25,
            discharge_coefficient=0.4,
            iterate_mass=False,
        )
    )
    assert result.smallest_element == "питатель"
    assert result.feeder_total.area_mm2 < result.collector.area_mm2


def test_static_head_auto_side():
    head, formula = calc_static_head("side", 0.25, 0.0344, 0.0122)
    assert abs(head - (0.25 - 0.0122 - 0.0344 / 2)) < 0.001
    assert "H₀" in formula


def test_ozann_dittert_formula():
    result = calculate_gating_system(
        CalculationRequest(
            alloy_id="gray_cast_iron",
            casting_mass_kg=12,
            feeder_count=1,
            pouring_time_s=7.6,
            static_head_m=0.25,
            discharge_coefficient=0.4,
            iterate_mass=False,
        )
    )
    expected = 12 / (7000 * 7.6 * 0.4 * math.sqrt(2 * GRAVITY_M_S2 * 0.25)) * 1e6
    assert abs(result.feeder_total.area_mm2 - expected) < 0.5


def test_iteration_increases_mass():
    r_no = calculate_gating_system(
        CalculationRequest(alloy_id="gray_cast_iron", casting_mass_kg=50, iterate_mass=False)
    )
    r_yes = calculate_gating_system(
        CalculationRequest(alloy_id="gray_cast_iron", casting_mass_kg=50, iterate_mass=True)
    )
    assert r_yes.total_metal_mass_kg >= r_no.total_metal_mass_kg
    assert r_yes.mass_breakdown.iteration_count >= 1


def test_filter_reduces_feeder_area():
    base = CalculationRequest(
        alloy_id="gray_cast_iron",
        casting_mass_kg=20,
        pouring_time_s=10,
        static_head_m=0.25,
        iterate_mass=False,
    )
    r0 = calculate_gating_system(base)
    r1 = calculate_gating_system(base.model_copy(update={"filter_screen": True}))
    assert r1.feeder_total.area_mm2 < r0.feeder_total.area_mm2
    assert r1.filter_screen_area_mm2 is not None


def test_expanding_smallest_is_sprue():
    result = calculate_gating_system(
        CalculationRequest(
            alloy_id="al_silicon",
            casting_mass_kg=10,
            pouring_time_s=5,
            static_head_m=0.3,
            iterate_mass=False,
        )
    )
    assert result.smallest_element == "стояк"
    assert result.sprue.area_mm2 < result.feeder_total.area_mm2

"""Тесты гидравлических функций."""

from src.hydraulics import calc_pouring_time, calc_slag_float_velocity_m_s
from src.alloys import get_alloy


def test_pouring_time_thin_wall():
    alloy = get_alloy("gray_cast_iron")
    tau, note = calc_pouring_time(alloy, 12, "thin_sqrt", 6.0, None, None)
    assert abs(tau - 2.2 * (12**0.5)) < 0.01
    assert "2.2" in note


def test_slag_float_velocity():
    v = calc_slag_float_velocity_m_s(0.002, 7000, 4500)
    assert 0.05 < v < 0.5

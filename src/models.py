"""Модели входных данных и результатов расчёта."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CalculationRequest(BaseModel):
    alloy_id: str
    casting_mass_kg: float = Field(gt=0, description="Масса отливки, кг")

    feeder_count: int = Field(default=2, ge=1, le=32)
    collector_count: int = Field(default=1, ge=1, le=8)
    castings_per_mold: int = Field(default=1, ge=1, le=32, description="Отливок в форме")

    wall_thickness_mm: float | None = Field(default=None, gt=0, description="δ — толщина стенки, мм")
    casting_height_m: float | None = Field(default=None, ge=0, description="C — высота отливки в форме, м")
    inlet_distance_m: float | None = Field(default=None, ge=0, description="P — от верха отливки до точки подвода, м")
    wall_thickness_at_feeder_mm: float | None = Field(default=None, gt=0)

    static_head_m: float | None = Field(default=None, gt=0, description="Hр напрямую, м")
    sprue_height_m: float | None = Field(default=0.25, gt=0, description="H₀ — высота металлического столба, м")
    gating_layout: str = Field(
        default="side",
        pattern="^(side|top|siphon|symmetric)$",
        description="Схема подводки для расчёта Hр",
    )

    pouring_time_s: float | None = Field(default=None, gt=0)
    pouring_time_method: str = Field(
        default="auto",
        pattern="^(auto|thin_sqrt|large_cube|manual)$",
    )
    pouring_time_coefficient_s: float | None = Field(default=None, gt=0, description="S — коэффициент времени заливки")

    discharge_coefficient: float | None = Field(default=None, gt=0, le=1)
    mold_moisture: str = Field(default="wet", pattern="^(wet|dry)$")

    area_ratio_feeder: float | None = Field(default=None, gt=0)
    area_ratio_collector: float | None = Field(default=None, gt=0)
    area_ratio_sprue: float | None = Field(default=None, gt=0)
    thin_walled: bool = Field(default=False, description="Тонкостенная отливка (соотношение 1:1,06:1,11)")
    steel_wall_type: str = Field(default="thick", pattern="^(thick|thin)$")

    filter_screen: bool = Field(default=False, description="Фильтровальная сетка Fф.с = Fп/1,1")

    feeder_attachment: str = Field(default="to_riser", pattern="^(to_riser|to_casting)$")
    feeder_length_m: float | None = Field(default=None, gt=0)
    feeder_shape: str = Field(default="trapezoid", pattern="^(circle|square|rectangle|trapezoid)$")
    feeder_aspect_ratio: float = Field(default=3.0, ge=1.0, le=10.0)

    collector_length_m: float | None = Field(default=None, gt=0)
    collector_shape: str = Field(default="trapezoid", pattern="^(circle|square|trapezoid|rectangle)$")

    sprue_shape: str = Field(default="circle", pattern="^(circle|square)$")
    sprue_taper: str = Field(default="constricting_down", pattern="^(constricting_down|expanding_up)$")
    sprue_draft_mm: float = Field(default=5.0, ge=0, description="Прибавка к dст.в при ручной формовке")

    slag_particle_diameter_mm: float = Field(default=2.0, gt=0)
    slag_density_kg_m3: float = Field(default=4500, gt=0)
    pour_temperature_c: float | None = Field(default=None, description="Tзал, °C")
    carbon_equivalent: float | None = Field(default=None, description="Сэкв для чугуна")

    iterate_mass: bool = Field(default=True, description="Итерационное уточнение Gл.с (формулы 2.9–2.10)")
    iteration_tolerance: float = Field(default=0.03, gt=0, le=0.2)
    overrun_factor: float | None = Field(default=None, ge=0, le=1)
    riser_mass_kg: float = Field(default=0.0, ge=0, description="Масса прибылей, кг")


class SectionDimensions(BaseModel):
    shape: str
    area_mm2: float
    description: str
    width_mm: float | None = None
    height_mm: float | None = None
    diameter_mm: float | None = None
    side_mm: float | None = None
    length_mm: float | None = None
    velocity_m_s: float | None = None


class GatingSectionResult(BaseModel):
    name: str
    area_mm2: float
    dimensions: SectionDimensions


class FunnelResult(BaseModel):
    name: str
    mass_flow_kg_s: float
    funnel_number: int
    cup_diameter_mm: float
    sprue_top_diameter_mm: float
    description: str


class VelocityResult(BaseModel):
    sprue_m_s: float
    collector_m_s: float
    feeder_m_s: float
    slag_float_m_s: float


class MassBreakdownResult(BaseModel):
    feeder_kg: float
    collector_kg: float
    sprue_kg: float
    funnel_kg: float
    total_kg: float
    iteration_count: int


class CalculationResult(BaseModel):
    alloy_id: str
    alloy_name: str
    system_type: str
    casting_mass_kg: float
    riser_mass_kg: float
    gating_mass_kg: float
    total_metal_mass_kg: float
    pouring_time_s: float
    pouring_time_formula: str
    static_head_m: float
    static_head_formula: str
    discharge_coefficient: float
    feeder_count: int
    collector_count: int
    castings_per_mold: int
    area_ratio: str
    smallest_element: str
    volume_flow_m3_s: float
    filter_screen_area_mm2: float | None
    collector_min_length_mm: float | None
    feeder_min_height_mm: float | None
    feeder_recommended_height_mm: float | None
    sprue_bottom_diameter_mm: float | None
    sprue_top_diameter_mm: float | None
    velocities: VelocityResult
    mass_breakdown: MassBreakdownResult
    funnel: FunnelResult
    sprue: GatingSectionResult
    collector: GatingSectionResult
    feeder_single: GatingSectionResult
    feeder_total: GatingSectionResult
    notes: list[str]

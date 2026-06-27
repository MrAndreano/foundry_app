"""FastAPI-приложение: калькулятор литниковой системы."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from src.alloys import list_alloys
from src.calculator import calculate_gating_system
from src.models import CalculationRequest, CalculationResult

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"

app = FastAPI(
    title="Foundry Gating Calculator",
    description="Расчёт литниковой системы: воронка → стояк → коллектор → питатель",
    version="2.1.0",
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=HTMLResponse)
async def index() -> HTMLResponse:
    return HTMLResponse((STATIC_DIR / "index.html").read_text(encoding="utf-8"))


@app.get("/api/alloys")
async def api_alloys() -> list[dict]:
    return [
        {
            "id": a.id,
            "name": a.name,
            "group": a.group,
            "density_kg_m3": a.density_kg_m3,
            "system_type": a.system_type,
            "area_ratio": a.area_ratio,
            "discharge_coefficient_wet": a.discharge_coefficient_wet,
            "discharge_coefficient_dry": a.discharge_coefficient_dry,
            "overrun_factor": a.overrun_factor,
            "notes": a.notes,
        }
        for a in list_alloys()
    ]


@app.post("/api/calculate", response_model=CalculationResult)
async def api_calculate(request: CalculationRequest) -> CalculationResult:
    try:
        return calculate_gating_system(request)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ZeroDivisionError as exc:
        raise HTTPException(status_code=400, detail="Некорректные параметры расчёта") from exc

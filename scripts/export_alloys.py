"""Экспорт базы сплавов из Python в docs/js/data.js."""

import json
from pathlib import Path

from src.alloys import list_alloys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "js" / "data.js"


def main() -> None:
    alloys = []
    for a in list_alloys():
        alloys.append({
            "id": a.id,
            "name": a.name,
            "group": a.group,
            "density_kg_m3": a.density_kg_m3,
            "system_type": a.system_type,
            "area_ratio": list(a.area_ratio),
            "discharge_coefficient_wet": a.discharge_coefficient_wet,
            "discharge_coefficient_dry": a.discharge_coefficient_dry,
            "pouring_time_s": a.pouring_time_s,
            "min_pouring_time_s": a.min_pouring_time_s,
            "overrun_factor": a.overrun_factor,
            "notes": a.notes,
        })
    js = "/** Auto-generated — run: python scripts/export_alloys.py */\nconst ALLOYS = "
    js += json.dumps(alloys, ensure_ascii=False, indent=2)
    js += ";\n"
    OUT.write_text(js, encoding="utf-8")
    print(f"Written {OUT}")


if __name__ == "__main__":
    main()

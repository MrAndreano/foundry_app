# Foundry Gating Calculator

Калькулятор литниковой системы: **Воронка → Стояк → Коллектор → Питатель** (метод Озанна–Диттерта).

## GitHub Pages (рекомендуется)

Сайт полностью **статический** — расчёт в браузере, сервер не нужен.

Репозиторий: [github.com/MrAndreano/foundry_app](https://github.com/MrAndreano/foundry_app)

Сайт: **https://mrandreano.github.io/foundry_app/**

### Публикация (один раз в настройках GitHub)

1. Откройте **Settings → Pages** в репозитории  
   https://github.com/MrAndreano/foundry_app/settings/pages

2. **Build and deployment → Source** → выберите **Deploy from a branch**

3. **Branch** → `gh-pages` → папка **`/ (root)`** → Save

4. При каждом push в `main` workflow публикует содержимое папки `docs/` в ветку `gh-pages`.

5. Сайт: **https://mrandreano.github.io/foundry_app/**  
   (первый деплой — 1–3 минуты после включения Pages)

> Если workflow уже запускался до настройки Pages — откройте **Actions** и нажмите **Re-run all jobs**.

### Локальный просмотр (без Python)

Откройте `docs/index.html` в браузере или:

```bash
cd docs
npx --yes serve .
```

## Локальный запуск с Python (опционально)

FastAPI-версия для разработки и pytest:

```bash
pip install -r requirements.txt
python run.py
# http://127.0.0.1:8080
pytest tests/ -v
```

## Структура

```
foundry-gating-calc/
├── docs/                 ← GitHub Pages (статика)
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── data.js       ← база сплавов
│       ├── engine.js     ← расчётный движок (JS)
│       └── app.js        ← UI
├── src/                  ← Python-версия (FastAPI + тесты)
├── .github/workflows/pages.yml
└── scripts/export_alloys.py
```

## Синхронизация базы сплавов

После изменения `src/alloys.py`:

```bash
python scripts/export_alloys.py
```

Обновит `docs/js/data.js` для GitHub Pages.

## Источник

[Чуркин Б.С. — Проектирование и расчёт литниковых систем](https://elar.uspu.ru/bitstream/ru-uspu/5566/1/978-5-8050-0483-5_2012.pdf)

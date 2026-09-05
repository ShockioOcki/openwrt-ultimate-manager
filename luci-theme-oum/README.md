# luci-theme-oum — системная тема OUM

Полноценная системная тема LuCI в том же визуальном языке, что и панель OUM.
Тема устанавливается рядом со стандартным Bootstrap и не изменяет его файлы.

- **seed** `304ab282` · **палитра** `#eef0ea` (canvas) / `#172c28` (console) / `#2868d7` (action)
- Каркас: актуальные шаблонные контракты LuCI 25.12, локальная копия базовых Bootstrap-стилей и отдельный слой OUM
- Оболочка: боковое меню 226px, верхняя панель, рабочая область до 1240px, те же формы, таблицы, вкладки и кнопки, что в `dashboard-tailadmin.html`
- Шаблоны: `ucode/template/themes/oum/{header,footer,sysauth}.ut` без устаревшего вызова `dispatcher.node()`
- Шрифт: локальный Inter с кириллицей, без CDN
- Интеграция: регистрируется в `luci.themes.OUM=/luci-static/oum`, `mediaurlbase` переключается в Системе → Язык и стиль
- Совместима с `luci-app-oum` (dashboard-v21 / settings-v20 / parental / help) — внутри панели остаются `.oum-*` стили

## Безопасная тестовая установка

```sh
./deploy.sh 192.168.5.1 ~/.ssh/oum_router_ed25519
```

Скрипт сначала сохраняет текущий `mediaurlbase`, устанавливает тему **неактивной** и проверяет наличие всех файлов. Переключение выполняется отдельно после проверки. Собранный пакет устанавливается стандартно через `apk add --allow-untrusted`.

## Структура

```
luci-theme-oum/
├── Makefile
├── htdocs/luci-static/oum/{bootstrap-base.css,bootstrap-mobile.css,cascade.css}
├── htdocs/luci-static/oum/fonts/
├── htdocs/luci-static/resources/menu-oum.js
├── htdocs/luci-static/oum/{logo,brand}.svg + icons/
├── root/etc/uci-defaults/30_luci-theme-oum
├── root/etc/config/oum_theme
├── root/usr/share/rpcd/acl.d/luci-theme-oum.json
└── ucode/template/themes/oum/{header,footer,sysauth}.ut
```

## Принципы

- Весь стандартный LuCI получает оболочку и компоненты OUM, но сетевые RPC/UCI не меняются.
- Внутреннее меню `luci-app-oum` скрывается только под системной темой OUM, чтобы не появлялись два сайдбара.
- Светлая тема включена по умолчанию; тёмная хранится только в локальном браузере.
- Bootstrap остаётся аварийной темой и не перезаписывается.

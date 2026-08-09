# Universal Notification Hub (не завершенный. реализация зашла в тупик) 

Универсальный бэкенд push-уведомлений. Сервисы-отправители (банки, соцсети и т.п.) шлют уведомления через REST API, а бэкенд доставляет их пользователям по подходящим каналам (Web Push, WebSocket — планируется). Клиенты (веб, iOS, Android) подключаются к бэкенду через публичный API.

**Ветки:** `dev` — основная разработка (пушить только сюда). `master` — стабильный релиз.

## Архитектура

```
Сервис-отправитель ──POST /api/v1/notify──>  Hub API  ──Web Push──>  PWA (веб)
     (X-API-Key)                              (VAPID)   ──WebSocket─>  Native iOS/Android (планируется)
                                              │
                                   ──GET /api/v1/notifications?user_id=──> любой клиент (история)
                                              │
                                  /api/v1/admin/* (JWT) <── /admin (веб-админка)
```

## Быстрый старт

```bash
cd backend
cp .env.example .env      # настроить порт, базу, VAPID, админ-доступ
npm install
npm run generate-vapid     # сгенерировать VAPID ключи (скопировать в .env)
npm run migrate            # создать таблицы
npm run dev                # сервер на http://localhost:3001
```

- Админка: `http://localhost:3001/admin`
- Демо PWA: `http://localhost:3001/pwa`

### Переменные окружения

| Переменная | Описание | По умолчанию |
|---|---|---|
| `PORT` | Порт HTTP | `3000` |
| `DB_CLIENT` | `sqlite3` (PostgreSQL позже) | `sqlite3` |
| `DB_FILENAME` | Путь к файлу SQLite | `./data/hub.sqlite` |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Ключи Web Push | — |
| `VAPID_SUBJECT` | Contact для VAPID | `mailto:admin@hub.local` |
| `BASE_URL` | Базовый URL (для абсолютных ссылок на логотипы) | `http://localhost:3000` |
| `ADMIN_USERNAME` | Логин админа | `admin` |
| `ADMIN_PASSWORD` | Пароль админа. **Обязателен в production** (в dev без него генерируется временный) | — |
| `JWT_SECRET` | Секрет для JWT-сессий админки. **Обязателен в production** | — |
| `JWT_EXPIRES_IN` | Время жизни JWT | `8h` |
| `CORS_ORIGINS` | Разрешённые origins через запятую. Пусто = все (только dev) | — |
| `UPLOAD_DIR` / `MAX_FILE_SIZE` | Каталог загрузок / лимит логотипа (байт) | `./uploads` / `1048576` |

### Скрипты

```bash
npm run dev        # dev-сервер (--watch)
npm start          # прод-запуск
npm run migrate    # применить миграции
npm test           # юнит + API тесты
npm run generate-vapid
```

## Аутентификация

Два независимых механизма:

1. **API-ключи отправителей** (`X-API-Key`) — для `/notify`, `PATCH /sources/:id`, загрузки логотипа. Ключ (`sk_...`) выдаётся один раз при создании источника или при регенерации. Хранится только хеш (SHA-256).
2. **JWT админки** (`Authorization: Bearer <token>`) — для `/api/v1/admin/*`. Получается через `POST /api/v1/admin/login`.

## Публичный API (для клиентов и отправителей)

### Источники

| Метод | Путь | Auth | Описание |
|---|---|---|---|
| `POST` | `/api/v1/sources` | нет | Создать источник → возвращает `api_key` (показывается один раз) |
| `GET` | `/api/v1/sources` | нет | Список активных источников |
| `GET` | `/api/v1/sources/:id` | нет | Детали источника |
| `PATCH` | `/api/v1/sources/:id` | API Key | Обновить `name`/`description`/`website_url` |
| `POST` | `/api/v1/sources/:id/logo` | API Key | Загрузить логотип (multipart, поле `logo`) |

`POST /api/v1/sources` body:
```json
{ "name": "Bank", "domain": "bank.example.com", "description": "...", "website_url": "https://..." }
```
Ответ: `201` + `{ id, name, domain, api_key: "sk_...", description, website_url }`.

Логотип: `image/jpeg`, `image/png`, `image/webp`, до `MAX_FILE_SIZE` байт. Контент проверяется по **magic bytes** (не только MIME).

### Подписки

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/v1/subscribe` | Подписать пользователя |
| `DELETE` | `/api/v1/subscribe` | Отписать пользователя |
| `GET` | `/api/v1/subscribe?user_id=` | Список активных подписок пользователя |

`POST` body:
```json
{
  "user_id": "uuid",            // опционально, иначе генерируется сервером
  "source_id": "uuid",
  "device_type": "pwa",         // pwa | native_ios
  "push_subscription": { ... }  // для pwa
}
```

### Отправка уведомлений

```bash
POST /api/v1/notify
X-API-Key: sk_...
Content-Type: application/json

{
  "title": "Новый перевод",
  "body": "500 руб от Ивана",
  "data": { "deep_link": "https://bank.example.com/transfer/123" }
}
```

Ответ:
```json
{
  "notification_id": "uuid",
  "status": "sent",       // sent | partial | failed
  "sent": 5,
  "failed": 0,
  "total": 5
}
```

Один `notify` фан-аутит по всем активным подписчикам источника, доставляя каждому подходящим каналом. При истечении push-подписки (404/410) она автоматически деактивируется.

### История уведомлений (для клиентов)

```
GET /api/v1/notifications?user_id=<uuid>&limit=50&offset=0
```
Возвращает уведомления, доставленные пользователю (для подтяжки после оффлайна). `limit` ≤ 200.

### Служебные

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/v1/health` | Проверка сервера |
| `GET` | `/api/v1/vapid-public-key` | VAPID-ключ для PWA |

## Admin API (требуется JWT)

```
Authorization: Bearer <token>
```

### Аутентификация админа

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/v1/admin/login` | `{ username, password }` → `{ token, username }`. Rate-limit 10/15 мин |
| `GET` | `/api/v1/admin/me` | Профиль текущего админа |

### Источники

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/v1/admin/sources` | Все источники + счётчик подписчиков |
| `POST` | `/api/v1/admin/sources` | Создать (то же, что публичный) |
| `GET` | `/api/v1/admin/sources/:id` | Детали + подписчики |
| `PATCH` | `/api/v1/admin/sources/:id` | Обновить поля |
| `POST` | `/api/v1/admin/sources/:id/logo` | Загрузить логотип |
| `POST` | `/api/v1/admin/sources/:id/activate` | Включить |
| `POST` | `/api/v1/admin/sources/:id/deactivate` | Выключить (скрыть из публичного списка) |
| `POST` | `/api/v1/admin/sources/:id/api-key` | **Регенерировать API-ключ** (старый инвалидируется; новый показывается один раз) |
| `GET` | `/api/v1/admin/sources/:id/stats` | Подписчики, уведомления, sent/failed |

### Статистика и история

| Метод | Путь | Описание |
|---|---|---|
| `GET` | `/api/v1/admin/stats` | Сводка: источники, пользователи, подписки, уведомления, доставки |
| `GET` | `/api/v1/admin/notifications?source_id=&status=&limit=&offset=` | История уведомлений с фильтрами и пагинацией |
| `GET` | `/api/v1/admin/notifications/:id` | Детали уведомления + список доставок (пользователь, устройство, статус, ошибка) |

## Ошибки

Все ответы об ошибках: `{ "error": "..." }` с подходящим HTTP-кодом.

| Код | Значение |
|---|---|
| `400` | Невалидный запрос (нет полей, неверный тип) |
| `401` | Нет/неверный токен, неверные креды |
| `403` | Неверный или неактивный API-ключ / недостаточно прав |
| `404` | Ресурс не найден |
| `409` | Конфликт (домен источника уже существует) |
| `429` | Превышен rate-limit |

## Безопасность

- **Helmet** — security-заголовки, отключён `X-Powered-By`.
- **Rate-limit** — `/admin/login` (10/15 мин), `/notify` (60/мин), `/subscribe` (120/мин).
- **Валидация входных данных** на всех write-эндпоинтах.
- **Логотипы** — проверка magic bytes (JPEG/PNG/WebP) + лимит размера.
- **API-ключи** хранятся только как SHA-256 хеши; показ только при создании/регенерации.
- **Пароль админа** — только в env, сравнение константного времени; обязателен в production.
- **CORS** — настраиваемый через `CORS_ORIGINS` (в production желательно указывать).
- **SQL** — параметризованные запросы, без интерполяции пользовательского ввода.

## WebSocket (планируется)

Нативный канал доставки для iOS/Android. Черновой протокол:
- подключение: `ws://<host>/ws`
- клиент → сервер: `{ "type": "auth", "user_id": "uuid" }` → сервер: `{ "type": "auth_ok" }`
- сервер → клиент: `{ "type": "notification", "notification_id", "title", "body", "icon_url", "data", "created_at" }`
- keepalive: ping/pong.

## Модель данных

Миграции: `backend/src/migrations/`. Таблицы:
`traffic_sources`, `users`, `user_subscriptions`, `notifications`, `notification_deliveries`.

## Тесты и CI

- Юнит: `backend/test/unit/` (auth, security, валидация, логотипы, delivery).
- API: `backend/test/api/` (полные флоу с in-memory БД).
- CI: `.github/workflows/ci.yml` — `npm ci`, миграции, `npm test` на push/PR в `dev`/`master`.

## План развития

1. ✅ Backend MVP + SQLite + PWA Web Push
2. ✅ Безопасность (helmet, rate-limit, JWT-админка, magic-bytes, валидация)
3. ✅ Админ-панель (источники, API-ключи, статистика) + тесты + CI
4. ☐ WebSocket delivery-канал для Native iOS/Android
5. ☐ PostgreSQL (переключение в config)
6. ☐ История уведомлений внутри PWA
7. ☐ Верификация домена (DNS TXT)

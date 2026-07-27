# Universal Notification Hub

Push-уведомления для сервисов, потерявших возможность отправлять пуши через APNs (например, приложения удалённые из App Store в некоторых странах).

**Домен:** `apiwebrelay.ru` (регистрация — beget.com). В перспективе — `apiwebrelay.com`.

**Ветки:** `dev` — основная разработка (пушить только сюда). `master` — стабильный релиз.

## Архитектура

```
Сервис (банк, соцсеть)  ──POST──>  Notification Hub API  ──Web Push──>  PWA пользователя
  (X-API-Key auth)                    (VAPID)                (Service Worker)
```

**Клиент:** PWA (Progressive Web App) на iOS, добавляется на экран «Домой».  
**Канал доставки:** Web Push через VAPID (основной), WebSocket (для будущего Native iOS клиента).  
**База данных:** SQLite (dev), PostgreSQL (prod) — через абстракцию в `db.js`.

## Быстрый старт

```bash
cd backend
cp .env.example .env    # настроить порт, базу, VAPID ключи
npm install
npm run migrate         # создать таблицы
npm run generate-vapid  # сгенерировать VAPID ключи (скопировать в .env)
npm run dev             # сервер на http://localhost:3001
```

PWA доступна по адресу: `http://localhost:3001/pwa`

## API

### Источники трафика (CRUD)

| Метод | Путь | Auth | Описание |
|-------|------|------|----------|
| `POST` | `/api/v1/sources` | нет | Создать источник → возвращает `api_key` |
| `GET` | `/api/v1/sources` | нет | Список активных источников |
| `GET` | `/api/v1/sources/:id` | нет | Детали источника |
| `PATCH` | `/api/v1/sources/:id` | API Key | Обновить источник |
| `POST` | `/api/v1/sources/:id/logo` | API Key | Загрузить логотип (multipart) |

### Подписки

| Метод | Путь | Описание |
|-------|------|----------|
| `POST` | `/api/v1/subscribe` | Подписать пользователя на источник |
| `DELETE` | `/api/v1/subscribe` | Отписать пользователя |
| `GET` | `/api/v1/subscribe?user_id=` | Список подписок пользователя |

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
  "status": "sent",
  "sent": 5,
  "failed": 0,
  "total": 5
}
```

### Публичные

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/api/v1/health` | Проверка сервера |
| `GET` | `/api/v1/vapid-public-key` | VAPID ключ для PWA |

## Модель данных

### traffic_sources
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | Внутренний ID |
| name | VARCHAR(100) | Наименование источника |
| domain | VARCHAR(255) UNIQUE | **Идентификатор** — домен источника |
| api_key_hash | VARCHAR(255) | Хеш API-ключа (SHA-256) |
| logo_path | VARCHAR(255) | Путь к логотипу |
| description | TEXT | Описание |
| website_url | VARCHAR(255) | Сайт |
| is_active | BOOLEAN | Активен/неактивен |

### users
| Поле | Тип | Описание |
|------|-----|----------|
| id | UUID PK | |
| device_type | VARCHAR(20) | `pwa` / `native_ios` |
| push_subscription | TEXT (JSON) | VAPID subscription (PWA) |
| ws_connection_id | VARCHAR(255) | WebSocket ID (Native) |
| device_token | VARCHAR(255) | APNs/FCM токен (будущее) |

### Остальные таблицы
`user_subscriptions`, `notifications`, `notification_deliveries` — см. миграцию `backend/src/migrations/001_initial.sql`.

## План развития

1. ✅ Backend MVP + SQLite + PWA Web Push
2. ☐ Dashboard для управления источниками
3. ☐ WebSocket delivery-канал для Native iOS
4. ☐ PostgreSQL (переключение в config)
5. ☐ История уведомлений внутри PWA
6. ☐ Верификация домена (DNS TXT)

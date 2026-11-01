"""
Django settings for the POS API.

Everything comes from the environment (see .env.example). Production refuses
to start on an unsafe configuration instead of running with a default.
"""

import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import unquote, urlparse

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


# Debug is off unless the environment turns it on, so a missing variable
# never exposes tracebacks in production.
DEBUG = os.environ.get("DEBUG", "0") == "1"

# A fixed key is only acceptable for local development. Production refuses to
# start without its own key, because sessions, reset links and JWTs are all
# signed with it.
SECRET_KEY = os.environ.get("SECRET_KEY", "").strip()
if not SECRET_KEY or SECRET_KEY == "change-me":
    if not DEBUG:
        raise ImproperlyConfigured("Set SECRET_KEY to a long random value (DEBUG is off).")
    SECRET_KEY = "django-insecure-local-development-only"

ALLOWED_HOSTS = [host for host in os.environ.get("ALLOWED_HOSTS", "").split(",") if host]


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "channels",
    "common.apps.CommonConfig",
    "accounts.apps.AccountsConfig",
    "audit.apps.AuditConfig",
    "outlet.apps.OutletConfig",
    "floor.apps.FloorConfig",
    "catalog.apps.CatalogConfig",
    "orders.apps.OrdersConfig",
    "payments.apps.PaymentsConfig",
    "shifts.apps.ShiftsConfig",
    "inventory.apps.InventoryConfig",
    "printing.apps.PrintingConfig",
    "reports.apps.ReportsConfig",
    "promos.apps.PromosConfig",
    "display.apps.DisplayConfig",
]

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "backend.middleware.FrontendCorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "backend.wsgi.application"
# HTTP and WebSockets (floor status, kitchen and print jobs) run in one ASGI app.
ASGI_APPLICATION = "backend.asgi.application"


def database_from_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql"}:
        raise ImproperlyConfigured("DATABASE_URL must be a postgres:// URL.")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/")),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or ""),
        # Keep connections between requests; the POS sends many small ones.
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }


DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL:
    DATABASES = {"default": database_from_url(DATABASE_URL)}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }


AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "id"
TIME_ZONE = os.environ.get("TIME_ZONE", "Asia/Jakarta")
USE_I18N = True
USE_TZ = True


STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
DOMAIN = os.environ.get("DOMAIN", "").strip()
API_DOCS_PUBLIC = os.environ.get("API_DOCS_PUBLIC", "0") == "1"
REDIS_URL = os.environ.get("REDIS_URL", "").strip()

if not DEBUG:
    if not REDIS_URL:
        raise ImproperlyConfigured("Set REDIS_URL (DEBUG is off): WebSockets and the cache need it.")
    for _host in ("localhost", "127.0.0.1"):
        if _host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(_host)
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # Caddy terminates TLS and forwards X-Forwarded-Proto. The container's own
    # health check calls plain http://localhost, so /health/ is exempt.
    SECURE_SSL_REDIRECT = True
    SECURE_REDIRECT_EXEMPT = [r"^health/$"]
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

_trusted_origins = []
if FRONTEND_URL:
    _trusted_origins.append(FRONTEND_URL)
if DOMAIN:
    _trusted_origins.append(f"https://{DOMAIN}")
CSRF_TRUSTED_ORIGINS = _trusted_origins

if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
        }
    }
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL]},
        }
    }
else:
    # Local development without Docker: one process, so memory is enough.
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.ApiPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "30/min",
        # Several tablets share one staff account rarely, but one tablet polls and posts often during service.
        "user": "300/min",
        "auth": "10/min",
        "pin": "10/min",
        "token_refresh": "60/min",
        # A customer display registers once; this only stops a script filling the table.
        "display_register": "10/hour",
    },
    "EXCEPTION_HANDLER": "common.exceptions.api_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# The web app keeps its refresh token in this httpOnly cookie (accounts/session_cookie.py).
# Only the auth endpoints that need it receive it.
REFRESH_COOKIE_NAME = "pos_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"
REFRESH_COOKIE_SECURE = not DEBUG

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    # A tablet stays signed in for the week; staff unlock it with their PIN.
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Staff PIN: failed attempts allowed before the account's PIN is locked, and for how long.
PIN_MAX_ATTEMPTS = int(os.environ.get("PIN_MAX_ATTEMPTS", "5"))
PIN_LOCK_MINUTES = int(os.environ.get("PIN_LOCK_MINUTES", "15"))

SPECTACULAR_SETTINGS = {
    "TITLE": "POS API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        app: {"handlers": ["console"], "level": "INFO", "propagate": False}
        for app in ("common", "accounts", "audit", "orders", "printing", "realtime")
    },
}

SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(dsn=SENTRY_DSN, traces_sample_rate=0, send_default_pii=False)

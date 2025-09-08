import os
from pathlib import Path
from datetime import timedelta
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET", "devsecret")
DEBUG = os.getenv("DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = ["localhost", "127.0.0.1", "customer-service-portal-three.vercel.app", "*"]  # Added wildcard for Render

# Allow your frontend origin
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://customer-service-portal-three.vercel.app",
]

# If you need credentials (cookies, auth headers)
CORS_ALLOW_CREDENTIALS = True

# Allow all headers (for development)
CORS_ALLOW_ALL_HEADERS = [o for o in CORS_ALLOWED_ORIGINS if o]
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

INSTALLED_APPS = [
    "django.contrib.admin","django.contrib.auth","django.contrib.contenttypes",
    "django.contrib.sessions","django.contrib.messages","django.contrib.staticfiles",
    "rest_framework","corsheaders","drf_spectacular",
    "accounts","tickets", "whitenoise.runserver_nostatic",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"
STATIC_URL = "static/"
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"  # Fixed typo: was STAATICFILES_STORAGE

# Database Configuration
# Priority: DATABASE_URL (production) > DB_BACKEND env var > default to sqlite for dev
if os.getenv("DATABASE_URL"):
    # Production: Use DATABASE_URL (PostgreSQL on Render)
    DATABASES = {
        'default': dj_database_url.parse(os.getenv("DATABASE_URL"))
    }
else:
    # Development: Use DB_BACKEND to choose between sqlite, postgres, or mssql
    DB_BACKEND = os.getenv("DB_BACKEND", "sqlite").lower()
    
    if DB_BACKEND == "postgres":
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": os.getenv("DB_NAME", "csp"),
                "USER": os.getenv("DB_USER", "postgres"),
                "PASSWORD": os.getenv("DB_PASSWORD", ""),
                "HOST": os.getenv("DB_HOST", "127.0.0.1"),
                "PORT": os.getenv("DB_PORT", "5432"),
            }
        }
    elif DB_BACKEND == "sqlite":
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": BASE_DIR / "db.sqlite3"
            }
        }
    else:  # mssql
        DATABASES = {
            "default": {
                "ENGINE": "mssql",
                "NAME": os.getenv("DB_NAME", "csp"),
                "USER": os.getenv("DB_USER", "sa"),
                "PASSWORD": os.getenv("DB_PASSWORD", "YourStrong!Passw0rd"),
                "HOST": os.getenv("DB_HOST", "127.0.0.1"),
                "PORT": os.getenv("DB_PORT", "1433"),
                "OPTIONS": {
                    "driver": "ODBC Driver 18 for SQL Server",
                    "extra_params": "TrustServerCertificate=yes;",
                },
            }
        }

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

SPECTACULAR_SETTINGS = {"TITLE": "CSP API", "VERSION": "1.0.0"}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ALLOW_SIGNUP = os.getenv("ALLOW_SIGNUP", "True").lower() == "true"
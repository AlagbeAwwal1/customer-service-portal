# backend/core/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

# ---- tickets app views ----
from tickets.views import (
    TicketViewSet,
    GroupViewSet,
    OrgGroupViewSet,
    OrgMembershipViewSet,
    AdminStatsView,
    MyStatsView,
)

# ---- accounts app views ----
from accounts.views import (
    MeView,
    RegisterView,
    SignupView,      # obeys settings.ALLOW_SIGNUP
    OrgUserViewSet,
)

# ---- DRF router registrations ----
router = DefaultRouter()

# Public/org-scoped resources
router.register(r"tickets", TicketViewSet, basename="ticket")
router.register(r"groups", GroupViewSet, basename="group")

# Org-admin resources (ADMIN/SUPERVISOR only via IsOrgAdmin)
router.register(r"org-admin/users", OrgUserViewSet, basename="org-users")
router.register(r"org-admin/groups", OrgGroupViewSet, basename="org-groups")
router.register(r"org-admin/memberships", OrgMembershipViewSet, basename="org-memberships")

urlpatterns = [
    # Django admin
    path("admin/", admin.site.urls),

    # JWT auth
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    # Router-backed endpoints
    path("api/", include(router.urls)),

    # User + stats
    path("api/me/", MeView.as_view(), name="me"),
    path("api/admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("api/my/stats/", MyStatsView.as_view(), name="my-stats"),

    # Signup/Register (create/join organization)
    path("api/register/", RegisterView.as_view(), name="register"),
    path("api/signup/", SignupView.as_view(), name="signup"),
]

# ---- Optional: API schema & docs (drf-spectacular) ----
try:
    from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path(
            "api/docs/",
            SpectacularSwaggerView.as_view(url_name="schema"),
            name="api-docs",
        ),
    ]
except Exception:
    # drf-spectacular not installed or misconfigured; safe to ignore
    pass

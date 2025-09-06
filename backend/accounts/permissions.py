# backend/accounts/permissions.py
from rest_framework.permissions import IsAuthenticated

class IsOrgAdmin(IsAuthenticated):
    """
    Allows access only to org-level admins/supervisors.
    (Uses your User.role field: ADMIN or SUPERVISOR)
    """
    def has_permission(self, request, view):
        return super().has_permission(request, view) and (
            getattr(request.user, "role", "") in ("ADMIN", "SUPERVISOR")
        )

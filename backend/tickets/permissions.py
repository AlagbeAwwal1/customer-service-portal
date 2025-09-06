from rest_framework.permissions import BasePermission


def uorg_id(org):
    return getattr(org, "id", None)


class IsSameOrg(BasePermission):
    def has_object_permission(self, request, view, obj):
        uorg = getattr(request.user, "organization", None)
        oorg = getattr(obj, "organization", None)
        return uorg and oorg and uorg_id(uorg) == uorg_id(oorg)


class IsSupervisorOrOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        if getattr(request.user, "role", "") in ("SUPERVISOR", "ADMIN"):
            return True
        return getattr(obj, "created_by_id", None) == request.user.id



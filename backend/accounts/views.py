from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status, viewsets, generics, serializers
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from django.contrib.auth import get_user_model

from .serializers import (
    UserSerializer,
    RegistrationSerializer,
    OrgUserSerializer,
    RegistrationSerializer
)
from accounts.permissions import IsOrgAdmin

# local mixin to avoid circular import
class OrgScopedMixin:
    def get_queryset(self):
        return self.queryset.filter(organization=self.request.user.organization)

User = get_user_model()

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        return Response(UserSerializer(request.user).data)

class SignupView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        if not getattr(settings, "ALLOW_SIGNUP", False):
            return Response({"detail": "Signups are disabled."}, status=403)
        ser = RegistrationSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }, status=201)

class OrgUserViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    """
    Lists/creates/updates/deletes users within your organization.
    Only org-level ADMINs/SUPERVISORs can access this.
    """
    queryset = User.objects.all().select_related("organization")
    serializer_class = OrgUserSerializer
    permission_classes = [IsOrgAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.filter(is_staff=False, is_superuser=False)

class MeSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name",
            "role", "organization", "organization_name"
        ]

class RegisterView(generics.CreateAPIView):
    serializer_class = RegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        refresh = RefreshToken.for_user(user)
        data = MeSerializer(user).data
        data.update({"access": str(refresh.access_token), "refresh": str(refresh)})
        return Response(data, status=201)

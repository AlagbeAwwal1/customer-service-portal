from rest_framework import serializers
from .models import User, Organization
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ["id","name","domain"]

class UserSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)
    class Meta:
        model = User
        fields = ["id","username","email","first_name","last_name","role","organization"]

User = get_user_model()

class RegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(min_length=3, max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=30, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    organization_name = serializers.CharField(required=False, allow_blank=True, max_length=120)
    organization_code = serializers.CharField(required=False, allow_blank=True, max_length=120)
    role = serializers.ChoiceField(choices=User.Roles.choices, default=User.Roles.AGENT)

    def validate_username(self, v):
        if User.objects.filter(username__iexact=v).exists():
            raise serializers.ValidationError("Username is already taken.")
        return v

    def validate_email(self, v):
        if User.objects.filter(email__iexact=v).exists():
            raise serializers.ValidationError("Email is already registered.")
        return v

    def validate(self, data):
        name = (data.get("organization_name") or "").strip()
        code = (data.get("organization_code") or "").strip()

        if name and code:
            raise serializers.ValidationError("Provide either organization_name to create a new org, or organization_code to join an existing one, not both.")

        if not name and not code:
            data["organization_name"] = f"{data['username']}'s Organization"
        return data
    
    def create(self, data):
        name = (data.pop("organization_name", "") or "").strip()
        code = (data.pop("organization_code", "") or "").strip()
        raw_password = data.pop("password")
        role = data.pop("role", None) or "AGENT"

        if name:
            if Organization.objects.filter(name__iexact=name).exists():
                raise ValidationError("Organization name already exists. Use organization_code to join.")
            org = Organization.objects.create(name=name)
            # creator becomes org ADMIN
            user = User(**data, organization=org, role="ADMIN")
        else:
            try:
                org = Organization.objects.get(invite_code=code)
            except Organization.DoesNotExist:
                raise ValidationError("Invalid organization code.")
            user = User(**data, organization=org, role=role)

        user.set_password(raw_password)
        user.save()
        return user

class OrgUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "is_active"]
        read_only_fields = ["id"]

    def create(self, validated_data):
        req = self.context["request"]
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            role=validated_data.get("role") or "AGENT",
            is_active=validated_data.get("is_active", True),
            organization=req.user.organization,
        )
        raw_pw = self.initial_data.get("password")
        if raw_pw:
            user.set_password(raw_pw)
        else:
            user.set_password(User.objects.make_random_password())
        user.save()
        return user
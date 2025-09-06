from django.contrib import admin
from .models import User, Organization
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("id","name","domain")

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Org & Role", {"fields": ("organization","role")}),
    )
    list_display = ("username","email","role","organization","is_staff","is_superuser")

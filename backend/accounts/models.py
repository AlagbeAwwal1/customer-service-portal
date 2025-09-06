# backend/accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid

def gen_invite_code():
    return uuid.uuid4().hex

class Organization(models.Model):
    name = models.CharField(max_length=120, unique=True)
    domain = models.CharField(max_length=120, blank=True)
    invite_code = models.CharField(
        max_length=32,
        unique=True,              # <-- was b=True
        default=gen_invite_code,  # callable, no ()
        editable=False,
    )

    def __str__(self):
        return self.name

    def rotate_invite(self):
        self.invite_code = gen_invite_code()
        self.save(update_fields=["invite_code"])

class User(AbstractUser):
    class Roles(models.TextChoices):
        AGENT = "AGENT", "Agent"
        SUPERVISOR = "SUPERVISOR", "Supervisor"
        ADMIN = "ADMIN", "Admin"

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, null=True, blank=True
    )
    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.AGENT)

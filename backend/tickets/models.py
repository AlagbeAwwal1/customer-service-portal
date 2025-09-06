from django.db import models
from django.conf import settings


class Group(models.Model):
    organization = models.ForeignKey(
        "accounts.Organization", on_delete=models.CASCADE, related_name="groups")
    name = models.CharField(max_length=120)
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, null=True,
                                blank=True, on_delete=models.SET_NULL, related_name="managed_groups")

    class Meta:
        unique_together = ("organization", "name")

    def __str__(self): return f"{self.name} ({self.organization})"


class GroupMembership(models.Model):
    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="group_memberships")

    class Meta:
        unique_together = ("group", "user")

    def __str__(self): return f"{self.user} in {self.group}"


class Ticket(models.Model):
    class Status(models.TextChoices):
        OPEN = "OPEN", "Open"
        IN_PROGRESS = "IN_PROGRESS", "In Progress"
        RESOLVED = "RESOLVED", "Resolved"
        CLOSED = "CLOSED", "Closed"

    class Priority(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        URGENT = "URGENT", "Urgent"

    organization = models.ForeignKey(
        "accounts.Organization", on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="tickets" )
    customer_name = models.CharField(max_length=120)
    subject = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN)
    priority = models.CharField(
        max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="created_tickets", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Comment(models.Model):
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Attachment(models.Model):
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to="attachments/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    uploaded_at = models.DateTimeField(auto_now_add=True)

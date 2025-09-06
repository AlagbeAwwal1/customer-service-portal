from django.contrib import admin
from .models import Ticket, Comment, Attachment, Group, GroupMembership

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("id","subject","status","priority","organization","assignee","created_by","created_at")
    list_filter = ("status","priority","organization")
    search_fields = ("subject","customer_name","description")

admin.site.register(Comment)
admin.site.register(Attachment)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("id","name","organization","manager")
    list_filter = ("organization",)

@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("group","user")
    list_filter = ("group__organization","group")


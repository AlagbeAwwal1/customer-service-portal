# backend/tickets/views.py
from datetime import timedelta
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Attachment, Comment, Group, GroupMembership, Ticket
from .permissions import IsSameOrg
from accounts.permissions import IsOrgAdmin
from .serializers import (
    AttachmentSerializer,
    CommentSerializer,
    GroupSerializer,
    TicketSerializer,
    GroupMembershipSerializer,
)
from django.contrib.auth import get_user_model

class OrgScopedMixin:
    def get_queryset(self):
        return self.queryset.filter(organization=self.request.user.organization)

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            created_by=self.request.user,
        )


# --- Groups ---
class GroupViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    queryset = Group.objects.all().select_related("organization", "manager")
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        group = self.get_object()
        users = (
            group.memberships.select_related("user")
            .values("user_id", "user__username", "user__first_name", "user__last_name")
        )
        return Response(
            [
                {
                    "id": u["user_id"],  # used by frontend <select>
                    "username": u["user__username"],
                    "name": (
                        (u["user__first_name"] + " " +
                         u["user__last_name"]).strip()
                        or u["user__username"]
                    ),
                }
                for u in users
            ]
        )


# --- Tickets ---
class TicketViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    queryset = Ticket.objects.all().select_related(
        "assignee", "created_by", "organization", "group", "group__manager"
    )
    serializer_class = TicketSerializer
    # Visibility is enforced by get_queryset below; avoid over-restrictive object perms here.
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        role = getattr(u, "role", "")

        # Admins/Supervisors see all org tickets
        if role in ("ADMIN", "SUPERVISOR"):
            return qs

        # Agents/others:
        # - always see tickets they created
        # - see tickets assigned to them
        # - if UNASSIGNED: only the group's manager can see it
        # - once ASSIGNED: every member of that group can see it
        my_group_ids = GroupMembership.objects.filter(
            user=u).values_list("group_id", flat=True)

        return qs.filter(
            Q(created_by=u)
            | Q(assignee=u)
            | (Q(assignee__isnull=True) & Q(group__manager=u))
            | (Q(assignee__isnull=False) & Q(group_id__in=my_group_ids))
        ).distinct()

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        ticket = self.get_object()

        # Only group manager OR org admin/supervisor can assign
        if not (
            getattr(request.user, "role", "") in ("ADMIN", "SUPERVISOR")
            or (ticket.group and ticket.group.manager_id == request.user.id)
        ):
            return Response({"detail": "You are not allowed to assign this ticket."}, status=403)

        raw = request.data.get("assignee", None)
        if raw in (None, "", "null"):
            return Response({"detail": "Provide 'assignee' user id."}, status=400)
        try:
            assignee_id = int(raw)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid assignee id."}, status=400)

        if not ticket.group_id:
            return Response({"detail": "Ticket has no group; set a group first."}, status=400)

        # Assignee must be a member of the ticket's group
        if not GroupMembership.objects.filter(group_id=ticket.group_id, user_id=assignee_id).exists():
            return Response({"detail": "Assignee must be a member of the ticket's group."}, status=400)

        ticket.assignee_id = assignee_id
        ticket.save(update_fields=["assignee"])
        return Response(TicketSerializer(ticket, context={"request": request}).data, status=200)

    @action(detail=True, methods=['post'], url_path='close')
    def close(self, request, pk=None):
        ticket = self.get_object()

        # Only the assignee or org admin/supervisor can close
        if not (
            ticket.assignee_id == request.user.id or getattr(
                request.user, "role", "") in ("ADMIN", "SUPERVISOR")
        ):
            return Response({"detail": "You are not allowed to close this ticket."}, status=status.HTTP_403_FORBIDDEN)

        # Require a comment when closing
        comment_text = request.data.get("comment", "").strip()
        if not comment_text:
            return Response({"detail": "A comment is required when closing a ticket."}, status=status.HTTP_400_BAD_REQUEST)

        # POick a terminal status that exists in your choices
        status_choices = [val for val,
                          _ in Ticket._meta.get_field("status").choices]
        target = None
        if 'RESOLVED' in status_choices:
            target = 'RESOLVED'
        elif 'CLOSED' in status_choices:
            target = 'CLOSED'
        else:
            return Response({"detail": "No terminal status (RESOLVED/CLOSED) defined in Ticket model."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Add the resolution comment (plain comment, no schema change)
        Comment.objects.create(
            ticket=ticket,
            author=request.user,
            body=comment_text
        )
        # Update the ticket status if not already in target state
        if ticket.status != target:
            ticket.status = target
            ticket.save(update_fields=['status', 'updated_at'])
        else:
            ticket.save(update_fields=['updated_at'])

        # Return the updated ticket
        return Response(TicketSerializer(ticket, context={"request": request}).data, status=status.HTTP_200_OK)


# --- Comments ---
class CommentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    queryset = Comment.objects.all().select_related("ticket", "author")
    serializer_class = CommentSerializer
    permission_classes = [IsAuthenticated, IsSameOrg]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user,
                        ticket_id=self.kwargs["ticket_pk"])


# --- Attachments ---
class AttachmentViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    queryset = Attachment.objects.all().select_related("ticket", "uploaded_by")
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated, IsSameOrg]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user,
                        ticket_id=self.kwargs["ticket_pk"])


# --- Admin stats ---
class IsAdminOrSupervisor(IsAuthenticated):
    def has_permission(self, request, view):
        base = super().has_permission(request, view)
        return base and getattr(request.user, "role", "") in ("ADMIN", "SUPERVISOR")


class AdminStatsView(APIView):
    permission_classes = [IsAdminOrSupervisor]

    def get(self, request):
        org = request.user.organization
        qs = Ticket.objects.filter(organization=org)

        total = qs.count()
        by_status = dict(qs.values("status").annotate(
            c=Count("id")).values_list("status", "c"))
        by_priority = dict(qs.values("priority").annotate(
            c=Count("id")).values_list("priority", "c"))

        today = timezone.now().date()
        start = today - timedelta(days=6)
        daily = (
            qs.filter(created_at__date__gte=start)
            .annotate(d=TruncDate("created_at"))
            .values("d")
            .annotate(c=Count("id"))
        )
        by_day = {str(row["d"]): row["c"] for row in daily}
        days = [start + timedelta(days=i) for i in range(7)]
        last7 = [{"date": str(d), "count": by_day.get(str(d), 0)}
                 for d in days]

        top_agents = list(
            qs.values("assignee__username").annotate(
                count=Count("id")).order_by("-count")[:5]
        )

        return Response(
            {
                "total_tickets": total,
                "by_status": by_status,
                "by_priority": by_priority,
                "last_7_days": last7,
                "top_agents": [
                    {"agent": r["assignee__username"]
                        or "Unassigned", "count": r["count"]}
                    for r in top_agents
                ],
            }
        )


class MyStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        org = u.organization

        # mirror TicketViewSet visibility
        if getattr(u, "role", "") in ("ADMIN", "SUPERVISOR"):
            qs = Ticket.objects.filter(organization=org)
            scope = "org"
        else:
            my_group_ids = GroupMembership.objects.filter(
                user=u).values_list("group_id", flat=True)
            qs = Ticket.objects.filter(organization=org).filter(
                Q(created_by=u)
                | Q(assignee=u)
                | (Q(assignee__isnull=True) & Q(group__manager=u))
                | (Q(assignee__isnull=False) & Q(group_id__in=my_group_ids))
            ).distinct()
            scope = "me"

        total = qs.count()
        by_status = dict(qs.values_list(
            "status").annotate(c=Count("id")).order_by())
        by_priority = dict(qs.values_list(
            "priority").annotate(c=Count("id")).order_by())

        today = timezone.now().date()
        start = today - timedelta(days=6)
        daily = (qs.filter(created_at__date__gte=start)
                   .annotate(d=TruncDate("created_at"))
                   .values("d").annotate(c=Count("id")))
        by_day = {str(r["d"]): r["c"] for r in daily}
        days = [start + timedelta(days=i) for i in range(7)]
        last7 = [{"date": str(d), "count": by_day.get(str(d), 0)}
                 for d in days]

        top_agents = list(
            qs.values("assignee__username").annotate(
                count=Count("id")).order_by("-count")[:5]
        )

        return Response({
            "scope": scope,
            "total_tickets": total,
            "by_status": by_status,
            "by_priority": by_priority,
            "last_7_days": last7,
            "top_agents": [
                {"agent": r["assignee__username"]
                    or "Unassigned", "count": r["count"]}
                for r in top_agents
            ],
        })


# Org admin version of groups
class OrgGroupViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    queryset = Group.objects.select_related("organization", "manager").all()
    serializer_class = GroupSerializer
    permission_classes = [IsOrgAdmin]

    def perform_create(self, serializer):
        serializer.save(organization=self.request.user.organization)

    @action(detail=True, methods=["get"], url_path="members")
    def members(self, request, pk=None):
        group = self.get_object()
        users = (group.memberships.select_related("user")
                 .values("user_id","user__username","user__first_name","user__last_name","user__role","user__is_active"))
        data = [{
            "id": u["user_id"],
            "username": u["user__username"],
            "name": (u["user__first_name"] + " " + u["user__last_name"]).strip() or u["user__username"],
            "role": u["user__role"],
            "is_active": u["user__is_active"],
        } for u in users]
        return Response(data)

    @action(detail=True, methods=["post"], url_path="set-manager")
    def set_manager(self, request, pk=None):
        group = self.get_object()
        try:
            uid = int(request.data.get("manager"))
        except (TypeError, ValueError):
            return Response({"detail": "Provide integer 'manager' user id."}, status=400)

        User = get_user_model()
        try:
            user = User.objects.get(id=uid, organization=request.user.organization)
        except User.DoesNotExist:
            return Response({"detail": "User not in your organization."}, status=400)

        group.manager = user
        group.save(update_fields=["manager"])
        return Response(GroupSerializer(group, context={"request": request}).data)

    # Add/remove members without needing membership id
    @action(detail=True, methods=["post", "delete"], url_path=r"members/(?P<user_id>\d+)")
    def change_member(self, request, pk=None, user_id=None):
        group = self.get_object()
        try:
            uid = int(user_id)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid user id"}, status=400)

        # must be same org
        if not GroupMembership.objects.filter(group=group, group__organization=request.user.organization).exists():
            return Response({"detail": "Invalid group/org."}, status=400)

        if request.method == "POST":
            GroupMembership.objects.get_or_create(group=group, user_id=uid)
        else:  # DELETE
            GroupMembership.objects.filter(group=group, user_id=uid).delete()

        return self.members(request, pk=pk)

class OrgMembershipViewSet(OrgScopedMixin, viewsets.ModelViewSet):
    queryset = GroupMembership.objects.select_related("group", "user", "group__organization")
    serializer_class = GroupMembershipSerializer
    permission_classes = [IsOrgAdmin]

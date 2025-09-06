from .models import Ticket, Comment, Attachment, Group, GroupMembership
from rest_framework import serializers

class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True)
    class Meta:
        model = Comment
        fields = ["id","author","author_name","body","created_at"]
        read_only_fields = ["author","created_at"]

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ["id","file","uploaded_by","uploaded_at"]
        read_only_fields = ["uploaded_by","uploaded_at"]



class GroupSerializer(serializers.ModelSerializer):
    manager_name = serializers.CharField(source="manager.username", read_only=True)
    class Meta:
        model = Group
        fields = ["id","name","organization","manager","manager_name"]
        read_only_fields = ["organization"]

class TicketSerializer(serializers.ModelSerializer):
    comments = CommentSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    assignee_name = serializers.CharField(source="assignee.username", read_only=True)

    # Accept group id, expose some convenience read-only fields:
    group = serializers.PrimaryKeyRelatedField(queryset=Group.objects.all())
    group_name = serializers.CharField(source="group.name", read_only=True)
    group_manager_id = serializers.IntegerField(source="group.manager_id", read_only=True)
    group_manager_name = serializers.CharField(source="group.manager.username", read_only=True)

    class Meta:
        model = Ticket
        fields = ["id","organization","group","group_name","group_manager_id","group_manager_name",
                  "customer_name","subject","description","status","priority",
                  "assignee", "assignee_name","created_by","created_at","updated_at",
                  "comments","attachments"]
        read_only_fields = ["organization","created_by","created_at","updated_at"]

    def validate(self, data):
        request = self.context["request"]
        user_org = getattr(request.user, "organization", None)
        grp = data.get("group") or getattr(self.instance, "group", None)

        if not user_org:
            raise serializers.ValidationError("User has no organization; contact an admin.")

        if not grp or grp.organization_id != user_org.id:
            raise serializers.ValidationError("Group must belong to your organization.")

        # If assignee provided, must be member of the group
        assignee = data.get("assignee")
        if assignee:
            is_member = GroupMembership.objects.filter(group=grp, user=assignee).exists()
            if not is_member:
                raise serializers.ValidationError("Assignee must be a member of the ticket's group.")
        return data


class GroupMembershipSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroupMembership
        fields = ["id", "group", "user", "created_at"]
        read_only_fields = ["id", "created_at"]
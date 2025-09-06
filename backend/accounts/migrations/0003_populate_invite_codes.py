# accounts/migrations/0003_populate_invite_codes.py
from django.db import migrations
import uuid

def gen():
    return uuid.uuid4().hex

def populate_invite_codes(apps, schema_editor):
    Organization = apps.get_model("accounts", "Organization")

    # collect already-used codes to avoid collisions
    used = set(
        Organization.objects.exclude(invite_code__isnull=True)
                            .exclude(invite_code="")
                            .values_list("invite_code", flat=True)
    )

    for org in Organization.objects.all():
        if org.invite_code:
            continue
        code = gen()
        while code in used:
            code = gen()
        org.invite_code = code
        org.save(update_fields=["invite_code"])
        used.add(code)

class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_organization_invite_code"),  # <-- important
    ]

    operations = [
        migrations.RunPython(populate_invite_codes, migrations.RunPython.noop),
    ]

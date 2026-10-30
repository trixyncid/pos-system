from django.core.management.base import BaseCommand

from accounts.services.roles import ensure_system_roles


class Command(BaseCommand):
    help = "Create the default roles, or reset their names and permissions. Safe to run on every deploy."

    def handle(self, *args, **options):
        groups = ensure_system_roles()
        self.stdout.write(self.style.SUCCESS(f"{len(groups)} system roles ready."))

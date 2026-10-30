from django.core.management.base import BaseCommand

from accounts.services.roles import ensure_system_roles


class Command(BaseCommand):
    help = (
        "Create any missing built-in role. Existing roles keep their permissions; "
        "--reset puts them back to the defaults."
    )

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Restore built-in role names and permissions.")

    def handle(self, *args, reset=False, **options):
        groups = ensure_system_roles(reset=reset)
        state = "reset to defaults" if reset else "ready"
        self.stdout.write(self.style.SUCCESS(f"{len(groups)} system roles {state}."))

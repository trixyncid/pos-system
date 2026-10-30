from django.test import TestCase

from audit.models import AuditEvent


class AppendOnlyTests(TestCase):
    def setUp(self):
        self.event = AuditEvent.objects.create(action="order.void_item", metadata={"reason": "salah input"})

    def test_rows_cannot_be_changed(self):
        self.event.action = "something.else"
        with self.assertRaises(PermissionError):
            self.event.save()
        with self.assertRaises(PermissionError):
            AuditEvent.objects.filter(pk=self.event.pk).update(action="x")

    def test_rows_cannot_be_deleted(self):
        with self.assertRaises(PermissionError):
            self.event.delete()
        with self.assertRaises(PermissionError):
            AuditEvent.objects.all().delete()

    def test_emit_redacts_secrets(self):
        from audit.services import emit

        with self.captureOnCommitCallbacks(execute=True):
            emit(None, "auth.pin_failed", metadata={"pin": "1234", "nested": {"password": "x"}, "reason": "ok"})
        event = AuditEvent.objects.get(action="auth.pin_failed")
        self.assertEqual(event.metadata, {"pin": "[redacted]", "nested": {"password": "[redacted]"}, "reason": "ok"})

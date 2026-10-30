import uuid

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, WAITER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent
from catalog.models import Category, ModifierGroup, Product, ProductKind
from floor.models import Area, Table
from orders.models import Order, OrderStatus
from printing.models import JobKind, JobStatus, PrintJob

API = "/api/v1/"


def uid():
    return str(uuid.uuid4())


class OrderFlowTests(TestCase):
    def setUp(self):
        ensure_system_roles()

        def staff(name, code, pin):
            user = User.objects.create_user(None, full_name=name)
            user.set_pin(pin)
            user.save()
            user.groups.add(GroupProfile.objects.get(code=code).group)
            return user

        self.waiter = staff("Sari", WAITER, "4444")
        self.manager = staff("Dimas", CASHIER, "2222")
        self.station = staff("Dapur", CASHIER, "9999")
        self.client = APIClient()
        self.client.force_authenticate(self.waiter)

        area = Area.objects.create(name="Indoor")
        self.t1 = Table.objects.create(area=area, label="1", x=100, y=100, width=80, height=80)
        self.t2 = Table.objects.create(area=area, label="2", x=300, y=100, width=80, height=80)
        food = Category.objects.create(name="Makanan", station="kitchen")
        drinks = Category.objects.create(name="Minuman", station="bar")
        snacks = Category.objects.create(name="Snack", station="none")
        self.spicy = ModifierGroup.objects.create(name="Level pedas", min_select=1, max_select=1)
        self.mild = self.spicy.options.create(name="Sedang", price_delta=0)
        self.extra_hot = self.spicy.options.create(name="Extra pedas", price_delta=2_000)
        self.rice = Product.objects.create(kind=ProductKind.MENU, name="Nasi goreng", category=food, price=28_000)
        self.rice.modifier_groups.add(self.spicy)
        self.tea = Product.objects.create(kind=ProductKind.MENU, name="Es teh", category=drinks, price=8_000)
        self.chips = Product.objects.create(kind=ProductKind.RETAIL, name="Keripik", category=snacks, price=12_000)

    def open(self, table=None, guests=2):
        response = self.client.post(
            f"{API}orders/", {"id": uid(), "table": str((table or self.t1).pk), "guests": guests}, format="json"
        )
        self.assertEqual(response.status_code, 201, response.content)
        return response.data["data"]

    def add(self, order_id, lines, send=True):
        return self.client.post(f"{API}orders/{order_id}/lines/", {"lines": lines, "send": send}, format="json")

    def line(self, product, **extra):
        return {"id": uid(), "product": str(product.pk), **extra}

    def test_open_is_idempotent_and_one_order_per_table(self):
        order_id = uid()
        first = self.client.post(f"{API}orders/", {"id": order_id, "table": str(self.t1.pk)}, format="json")
        again = self.client.post(f"{API}orders/", {"id": order_id, "table": str(self.t1.pk)}, format="json")
        self.assertEqual(first.data["data"]["number"], again.data["data"]["number"])
        self.assertEqual(Order.objects.count(), 1)
        busy = self.client.post(f"{API}orders/", {"id": uid(), "table": str(self.t1.pk)}, format="json")
        self.assertIn("table", busy.data["errors"])

    def test_lines_price_modifiers_and_route_tickets_by_station(self):
        order = self.open()
        response = self.add(
            order["id"],
            [
                self.line(self.rice, quantity=2, modifiers=[str(self.extra_hot.pk)], note="tanpa bawang"),
                self.line(self.tea, quantity=2),
                self.line(self.chips),
            ],
        )
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data["data"]
        rice = data["lines"][0]
        self.assertEqual((rice["unit_price"], rice["total"]), (30_000, 60_000))
        self.assertEqual(rice["modifiers"], [{"group": "Level pedas", "name": "Extra pedas", "price_delta": 2_000}])
        self.assertEqual(data["subtotal"], 60_000 + 16_000 + 12_000)
        jobs = {job.station: job for job in PrintJob.objects.all()}
        self.assertEqual(set(jobs), {"kitchen", "bar"})  # the snack goes nowhere
        ticket = jobs["kitchen"].payload
        self.assertEqual(ticket["label"], "Meja 1")
        self.assertEqual(ticket["lines"][0]["modifiers"], ["Extra pedas"])
        self.assertEqual(ticket["lines"][0]["note"], "tanpa bawang")

    def test_required_modifiers_and_sold_out_items_are_refused(self):
        order = self.open()
        missing = self.add(order["id"], [self.line(self.rice)])
        self.assertIn("modifiers", missing.data["errors"])
        self.tea.is_available = False
        self.tea.save()
        sold_out = self.add(order["id"], [self.line(self.tea)])
        self.assertIn("sold out", sold_out.data["detail"])

    def test_retried_lines_are_not_added_twice(self):
        order = self.open()
        line = self.line(self.tea)
        self.add(order["id"], [line])
        self.add(order["id"], [line])
        self.assertEqual(Order.objects.get().lines.count(), 1)

    def test_hold_then_send(self):
        order = self.open()
        self.add(order["id"], [self.line(self.tea)], send=False)
        self.assertEqual(PrintJob.objects.count(), 0)
        floor = self.client.get(f"{API}floor/areas/").data["data"][0]["tables"][0]
        self.assertEqual(floor["status"], "occupied")
        self.client.post(f"{API}orders/{order['id']}/send/", {}, format="json")
        self.assertEqual(PrintJob.objects.get().station, "bar")
        floor = self.client.get(f"{API}floor/areas/").data["data"][0]["tables"][0]
        self.assertEqual((floor["status"], floor["order_total"], floor["guests"]), ("ordered", 8_000, 2))

    def test_held_lines_can_change_but_sent_lines_cannot(self):
        order = self.open()
        held = self.line(self.tea)
        self.add(order["id"], [held], send=False)
        response = self.client.patch(f"{API}orders/{order['id']}/lines/{held['id']}/", {"quantity": 3}, format="json")
        self.assertEqual(response.data["data"]["lines"][0]["quantity"], 3)
        self.client.post(f"{API}orders/{order['id']}/send/", {}, format="json")
        response = self.client.patch(f"{API}orders/{order['id']}/lines/{held['id']}/", {"quantity": 1}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_voiding_a_sent_item_needs_a_manager(self):
        order = self.open()
        sent = self.line(self.tea)
        self.add(order["id"], [sent])
        url = f"{API}orders/{order['id']}/lines/{sent['id']}/void/"

        refused = self.client.post(url, {"reason": "salah input"}, format="json")
        self.assertEqual((refused.status_code, refused.data["code"]), (403, "approval_required"))
        wrong_pin = self.client.post(
            url, {"reason": "salah input", "approver": self.manager.pk, "approver_pin": "0000"}, format="json"
        )
        self.assertEqual(wrong_pin.data["code"], "approval_rejected")
        with self.captureOnCommitCallbacks(execute=True):
            approved = self.client.post(
                url, {"reason": "salah input", "approver": self.manager.pk, "approver_pin": "2222"}, format="json"
            )
        self.assertEqual(approved.status_code, 200, approved.content)
        self.assertEqual(approved.data["data"]["subtotal"], 0)
        self.assertTrue(PrintJob.objects.filter(kind=JobKind.VOID, station="bar").exists())
        event = AuditEvent.objects.get(action="order.void_item")
        self.assertEqual((event.metadata["approved_by"], event.metadata["amount"]), ("Dimas", 8_000))

    def test_held_line_is_simply_removed(self):
        order = self.open()
        held = self.line(self.tea)
        self.add(order["id"], [held], send=False)
        self.client.post(f"{API}orders/{order['id']}/lines/{held['id']}/void/", {}, format="json")
        self.assertFalse(Order.objects.get().lines.exists())

    def test_move_and_merge(self):
        first = self.open(self.t1, guests=2)
        self.add(first["id"], [self.line(self.tea)])
        moved = self.client.post(f"{API}orders/{first['id']}/move/", {"table": str(self.t2.pk)}, format="json")
        self.assertEqual(moved.data["data"]["table_label"], "2")
        floor = self.client.get(f"{API}floor/areas/").data["data"]
        statuses = {t["label"]: t["status"] for area in floor for t in area["tables"]}
        self.assertEqual(statuses["1"], "available")

        second = self.open(self.t1, guests=3)
        self.add(second["id"], [self.line(self.tea, quantity=2)])
        merged = self.client.post(f"{API}orders/{first['id']}/merge/", {"source": second["id"]}, format="json")
        self.assertEqual((merged.data["data"]["guests"], merged.data["data"]["subtotal"]), (5, 24_000))
        self.assertEqual(Order.objects.get(pk=second["id"]).status, OrderStatus.MERGED)

    def test_cancel_only_without_sent_items(self):
        order = self.open()
        self.add(order["id"], [self.line(self.tea)], send=False)
        response = self.client.post(f"{API}orders/{order['id']}/cancel/")
        self.assertEqual(response.data["data"]["status"], "void")
        busy = self.open()
        self.add(busy["id"], [self.line(self.tea)])
        self.assertEqual(self.client.post(f"{API}orders/{busy['id']}/cancel/").status_code, 400)

    def test_busy_table_cannot_be_removed_from_the_layout(self):
        self.open(self.t1)
        self.client.force_authenticate(self.manager)
        response = self.client.put(f"{API}floor/areas/{self.t1.area_id}/layout/", {"tables": []}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("seated", response.data["detail"])

    def test_print_station_acks_and_reprint_needs_permission(self):
        order = self.open()
        self.add(order["id"], [self.line(self.tea)])
        job = PrintJob.objects.get()
        self.assertEqual(self.client.get(f"{API}printing/jobs/").status_code, 403)
        self.client.force_authenticate(self.station)
        queued = self.client.get(f"{API}printing/jobs/", {"status": "queued"}).data["data"]
        self.assertEqual([row["id"] for row in queued], [str(job.pk)])
        self.client.post(f"{API}printing/jobs/{job.pk}/ack/", {"status": "printed"}, format="json")
        job.refresh_from_db()
        self.assertEqual(job.status, JobStatus.PRINTED)
        reprint = self.client.post(f"{API}printing/jobs/{job.pk}/reprint/")
        self.assertTrue(reprint.data["data"]["payload"]["reprint"])

    def test_staff_without_take_order_cannot_see_orders(self):
        self.client.force_authenticate(User.objects.create_user(None, full_name="Tamu"))
        self.assertEqual(self.client.get(f"{API}orders/").status_code, 403)

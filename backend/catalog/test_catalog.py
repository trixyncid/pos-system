import io
import tempfile

from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import OWNER, WAITER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent
from catalog.models import Category, ModifierGroup, Product, ProductKind

BASE = "/api/v1/catalog/"


class CatalogTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.owner = User.objects.create_user("owner@example.com", "Str0ng-pass!", full_name="Rina")
        self.owner.groups.add(GroupProfile.objects.get(code=OWNER).group)
        self.waiter = User.objects.create_user(None, full_name="Sari")
        self.waiter.groups.add(GroupProfile.objects.get(code=WAITER).group)
        self.client = APIClient()
        self.food = Category.objects.create(name="Makanan")
        self.rice = Product.objects.create(kind=ProductKind.INGREDIENT, name="Beras", unit="g", cost=15)
        self.egg = Product.objects.create(kind=ProductKind.INGREDIENT, name="Telur", unit="pcs", cost=2_500)

    def as_user(self, user):
        self.client.force_authenticate(user)

    def test_waiter_reads_but_cannot_write(self):
        self.as_user(self.waiter)
        self.assertEqual(self.client.get(f"{BASE}products/").status_code, 200)
        self.assertEqual(self.client.get(f"{BASE}categories/").status_code, 200)
        self.assertEqual(self.client.post(f"{BASE}categories/", {"name": "X"}, format="json").status_code, 403)

    def test_menu_item_with_recipe_and_modifiers(self):
        self.as_user(self.owner)
        group = self.client.post(
            f"{BASE}modifier-groups/",
            {
                "name": "Level pedas",
                "min_select": 1,
                "max_select": 1,
                "options": [{"name": "Tidak pedas"}, {"name": "Pedas", "price_delta": 0}],
            },
            format="json",
        )
        self.assertEqual(group.status_code, 201, group.content)
        response = self.client.post(
            f"{BASE}products/",
            {
                "kind": "menu",
                "name": "Nasi goreng",
                "category": str(self.food.pk),
                "price": 28_000,
                "modifier_groups": [group.data["data"]["id"]],
                "recipe": [
                    {"ingredient": str(self.rice.pk), "quantity": 200},
                    {"ingredient": str(self.egg.pk), "quantity": 1},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.content)
        data = response.data["data"]
        self.assertEqual(data["recipe_cost"], 200 * 15 + 2_500)
        self.assertEqual(data["category_name"], "Makanan")
        self.assertEqual(len(data["recipe"]), 2)

    def test_menu_needs_a_category_and_recipe_needs_ingredients(self):
        self.as_user(self.owner)
        response = self.client.post(f"{BASE}products/", {"kind": "menu", "name": "X", "price": 1}, format="json")
        self.assertIn("category", response.data["errors"])
        dish = Product.objects.create(kind=ProductKind.MENU, name="Teh", category=self.food, price=5_000)
        response = self.client.post(
            f"{BASE}products/",
            {
                "kind": "menu",
                "name": "Y",
                "category": str(self.food.pk),
                "recipe": [{"ingredient": str(dish.pk), "quantity": 1}],
            },
            format="json",
        )
        self.assertIn("recipe", response.data["errors"])

    def test_barcodes_are_unique_and_searchable(self):
        self.as_user(self.owner)
        payload = {
            "kind": "retail",
            "name": "Keripik",
            "category": str(self.food.pk),
            "price": 12_000,
            "barcode": "8991234567890",
        }
        self.assertEqual(self.client.post(f"{BASE}products/", payload, format="json").status_code, 201)
        clash = self.client.post(f"{BASE}products/", {**payload, "name": "Lain"}, format="json")
        self.assertIn("barcode", clash.data["errors"])
        found = self.client.get(f"{BASE}products/", {"barcode": "8991234567890"}).data["data"]
        self.assertEqual([row["name"] for row in found], ["Keripik"])

    def test_ingredients_are_never_priced_or_categorised(self):
        self.as_user(self.owner)
        response = self.client.post(
            f"{BASE}products/",
            {
                "kind": "ingredient",
                "name": "Gula",
                "unit": "g",
                "cost": 18,
                "price": 999,
                "category": str(self.food.pk),
            },
            format="json",
        )
        data = response.data["data"]
        self.assertEqual((data["price"], data["category"], data["tax_category"]), (0, None, "none"))

    def test_price_change_is_audited_and_archive_keeps_the_row(self):
        dish = Product.objects.create(kind=ProductKind.MENU, name="Teh", category=self.food, price=5_000)
        self.as_user(self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            self.client.patch(f"{BASE}products/{dish.pk}/", {"price": 6_000}, format="json")
        event = AuditEvent.objects.get(action="product.update")
        self.assertEqual((event.metadata["before"]["price"], event.metadata["after"]["price"]), (5_000, 6_000))
        self.client.delete(f"{BASE}products/{dish.pk}/")
        self.assertTrue(Product.objects.filter(pk=dish.pk, is_active=False).exists())
        names = [row["name"] for row in self.client.get(f"{BASE}products/", {"kind": "menu"}).data["data"]]
        self.assertNotIn("Teh", names)

    def test_category_in_use_cannot_be_deleted_and_reorder(self):
        drinks = Category.objects.create(name="Minuman", sort_order=5)
        Product.objects.create(kind=ProductKind.MENU, name="Teh", category=self.food, price=5_000)
        self.as_user(self.owner)
        refused = self.client.delete(f"{BASE}categories/{self.food.pk}/")
        self.assertEqual(refused.status_code, 400)
        self.assertNotIn("errors", refused.data)
        response = self.client.post(
            f"{BASE}categories/reorder/", {"ids": [str(drinks.pk), str(self.food.pk)]}, format="json"
        )
        self.assertEqual([row["name"] for row in response.data["data"]], ["Minuman", "Makanan"])

    def test_modifier_group_rules(self):
        self.as_user(self.owner)
        response = self.client.post(
            f"{BASE}modifier-groups/",
            {"name": "X", "min_select": 2, "max_select": 1, "options": [{"name": "a"}]},
            format="json",
        )
        self.assertIn("min_select", response.data["errors"])
        group = ModifierGroup.objects.create(name="Tambahan", min_select=0, max_select=3)
        option = group.options.create(name="Telur", price_delta=5_000)
        response = self.client.patch(
            f"{BASE}modifier-groups/{group.pk}/",
            {
                "options": [
                    {"id": str(option.pk), "name": "Telur ceplok", "price_delta": 6_000},
                    {"name": "Keju", "price_delta": 7_000},
                ]
            },
            format="json",
        )
        names = [o["name"] for o in response.data["data"]["options"]]
        self.assertEqual(names, ["Telur ceplok", "Keju"])
        option.refresh_from_db()
        self.assertEqual(option.price_delta, 6_000)

    def test_photo_upload_is_reencoded_to_webp(self):
        dish = Product.objects.create(kind=ProductKind.MENU, name="Teh", category=self.food, price=5_000)
        buffer = io.BytesIO()
        Image.new("RGB", (1600, 1600), "orange").save(buffer, format="PNG")
        buffer.seek(0)
        buffer.name = "teh.png"
        self.as_user(self.owner)
        with tempfile.TemporaryDirectory() as media, override_settings(MEDIA_ROOT=media):
            response = self.client.post(f"{BASE}products/{dish.pk}/image/", {"image": buffer}, format="multipart")
            self.assertEqual(response.status_code, 200, response.content)
            self.assertTrue(response.data["data"]["image_url"].endswith(".webp"))
            dish.refresh_from_db()
            with Image.open(dish.image.path) as stored:
                self.assertEqual(stored.size, (1200, 900))
            bad = io.BytesIO(b"not an image")
            bad.name = "x.png"
            response = self.client.post(f"{BASE}products/{dish.pk}/image/", {"image": bad}, format="multipart")
            self.assertIn("image", response.data["errors"])

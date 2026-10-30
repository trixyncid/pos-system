"""
What the outlet sells and what it is made of.

One `Product` table holds menu items, snack-bar retail items and ingredients,
so restaurant and snack bar share one stock ledger (M8). Prices and costs are
whole rupiah.
"""

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class Station(models.TextChoices):
    """Where a category's order lines print. M5 maps each station to a printer."""

    KITCHEN = "kitchen", _("Kitchen")
    BAR = "bar", _("Bar")
    NONE = "none", _("Not printed")


class Category(BaseModel):
    name = models.CharField(_("name"), max_length=80)
    station = models.CharField(_("prints at"), max_length=16, choices=Station.choices, default=Station.KITCHEN)
    sort_order = models.PositiveIntegerField(_("sort order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ("sort_order", "name")
        constraints = [models.UniqueConstraint(fields=["name"], name="category_unique_name")]

    def __str__(self):
        return self.name


class ProductKind(models.TextChoices):
    MENU = "menu", _("Menu item")
    RETAIL = "retail", _("Retail item")
    INGREDIENT = "ingredient", _("Ingredient")


class TaxCategory(models.TextChoices):
    """PBJT for restaurant food and drink; retail goods may fall under PPN or nothing."""

    PBJT = "pbjt", _("PBJT")
    PPN = "ppn", _("PPN")
    NONE = "none", _("No tax")


class Unit(models.TextChoices):
    PORTION = "portion", _("portion")
    PIECE = "pcs", _("pcs")
    GRAM = "g", _("gram")
    MILLILITRE = "ml", _("ml")


class Product(BaseModel):
    kind = models.CharField(_("kind"), max_length=16, choices=ProductKind.choices, db_index=True)
    name = models.CharField(_("name"), max_length=120)
    description = models.CharField(_("description"), max_length=300, blank=True, default="")
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="products",
        verbose_name=_("category"),
    )
    price = models.PositiveIntegerField(_("price"), default=0, help_text=_("Selling price in rupiah."))
    cost = models.PositiveIntegerField(
        _("cost"),
        default=0,
        help_text=_("Purchase cost per unit; for menu items with a recipe, the recipe cost is used instead."),
    )
    unit = models.CharField(_("unit"), max_length=8, choices=Unit.choices, default=Unit.PORTION)
    barcode = models.CharField(_("barcode"), max_length=32, null=True, blank=True)
    sku = models.CharField(_("SKU"), max_length=40, blank=True, default="")
    tax_category = models.CharField(_("tax"), max_length=8, choices=TaxCategory.choices, default=TaxCategory.PBJT)
    track_stock = models.BooleanField(_("track stock"), default=False)
    low_stock_threshold = models.DecimalField(_("low stock at"), max_digits=12, decimal_places=3, null=True, blank=True)
    # Cached from the inventory ledger (inventory.StockMovement); only inventory.services writes it.
    stock = models.DecimalField(_("on hand"), max_digits=12, decimal_places=3, default=0)
    image = models.ImageField(_("photo"), upload_to="products/", blank=True)
    is_available = models.BooleanField(
        _("available"), default=True, help_text=_("Off shows the item as sold out on the order screen.")
    )
    is_favorite = models.BooleanField(_("favourite"), default=False)
    is_active = models.BooleanField(_("active"), default=True)
    sort_order = models.PositiveIntegerField(_("sort order"), default=0)
    modifier_groups = models.ManyToManyField(
        "ModifierGroup", blank=True, related_name="products", verbose_name=_("modifier groups")
    )

    class Meta:
        verbose_name = _("product")
        verbose_name_plural = _("products")
        ordering = ("sort_order", "name")
        constraints = [
            # A barcode identifies one product; many products have none.
            models.UniqueConstraint(
                fields=["barcode"], condition=Q(barcode__isnull=False), name="product_unique_barcode"
            ),
        ]
        indexes = [models.Index(fields=["kind", "is_active", "category"], name="product_listing")]

    def __str__(self):
        return self.name


class ModifierGroup(BaseModel):
    """A choice asked when the item is ordered: "Level pedas" (pick 1), "Tambahan" (up to 3)."""

    name = models.CharField(_("name"), max_length=80)
    min_select = models.PositiveSmallIntegerField(_("minimum"), default=0, help_text=_("1 or more makes it required."))
    max_select = models.PositiveSmallIntegerField(_("maximum"), default=1, validators=[MinValueValidator(1)])
    sort_order = models.PositiveIntegerField(_("sort order"), default=0)

    class Meta:
        verbose_name = _("modifier group")
        verbose_name_plural = _("modifier groups")
        ordering = ("sort_order", "name")
        constraints = [
            models.CheckConstraint(condition=Q(min_select__lte=models.F("max_select")), name="modifier_min_le_max"),
        ]

    def __str__(self):
        return self.name


class Modifier(BaseModel):
    group = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name="options", verbose_name=_("group"))
    name = models.CharField(_("name"), max_length=80)
    price_delta = models.IntegerField(_("price change"), default=0)
    sort_order = models.PositiveIntegerField(_("sort order"), default=0)

    class Meta:
        verbose_name = _("modifier")
        verbose_name_plural = _("modifiers")
        ordering = ("sort_order", "name")

    def __str__(self):
        return self.name


class RecipeLine(BaseModel):
    """One ingredient of a menu item. Selling the item takes `quantity` of it from stock (M8)."""

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="recipe", verbose_name=_("menu item"))
    ingredient = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="used_in", verbose_name=_("ingredient")
    )
    quantity = models.DecimalField(_("quantity"), max_digits=12, decimal_places=3)

    class Meta:
        verbose_name = _("recipe line")
        verbose_name_plural = _("recipe lines")
        ordering = ("created_at",)
        constraints = [models.UniqueConstraint(fields=["product", "ingredient"], name="recipe_unique_ingredient")]

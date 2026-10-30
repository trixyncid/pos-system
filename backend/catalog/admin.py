from django.contrib import admin

from catalog.models import Category, Modifier, ModifierGroup, Product, RecipeLine


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "station", "sort_order", "is_active")


class RecipeInline(admin.TabularInline):
    model = RecipeLine
    fk_name = "product"
    extra = 0


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "category", "price", "is_available", "is_active")
    list_filter = ("kind", "category", "is_active")
    search_fields = ("name", "barcode", "sku")
    inlines = [RecipeInline]


class ModifierInline(admin.TabularInline):
    model = Modifier
    extra = 0


@admin.register(ModifierGroup)
class ModifierGroupAdmin(admin.ModelAdmin):
    list_display = ("name", "min_select", "max_select")
    inlines = [ModifierInline]

# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    jh_catalog_ids = fields.Many2many(
        'jh.website.catalog',
        'jh_website_catalog_product_rel',
        'product_id',
        'catalog_id',
        string='Catálogos JH Web',
        check_company=True,
    )
    jh_show_on_website = fields.Boolean(
        string='En web JH Hogar',
        compute='_compute_jh_show_on_website',
        store=True,
        index=True,
        help='True si el producto está en al menos un catálogo JH publicado y activo.',
    )

    @api.depends(
        'jh_catalog_ids',
        'jh_catalog_ids.published',
        'jh_catalog_ids.active',
    )
    def _compute_jh_show_on_website(self):
        for product in self:
            product.jh_show_on_website = any(
                catalog.published and catalog.active
                for catalog in product.jh_catalog_ids
            )

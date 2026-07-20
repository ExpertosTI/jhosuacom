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
    jh_website_description = fields.Text(
        string='Descripción web JH',
        help='Texto que usa la tienda JH Hogar. Si está vacío, se usa la descripción de venta '
             'o la generada por IA al sincronizar.',
    )
    jh_ai_description = fields.Text(
        string='Descripción IA (JH)',
        readonly=True,
        copy=False,
        help='Rellenada por la tienda JH Hogar tras sync + Gemini. Solo lectura en Odoo.',
    )
    jh_ai_tags = fields.Char(
        string='Tags IA (JH)',
        readonly=True,
        copy=False,
        help='Etiquetas generadas por IA en la tienda (separadas por coma).',
    )
    jh_need_ai_description = fields.Boolean(
        string='Pedir descripción IA',
        default=False,
        help='Marca para que la próxima sincronización de JH Hogar regenere la descripción con IA.',
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

    def action_jh_request_ai_description(self):
        """Botón: marcar productos para regenerar copy con IA en el próximo sync."""
        self.write({'jh_need_ai_description': True})
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': 'JH Hogar',
                'message': 'Marcados para descripción IA. Ejecuta sync en el admin de la tienda.',
                'type': 'success',
                'sticky': False,
            },
        }

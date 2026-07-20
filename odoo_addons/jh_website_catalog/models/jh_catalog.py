# -*- coding: utf-8 -*-
from odoo import api, fields, models


class JhWebsiteCatalog(models.Model):
    _name = 'jh.website.catalog'
    _description = 'Catálogo web JH Hogar'
    _order = 'sequence, name'
    _check_company_auto = True

    name = fields.Char(
        string='Nombre',
        required=True,
        translate=True,
    )
    company_id = fields.Many2one(
        'res.company',
        string='Empresa',
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    published = fields.Boolean(
        string='Publicado en web',
        default=True,
        help='Si está activo, la tienda JH Hogar sincroniza estos productos.',
    )
    product_ids = fields.Many2many(
        'product.template',
        'jh_website_catalog_product_rel',
        'catalog_id',
        'product_id',
        string='Productos en la tienda',
        check_company=True,
        domain="[('sale_ok', '=', True), '|', ('company_id', '=', False), ('company_id', '=', company_id)]",
    )
    product_count = fields.Integer(
        string='# Productos',
        compute='_compute_product_count',
    )
    notes = fields.Text(string='Notas internas')

    @api.depends('product_ids')
    def _compute_product_count(self):
        for rec in self:
            rec.product_count = len(rec.product_ids)

    def action_open_products(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Productos del catálogo',
            'res_model': 'product.template',
            'view_mode': 'list,form',
            'domain': [('id', 'in', self.product_ids.ids)],
            'context': {'default_company_id': self.company_id.id},
        }

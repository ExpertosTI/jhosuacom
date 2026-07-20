# -*- coding: utf-8 -*-
{
    'name': 'JH Hogar — Catálogo Web',
    'version': '18.0.1.1.0',
    'category': 'Sales/Sales',
    'summary': 'Selecciona qué productos de cada empresa se publican en jhosuacomercial.com',
    'description': """
JH Hogar — Catálogo Web (Odoo 18)
=================================

Permite crear catálogos por empresa y elegir exactamente qué productos
se sincronizan con la tienda JH Hogar.

* Menú: Ventas → JH Hogar Web → Catálogos web
* Multi-compañía nativo
* Flag calculado ``jh_show_on_website`` en el producto
* Galería de fotos múltiples (imagen principal + product.image)
* La API de la tienda solo importa productos de catálogos publicados
""",
    'author': 'Renace Technologies',
    'company': 'Renace Technologies',
    'maintainer': 'Renace Technologies',
    'website': 'https://renace.tech',
    'license': 'LGPL-3',
    'depends': [
        'product',
        'sale_management',
    ],
    'data': [
        'security/jh_website_security.xml',
        'security/ir.model.access.csv',
        'views/jh_catalog_views.xml',
        'views/product_template_views.xml',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}

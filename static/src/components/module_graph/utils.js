/** @odoo-module */
import { useService } from "@web/core/utils/hooks";

export function useOrm() {
    return useService("orm");
}

export function useAction() {
    return useService("action");
}

export function fetchModules(orm) {
    return orm.call(
        'ir.module.module',
        'search_read',
        [],
        {
            fields: ['id', 'name', 'shortdesc', 'state', 'icon', 'category_id', 'application', 'module_type'],
            order: 'shortdesc',
        }
    );
}

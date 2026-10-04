"use strict";
var WooOptionsPro;
(function (WooOptionsPro) {
    var Utils;
    (function (Utils) {
        Utils.i18n = wp.i18n;
        function clone(value) {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
            return JSON.parse(JSON.stringify(value));
        }
        Utils.clone = clone;
        function uuid() {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
                const random = Math.floor(Math.random() * 16);
                const value = character === 'x' ? random : (random & 0x3) | 0x8;
                return value.toString(16);
            });
        }
        Utils.uuid = uuid;
        function errorMessage(error) {
            if (typeof error === 'string' && error.trim() !== '') {
                return error;
            }
            if (error && typeof error === 'object') {
                const anyErr = error;
                if (typeof anyErr.message === 'string' && anyErr.message.trim() !== '') {
                    return anyErr.message;
                }
                if (anyErr.data && typeof anyErr.data.message === 'string' && anyErr.data.message.trim() !== '') {
                    return anyErr.data.message;
                }
                if (anyErr.code === 'wooptions_pro_license_required') {
                    return Utils.i18n.__('Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro');
                }
            }
            return Utils.i18n.__('Something went wrong. Please try again.', 'wooptions-pro');
        }
        Utils.errorMessage = errorMessage;
        function formatDate(value) {
            if (!value)
                return '—';
            const normalized = /Z$/.test(value) ? value : `${value}Z`;
            const date = new Date(normalized);
            if (Number.isNaN(date.getTime()))
                return value;
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(date);
        }
        Utils.formatDate = formatDate;
        function downloadJson(filename, payload) {
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        }
        Utils.downloadJson = downloadJson;
        function slug(value) {
            return value
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
        }
        Utils.slug = slug;
        function fieldByUuid(document, uuidValue) {
            if (!document || !uuidValue)
                return null;
            const walk = (fields) => {
                for (const field of fields) {
                    if (field.uuid === uuidValue)
                        return field;
                    if (field.children?.length) {
                        const child = walk(field.children);
                        if (child)
                            return child;
                    }
                }
                return null;
            };
            return walk(document.fields);
        }
        Utils.fieldByUuid = fieldByUuid;
        function updateFieldTree(fields, uuidValue, updater) {
            return fields.map((field) => {
                if (field.uuid === uuidValue)
                    return updater(field);
                if (field.children?.length) {
                    return { ...field, children: updateFieldTree(field.children, uuidValue, updater) };
                }
                return field;
            });
        }
        Utils.updateFieldTree = updateFieldTree;
        function removeFieldTree(fields, uuidValue) {
            return fields
                .filter((field) => field.uuid !== uuidValue)
                .map((field) => ({
                ...field,
                children: field.children ? removeFieldTree(field.children, uuidValue) : field.children,
            }));
        }
        Utils.removeFieldTree = removeFieldTree;
        function allFields(fields) {
            const result = [];
            const walk = (items) => {
                items.forEach((field) => {
                    result.push(field);
                    if (field.children?.length)
                        walk(field.children);
                });
            };
            walk(fields);
            return result;
        }
        Utils.allFields = allFields;
        function countChoices(fields) {
            return allFields(fields).reduce((count, field) => count + (field.choices?.length ?? 0), 0);
        }
        Utils.countChoices = countChoices;
        function compactNumber(value) {
            const number = Number(value || 0);
            if (number < 1000)
                return String(number);
            return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(number);
        }
        Utils.compactNumber = compactNumber;
        function classNames(...values) {
            return values.filter(Boolean).join(' ');
        }
        Utils.classNames = classNames;
    })(Utils = WooOptionsPro.Utils || (WooOptionsPro.Utils = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Api;
    (function (Api) {
        const apiFetch = wp.apiFetch;
        apiFetch.use(apiFetch.createNonceMiddleware(window.WooOptionsProAdmin.nonce));
        async function request(path, options = {}) {
            return apiFetch({
                path: `/wooptions-pro/v1${path}`,
                method: options.method ?? 'GET',
                data: options.data,
            });
        }
        Api.request = request;
        function listOptionSets(params = {}) {
            const query = new URLSearchParams({
                page: String(params.page ?? 1),
                perPage: String(params.perPage ?? 10),
                status: params.status ?? 'active',
                search: params.search ?? '',
                orderBy: params.orderBy ?? 'updated_at_gmt',
                order: params.order ?? 'DESC',
            });
            return request(`/option-sets?${query.toString()}`);
        }
        Api.listOptionSets = listOptionSets;
        function createOptionSet(title) {
            return request('/option-sets', { method: 'POST', data: { title } });
        }
        Api.createOptionSet = createOptionSet;
        function getOptionSet(uuid) {
            return request(`/option-sets/${uuid}`);
        }
        Api.getOptionSet = getOptionSet;
        function updateOptionSet(uuid, data) {
            return request(`/option-sets/${uuid}`, { method: 'PUT', data });
        }
        Api.updateOptionSet = updateOptionSet;
        function duplicateOptionSet(uuid) {
            return request(`/option-sets/${uuid}/duplicate`, { method: 'POST' });
        }
        Api.duplicateOptionSet = duplicateOptionSet;
        function deleteOptionSet(uuid) {
            return request(`/option-sets/${uuid}/delete-permanently`, { method: 'POST' });
        }
        Api.deleteOptionSet = deleteOptionSet;
        function saveRevision(uuid, definition, expectedHash, versionNote) {
            return request(`/option-sets/${uuid}/revisions`, {
                method: 'POST',
                data: { definition, expectedHash, versionNote },
            });
        }
        Api.saveRevision = saveRevision;
        function validateDefinition(uuid, definition) {
            return request(`/option-sets/${uuid}/validate`, { method: 'POST', data: { definition } });
        }
        Api.validateDefinition = validateDefinition;
        function publishOptionSet(uuid, expectedHash) {
            return request(`/option-sets/${uuid}/publish`, {
                method: 'POST',
                data: { expectedHash, versionNote: 'Published from the builder' },
            });
        }
        Api.publishOptionSet = publishOptionSet;
        function listRevisions(uuid) {
            return request(`/option-sets/${uuid}/revisions`);
        }
        Api.listRevisions = listRevisions;
        function rollback(uuid, revisionUuid) {
            return request(`/option-sets/${uuid}/rollback`, { method: 'POST', data: { revisionUuid } });
        }
        Api.rollback = rollback;
        function getAssignments(uuid) {
            return request(`/option-sets/${uuid}/assignments`);
        }
        Api.getAssignments = getAssignments;
        function saveAssignments(uuid, assignments) {
            return request(`/option-sets/${uuid}/assignments`, { method: 'PUT', data: { assignments } });
        }
        Api.saveAssignments = saveAssignments;
        function searchAssignmentTargets(type, search, include = []) {
            const query = new URLSearchParams({ type, search, include: include.join(','), perPage: '25' });
            return request(`/assignment-targets?${query.toString()}`);
        }
        Api.searchAssignmentTargets = searchAssignmentTargets;
        function searchProductsForChoices(search, include = []) {
            const query = new URLSearchParams({ type: 'product', search, include: include.join(','), perPage: '20', forChoices: '1' });
            return request(`/assignment-targets?${query.toString()}`);
        }
        Api.searchProductsForChoices = searchProductsForChoices;
        function listTemplates() {
            return request('/templates');
        }
        Api.listTemplates = listTemplates;
        function importTemplate(slug) {
            return request('/templates', { method: 'POST', data: { slug } });
        }
        Api.importTemplate = importTemplate;
        function previewImport(payload) {
            return request('/imports/preview', { method: 'POST', data: payload });
        }
        Api.previewImport = previewImport;
        function commitImport(payload, title) {
            return request('/imports/commit', { method: 'POST', data: { ...payload, title } });
        }
        Api.commitImport = commitImport;
        function exportOptionSet(uuid) {
            return request(`/exports/${uuid}`);
        }
        Api.exportOptionSet = exportOptionSet;
        function analytics(params) {
            const query = new URLSearchParams();
            if (params?.range)
                query.set('range', params.range);
            if (params?.from)
                query.set('from', params.from);
            if (params?.to)
                query.set('to', params.to);
            if (params?.productId)
                query.set('productId', String(params.productId));
            const qs = query.toString();
            return request(qs ? `/analytics?${qs}` : '/analytics');
        }
        Api.analytics = analytics;
        function getSettings() {
            return request('/settings');
        }
        Api.getSettings = getSettings;
        function saveSettings(settings) {
            return request('/settings', { method: 'PUT', data: settings });
        }
        Api.saveSettings = saveSettings;
    })(Api = WooOptionsPro.Api || (WooOptionsPro.Api = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var BuilderStore;
    (function (BuilderStore) {
        BuilderStore.STORE_KEY = 'wooptions-pro/builder';
        const initialState = {
            optionSet: null,
            document: null,
            selectedUuid: null,
            inspectorTab: 'content',
            device: 'desktop',
            saveStatus: 'idle',
            dirty: false,
            history: [],
            future: [],
            errors: [],
            warnings: [],
        };
        function pushHistory(state) {
            if (!state.document)
                return state;
            const history = [...state.history, WooOptionsPro.Utils.clone(state.document)].slice(-60);
            return { ...state, history, future: [] };
        }
        const actions = {
            loadSet(optionSet) {
                return { type: 'LOAD_SET', optionSet };
            },
            replaceDocument(document) {
                return { type: 'REPLACE_DOCUMENT', document };
            },
            updateDocument(patch) {
                return { type: 'UPDATE_DOCUMENT', patch };
            },
            addField(field, index, parentUuid) {
                return { type: 'ADD_FIELD', field, index, parentUuid };
            },
            updateField(uuid, patch) {
                return { type: 'UPDATE_FIELD', uuid, patch };
            },
            replaceField(uuid, field) {
                return { type: 'REPLACE_FIELD', uuid, field };
            },
            deleteField(uuid) {
                return { type: 'DELETE_FIELD', uuid };
            },
            moveField(from, to) {
                return { type: 'MOVE_FIELD', from, to };
            },
            moveChildField(parentUuid, from, to) {
                return { type: 'MOVE_CHILD_FIELD', parentUuid, from, to };
            },
            moveFieldToParent(fieldUuid, parentUuid, index) {
                return { type: 'MOVE_FIELD_TO_PARENT', fieldUuid, parentUuid, index };
            },
            selectField(uuid) {
                return { type: 'SELECT_FIELD', uuid };
            },
            setInspectorTab(tab) {
                return { type: 'SET_INSPECTOR_TAB', tab };
            },
            setDevice(device) {
                return { type: 'SET_DEVICE', device };
            },
            setSaveStatus(status) {
                return { type: 'SET_SAVE_STATUS', status };
            },
            setValidation(errors, warnings) {
                return { type: 'SET_VALIDATION', errors, warnings };
            },
            saved(optionSet, document) {
                return { type: 'SAVED', optionSet, document };
            },
            undo() {
                return { type: 'UNDO' };
            },
            redo() {
                return { type: 'REDO' };
            },
        };
        function reducer(state = initialState, action) {
            switch (action.type) {
                case 'LOAD_SET': {
                    const optionSet = action.optionSet;
                    const document = optionSet.currentRevision?.definition ?? null;
                    return {
                        ...initialState,
                        optionSet,
                        document: document ? WooOptionsPro.Utils.clone(document) : null,
                        saveStatus: 'saved',
                    };
                }
                case 'REPLACE_DOCUMENT': {
                    return {
                        ...pushHistory(state),
                        document: WooOptionsPro.Utils.clone(action.document),
                        dirty: true,
                        saveStatus: 'dirty',
                    };
                }
                case 'UPDATE_DOCUMENT': {
                    if (!state.document)
                        return state;
                    const next = pushHistory(state);
                    return {
                        ...next,
                        document: { ...state.document, ...action.patch },
                        dirty: true,
                        saveStatus: 'dirty',
                    };
                }
                case 'ADD_FIELD': {
                    if (!state.document)
                        return state;
                    const next = pushHistory(state);
                    let fields = [...state.document.fields];
                    if (action.parentUuid) {
                        fields = WooOptionsPro.Utils.updateFieldTree(fields, action.parentUuid, (parent) => {
                            const children = [...(parent.children ?? [])];
                            const index = typeof action.index === 'number' ? Math.max(0, Math.min(children.length, action.index)) : children.length;
                            children.splice(index, 0, action.field);
                            return { ...parent, children };
                        });
                    }
                    else {
                        const index = typeof action.index === 'number' ? Math.max(0, Math.min(fields.length, action.index)) : fields.length;
                        fields.splice(index, 0, action.field);
                    }
                    return {
                        ...next,
                        document: { ...state.document, fields },
                        selectedUuid: action.field.uuid,
                        inspectorTab: 'content',
                        dirty: true,
                        saveStatus: 'dirty',
                    };
                }
                case 'UPDATE_FIELD': {
                    if (!state.document)
                        return state;
                    const next = pushHistory(state);
                    const fields = WooOptionsPro.Utils.updateFieldTree(state.document.fields, action.uuid, (field) => ({ ...field, ...action.patch }));
                    return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
                }
                case 'REPLACE_FIELD': {
                    if (!state.document)
                        return state;
                    const next = pushHistory(state);
                    const fields = WooOptionsPro.Utils.updateFieldTree(state.document.fields, action.uuid, () => action.field);
                    return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
                }
                case 'DELETE_FIELD': {
                    if (!state.document)
                        return state;
                    const next = pushHistory(state);
                    const fields = WooOptionsPro.Utils.removeFieldTree(state.document.fields, action.uuid);
                    const rules = state.document.rules.filter((rule) => !rule.actions.some((item) => item.target === action.uuid));
                    return {
                        ...next,
                        document: { ...state.document, fields, rules },
                        selectedUuid: state.selectedUuid === action.uuid ? null : state.selectedUuid,
                        dirty: true,
                        saveStatus: 'dirty',
                    };
                }
                case 'MOVE_FIELD': {
                    if (!state.document || action.from === action.to)
                        return state;
                    const next = pushHistory(state);
                    const fields = [...state.document.fields];
                    const from = Math.max(0, Math.min(fields.length - 1, action.from));
                    const to = Math.max(0, Math.min(fields.length - 1, action.to));
                    const [field] = fields.splice(from, 1);
                    fields.splice(to, 0, field);
                    return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
                }
                case 'MOVE_CHILD_FIELD': {
                    if (!state.document || action.from === action.to)
                        return state;
                    const next = pushHistory(state);
                    const fields = WooOptionsPro.Utils.updateFieldTree(state.document.fields, action.parentUuid, (parent) => {
                        const children = [...(parent.children ?? [])];
                        const from = Math.max(0, Math.min(children.length - 1, action.from));
                        const to = Math.max(0, Math.min(children.length - 1, action.to));
                        const [moved] = children.splice(from, 1);
                        children.splice(to, 0, moved);
                        return { ...parent, children };
                    });
                    return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
                }
                case 'MOVE_FIELD_TO_PARENT': {
                    if (!state.document)
                        return state;
                    const fieldToMove = WooOptionsPro.Utils.fieldByUuid(state.document, action.fieldUuid);
                    if (!fieldToMove || fieldToMove.uuid === action.parentUuid)
                        return state;
                    const next = pushHistory(state);
                    let fields = WooOptionsPro.Utils.removeFieldTree(state.document.fields, action.fieldUuid);
                    fields = WooOptionsPro.Utils.updateFieldTree(fields, action.parentUuid, (parent) => {
                        const children = [...(parent.children ?? [])];
                        const index = typeof action.index === 'number' ? Math.max(0, Math.min(children.length, action.index)) : children.length;
                        children.splice(index, 0, fieldToMove);
                        return { ...parent, children };
                    });
                    return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
                }
                case 'SELECT_FIELD':
                    return { ...state, selectedUuid: action.uuid };
                case 'SET_INSPECTOR_TAB':
                    return { ...state, inspectorTab: action.tab };
                case 'SET_DEVICE':
                    return { ...state, device: action.device };
                case 'SET_SAVE_STATUS':
                    return { ...state, saveStatus: action.status };
                case 'SET_VALIDATION':
                    return { ...state, errors: action.errors, warnings: action.warnings };
                case 'SAVED': {
                    const optionSet = action.optionSet;
                    return {
                        ...state,
                        optionSet,
                        document: action.document ?? state.document,
                        dirty: false,
                        saveStatus: 'saved',
                    };
                }
                case 'UNDO': {
                    if (!state.document || !state.history.length)
                        return state;
                    const history = [...state.history];
                    const previous = history.pop();
                    return {
                        ...state,
                        document: previous,
                        history,
                        future: [WooOptionsPro.Utils.clone(state.document), ...state.future].slice(0, 60),
                        dirty: true,
                        saveStatus: 'dirty',
                    };
                }
                case 'REDO': {
                    if (!state.document || !state.future.length)
                        return state;
                    const [nextDocument, ...future] = state.future;
                    return {
                        ...state,
                        document: nextDocument,
                        history: [...state.history, WooOptionsPro.Utils.clone(state.document)].slice(-60),
                        future,
                        dirty: true,
                        saveStatus: 'dirty',
                    };
                }
                default:
                    return state;
            }
        }
        const selectors = {
            getState(state) {
                return state;
            },
            getDocument(state) {
                return state.document;
            },
            getSelectedField(state) {
                return WooOptionsPro.Utils.fieldByUuid(state.document, state.selectedUuid);
            },
        };
        wp.data.registerStore(BuilderStore.STORE_KEY, { reducer, actions, selectors });
    })(BuilderStore = WooOptionsPro.BuilderStore || (WooOptionsPro.BuilderStore = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var FieldFactory;
    (function (FieldFactory) {
        const choiceTypes = new Set(['select', 'radio', 'checkbox_group', 'segmented', 'color_swatch', 'image_swatch', 'product', 'font']);
        function emptyPricing() {
            return { strategy: 'none', amount: '0', percent: '0', mode: 'adjustment' };
        }
        FieldFactory.emptyPricing = emptyPricing;
        function choice(label, index = 0) {
            return {
                uuid: WooOptionsPro.Utils.uuid(),
                label,
                description: '',
                adminLabel: '',
                color: index === 0 ? '#5B4FF5' : index === 1 ? '#0F766E' : '#64748B',
                imageId: 0,
                imageUrl: '',
                disabled: false,
                default: index === 0,
                pricing: emptyPricing(),
                quantityEnabled: false,
                linkedProductId: 0,
                linkedVariationId: 0,
                linkedQuantity: 1,
                preview: {},
            };
        }
        FieldFactory.choice = choice;
        function create(type) {
            const manifest = window.WooOptionsProAdmin.fieldTypes[type];
            const label = manifest?.label ?? 'Field';
            const field = {
                uuid: WooOptionsPro.Utils.uuid(),
                type,
                label,
                description: '',
                required: false,
                disabled: false,
                default: null,
                validation: {},
                pricing: emptyPricing(),
                conditions: {},
                style: {},
                preview: {},
                help: '',
                helpTextPosition: 'below_title',
                width: '100%',
            };
            if (choiceTypes.has(type)) {
                field.choices = type === 'product' ? [] : [choice('Choice 1', 0), choice('Choice 2', 1), choice('Choice 3', 2)];
                field.multiple = Boolean(manifest?.multiple);
                field.minChoices = 0;
                field.maxChoices = 0;
                field.choiceWidth = '';
                field.choiceHeight = '';
                field.choiceBorderRadius = '';
                field.enableQuantity = false;
                field.minQuantity = 1;
                field.maxQuantity = 100;
                if (type === 'image_swatch')
                    field.updateProductImage = false;
                if (['radio', 'checkbox_group', 'select'].includes(type)) {
                    field.columns = 'one';
                    field.imageStyle = 'normal';
                }
                if (['product', 'image_swatch', 'color_swatch'].includes(type)) {
                    field.imageStyle = 'default';
                }
                if (type === 'product') {
                    field.mergeVariationProducts = false;
                }
                if (type === 'font') {
                    field.appliedFields = [];
                    field.placeholder = 'Choose a font...';
                    field.choices = [
                        {
                            uuid: WooOptionsPro.Utils.uuid(),
                            label: 'Roboto',
                            description: '',
                            adminLabel: '',
                            color: '',
                            imageId: 0,
                            imageUrl: '',
                            disabled: false,
                            default: true,
                            pricing: emptyPricing(),
                            quantityEnabled: false,
                            linkedProductId: 0,
                            linkedVariationId: 0,
                            linkedQuantity: 1,
                            preview: {},
                            fontFamily: 'Roboto, sans-serif',
                            fontCategory: 'Sans-Serif',
                            fontSource: 'google',
                        },
                        {
                            uuid: WooOptionsPro.Utils.uuid(),
                            label: 'Playfair Display',
                            description: '',
                            adminLabel: '',
                            color: '',
                            imageId: 0,
                            imageUrl: '',
                            disabled: false,
                            default: false,
                            pricing: emptyPricing(),
                            quantityEnabled: false,
                            linkedProductId: 0,
                            linkedVariationId: 0,
                            linkedQuantity: 1,
                            preview: {},
                            fontFamily: "'Playfair Display', serif",
                            fontCategory: 'Serif',
                            fontSource: 'google',
                        },
                        {
                            uuid: WooOptionsPro.Utils.uuid(),
                            label: 'Dancing Script',
                            description: '',
                            adminLabel: '',
                            color: '',
                            imageId: 0,
                            imageUrl: '',
                            disabled: false,
                            default: false,
                            pricing: emptyPricing(),
                            quantityEnabled: false,
                            linkedProductId: 0,
                            linkedVariationId: 0,
                            linkedQuantity: 1,
                            preview: {},
                            fontFamily: "'Dancing Script', cursive",
                            fontCategory: 'Handwriting / Script',
                            fontSource: 'google',
                        },
                        {
                            uuid: WooOptionsPro.Utils.uuid(),
                            label: 'Pacifico',
                            description: '',
                            adminLabel: '',
                            color: '',
                            imageId: 0,
                            imageUrl: '',
                            disabled: false,
                            default: false,
                            pricing: emptyPricing(),
                            quantityEnabled: false,
                            linkedProductId: 0,
                            linkedVariationId: 0,
                            linkedQuantity: 1,
                            preview: {},
                            fontFamily: "'Pacifico', cursive",
                            fontCategory: 'Handwriting / Script',
                            fontSource: 'google',
                        },
                    ];
                }
                if (type === 'checkbox_group') {
                    field.choices.forEach((c) => {
                        c.default = false;
                    });
                }
            }
            if (type === 'tel') {
                field.flagStyle = 'number_only';
                field.defaultCountry = 'US';
            }
            if (type === 'datetime' || type === 'date' || type === 'time') {
                field.dateTimeType = type === 'time' ? 'time' : 'date';
                field.dateFormat = 'DD/MM/YYYY';
                field.minDateType = 'none';
                field.minDateCustom = '';
                field.maxDateType = 'none';
                field.maxDateCustom = '';
                field.disableToday = false;
                field.disableNextNDays = 0;
                field.disabledDates = [];
                field.disabledWeekdays = [];
                field.disabledMonthlyDays = '';
                field.minTime = '12:00 AM';
                field.maxTime = '12:00 PM';
                field.timeFormat = '12';
            }
            if (type === 'date_range') {
                field.dateFormat = 'DD/MM/YYYY';
                field.minDateType = 'none';
                field.minDateCustom = '';
                field.maxDateType = 'none';
                field.maxDateCustom = '';
                field.disableToday = false;
                field.disableNextNDays = 0;
                field.disabledDates = [];
                field.disabledWeekdays = [];
                field.disabledMonthlyDays = '';
                field.minDays = 0;
                field.maxDays = 0;
                field.allowSameDay = true;
            }
            if (['text', 'textarea', 'tel', 'email', 'url', 'number', 'range', 'date', 'date_range', 'time', 'datetime', 'customer_defined_price', 'color_picker'].includes(type)) {
                field.placeholder = '';
                field.min = null;
                field.max = null;
                field.step = ['number', 'range', 'customer_defined_price'].includes(type) ? '1' : null;
                field.maxLength = 0;
            }
            if (type === 'text' || type === 'textarea') {
                field.minLength = 0;
                field.maxLength = 0;
                field.textTransform = 'none';
                if (type === 'textarea') {
                    field.rows = 4;
                }
            }
            if (type === 'number') {
                field.enableMinMax = true;
                field.min = '1';
                field.max = '100';
                field.step = '1';
                field.default = '';
            }
            if (type === 'range') {
                field.enablePostfix = false;
                field.postfix = 'PostFix';
                field.min = '1';
                field.max = '100';
                field.step = '1';
                field.default = '10';
            }
            if (type === 'file') {
                field.allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
                field.maxFiles = 1;
                field.maxFileMb = 5;
            }
            if (type === 'formula') {
                field.expression = '0';
                field.displayMode = 'currency';
                field.decimalPlaces = 2;
                field.prefix = '';
                field.suffix = '';
                field.hideWhenZero = false;
            }
            if (type === 'repeater') {
                field.label = 'Section Container';
                field.sectionStyle = 'section';
                field.initialState = 'open';
                field.repeatable = true;
                field.repeatMethod = 'button';
                field.repeatLabel = 'Item {n}';
                field.repeatPriceType = 'fixed';
                field.repeatRegularPrice = '3';
                field.repeatSalePrice = '';
                field.buttonLabel = 'Add Another';
                field.maxRepeats = 0;
                field.minRepeats = 1;
                field.children = [];
            }
            if (type === 'heading') {
                field.label = 'Section heading';
                field.help = '';
                field.helpTextPosition = 'below_title';
            }
            if (type === 'paragraph') {
                field.label = 'Paragraph';
                field.description = 'Add supporting product-option content here.';
                field.content = 'Add supporting product-option content here.';
                field.help = '';
            }
            if (type === 'help') {
                field.label = 'Help content';
                field.description = 'Helpful information for customers.';
                field.content = 'Helpful information for customers.';
                field.help = '';
            }
            if (type === 'spacer') {
                field.height = 24;
                field.style = { height: 24 };
            }
            if (type === 'separator') {
                field.height = 1;
                field.color = '#E2E8F0';
                field.style = { height: 1, color: '#E2E8F0' };
            }
            if (type === 'content') {
                field.label = 'Content';
                field.content = '<p>Add rich product description or information here.</p>';
            }
            if (type === 'modal') {
                field.label = 'Modal';
                field.buttonText = 'View details';
                field.modalTitle = 'Product Details';
                field.buttonStyle = 'outline';
                field.content = '<p>Add modal popup information and images here.</p>';
            }
            return field;
        }
        FieldFactory.create = create;
        function duplicate(field) {
            const copy = WooOptionsPro.Utils.clone(field);
            const remap = (item) => ({
                ...item,
                uuid: WooOptionsPro.Utils.uuid(),
                label: item === copy ? `${item.label} copy` : item.label,
                choices: item.choices?.map((choiceItem) => ({ ...choiceItem, uuid: WooOptionsPro.Utils.uuid() })),
                children: item.children?.map(remap),
            });
            return remap(copy);
        }
        FieldFactory.duplicate = duplicate;
    })(FieldFactory = WooOptionsPro.FieldFactory || (WooOptionsPro.FieldFactory = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Components;
    (function (Components) {
        const iconMap = {
            select: 'list-view',
            radio: 'marker',
            checkbox_group: 'yes-alt',
            checkbox: 'yes',
            toggle: 'image-flip-horizontal',
            segmented: 'grid-view',
            color_swatch: 'art',
            image_swatch: 'format-image',
            product: 'products',
            font: 'editor-textcolor',
            text: 'editor-textcolor',
            textarea: 'text-page',
            tel: 'phone',
            email: 'email',
            url: 'admin-links',
            number: 'editor-ol',
            range: 'leftright',
            date: 'calendar-alt',
            date_range: 'calendar',
            time: 'clock',
            datetime: 'schedule',
            customer_defined_price: 'money-alt',
            color_picker: 'admin-customizer',
            file: 'upload',
            formula: 'calculator',
            calculated: 'chart-line',
            repeater: 'screenoptions',
            heading: 'heading',
            paragraph: 'editor-paragraph',
            help: 'editor-help',
            separator: 'minus',
            spacer: 'editor-contract',
            content: 'editor-alignleft',
            modal: 'external',
        };
        function Dashicon(props) {
            return wp.element.createElement("span", { className: WooOptionsPro.Utils.classNames('dashicons', `dashicons-${props.name}`, props.className), "aria-hidden": "true" });
        }
        Components.Dashicon = Dashicon;
        function FieldIcon(props) {
            return wp.element.createElement(Dashicon, { name: iconMap[props.type] ?? 'admin-generic' });
        }
        Components.FieldIcon = FieldIcon;
        function GripIcon() {
            return wp.element.createElement("span", { className: "wof-grip-dots", "aria-hidden": "true" },
                wp.element.createElement("i", null),
                wp.element.createElement("i", null),
                wp.element.createElement("i", null),
                wp.element.createElement("i", null),
                wp.element.createElement("i", null),
                wp.element.createElement("i", null));
        }
        Components.GripIcon = GripIcon;
    })(Components = WooOptionsPro.Components || (WooOptionsPro.Components = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Components;
    (function (Components) {
        const { Button, Modal, Spinner } = wp.components;
        const { __ } = wp.i18n;
        const { useEffect, useState } = wp.element;
        function MediaImage(props) {
            const [resolvedSrc, setResolvedSrc] = useState(props.src ?? '');
            useEffect(() => {
                let active = true;
                setResolvedSrc(props.src ?? '');
                const attachmentId = Number(props.attachmentId ?? 0);
                if (!attachmentId || !wp.media?.attachment)
                    return () => { active = false; };
                const attachment = wp.media.attachment(attachmentId);
                const update = () => {
                    if (!active)
                        return;
                    const data = attachment.toJSON?.() ?? {};
                    const source = data.sizes?.thumbnail?.url ?? data.sizes?.medium?.url ?? data.url ?? '';
                    if (source)
                        setResolvedSrc(String(source));
                };
                update();
                const request = attachment.fetch?.();
                if (request)
                    Promise.resolve(request).then(update).catch(() => undefined);
                return () => { active = false; };
            }, [props.attachmentId, props.src]);
            return resolvedSrc ? wp.element.createElement("img", { src: resolvedSrc, alt: props.alt ?? '', className: props.className }) : null;
        }
        Components.MediaImage = MediaImage;
        function Loading(props) {
            return (wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-loading', props.overlay && 'is-overlay'), role: "status" },
                wp.element.createElement("span", { className: "wof-loader", "aria-hidden": "true" }),
                wp.element.createElement("span", null, props.label ?? __('Loading…', 'wooptions-pro'))));
        }
        Components.Loading = Loading;
        function PageHeader(props) {
            return (wp.element.createElement("header", { className: "wof-page-header" },
                wp.element.createElement("div", null,
                    wp.element.createElement("h1", null, props.title),
                    props.description ? wp.element.createElement("p", null, props.description) : null),
                props.actions ? wp.element.createElement("div", { className: "wof-page-header__actions" }, props.actions) : null));
        }
        Components.PageHeader = PageHeader;
        function EmptyState(props) {
            return (wp.element.createElement("div", { className: "wof-empty" },
                wp.element.createElement("div", { className: "wof-empty__icon" },
                    wp.element.createElement(Components.Dashicon, { name: props.icon })),
                wp.element.createElement("h2", null, props.title),
                wp.element.createElement("p", null, props.description),
                props.action));
        }
        Components.EmptyState = EmptyState;
        function StatusPill(props) {
            const normalized = props.status.toLowerCase().replace(/[^a-z-]/g, '');
            return wp.element.createElement("span", { className: `wof-status-pill is-${normalized}` },
                wp.element.createElement("span", { "aria-hidden": "true" }),
                props.status);
        }
        Components.StatusPill = StatusPill;
        function ConfirmModal(props) {
            return (wp.element.createElement(Modal, { title: props.title, onRequestClose: () => !props.busy && props.onCancel(), className: WooOptionsPro.Utils.classNames('wof-modal', 'wof-confirm-modal', props.destructive && 'is-destructive') },
                wp.element.createElement("div", { className: "wof-confirm-modal__header-custom" },
                    wp.element.createElement("h3", { className: "wof-confirm-modal__title-custom" }, props.title),
                    wp.element.createElement("button", { type: "button", className: "wof-confirm-modal__close-custom", onClick: props.onCancel, "aria-label": __('Close', 'wooptions-pro') }, "\u2715")),
                wp.element.createElement("div", { className: "wof-confirm-modal__body" },
                    props.destructive ? (wp.element.createElement("div", { className: "wof-confirm-modal__icon-badge" },
                        wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("polyline", { points: "3 6 5 6 21 6" }),
                            wp.element.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
                            wp.element.createElement("line", { x1: "10", y1: "11", x2: "10", y2: "17" }),
                            wp.element.createElement("line", { x1: "14", y1: "11", x2: "14", y2: "17" })))) : null,
                    wp.element.createElement("div", { className: "wof-confirm-modal__text" },
                        wp.element.createElement("p", { className: "wof-confirm-modal__message" }, props.message))),
                wp.element.createElement("div", { className: "wof-modal__actions wof-confirm-modal__actions" },
                    wp.element.createElement("button", { type: "button", className: "wof-btn-modal-cancel", disabled: props.busy, onClick: props.onCancel }, props.cancelLabel ?? __('Cancel', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", className: WooOptionsPro.Utils.classNames('wof-btn-modal-confirm', props.destructive && 'is-destructive'), disabled: props.busy, onClick: props.onConfirm }, props.busy ? (wp.element.createElement("span", { className: "wof-btn-busy-spinner" },
                        wp.element.createElement(Spinner, null),
                        wp.element.createElement("span", null, __('Deleting…', 'wooptions-pro')))) : (props.confirmLabel)))));
        }
        Components.ConfirmModal = ConfirmModal;
        function InlineNotice(props) {
            return (wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-inline-notice', props.type && `is-${props.type}`), role: props.type === 'error' ? 'alert' : 'status' },
                wp.element.createElement("span", { "aria-hidden": "true" }, props.type === 'error' ? '!' : props.type === 'warning' ? '•' : '✓'),
                wp.element.createElement("div", null, props.children),
                props.onClose ? wp.element.createElement("button", { type: "button", onClick: props.onClose, "aria-label": __('Dismiss', 'wooptions-pro') }, "\u00D7") : null));
        }
        Components.InlineNotice = InlineNotice;
        function ModalLoading(props) {
            return wp.element.createElement("div", { className: "wof-modal-loading" },
                wp.element.createElement(Spinner, null),
                wp.element.createElement("span", null, props.label ?? __('Loading…', 'wooptions-pro')));
        }
        Components.ModalLoading = ModalLoading;
        function WpWysiwygEditor(props) {
            const rawId = props.id.replace(/[^a-zA-Z0-9_]/g, '');
            const editorId = `wof_editor_${rawId}`;
            const [activeTab, setActiveTab] = wp.element.useState('visual');
            const [textValue, setTextValue] = wp.element.useState(props.value ?? '');
            const textTextareaRef = wp.element.useRef(null);
            const onChangeRef = wp.element.useRef(props.onChange);
            onChangeRef.current = props.onChange;
            const valueRef = wp.element.useRef(props.value);
            valueRef.current = props.value;
            wp.element.useEffect(() => {
                setTextValue(props.value ?? '');
            }, [props.id]);
            wp.element.useEffect(() => {
                let isMounted = true;
                let timer = null;
                const initEditor = () => {
                    if (!isMounted)
                        return true;
                    const tinymce = window.tinymce;
                    if (!tinymce || typeof tinymce.init !== 'function')
                        return false;
                    const target = document.getElementById(editorId);
                    if (!target)
                        return false;
                    try {
                        const prev = tinymce.get(editorId);
                        if (prev) {
                            prev.remove();
                        }
                    }
                    catch {
                        // ignore
                    }
                    const preInit = window.tinyMCEPreInit?.mceInit?.wof_admin_dummy_editor;
                    try {
                        tinymce.init({
                            ...(preInit || {}),
                            selector: '#' + editorId,
                            theme: 'modern',
                            skin: 'lightgray',
                            menubar: false,
                            branding: false,
                            statusbar: false,
                            elementpath: false,
                            height: 220,
                            plugins: preInit?.plugins || 'charmap colorpicker hr lists media paste tabfocus textcolor fullscreen wordpress wpautoresize wpeditimage wpemoji wpgallery wplink wpdialogs wptextpattern wpview',
                            toolbar1: preInit?.toolbar1 || 'formatselect,bold,italic,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_adv',
                            toolbar2: preInit?.toolbar2 || 'strikethrough,hr,forecolor,pastetext,removeformat,charmap,outdent,indent,undo,redo',
                            setup: (ed) => {
                                ed.on('init', () => {
                                    if (isMounted) {
                                        ed.setContent(valueRef.current ?? '');
                                    }
                                });
                                ed.on('change input keyup NodeChange SetContent', () => {
                                    if (isMounted) {
                                        const content = ed.getContent();
                                        setTextValue(content);
                                        onChangeRef.current(content);
                                    }
                                });
                            },
                        });
                        return true;
                    }
                    catch {
                        return false;
                    }
                };
                if (!initEditor()) {
                    let count = 0;
                    timer = setInterval(() => {
                        count++;
                        if (initEditor() || count > 40) {
                            clearInterval(timer);
                        }
                    }, 50);
                }
                return () => {
                    isMounted = false;
                    if (timer)
                        clearInterval(timer);
                    const tinymce = window.tinymce;
                    if (tinymce) {
                        try {
                            const ed = tinymce.get(editorId);
                            if (ed)
                                ed.remove();
                        }
                        catch {
                            // ignore
                        }
                    }
                };
            }, [editorId]);
            const handleSwitchTab = (tab) => {
                if (tab === activeTab)
                    return;
                const tinymce = window.tinymce;
                const editor = tinymce ? tinymce.get(editorId) : null;
                if (tab === 'text') {
                    let currentHtml = textValue;
                    if (editor) {
                        try {
                            currentHtml = editor.getContent();
                        }
                        catch {
                            // ignore
                        }
                    }
                    setTextValue(currentHtml);
                    setActiveTab('text');
                }
                else {
                    setActiveTab('visual');
                    if (editor) {
                        try {
                            editor.setContent(textValue);
                        }
                        catch {
                            // ignore
                        }
                    }
                }
            };
            const handleOpenMedia = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const wpMedia = window.wp?.media;
                if (!wpMedia)
                    return;
                const frame = wpMedia({
                    title: __('Add Media', 'wooptions-pro'),
                    button: { text: __('Insert into field', 'wooptions-pro') },
                    multiple: false,
                    library: { type: 'image' },
                });
                frame.on('select', () => {
                    const attachment = frame.state().get('selection').first().toJSON();
                    const imgUrl = attachment.url;
                    const imgAlt = attachment.alt || attachment.title || '';
                    const imgHtml = `<img src="${imgUrl}" alt="${imgAlt}" class="alignnone size-full" />`;
                    const tinymce = window.tinymce;
                    const editor = tinymce ? tinymce.get(editorId) : null;
                    if (activeTab === 'visual' && editor) {
                        try {
                            editor.insertContent(imgHtml);
                            const updated = editor.getContent();
                            setTextValue(updated);
                            onChangeRef.current(updated);
                        }
                        catch {
                            const updated = (textValue || '') + imgHtml;
                            setTextValue(updated);
                            onChangeRef.current(updated);
                        }
                    }
                    else {
                        const ta = textTextareaRef.current;
                        if (ta) {
                            const start = ta.selectionStart ?? 0;
                            const end = ta.selectionEnd ?? 0;
                            const val = ta.value;
                            const updated = val.substring(0, start) + imgHtml + val.substring(end);
                            setTextValue(updated);
                            onChangeRef.current(updated);
                        }
                        else {
                            const updated = (textValue || '') + imgHtml;
                            setTextValue(updated);
                            onChangeRef.current(updated);
                        }
                    }
                });
                frame.open();
            };
            const handleTextChange = (newVal) => {
                setTextValue(newVal);
                onChangeRef.current(newVal);
                const tinymce = window.tinymce;
                const editor = tinymce ? tinymce.get(editorId) : null;
                if (editor) {
                    try {
                        editor.setContent(newVal);
                    }
                    catch {
                        // ignore
                    }
                }
            };
            return (wp.element.createElement("div", { className: "wof-wp-editor-field" },
                props.label ? wp.element.createElement("label", { className: "wof-wp-editor-label" }, props.label) : null,
                wp.element.createElement("div", { className: "wof-wp-editor-mount" },
                    wp.element.createElement("div", { className: `wp-core-ui wp-editor-wrap ${activeTab === 'visual' ? 'tmce-active' : 'html-active'}` },
                        wp.element.createElement("div", { className: "wp-editor-tools hide-if-no-js" },
                            wp.element.createElement("div", { className: "wp-media-buttons" },
                                wp.element.createElement("button", { type: "button", className: "button insert-media add_media", onClick: handleOpenMedia },
                                    wp.element.createElement("span", { className: "wp-media-buttons-icon" }),
                                    __('Add Media', 'wooptions-pro'))),
                            wp.element.createElement("div", { className: "wp-editor-tabs" },
                                wp.element.createElement("button", { type: "button", className: `wp-switch-editor switch-tmce ${activeTab === 'visual' ? 'is-active' : ''}`, onClick: () => handleSwitchTab('visual') }, __('Visual', 'wooptions-pro')),
                                wp.element.createElement("button", { type: "button", className: `wp-switch-editor switch-html ${activeTab === 'text' ? 'is-active' : ''}`, onClick: () => handleSwitchTab('text') }, __('Text', 'wooptions-pro')))),
                        wp.element.createElement("div", { className: "wp-editor-container" },
                            wp.element.createElement("div", { style: { display: activeTab === 'visual' ? 'block' : 'none' } },
                                wp.element.createElement("textarea", { id: editorId, name: editorId, className: "wp-editor-area", rows: 8, style: { width: '100%', height: '220px' }, defaultValue: props.value ?? '' })),
                            wp.element.createElement("div", { style: { display: activeTab === 'text' ? 'block' : 'none' } },
                                wp.element.createElement("textarea", { ref: textTextareaRef, id: `${editorId}_html`, className: "wp-editor-area wof-editor-text-mode", rows: 9, style: {
                                        width: '100%',
                                        height: '220px',
                                        padding: '12px',
                                        fontFamily: 'Consolas, Monaco, monospace',
                                        fontSize: '13px',
                                        lineHeight: 1.6,
                                        border: 'none',
                                        boxSizing: 'border-box',
                                        outline: 'none',
                                    }, value: textValue, onChange: (e) => handleTextChange(e.target.value) })))))));
        }
        Components.WpWysiwygEditor = WpWysiwygEditor;
    })(Components = WooOptionsPro.Components || (WooOptionsPro.Components = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Toast;
    (function (Toast) {
        let items = [];
        const listeners = new Set();
        function notify() {
            listeners.forEach((fn) => fn([...items]));
        }
        function subscribe(listener) {
            listeners.add(listener);
            listener([...items]);
            return () => {
                listeners.delete(listener);
            };
        }
        Toast.subscribe = subscribe;
        function dismiss(id) {
            const existing = items.find((t) => t.id === id);
            if (!existing || existing.isHiding)
                return;
            items = items.map((t) => (t.id === id ? { ...t, isHiding: true } : t));
            notify();
            setTimeout(() => {
                items = items.filter((t) => t.id !== id);
                notify();
            }, 220);
        }
        Toast.dismiss = dismiss;
        function show(options) {
            const id = 'toast_' + Math.random().toString(36).slice(2, 9);
            const item = {
                id,
                type: options.type ?? 'info',
                title: options.title,
                message: options.message,
                duration: options.duration ?? 4000,
            };
            if (items.length >= 3) {
                items = items.slice(items.length - 2);
            }
            items = [...items, item];
            notify();
            return id;
        }
        Toast.show = show;
        function success(message, title, duration) {
            return show({ type: 'success', message, title, duration });
        }
        Toast.success = success;
        function error(message, title, duration) {
            return show({ type: 'error', message, title: title ?? 'Error', duration: duration ?? 5000 });
        }
        Toast.error = error;
        function warning(message, title, duration) {
            return show({ type: 'warning', message, title: title ?? 'Attention', duration });
        }
        Toast.warning = warning;
        function info(message, title, duration) {
            return show({ type: 'info', message, title, duration });
        }
        Toast.info = info;
    })(Toast = WooOptionsPro.Toast || (WooOptionsPro.Toast = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
(function (WooOptionsPro) {
    var Components;
    (function (Components) {
        const { useEffect, useRef, useState } = wp.element;
        function ToastContainer() {
            const [toasts, setToasts] = useState([]);
            useEffect(() => {
                return WooOptionsPro.Toast.subscribe(setToasts);
            }, []);
            if (!toasts.length)
                return null;
            return (wp.element.createElement("div", { className: "wof-toast-container", role: "region", "aria-label": "Notifications" }, toasts.map((toast) => (wp.element.createElement(ToastCard, { key: toast.id, toast: toast, onDismiss: () => WooOptionsPro.Toast.dismiss(toast.id) })))));
        }
        Components.ToastContainer = ToastContainer;
        function ToastCard(props) {
            const { toast, onDismiss } = props;
            const duration = toast.duration ?? 4000;
            const remainingRef = useRef(duration);
            const startTimeRef = useRef(Date.now());
            const timerRef = useRef(null);
            const startTimer = () => {
                if (remainingRef.current > 0 && !toast.isHiding) {
                    startTimeRef.current = Date.now();
                    timerRef.current = window.setTimeout(onDismiss, remainingRef.current);
                }
            };
            const pauseTimer = () => {
                if (timerRef.current) {
                    window.clearTimeout(timerRef.current);
                    timerRef.current = null;
                    remainingRef.current -= (Date.now() - startTimeRef.current);
                    if (remainingRef.current < 500)
                        remainingRef.current = 500;
                }
            };
            useEffect(() => {
                startTimer();
                return () => {
                    if (timerRef.current)
                        window.clearTimeout(timerRef.current);
                };
            }, [toast.id, toast.isHiding]);
            return (wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-toast', `wof-toast--${toast.type}`, toast.isHiding && 'is-hiding'), role: toast.type === 'error' ? 'alert' : 'status', "aria-live": "polite", onMouseEnter: pauseTimer, onMouseLeave: startTimer },
                wp.element.createElement("span", { className: "wof-toast__icon", "aria-hidden": "true" }, toast.type === 'success' ? (wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    wp.element.createElement("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
                    wp.element.createElement("polyline", { points: "22 4 12 14.01 9 11.01" }))) : toast.type === 'error' ? (wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                    wp.element.createElement("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
                    wp.element.createElement("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" }))) : toast.type === 'warning' ? (wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    wp.element.createElement("path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" }),
                    wp.element.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
                    wp.element.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }))) : (wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                    wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                    wp.element.createElement("line", { x1: "12", y1: "16", x2: "12", y2: "12" }),
                    wp.element.createElement("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })))),
                wp.element.createElement("div", { className: "wof-toast__content" },
                    toast.title ? wp.element.createElement("div", { className: "wof-toast__title" }, toast.title) : null,
                    wp.element.createElement("div", { className: "wof-toast__message" }, toast.message)),
                wp.element.createElement("button", { type: "button", className: "wof-toast__close", "aria-label": "Close notification", onClick: onDismiss },
                    wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                        wp.element.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                        wp.element.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" }))),
                wp.element.createElement("div", { className: "wof-toast__progress", "aria-hidden": "true" },
                    wp.element.createElement("div", { className: "wof-toast__progress-bar", style: { animationDuration: `${duration}ms` } }))));
        }
    })(Components = WooOptionsPro.Components || (WooOptionsPro.Components = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Components;
    (function (Components) {
        const { __ } = wp.i18n;
        function LicenseOverlayModal(props) {
            const adminData = window.WooOptionsProAdmin || {};
            const licenseInfo = adminData.license;
            const state = (licenseInfo?.state || 'unlicensed').toLowerCase();
            const stateLabels = {
                unlicensed: __('LICENSE INACTIVE', 'wooptions-pro'),
                expired: __('LICENSE EXPIRED', 'wooptions-pro'),
                connection_error: __('LICENSE CHECK FAILED', 'wooptions-pro'),
                invalid: __('LICENSE INVALID', 'wooptions-pro'),
                deactivated: __('LICENSE DEACTIVATED', 'wooptions-pro'),
            };
            const stateLabel = stateLabels[state] || state.toUpperCase().replace(/_/g, ' ');
            const title = props.featureTitle || __('WooOptions Pro', 'wooptions-pro');
            const message = licenseInfo?.message ||
                __('The WooOptions Pro license is deactivated. Activate a license to continue.', 'wooptions-pro');
            const assetsUrl = adminData.assetsUrl || (adminData.pluginUrl ? adminData.pluginUrl + 'assets/' : '');
            const shieldUrl = assetsUrl ? `${assetsUrl}images/pro-badge-sheild.svg` : '';
            const supportUrl = 'https://themefic.com/support';
            const features = [
                {
                    icon: (wp.element.createElement("svg", { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" },
                        wp.element.createElement("circle", { cx: "12", cy: "8", r: "4" }),
                        wp.element.createElement("path", { d: "M5 20v-1.5A6.5 6.5 0 0 1 11.5 12h1A6.5 6.5 0 0 1 19 18.5V20" }))),
                    title: __('Option Fields', 'wooptions-pro'),
                },
                {
                    icon: (wp.element.createElement("svg", { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" },
                        wp.element.createElement("circle", { cx: "12", cy: "12", r: "9" }),
                        wp.element.createElement("path", { d: "M3.5 12h17M12 3c2.4 2.5 3.5 5.5 3.5 9S14.4 18.5 12 21c-2.4-2.5-3.5-5.5-3.5-9S9.6 5.5 12 3Z" }))),
                    title: __('Pricing Formulas', 'wooptions-pro'),
                },
                {
                    icon: (wp.element.createElement("svg", { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" },
                        wp.element.createElement("path", { d: "M4 5.5V12l7.5 7.5a2 2 0 0 0 2.8 0l5.2-5.2a2 2 0 0 0 0-2.8L12 4H5.5A1.5 1.5 0 0 0 4 5.5Z" }),
                        wp.element.createElement("circle", { cx: "8.2", cy: "8.2", r: "1.2" }))),
                    title: __('Conditional Rules', 'wooptions-pro'),
                },
                {
                    icon: (wp.element.createElement("svg", { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" },
                        wp.element.createElement("path", { d: "m8 4 3 5H5l3-5Zm8 0 3 5h-6l3-5ZM5 14h6v6H5v-6Zm11 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" }))),
                    title: __('Product Assignment', 'wooptions-pro'),
                },
            ];
            return (wp.element.createElement("div", { className: "ws-license-overlay wof-license-overlay", role: "region", "aria-label": __('WooOptions Pro license required', 'wooptions-pro') },
                wp.element.createElement("div", { className: "ws-license-overlay__card" },
                    wp.element.createElement("div", { className: "ws-license-overlay__body" },
                        wp.element.createElement("div", { className: "ws-license-overlay__icon", "aria-hidden": "true" }, shieldUrl ? (wp.element.createElement("img", { src: shieldUrl, alt: "badge", width: "132", height: "100" })) : (wp.element.createElement("svg", { width: "48", height: "48", viewBox: "0 0 48 48", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                            wp.element.createElement("rect", { width: "48", height: "48", rx: "24", fill: "#EEF2FF" }),
                            wp.element.createElement("path", { d: "M24 12L34 16.5V23C34 29.5 29.7 35.5 24 37C18.3 35.5 14 29.5 14 23V16.5L24 12Z", fill: "#5271FF" }),
                            wp.element.createElement("path", { d: "M20 24L23 27L28 21", stroke: "white", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" })))),
                        wp.element.createElement("div", { className: "ws-license-overlay__topline" },
                            wp.element.createElement("span", { className: "ws-license-overlay__badge", "aria-hidden": "true" },
                                wp.element.createElement("svg", { viewBox: "0 0 20 20", xmlns: "http://www.w3.org/2000/svg" },
                                    wp.element.createElement("path", { d: "m10 1.8 2 2.1 2.9-.1.7 2.8 2.5 1.6-1.3 2.7.9 2.8-2.6 1.4-.6 2.9-2.9-.3L10 20l-2-2.1-2.9.1-.7-2.8-2.5-1.6 1.3-2.7-.9-2.8 2.6-1.4.6-2.9 2.9.3L10 1.8Z", fill: "currentColor" }),
                                    wp.element.createElement("path", { d: "m8 10 1.3 1.3 2.8-3", fill: "none", stroke: "#fff", strokeWidth: "1.6", strokeLinecap: "round", strokeLinejoin: "round" }))),
                            wp.element.createElement("span", null, __('PRO', 'wooptions-pro')),
                            wp.element.createElement("span", { className: "ws-license-overlay__dot", "aria-hidden": "true" }, "\u00B7"),
                            wp.element.createElement("span", { className: "ws-license-overlay__state" }, stateLabel)),
                        wp.element.createElement("h2", null,
                            __('Activate your license to unlock', 'wooptions-pro'),
                            " ",
                            title),
                        wp.element.createElement("p", { className: "ws-license-overlay__message" }, message),
                        wp.element.createElement("div", { className: "ws-license-overlay__features", "aria-label": __('Premium feature highlights', 'wooptions-pro') }, features.map((item, idx) => (wp.element.createElement("div", { key: idx, className: "ws-license-overlay__feature" },
                            wp.element.createElement("span", { className: "ws-license-overlay__feature-icon", "aria-hidden": "true" }, item.icon),
                            wp.element.createElement("span", null, item.title))))),
                        wp.element.createElement("div", { className: "ws-license-overlay__actions" },
                            wp.element.createElement("button", { type: "button", className: "wholesalefic-btn wholesalefic-btn--primary", onClick: props.onActivate }, __('Activate License', 'wooptions-pro')),
                            wp.element.createElement("button", { type: "button", className: "wholesalefic-btn wholesalefic-btn--secondary", onClick: props.onDismiss }, __('Dismiss & View Preview', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: "ws-license-overlay__footer" },
                        wp.element.createElement("a", { className: "ws-license-overlay__help", href: supportUrl, target: "_blank", rel: "noopener noreferrer" },
                            wp.element.createElement("svg", { viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true" },
                                wp.element.createElement("circle", { cx: "12", cy: "12", r: "9" }),
                                wp.element.createElement("path", { d: "M12 10v6M12 7h.01" })),
                            wp.element.createElement("span", null, __('Need help? Contact support', 'wooptions-pro'))),
                        wp.element.createElement("button", { type: "button", className: "ws-license-overlay__dismiss", onClick: props.onDismiss }, __('Dismiss', 'wooptions-pro'))))));
        }
        Components.LicenseOverlayModal = LicenseOverlayModal;
    })(Components = WooOptionsPro.Components || (WooOptionsPro.Components = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Components;
    (function (Components) {
        const { __ } = wp.i18n;
        const { useState } = wp.element;
        function AdminShell(props) {
            const isBuilder = props.route.startsWith('builder/');
            const [mobileOpen, setMobileOpen] = useState(false);
            const [overlayDismissed, setOverlayDismissed] = useState(false);
            if (isBuilder) {
                return (wp.element.createElement("div", { className: "wof-admin is-builder" },
                    wp.element.createElement("main", { className: "wof-admin__content" }, props.children),
                    wp.element.createElement(Components.ToastContainer, null)));
            }
            const licenseInfo = window.WooOptionsProAdmin?.license;
            const isLicenseActive = licenseInfo?.active === true || licenseInfo?.canConfigure === true;
            const canConfigure = licenseInfo?.canConfigure !== false && isLicenseActive;
            const navItems = [
                { id: 'dashboard', label: __('Dashboard', 'wooptions-pro') },
                { id: 'option-sets', label: __('Option Sets', 'wooptions-pro') },
                { id: 'templates', label: __('Templates', 'wooptions-pro') },
                { id: 'analytics', label: __('Analytics', 'wooptions-pro') },
                { id: 'settings', label: __('Settings', 'wooptions-pro') },
                { id: 'license', label: __('License', 'wooptions-pro') },
            ];
            const featureTitles = {
                dashboard: __('Dashboard', 'wooptions-pro'),
                'option-sets': __('Option Sets', 'wooptions-pro'),
                templates: __('Templates', 'wooptions-pro'),
                analytics: __('Analytics', 'wooptions-pro'),
                settings: __('Settings', 'wooptions-pro'),
            };
            const isLicensePage = props.route === 'license';
            const showOverlay = !canConfigure && !isLicensePage && !overlayDismissed;
            return (wp.element.createElement("div", { className: "wof-admin" },
                wp.element.createElement("header", { className: "wof-admin__masthead" },
                    wp.element.createElement("button", { type: "button", className: "wof-brand", onClick: () => props.navigate('dashboard'), title: __('Go to Dashboard', 'wooptions-pro') },
                        wp.element.createElement("span", { className: "wof-brand-mark" },
                            wp.element.createElement(Components.Dashicon, { name: "screenoptions" })),
                        wp.element.createElement("span", { className: "wof-brand-name" }, "WooOptions Pro")),
                    wp.element.createElement("nav", { className: "wof-masthead__nav", "aria-label": __('Primary navigation', 'wooptions-pro') }, navItems.map((item) => {
                        const isActive = props.route === item.id;
                        return (wp.element.createElement("button", { type: "button", key: item.id, className: `wof-masthead__nav-item ${isActive ? 'is-active' : ''}`, onClick: () => props.navigate(item.id) }, item.label));
                    })),
                    wp.element.createElement("div", { className: "wof-masthead__right" },
                        wp.element.createElement("div", { className: "wof-masthead__support" },
                            wp.element.createElement("span", { className: "wof-masthead__support-text" }, __('Having troubles?', 'wooptions-pro')),
                            ' ',
                            wp.element.createElement("a", { href: "https://themefic.com/support", target: "_blank", rel: "noopener noreferrer", className: "wof-masthead__tutorial-link" }, __('Support', 'wooptions-pro'))),
                        wp.element.createElement("button", { type: "button", className: "wof-masthead__hamburger", onClick: () => setMobileOpen(!mobileOpen), "aria-label": __('Toggle mobile navigation', 'wooptions-pro'), "aria-expanded": mobileOpen },
                            wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                wp.element.createElement("line", { x1: "3", y1: "12", x2: "21", y2: "12" }),
                                wp.element.createElement("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
                                wp.element.createElement("line", { x1: "3", y1: "18", x2: "21", y2: "18" }))))),
                mobileOpen && (wp.element.createElement(wp.element.Fragment, null,
                    wp.element.createElement("div", { className: "wof-mobile-nav-backdrop", onClick: () => setMobileOpen(false), "aria-hidden": "true" }),
                    wp.element.createElement("aside", { className: "wof-mobile-nav-drawer", role: "dialog", "aria-label": __('Mobile navigation', 'wooptions-pro') },
                        wp.element.createElement("div", { className: "wof-mobile-nav__header" },
                            wp.element.createElement("div", { className: "wof-brand" },
                                wp.element.createElement("span", { className: "wof-brand-mark" },
                                    wp.element.createElement(Components.Dashicon, { name: "screenoptions" })),
                                wp.element.createElement("span", { className: "wof-brand-name" }, "WooOptions Pro")),
                            wp.element.createElement("button", { type: "button", className: "wof-mobile-nav__close", onClick: () => setMobileOpen(false), "aria-label": __('Close menu', 'wooptions-pro') },
                                wp.element.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                    wp.element.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                                    wp.element.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" })))),
                        wp.element.createElement("div", { className: "wof-mobile-nav__body" }, navItems.map((item) => {
                            const isActive = props.route === item.id;
                            return (wp.element.createElement("button", { type: "button", key: item.id, className: `wof-mobile-nav__item ${isActive ? 'is-active' : ''}`, onClick: () => {
                                    props.navigate(item.id);
                                    setMobileOpen(false);
                                } },
                                wp.element.createElement("span", null, item.label),
                                isActive && wp.element.createElement("span", { className: "wof-mobile-nav__active-dot", "aria-hidden": "true" }, "\u25CF")));
                        })),
                        wp.element.createElement("div", { className: "wof-mobile-nav__footer" },
                            wp.element.createElement("div", { className: "wof-masthead__support" },
                                wp.element.createElement("span", null, __('Having troubles?', 'wooptions-pro')),
                                ' ',
                                wp.element.createElement("a", { href: "https://themefic.com/support", target: "_blank", rel: "noopener noreferrer", className: "wof-masthead__tutorial-link" }, __('Support', 'wooptions-pro'))))))),
                !canConfigure && !isLicensePage && overlayDismissed && (wp.element.createElement("div", { className: "wof-license-banner" },
                    wp.element.createElement("div", { className: "wof-license-banner__content" },
                        wp.element.createElement("span", { className: "wof-license-banner__icon", "aria-hidden": "true" },
                            wp.element.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                wp.element.createElement("path", { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" }),
                                wp.element.createElement("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
                                wp.element.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }))),
                        wp.element.createElement("span", null, licenseInfo?.message ||
                            __('Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro'))),
                    wp.element.createElement("button", { type: "button", className: "wof-license-banner__button", onClick: () => props.navigate('license') }, licenseInfo?.state === 'expired' ? __('Renew License', 'wooptions-pro') : __('Activate License', 'wooptions-pro')))),
                wp.element.createElement("div", { className: `wof-admin__body ${showOverlay ? 'wof-admin__body--locked' : ''}` },
                    wp.element.createElement("main", { className: "wof-admin__content", inert: showOverlay ? true : undefined, "aria-hidden": showOverlay ? true : undefined }, props.children),
                    showOverlay && (wp.element.createElement(Components.LicenseOverlayModal, { featureTitle: featureTitles[props.route] || __('Option Sets', 'wooptions-pro'), onActivate: () => props.navigate('license'), onDismiss: () => setOverlayDismissed(true) }))),
                wp.element.createElement(Components.ToastContainer, null)));
        }
        Components.AdminShell = AdminShell;
    })(Components = WooOptionsPro.Components || (WooOptionsPro.Components = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Pages;
    (function (Pages) {
        const { Button } = wp.components;
        const { __, sprintf } = wp.i18n;
        const { useEffect, useState } = wp.element;
        function Dashboard(props) {
            const [items, setItems] = useState([]);
            const [templates, setTemplates] = useState([]);
            const [loading, setLoading] = useState(true);
            useEffect(() => {
                Promise.all([
                    WooOptionsPro.Api.listOptionSets({ perPage: 5 }),
                    WooOptionsPro.Api.listTemplates().catch(() => ({ items: [] }))
                ])
                    .then(([optionSetsRes, templatesRes]) => {
                    setItems(optionSetsRes.items || []);
                    setTemplates((templatesRes.items || []).slice(0, 3));
                })
                    .finally(() => setLoading(false));
            }, []);
            const published = items.filter((item) => item.publishedRevisionId).length;
            const adminConfig = window.WooOptionsProAdmin || {};
            const userName = adminConfig.currentUser?.name?.split(' ')[0] ?? adminConfig.currentUser?.name ?? 'Admin';
            const previewImage = (adminConfig.assetsUrl || '') + 'images/builder-preview.webp';
            return (wp.element.createElement("div", { className: "wof-page" },
                wp.element.createElement(WooOptionsPro.Components.PageHeader, { title: sprintf(__('Good to see you, %s.', 'wooptions-pro'), userName), description: __('Build thoughtful product choices, price them safely, and publish without touching theme code.', 'wooptions-pro'), actions: wp.element.createElement(Button, { variant: "primary", onClick: () => props.navigate('option-sets') }, __('Create an option set', 'wooptions-pro')) }),
                wp.element.createElement("section", { className: "wof-hero-card" },
                    wp.element.createElement("div", { className: "wof-hero-card__copy" },
                        wp.element.createElement("h2", null, __('A polished configurator in three moves', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-steps" },
                            wp.element.createElement("div", null,
                                wp.element.createElement("b", null, "1"),
                                wp.element.createElement("span", null,
                                    wp.element.createElement("strong", null, __('Shape', 'wooptions-pro')),
                                    wp.element.createElement("small", null, __('Add fields, swatches, formulas & choices', 'wooptions-pro')))),
                            wp.element.createElement("div", null,
                                wp.element.createElement("b", null, "2"),
                                wp.element.createElement("span", null,
                                    wp.element.createElement("strong", null, __('Assign', 'wooptions-pro')),
                                    wp.element.createElement("small", null, __('Target matching products or categories', 'wooptions-pro')))),
                            wp.element.createElement("div", null,
                                wp.element.createElement("b", null, "3"),
                                wp.element.createElement("span", null,
                                    wp.element.createElement("strong", null, __('Publish', 'wooptions-pro')),
                                    wp.element.createElement("small", null, __('Run server checks and go live seamlessly', 'wooptions-pro'))))),
                        wp.element.createElement("div", { className: "wof-inline-actions" },
                            wp.element.createElement(Button, { variant: "primary", onClick: () => props.navigate('option-sets') }, __('Create an option set', 'wooptions-pro')),
                            wp.element.createElement(Button, { variant: "secondary", onClick: () => props.navigate('templates') }, __('Explore templates', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: "wof-hero-preview" },
                        wp.element.createElement("div", { className: "wof-preview-window", onClick: () => props.navigate('templates'), title: __('Click to explore Visual Builder & Templates', 'wooptions-pro'), role: "button", tabIndex: 0, onKeyDown: (e) => {
                                if (e.key === 'Enter')
                                    props.navigate('templates');
                            } },
                            wp.element.createElement("div", { className: "wof-preview-window__bar" },
                                wp.element.createElement("div", { className: "wof-preview-window__controls", "aria-hidden": "true" },
                                    wp.element.createElement("i", { className: "is-close" }),
                                    wp.element.createElement("i", { className: "is-minimize" }),
                                    wp.element.createElement("i", { className: "is-maximize" })),
                                wp.element.createElement("div", { className: "wof-preview-window__title" },
                                    wp.element.createElement("span", null, __('WooOptions Pro Live Builder', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wof-preview-window__badge" },
                                    wp.element.createElement("span", { className: "wof-pulse-dot" }),
                                    wp.element.createElement("span", null, __('Live Canvas', 'wooptions-pro')))),
                            wp.element.createElement("div", { className: "wof-preview-window__screen" },
                                wp.element.createElement("img", { src: previewImage, alt: __('WooOptions Pro Live Builder Interface', 'wooptions-pro'), className: "wof-preview-window__img", loading: "eager" }),
                                wp.element.createElement("div", { className: "wof-preview-window__overlay" },
                                    wp.element.createElement("span", { className: "wof-preview-window__cta" },
                                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                            wp.element.createElement("polygon", { points: "5 3 19 12 5 21 5 3" })),
                                        __('Open Visual Builder', 'wooptions-pro'))))))),
                wp.element.createElement("div", { className: "wof-stat-grid" },
                    wp.element.createElement("div", { className: "wof-stat" },
                        wp.element.createElement("span", null, __('Active sets', 'wooptions-pro')),
                        wp.element.createElement("strong", null, items.length),
                        wp.element.createElement("small", null, __('Option sets available in your store', 'wooptions-pro'))),
                    wp.element.createElement("div", { className: "wof-stat" },
                        wp.element.createElement("span", null, __('Published', 'wooptions-pro')),
                        wp.element.createElement("strong", null, published),
                        wp.element.createElement("small", null, __('Immutable live revisions in checkout', 'wooptions-pro'))),
                    wp.element.createElement("div", { className: "wof-stat" },
                        wp.element.createElement("span", null, __('Built-in templates', 'wooptions-pro')),
                        wp.element.createElement("strong", null, "10"),
                        wp.element.createElement("small", null, __('Ready to customize and launch', 'wooptions-pro'))),
                    wp.element.createElement("div", { className: "wof-stat is-accent" },
                        wp.element.createElement("span", null, __('Commerce truth', 'wooptions-pro')),
                        wp.element.createElement("strong", null, "100%"),
                        wp.element.createElement("small", null, __('Calculated on the server for safety', 'wooptions-pro')))),
                wp.element.createElement("div", { className: "wof-dashboard-grid" },
                    wp.element.createElement("div", { className: "wof-dashboard-main" },
                        wp.element.createElement("section", { className: "wof-panel" },
                            wp.element.createElement("div", { className: "wof-panel__header" },
                                wp.element.createElement("div", null,
                                    wp.element.createElement("h2", null, __('Recently edited', 'wooptions-pro')),
                                    wp.element.createElement("p", null, __('Pick up exactly where you left off in your option sets.', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wof-inline-actions" },
                                    wp.element.createElement(Button, { variant: "secondary", onClick: () => props.navigate('option-sets') }, __('Create new', 'wooptions-pro')),
                                    wp.element.createElement(Button, { variant: "tertiary", onClick: () => props.navigate('option-sets') }, __('View all', 'wooptions-pro')))),
                            loading ? (wp.element.createElement(WooOptionsPro.Components.Loading, { label: __('Loading your workshop…', 'wooptions-pro') })) : items.length ? (wp.element.createElement("div", { className: "wof-recent-list" }, items.map((item) => (wp.element.createElement("button", { type: "button", key: item.uuid, onClick: () => props.navigate(`builder/${item.uuid}`) },
                                wp.element.createElement("span", { className: "wof-set-glyph" },
                                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "screenoptions" })),
                                wp.element.createElement("span", null,
                                    wp.element.createElement("strong", null, item.title),
                                    wp.element.createElement("small", null, WooOptionsPro.Utils.formatDate(item.updatedAtGmt))),
                                wp.element.createElement(WooOptionsPro.Components.StatusPill, { status: item.publishedRevisionId ? __('Published', 'wooptions-pro') : __('Draft', 'wooptions-pro') }),
                                wp.element.createElement("b", { "aria-hidden": "true" }, "\u2192")))))) : (wp.element.createElement("div", { className: "wof-panel__empty" },
                                wp.element.createElement("p", null, __('Your workshop is clear. Import a template or create a blank option set.', 'wooptions-pro')),
                                wp.element.createElement(Button, { variant: "primary", onClick: () => props.navigate('option-sets') }, __('Create your first option set', 'wooptions-pro'))))),
                        templates.length > 0 ? (wp.element.createElement("section", { className: "wof-panel wof-dashboard-templates-panel" },
                            wp.element.createElement("div", { className: "wof-panel__header" },
                                wp.element.createElement("div", null,
                                    wp.element.createElement("h2", null, __('Quick Start Templates', 'wooptions-pro')),
                                    wp.element.createElement("p", null, __('Production-tested option sets ready to import in one click.', 'wooptions-pro'))),
                                wp.element.createElement(Button, { variant: "tertiary", onClick: () => props.navigate('templates') }, __('Explore all 10 templates →', 'wooptions-pro'))),
                            wp.element.createElement("div", { className: "wof-template-quick-grid" }, templates.map((tpl) => (wp.element.createElement("div", { key: tpl.slug, className: "wof-template-quick-card", onClick: () => props.navigate('templates'), role: "button", tabIndex: 0, onKeyDown: (e) => {
                                    if (e.key === 'Enter')
                                        props.navigate('templates');
                                } },
                                tpl.previewImage ? (wp.element.createElement("div", { className: "wof-template-quick-card__thumb" },
                                    wp.element.createElement("img", { src: tpl.previewImage, alt: tpl.name, loading: "lazy" }),
                                    wp.element.createElement("span", { className: "wof-template-quick-card__tag" }, tpl.categoryLabel || tpl.category))) : null,
                                wp.element.createElement("div", { className: "wof-template-quick-card__body" },
                                    wp.element.createElement("h4", null, tpl.name),
                                    wp.element.createElement("div", { className: "wof-template-quick-card__meta" },
                                        wp.element.createElement("span", null, tpl.fieldsCount ? sprintf(__('%d fields', 'wooptions-pro'), tpl.fieldsCount) : __('Configured', 'wooptions-pro')),
                                        wp.element.createElement("span", { className: "wof-template-quick-card__cta" }, __('Use Template →', 'wooptions-pro')))))))))) : null),
                    wp.element.createElement("aside", { className: "wof-dashboard-sidebar" },
                        wp.element.createElement("div", { className: "wof-sidebar-card wof-sidebar-resources" },
                            wp.element.createElement("div", { className: "wof-sidebar-card__header" },
                                wp.element.createElement("span", { className: "wof-sidebar-card__eyebrow" }, __('Support & Guides', 'wooptions-pro')),
                                wp.element.createElement("h3", null, __('Resources', 'wooptions-pro')),
                                wp.element.createElement("p", null, __('Everything you need to master your storefront product options.', 'wooptions-pro'))),
                            wp.element.createElement("div", { className: "wof-resource-links" },
                                wp.element.createElement("a", { href: "https://themefic.com/docs/wooptions-pro/tutorials/", target: "_blank", rel: "noopener noreferrer", className: "wof-resource-link is-tutorial" },
                                    wp.element.createElement("span", { className: "wof-resource-link__icon" },
                                        wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                            wp.element.createElement("polygon", { points: "5 3 19 12 5 21 5 3" }))),
                                    wp.element.createElement("span", { className: "wof-resource-link__content" },
                                        wp.element.createElement("strong", null, __('Tutorial For Beginner', 'wooptions-pro')),
                                        wp.element.createElement("small", null, __('Step-by-step walkthrough to build your first configurator', 'wooptions-pro'))),
                                    wp.element.createElement("span", { className: "wof-resource-link__arrow", "aria-hidden": "true" }, "\u2192")),
                                wp.element.createElement("a", { href: "https://themefic.com/docs/wooptions-pro/", target: "_blank", rel: "noopener noreferrer", className: "wof-resource-link is-docs" },
                                    wp.element.createElement("span", { className: "wof-resource-link__icon" },
                                        wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                            wp.element.createElement("path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
                                            wp.element.createElement("path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" }))),
                                    wp.element.createElement("span", { className: "wof-resource-link__content" },
                                        wp.element.createElement("strong", null, __('Documentation link', 'wooptions-pro')),
                                        wp.element.createElement("small", null, __('Field types, formulas, logic rules & developer hooks', 'wooptions-pro'))),
                                    wp.element.createElement("span", { className: "wof-resource-link__arrow", "aria-hidden": "true" }, "\u2192")),
                                wp.element.createElement("a", { href: "https://themefic.com/support/", target: "_blank", rel: "noopener noreferrer", className: "wof-resource-link is-help" },
                                    wp.element.createElement("span", { className: "wof-resource-link__icon" },
                                        wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                            wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                                            wp.element.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
                                            wp.element.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }))),
                                    wp.element.createElement("span", { className: "wof-resource-link__content" },
                                        wp.element.createElement("strong", null, __('Get help', 'wooptions-pro')),
                                        wp.element.createElement("small", null, __('Knowledge base, FAQs & community troubleshooting', 'wooptions-pro'))),
                                    wp.element.createElement("span", { className: "wof-resource-link__arrow", "aria-hidden": "true" }, "\u2192")),
                                wp.element.createElement("a", { href: "https://themefic.com/contact/", target: "_blank", rel: "noopener noreferrer", className: "wof-resource-link is-support" },
                                    wp.element.createElement("span", { className: "wof-resource-link__icon" },
                                        wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                            wp.element.createElement("path", { d: "M3 18v-6a9 9 0 0 1 18 0v6" }),
                                            wp.element.createElement("path", { d: "M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" }))),
                                    wp.element.createElement("span", { className: "wof-resource-link__content" },
                                        wp.element.createElement("strong", null, __('Customer support', 'wooptions-pro')),
                                        wp.element.createElement("small", null, __('Direct priority assistance from our core development team', 'wooptions-pro'))),
                                    wp.element.createElement("span", { className: "wof-resource-link__arrow", "aria-hidden": "true" }, "\u2192")),
                                wp.element.createElement("a", { href: "https://themefic.com/wooptions-pro/demo/", target: "_blank", rel: "noopener noreferrer", className: "wof-resource-link is-demo" },
                                    wp.element.createElement("span", { className: "wof-resource-link__icon" },
                                        wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                            wp.element.createElement("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2", ry: "2" }),
                                            wp.element.createElement("line", { x1: "8", y1: "21", x2: "16", y2: "21" }),
                                            wp.element.createElement("line", { x1: "12", y1: "17", x2: "12", y2: "21" }))),
                                    wp.element.createElement("span", { className: "wof-resource-link__content" },
                                        wp.element.createElement("strong", null, __('Live Demo link', 'wooptions-pro')),
                                        wp.element.createElement("small", null, __('Experience interactive storefront configurators live', 'wooptions-pro'))),
                                    wp.element.createElement("span", { className: "wof-resource-link__arrow", "aria-hidden": "true" }, "\u2192")))),
                        wp.element.createElement("div", { className: "wof-sidebar-card is-callout" },
                            wp.element.createElement("div", { className: "wof-callout-icon", "aria-hidden": "true" },
                                wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                    wp.element.createElement("path", { d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" }))),
                            wp.element.createElement("h4", null, __('Need custom work or new features?', 'wooptions-pro')),
                            wp.element.createElement("p", null, __('We are actively adding new field types and integrations. Share your ideas with our engineering team.', 'wooptions-pro')),
                            wp.element.createElement("a", { href: "https://themefic.com/contact/", target: "_blank", rel: "noopener noreferrer", className: "components-button is-secondary is-small" }, __('Contact Engineering →', 'wooptions-pro')))))));
        }
        Pages.Dashboard = Dashboard;
    })(Pages = WooOptionsPro.Pages || (WooOptionsPro.Pages = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Pages;
    (function (Pages) {
        const { Button, SearchControl, SelectControl } = wp.components;
        const { __ } = wp.i18n;
        const { useCallback, useEffect, useMemo, useRef, useState } = wp.element;
        function CreateOptionSetModal(props) {
            const [title, setTitle] = useState('');
            const inputRef = useRef(null);
            useEffect(() => {
                if (props.isOpen) {
                    setTitle('');
                    const timer = setTimeout(() => {
                        if (inputRef.current)
                            inputRef.current.focus();
                    }, 50);
                    return () => clearTimeout(timer);
                }
            }, [props.isOpen]);
            useEffect(() => {
                const handleKeyDown = (e) => {
                    if (!props.isOpen)
                        return;
                    if (e.key === 'Escape' && !props.busy) {
                        e.preventDefault();
                        props.onClose();
                    }
                };
                window.addEventListener('keydown', handleKeyDown);
                return () => window.removeEventListener('keydown', handleKeyDown);
            }, [props.isOpen, props.busy, props.onClose]);
            if (!props.isOpen)
                return null;
            const handleSubmit = (e) => {
                e.preventDefault();
                if (!title.trim() || props.busy)
                    return;
                props.onCreate(title.trim());
            };
            return (wp.element.createElement("div", { className: "wof-create-modal-backdrop", onClick: (e) => {
                    if (e.target === e.currentTarget && !props.busy) {
                        props.onClose();
                    }
                }, role: "dialog", "aria-modal": "true", "aria-labelledby": "wof-create-modal-title" },
                wp.element.createElement("div", { className: "wof-create-modal-card" },
                    wp.element.createElement("div", { className: "wof-create-modal-header" },
                        wp.element.createElement("div", { className: "wof-create-modal-header__text" },
                            wp.element.createElement("h3", { id: "wof-create-modal-title", className: "wof-create-modal-title" }, __('Create an option set', 'wooptions-pro')),
                            wp.element.createElement("p", { className: "wof-create-modal-subtitle" }, __('Enter a name for your option set to begin designing fields.', 'wooptions-pro'))),
                        wp.element.createElement("button", { type: "button", className: "wof-create-modal-close", onClick: props.onClose, disabled: props.busy, "aria-label": __('Close modal', 'wooptions-pro') },
                            wp.element.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                wp.element.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                                wp.element.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" })))),
                    wp.element.createElement("form", { onSubmit: handleSubmit, className: "wof-create-modal-form" },
                        wp.element.createElement("div", { className: "wof-create-modal-field" },
                            wp.element.createElement("label", { htmlFor: "wof-create-title-input", className: "wof-create-modal-label" }, __('Option set title', 'wooptions-pro')),
                            wp.element.createElement("input", { id: "wof-create-title-input", ref: inputRef, type: "text", className: "wof-create-modal-input", placeholder: __('e.g. Pizza Toppings, Custom Engraving…', 'wooptions-pro'), value: title, onChange: (e) => setTitle(e.target.value), disabled: props.busy, autoComplete: "off" })),
                        wp.element.createElement("div", { className: "wof-create-modal-actions" },
                            wp.element.createElement("button", { type: "button", className: "wof-create-modal-btn wof-create-modal-btn--cancel", onClick: props.onClose, disabled: props.busy }, __('Cancel', 'wooptions-pro')),
                            wp.element.createElement("button", { type: "submit", className: "wof-create-modal-btn wof-create-modal-btn--submit", disabled: !title.trim() || props.busy }, props.busy ? (wp.element.createElement("span", { className: "wof-create-modal-spinner-wrap" },
                                wp.element.createElement("span", { className: "wof-create-modal-spinner" }),
                                wp.element.createElement("span", null, __('Creating…', 'wooptions-pro')))) : (__('Create and open', 'wooptions-pro'))))))));
        }
        function ActionMenu(props) {
            const [open, setOpen] = useState(false);
            useEffect(() => {
                if (!open)
                    return;
                const close = () => setOpen(false);
                document.addEventListener('click', close);
                return () => document.removeEventListener('click', close);
            }, [open]);
            return wp.element.createElement("div", { className: "wof-row-menu", onClick: (event) => event.stopPropagation() },
                wp.element.createElement("button", { type: "button", className: "wof-row-menu__toggle", "aria-expanded": open, onClick: () => setOpen(!open) },
                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "ellipsis" })),
                open ? wp.element.createElement("div", { className: "wof-row-menu__popover" },
                    wp.element.createElement("button", { type: "button", onClick: () => props.onAction('edit') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "edit" }),
                        __('Edit', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", onClick: () => props.onAction('export') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "download" }),
                        __('Export', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", onClick: () => props.onAction('duplicate') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-page" }),
                        __('Duplicate', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", onClick: () => props.onAction(props.item.status === 'inactive' ? 'activate' : 'deactivate') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: props.item.status === 'inactive' ? 'yes' : 'hidden' }),
                        props.item.status === 'inactive' ? __('Activate', 'wooptions-pro') : __('Deactivate', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", onClick: () => props.onAction(props.item.status === 'archived' ? 'restore' : 'archive') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: props.item.status === 'archived' ? 'undo' : 'archive' }),
                        props.item.status === 'archived' ? __('Restore', 'wooptions-pro') : __('Archive', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", className: "is-destructive", onClick: () => props.onAction('delete') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" }),
                        __('Delete permanently', 'wooptions-pro'))) : null);
        }
        function OptionSets(props) {
            const [collection, setCollection] = useState({ items: [], total: 0, page: 1, perPage: 10 });
            const [status, setStatus] = useState('active');
            const [search, setSearch] = useState('');
            const [sort, setSort] = useState('updated_at_gmt');
            const [page, setPage] = useState(1);
            const [perPage, setPerPage] = useState(10);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState('');
            const [selected, setSelected] = useState([]);
            const [createOpen, setCreateOpen] = useState(false);
            const [createTitle, setCreateTitle] = useState('');
            const [busy, setBusy] = useState(false);
            const [deleteTarget, setDeleteTarget] = useState(null);
            const licenseInfo = window.WooOptionsProAdmin?.license;
            const canConfigure = licenseInfo?.canConfigure !== false && (licenseInfo?.active === true || licenseInfo?.canConfigure === true);
            const load = useCallback(() => {
                setLoading(true);
                setError('');
                WooOptionsPro.Api.listOptionSets({ page, perPage, status, search, orderBy: sort, order: sort === 'title' ? 'ASC' : 'DESC' })
                    .then((response) => setCollection(response))
                    .catch((reason) => setError(WooOptionsPro.Utils.errorMessage(reason)))
                    .finally(() => setLoading(false));
            }, [page, perPage, status, search, sort]);
            useEffect(() => {
                const timeout = window.setTimeout(load, 180);
                return () => window.clearTimeout(timeout);
            }, [load]);
            useEffect(() => { setSelected([]); setPage(1); }, [status, search, perPage, sort]);
            const totalPages = Math.max(1, Math.ceil(collection.total / perPage));
            const start = collection.total ? (collection.page - 1) * collection.perPage + 1 : 0;
            const end = collection.total ? Math.min(collection.total, start + collection.items.length - 1) : 0;
            const allSelected = collection.items.length > 0 && collection.items.every((item) => selected.includes(item.uuid));
            const create = async (titleToCreate) => {
                const title = (typeof titleToCreate === 'string' ? titleToCreate : createTitle).trim();
                if (!title)
                    return;
                if (!canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to create option sets.', 'wooptions-pro'));
                    return;
                }
                setBusy(true);
                try {
                    const result = await WooOptionsPro.Api.createOptionSet(title);
                    setCreateOpen(false);
                    setCreateTitle('');
                    props.navigate(`builder/${result.uuid}`);
                }
                catch (reason) {
                    setError(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setBusy(false);
                }
            };
            const exportItems = async (uuids) => {
                const exports = await Promise.all(uuids.map((uuid) => WooOptionsPro.Api.exportOptionSet(uuid)));
                WooOptionsPro.Utils.downloadJson(uuids.length === 1 ? `wooptions-pro-${uuids[0]}.json` : `wooptions-pro-option-sets-${Date.now()}.json`, uuids.length === 1 ? exports[0] : { exportSchemaVersion: 1, exportedAtGmt: new Date().toISOString(), optionSets: exports });
            };
            const updateStatus = async (uuid, nextStatus) => {
                if (!canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to modify option sets.', 'wooptions-pro'));
                    return;
                }
                await WooOptionsPro.Api.updateOptionSet(uuid, { status: nextStatus });
            };
            const rowAction = async (item, action) => {
                if (action !== 'export' && action !== 'edit' && !canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to modify option sets.', 'wooptions-pro'));
                    return;
                }
                setBusy(true);
                try {
                    if (action === 'edit')
                        props.navigate(`builder/${item.uuid}`);
                    if (action === 'export')
                        await exportItems([item.uuid]);
                    if (action === 'duplicate')
                        await WooOptionsPro.Api.duplicateOptionSet(item.uuid);
                    if (action === 'activate' || action === 'restore')
                        await updateStatus(item.uuid, 'active');
                    if (action === 'deactivate')
                        await updateStatus(item.uuid, 'inactive');
                    if (action === 'archive')
                        await updateStatus(item.uuid, 'archived');
                    if (action === 'delete') {
                        setDeleteTarget(item);
                        return;
                    }
                    load();
                }
                catch (reason) {
                    setError(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setBusy(false);
                }
            };
            const bulk = async (action) => {
                if (!selected.length)
                    return;
                if (action !== 'export' && !canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to modify option sets.', 'wooptions-pro'));
                    return;
                }
                if (action === 'delete') {
                    const target = collection.items.find((item) => item.uuid === selected[0]);
                    if (target)
                        setDeleteTarget({ ...target, title: selected.length > 1 ? `${selected.length} selected option sets` : target.title });
                    return;
                }
                setBusy(true);
                try {
                    if (action === 'export')
                        await exportItems(selected);
                    else
                        await Promise.all(selected.map((uuid) => updateStatus(uuid, action === 'activate' || action === 'restore' ? 'active' : action === 'deactivate' ? 'inactive' : 'archived')));
                    setSelected([]);
                    load();
                }
                catch (reason) {
                    setError(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setBusy(false);
                }
            };
            const confirmDelete = async () => {
                if (!deleteTarget)
                    return;
                if (!canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to delete option sets.', 'wooptions-pro'));
                    return;
                }
                setBusy(true);
                try {
                    const targets = deleteTarget.title.includes('selected option sets') ? selected : [deleteTarget.uuid];
                    await Promise.all(targets.map((uuid) => WooOptionsPro.Api.deleteOptionSet(uuid)));
                    setDeleteTarget(null);
                    setSelected([]);
                    load();
                }
                catch (reason) {
                    setError(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setBusy(false);
                }
            };
            const pages = useMemo(() => {
                const values = [];
                const min = Math.max(1, Math.min(page - 2, totalPages - 4));
                const max = Math.min(totalPages, min + 4);
                for (let value = min; value <= max; value += 1)
                    values.push(value);
                return values;
            }, [page, totalPages]);
            return wp.element.createElement("div", { className: "wof-page" },
                wp.element.createElement(WooOptionsPro.Components.PageHeader, { eyebrow: __('Configuration library', 'wooptions-pro'), title: __('Option Sets', 'wooptions-pro'), description: __('Design once, assign precisely, and preserve every published revision.', 'wooptions-pro'), actions: wp.element.createElement(wp.element.Fragment, null,
                        wp.element.createElement(Button, { variant: "secondary", onClick: () => props.navigate('templates') }, __('Browse templates', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "primary", onClick: () => { if (!canConfigure) {
                                WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to create option sets.', 'wooptions-pro'));
                                return;
                            } setCreateOpen(true); } },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }),
                            __('New option set', 'wooptions-pro'))) }),
                error ? wp.element.createElement(WooOptionsPro.Components.InlineNotice, { type: "error", onClose: () => setError('') }, error) : null,
                wp.element.createElement("section", { className: "wof-panel wof-library-panel" },
                    wp.element.createElement("div", { className: "wof-library-toolbar" },
                        wp.element.createElement("div", { className: "wof-segmented-tabs", role: "tablist" }, ['active', 'inactive', 'archived'].map((value) => wp.element.createElement("button", { type: "button", role: "tab", "aria-selected": status === value, className: status === value ? 'is-active' : '', onClick: () => setStatus(value), key: value }, value === 'active' ? __('Active', 'wooptions-pro') : value === 'inactive' ? __('Deactivated', 'wooptions-pro') : __('Archived', 'wooptions-pro')))),
                        wp.element.createElement("div", { className: "wof-toolbar-controls" },
                            wp.element.createElement(SearchControl, { label: __('Search option sets', 'wooptions-pro'), value: search, onChange: setSearch, placeholder: __('Search name or UUID…', 'wooptions-pro') }),
                            wp.element.createElement(SelectControl, { label: __('Sort option sets', 'wooptions-pro'), hideLabelFromVision: true, value: sort, onChange: setSort, options: [{ label: __('Recently updated', 'wooptions-pro'), value: 'updated_at_gmt' }, { label: __('Recently created', 'wooptions-pro'), value: 'created_at_gmt' }, { label: __('Title A–Z', 'wooptions-pro'), value: 'title' }] }))),
                    selected.length ? wp.element.createElement("div", { className: "wof-bulk-bar wof-bulk-bar--modern" },
                        wp.element.createElement("strong", null,
                            selected.length,
                            " ",
                            selected.length === 1 ? __('item selected', 'wooptions-pro') : __('items selected', 'wooptions-pro')),
                        status === 'active' ? wp.element.createElement(Button, { variant: "tertiary", disabled: busy, onClick: () => bulk('deactivate') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "hidden" }),
                            __('Deactivate', 'wooptions-pro')) : null,
                        status === 'inactive' ? wp.element.createElement(Button, { variant: "tertiary", disabled: busy, onClick: () => bulk('activate') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "yes-alt" }),
                            __('Activate', 'wooptions-pro')) : null,
                        status !== 'archived' ? wp.element.createElement(Button, { variant: "tertiary", disabled: busy, onClick: () => bulk('archive') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "archive" }),
                            __('Archive', 'wooptions-pro')) : wp.element.createElement(Button, { variant: "tertiary", disabled: busy, onClick: () => bulk('restore') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "image-rotate" }),
                            __('Restore', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "tertiary", disabled: busy, onClick: () => bulk('export') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "download" }),
                            __('Export', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "tertiary", isDestructive: true, disabled: busy, onClick: () => bulk('delete') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" }),
                            __('Delete', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "tertiary", disabled: busy, onClick: () => setSelected([]) }, __('Clear', 'wooptions-pro'))) : null,
                    wp.element.createElement("div", { className: "wof-option-set-results" },
                        loading && collection.items.length ? wp.element.createElement("div", { className: "wof-table-loading-overlay", role: "status" },
                            wp.element.createElement("span", { className: "wof-loader", "aria-hidden": "true" }),
                            wp.element.createElement("small", null, __('Refreshing option sets…', 'wooptions-pro'))) : null,
                        wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-set-table-wrap', loading && 'is-loading') },
                            wp.element.createElement("table", { className: "wof-set-table wof-set-table--managed" },
                                wp.element.createElement("thead", null,
                                    wp.element.createElement("tr", null,
                                        wp.element.createElement("th", { className: "wof-check-cell" },
                                            wp.element.createElement("input", { className: "wof-table-checkbox", type: "checkbox", checked: allSelected, onChange: () => setSelected(allSelected ? selected.filter((uuid) => !collection.items.some((item) => item.uuid === uuid)) : Array.from(new Set([...selected, ...collection.items.map((item) => item.uuid)]))), "aria-label": __('Select all on this page', 'wooptions-pro') })),
                                        wp.element.createElement("th", null, __('Title', 'wooptions-pro')),
                                        wp.element.createElement("th", null, __('Status', 'wooptions-pro')),
                                        wp.element.createElement("th", null, __('Options applied', 'wooptions-pro')),
                                        wp.element.createElement("th", null, __('Updated', 'wooptions-pro')),
                                        wp.element.createElement("th", { className: "wof-actions-heading" }, __('Actions', 'wooptions-pro')))),
                                wp.element.createElement("tbody", null, collection.items.map((item) => wp.element.createElement("tr", { key: item.uuid, className: selected.includes(item.uuid) ? 'is-selected' : '' },
                                    wp.element.createElement("td", { className: "wof-check-cell" },
                                        wp.element.createElement("input", { className: "wof-table-checkbox", type: "checkbox", checked: selected.includes(item.uuid), onChange: () => setSelected(selected.includes(item.uuid) ? selected.filter((uuid) => uuid !== item.uuid) : [...selected, item.uuid]), "aria-label": __('Select option set', 'wooptions-pro') })),
                                    wp.element.createElement("td", null,
                                        wp.element.createElement("button", { type: "button", className: "wof-set-title", onClick: () => props.navigate(`builder/${item.uuid}`) },
                                            wp.element.createElement("span", { className: "wof-set-glyph" },
                                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "screenoptions" })),
                                            wp.element.createElement("span", null,
                                                wp.element.createElement("strong", null, item.title),
                                                wp.element.createElement("small", null, item.uuid)))),
                                    wp.element.createElement("td", null,
                                        wp.element.createElement(WooOptionsPro.Components.StatusPill, { status: item.status })),
                                    wp.element.createElement("td", null,
                                        wp.element.createElement("strong", { className: WooOptionsPro.Utils.classNames('wof-field-count', (item.fieldCount ?? 0) > 0 && 'has-count') }, item.fieldCount ?? 0)),
                                    wp.element.createElement("td", null,
                                        wp.element.createElement("time", null, WooOptionsPro.Utils.formatDate(item.updatedAtGmt))),
                                    wp.element.createElement("td", { className: "wof-actions-cell" },
                                        wp.element.createElement(ActionMenu, { item: item, onAction: (action) => rowAction(item, action) })))))),
                            !loading && !collection.items.length ? wp.element.createElement(WooOptionsPro.Components.EmptyState, { icon: "screenoptions", title: __('No option sets found', 'wooptions-pro'), description: __('Try another status or search, or create a new option set.', 'wooptions-pro'), action: wp.element.createElement(Button, { variant: "primary", onClick: () => setCreateOpen(true) }, __('Create option set', 'wooptions-pro')) }) : null,
                            loading && !collection.items.length ? wp.element.createElement(WooOptionsPro.Components.Loading, { label: __('Organizing option sets…', 'wooptions-pro') }) : null)),
                    wp.element.createElement("nav", { className: "wof-pagination", "aria-label": __('Option set pagination', 'wooptions-pro') },
                        wp.element.createElement("label", { className: "wof-pagination__length" },
                            wp.element.createElement("span", null, __('Show', 'wooptions-pro')),
                            wp.element.createElement("select", { value: perPage, disabled: loading, onChange: (event) => setPerPage(Number(event.target.value)) }, [10, 25, 50, 100].map((value) => wp.element.createElement("option", { value: value, key: value }, value))),
                            wp.element.createElement("span", null, __('entries', 'wooptions-pro'))),
                        wp.element.createElement("span", { className: "wof-pagination__summary" },
                            __('Showing', 'wooptions-pro'),
                            " ",
                            start,
                            "\u2013",
                            end,
                            " ",
                            __('of', 'wooptions-pro'),
                            " ",
                            collection.total),
                        wp.element.createElement("div", { className: "wof-pagination__controls" },
                            wp.element.createElement("button", { type: "button", className: "wof-pagination__direction", disabled: page <= 1 || loading, onClick: () => setPage(Math.max(1, page - 1)) }, __('Previous', 'wooptions-pro')),
                            pages.map((value) => wp.element.createElement("button", { type: "button", key: value, className: page === value ? 'is-current' : '', "aria-current": page === value ? 'page' : undefined, disabled: loading, onClick: () => setPage(value) }, value)),
                            wp.element.createElement("button", { type: "button", className: "wof-pagination__direction", disabled: page >= totalPages || loading, onClick: () => setPage(Math.min(totalPages, page + 1)) }, __('Next', 'wooptions-pro'))))),
                wp.element.createElement(CreateOptionSetModal, { isOpen: createOpen, busy: busy, onClose: () => !busy && setCreateOpen(false), onCreate: (title) => create(title) }),
                deleteTarget ? wp.element.createElement(WooOptionsPro.Components.ConfirmModal, { title: __('Delete permanently?', 'wooptions-pro'), message: __('This removes the option set and its complete revision history. This action cannot be undone.', 'wooptions-pro'), confirmLabel: __('Delete permanently', 'wooptions-pro'), busy: busy, destructive: true, onConfirm: confirmDelete, onCancel: () => setDeleteTarget(null) }) : null);
        }
        Pages.OptionSets = OptionSets;
    })(Pages = WooOptionsPro.Pages || (WooOptionsPro.Pages = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Pages;
    (function (Pages) {
        const { __, sprintf } = wp.i18n;
        const { useEffect, useMemo, useRef, useState } = wp.element;
        const { Button } = wp.components;
        const { Dashicon } = WooOptionsPro.Components;
        function renderFooterIcon(type, itemSlug) {
            switch (type) {
                case 'image':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Image options', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }),
                            wp.element.createElement("circle", { cx: "8.5", cy: "8.5", r: "1.5" }),
                            wp.element.createElement("polyline", { points: "21 15 16 10 5 21" }))));
                case 'list':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('List choices', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("line", { x1: "8", y1: "6", x2: "21", y2: "6" }),
                            wp.element.createElement("line", { x1: "8", y1: "12", x2: "21", y2: "12" }),
                            wp.element.createElement("line", { x1: "8", y1: "18", x2: "21", y2: "18" }),
                            wp.element.createElement("line", { x1: "3", y1: "6", x2: "3.01", y2: "6" }),
                            wp.element.createElement("line", { x1: "3", y1: "12", x2: "3.01", y2: "12" }),
                            wp.element.createElement("line", { x1: "3", y1: "18", x2: "3.01", y2: "18" }))));
                case 'price':
                case 'price3':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon is-glyph-price", title: __('Dynamic pricing', 'wooptions-pro') }, itemSlug === 'donation' ? '$' : '$$$'));
                case 'text':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Text personalization', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("polyline", { points: "4 7 4 4 20 4 20 7" }),
                            wp.element.createElement("line", { x1: "9", y1: "20", x2: "15", y2: "20" }),
                            wp.element.createElement("line", { x1: "12", y1: "4", x2: "12", y2: "20" }))));
                case 'swatch':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Color choices', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                            wp.element.createElement("circle", { cx: "12", cy: "12", r: "4" }),
                            wp.element.createElement("line", { x1: "4.93", y1: "4.93", x2: "9.17", y2: "9.17" }),
                            wp.element.createElement("line", { x1: "14.83", y1: "14.83", x2: "19.07", y2: "19.07" }),
                            wp.element.createElement("line", { x1: "14.83", y1: "9.17", x2: "19.07", y2: "4.93" }),
                            wp.element.createElement("line", { x1: "4.93", y1: "19.07", x2: "9.17", y2: "14.83" }))));
                case 'package':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Product bundles', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("path", { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }),
                            wp.element.createElement("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }),
                            wp.element.createElement("line", { x1: "12", y1: "22.08", x2: "12", y2: "12" }))));
                case 'ruler':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Measurement', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("path", { d: "M21.3 8.7 8.7 21.3c-.4.4-1 .4-1.4 0l-6-6c-.4-.4-.4-1 0-1.4L13.9 1.3c.4-.4 1-.4 1.4 0l6 6c.4.4.4 1 0 1.4z" }),
                            wp.element.createElement("path", { d: "m14.5 4.5 1.5 1.5" }),
                            wp.element.createElement("path", { d: "m11.5 7.5 1.5 1.5" }),
                            wp.element.createElement("path", { d: "m8.5 10.5 1.5 1.5" }),
                            wp.element.createElement("path", { d: "m5.5 13.5 1.5 1.5" }))));
                case 'chip':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Components builder', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }),
                            wp.element.createElement("rect", { x: "9", y: "9", width: "6", height: "6" }),
                            wp.element.createElement("line", { x1: "9", y1: "1", x2: "9", y2: "4" }),
                            wp.element.createElement("line", { x1: "15", y1: "1", x2: "15", y2: "4" }),
                            wp.element.createElement("line", { x1: "9", y1: "20", x2: "9", y2: "23" }),
                            wp.element.createElement("line", { x1: "15", y1: "20", x2: "15", y2: "23" }),
                            wp.element.createElement("line", { x1: "20", y1: "9", x2: "23", y2: "9" }),
                            wp.element.createElement("line", { x1: "20", y1: "15", x2: "23", y2: "15" }),
                            wp.element.createElement("line", { x1: "1", y1: "9", x2: "4", y2: "9" }),
                            wp.element.createElement("line", { x1: "1", y1: "15", x2: "4", y2: "15" }))));
                case 'users':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Team members', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
                            wp.element.createElement("circle", { cx: "9", cy: "7", r: "4" }),
                            wp.element.createElement("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
                            wp.element.createElement("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }))));
                case 'calendar':
                    return (wp.element.createElement("span", { key: type, className: "wof-footer-icon", title: __('Rental dates', 'wooptions-pro') },
                        wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
                            wp.element.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
                            wp.element.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
                            wp.element.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" }))));
                default:
                    return wp.element.createElement("span", { key: type, className: "wof-footer-icon" },
                        wp.element.createElement(Dashicon, { name: "screenoptions" }));
            }
        }
        function TemplateCard(props) {
            const { item, selected, busy, onSelect, onPreview, onUse } = props;
            const isAdvanced = (item.level ?? '').toLowerCase() === 'advanced';
            const footerIcons = item.footerIcons?.length ? item.footerIcons : ['image', 'list', 'price'];
            return (wp.element.createElement("article", { className: WooOptionsPro.Utils.classNames('wof-new-template-card', selected && 'is-selected'), onClick: onSelect },
                selected ? (wp.element.createElement("span", { className: "wof-template-card__selected-check", "aria-label": __('Selected', 'wooptions-pro') },
                    wp.element.createElement("svg", { width: "12", height: "10", viewBox: "0 0 12 10", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                        wp.element.createElement("path", { d: "M1 5L4.5 8.5L11 1.5", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })))) : null,
                wp.element.createElement("div", { className: "wof-template-card__body" },
                    wp.element.createElement("div", { className: "wof-template-card__media" },
                        wp.element.createElement("img", { src: item.previewImage, alt: item.name, loading: "lazy" })),
                    wp.element.createElement("div", { className: "wof-template-card__content" },
                        wp.element.createElement("div", { className: "wof-template-card__header" },
                            wp.element.createElement("h3", { className: "wof-template-card__title" }, item.name),
                            wp.element.createElement("span", { className: `wof-template-level-badge ${isAdvanced ? 'is-advanced' : 'is-beginner'}` }, item.level ?? 'Beginner')),
                        wp.element.createElement("div", { className: "wof-template-card__specs" },
                            wp.element.createElement("div", { className: "wof-template-card__spec" },
                                (item.fieldsCount ?? item.fieldCount ?? 0),
                                " ",
                                __('fields', 'wooptions-pro'),
                                " \u00B7 ",
                                (item.rulesCount ?? 0),
                                " ",
                                __('rules', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-template-card__spec" }, item.pricingModel ?? __('Cumulative pricing', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-template-card__spec" }, item.layoutModel ?? __('Grid layout', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-template-card__tested" },
                                wp.element.createElement("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "currentColor", xmlns: "http://www.w3.org/2000/svg" },
                                    wp.element.createElement("path", { fillRule: "evenodd", d: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.41 5.41a1 1 0 0 0-1.41 0L7 8.41 5.71 7.12a1 1 0 1 0-1.42 1.42l2 2a1 1 0 0 0 1.42 0l4-4a1 1 0 0 0 0-1.42z" })),
                                wp.element.createElement("span", null, __('Tested', 'wooptions-pro')))))),
                wp.element.createElement("div", { className: "wof-template-card__footer", onClick: (e) => e.stopPropagation() },
                    wp.element.createElement("div", { className: "wof-template-card__icons" }, footerIcons.map((t) => renderFooterIcon(t, item.slug))),
                    wp.element.createElement("div", { className: "wof-template-card__actions" },
                        wp.element.createElement("button", { type: "button", className: "wof-btn-card-preview", onClick: onPreview }, __('Preview', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "primary", className: "wof-btn-card-use", isBusy: busy, onClick: onUse }, __('Use template', 'wooptions-pro'))))));
        }
        function Templates(props) {
            const [items, setItems] = useState([]);
            const [search, setSearch] = useState('');
            const [category, setCategory] = useState('all');
            const [fieldTypeFilter, setFieldTypeFilter] = useState('all');
            const [layoutFilter, setLayoutFilter] = useState('all');
            const [sort, setSort] = useState('popular');
            const [page, setPage] = useState(1);
            const [perPage, setPerPage] = useState(9);
            const [viewMode, setViewMode] = useState('grid');
            const [selectedSlug, setSelectedSlug] = useState('design-your-own-pizza');
            const [loading, setLoading] = useState(true);
            const [busy, setBusy] = useState(null);
            const [creating, setCreating] = useState(false);
            const [importing, setImporting] = useState(false);
            const [error, setError] = useState('');
            const fileRef = useRef(null);
            const searchInputRef = useRef(null);
            useEffect(() => {
                WooOptionsPro.Api.listTemplates()
                    .then((response) => {
                    setItems(response.items);
                    if (response.items.length && !selectedSlug) {
                        setSelectedSlug(response.items[0].slug);
                    }
                })
                    .catch((reason) => setError(WooOptionsPro.Utils.errorMessage(reason)))
                    .finally(() => setLoading(false));
            }, []);
            // ⌘K or Ctrl+K shortcut listener
            useEffect(() => {
                const handleKeyDown = (e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                        e.preventDefault();
                        searchInputRef.current?.focus();
                    }
                };
                window.addEventListener('keydown', handleKeyDown);
                return () => window.removeEventListener('keydown', handleKeyDown);
            }, []);
            useEffect(() => {
                setPage(1);
            }, [search, category, fieldTypeFilter, layoutFilter, sort]);
            const categories = [
                { id: 'all', label: __('All', 'wooptions-pro') },
                { id: 'food', label: __('Food', 'wooptions-pro') },
                { id: 'apparel', label: __('Apparel', 'wooptions-pro') },
                { id: 'personalization', label: __('Personalization', 'wooptions-pro') },
                { id: 'measurement', label: __('Measurement', 'wooptions-pro') },
                { id: 'bundles', label: __('Bundles', 'wooptions-pro') },
                { id: 'advanced', label: __('Advanced', 'wooptions-pro') },
            ];
            const filtered = useMemo(() => {
                const term = search.trim().toLowerCase();
                const result = items.filter((item) => {
                    if (category !== 'all') {
                        if (category === 'advanced') {
                            if ((item.level ?? '').toLowerCase() !== 'advanced' && item.category !== 'advanced') {
                                return false;
                            }
                        }
                        else if (item.category !== category) {
                            return false;
                        }
                    }
                    if (fieldTypeFilter !== 'all') {
                        if (!(item.fieldTypes ?? []).includes(fieldTypeFilter))
                            return false;
                    }
                    if (layoutFilter !== 'all') {
                        const layoutName = (item.layoutModel ?? '').toLowerCase();
                        if (!layoutName.includes(layoutFilter.toLowerCase()))
                            return false;
                    }
                    if (!term)
                        return true;
                    return `${item.name} ${item.description} ${item.categoryLabel ?? item.category} ${item.pricingModel ?? ''} ${item.layoutModel ?? ''} ${(item.features ?? []).join(' ')}`.toLowerCase().includes(term);
                });
                return result.sort((left, right) => {
                    if (sort === 'name')
                        return left.name.localeCompare(right.name);
                    if (sort === 'newest')
                        return (right.order ?? 0) - (left.order ?? 0);
                    return (right.order ?? 0) - (left.order ?? 0);
                });
            }, [items, search, category, fieldTypeFilter, layoutFilter, sort]);
            const pages = Math.max(1, Math.ceil(filtered.length / perPage));
            const currentPage = Math.min(page, pages);
            const visible = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
            const selectedItem = useMemo(() => {
                if (!selectedSlug)
                    return null;
                return items.find((i) => i.slug === selectedSlug) ?? (filtered.length ? filtered[0] : null);
            }, [selectedSlug, items, filtered]);
            const importTemplate = async (slug) => {
                setBusy(slug);
                setError('');
                try {
                    const result = await WooOptionsPro.Api.importTemplate(slug);
                    props.navigate(`builder/${result.uuid}`);
                }
                catch (reason) {
                    setError(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setBusy(null);
                }
            };
            const createFromScratch = async () => {
                setCreating(true);
                setError('');
                try {
                    const created = await WooOptionsPro.Api.createOptionSet(__('Untitled option set', 'wooptions-pro'));
                    props.navigate(`builder/${created.uuid}`);
                }
                catch (reason) {
                    setError(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setCreating(false);
                }
            };
            const importFile = async (event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file)
                    return;
                setImporting(true);
                setError('');
                try {
                    const raw = await file.text();
                    const payload = JSON.parse(raw);
                    const previewResult = await WooOptionsPro.Api.previewImport(payload);
                    if (!previewResult.valid) {
                        throw new Error(__('The selected file is not a valid option set template.', 'wooptions-pro'));
                    }
                    const result = await WooOptionsPro.Api.commitImport(payload, previewResult.title || __('Imported template', 'wooptions-pro'));
                    props.navigate(`builder/${result.uuid}`);
                }
                catch (reason) {
                    setError(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setImporting(false);
                }
            };
            return (wp.element.createElement("div", { className: "wof-new-templates-page" },
                wp.element.createElement("header", { className: "wof-new-templates-header" },
                    wp.element.createElement("div", { className: "wof-new-templates-header__left" },
                        wp.element.createElement("h1", { className: "wof-new-templates-title" }, __('Templates', 'wooptions-pro')),
                        wp.element.createElement("p", { className: "wof-new-templates-subtitle" }, __('Start with a tested option set, then make it your own.', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-new-templates-cta-row" },
                            wp.element.createElement(Button, { variant: "primary", className: "wof-btn-create-template", isBusy: creating, onClick: createFromScratch }, __('Create template', 'wooptions-pro')),
                            wp.element.createElement("input", { ref: fileRef, type: "file", hidden: true, accept: "application/json,.json", onChange: importFile }),
                            wp.element.createElement(Button, { variant: "secondary", className: "wof-btn-import-template", isBusy: importing, onClick: () => fileRef.current?.click() }, __('Import template', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: "wof-new-templates-header__right" },
                        wp.element.createElement("div", { className: "wof-quick-search-box", onClick: () => searchInputRef.current?.focus() },
                            wp.element.createElement("input", { ref: searchInputRef, type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: __('Search (⌘K)', 'wooptions-pro'), className: "wof-quick-search-input" }),
                            wp.element.createElement("span", { className: "wof-quick-search-icon" },
                                wp.element.createElement(Dashicon, { name: "search" }))))),
                wp.element.createElement("div", { className: "wof-new-templates-toolbar" },
                    wp.element.createElement("div", { className: "wof-toolbar-row-top" },
                        wp.element.createElement("div", { className: "wof-search-templates-field" },
                            wp.element.createElement("input", { type: "text", value: search, onChange: (e) => setSearch(e.target.value), placeholder: __('Search templates', 'wooptions-pro'), className: "wof-search-templates-input" }),
                            wp.element.createElement("span", { className: "wof-search-templates-icon" },
                                wp.element.createElement(Dashicon, { name: "search" }))),
                        wp.element.createElement("div", { className: "wof-category-pills" }, categories.map((cat) => (wp.element.createElement("button", { type: "button", key: cat.id, className: `wof-category-pill ${category === cat.id ? 'is-active' : ''}`, onClick: () => setCategory(cat.id) }, cat.label))))),
                    wp.element.createElement("div", { className: "wof-toolbar-row-bottom" },
                        wp.element.createElement("div", { className: "wof-toolbar-dropdowns-left" },
                            wp.element.createElement("div", { className: "wof-select-wrapper" },
                                wp.element.createElement("select", { value: fieldTypeFilter, onChange: (e) => setFieldTypeFilter(e.target.value), className: "wof-filter-select", "aria-label": __('Filter by field type', 'wooptions-pro') },
                                    wp.element.createElement("option", { value: "all" }, __('Field types', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "image_swatch" }, __('Image choices', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "color_swatch" }, __('Color swatches', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "radio" }, __('Radio group', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "segmented" }, __('Button choices', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "checkbox_group" }, __('Checkbox group', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "product" }, __('Product choices', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "file" }, __('File upload', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "repeater" }, __('Repeatable section', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "date_range" }, __('Date range', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "formula" }, __('Formula output', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "customer_defined_price" }, __('Customer price', 'wooptions-pro'))),
                                wp.element.createElement("span", { className: "wof-select-chevron" }, "\u25BE")),
                            wp.element.createElement("div", { className: "wof-select-wrapper" },
                                wp.element.createElement("select", { value: layoutFilter, onChange: (e) => setLayoutFilter(e.target.value), className: "wof-filter-select", "aria-label": __('Filter by layout', 'wooptions-pro') },
                                    wp.element.createElement("option", { value: "all" }, __('Layout', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "grid" }, __('Grid layout', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "sectioned" }, __('Sectioned layout', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "accordion" }, __('Accordion layout', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "step" }, __('Step layout', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "single column" }, __('Single column', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "table" }, __('Table layout', 'wooptions-pro'))),
                                wp.element.createElement("span", { className: "wof-select-chevron" }, "\u25BE"))),
                        wp.element.createElement("div", { className: "wof-toolbar-dropdowns-right" },
                            wp.element.createElement("div", { className: "wof-view-mode-toggle" },
                                wp.element.createElement("button", { type: "button", className: `wof-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`, onClick: () => setViewMode('grid'), "aria-label": __('Grid view', 'wooptions-pro'), title: __('Grid view', 'wooptions-pro') },
                                    wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "currentColor" },
                                        wp.element.createElement("rect", { x: "1", y: "1", width: "6", height: "6", rx: "1.5" }),
                                        wp.element.createElement("rect", { x: "9", y: "1", width: "6", height: "6", rx: "1.5" }),
                                        wp.element.createElement("rect", { x: "1", y: "9", width: "6", height: "6", rx: "1.5" }),
                                        wp.element.createElement("rect", { x: "9", y: "9", width: "6", height: "6", rx: "1.5" }))),
                                wp.element.createElement("button", { type: "button", className: `wof-view-btn ${viewMode === 'list' ? 'is-active' : ''}`, onClick: () => setViewMode('list'), "aria-label": __('List view', 'wooptions-pro'), title: __('List view', 'wooptions-pro') },
                                    wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "currentColor" },
                                        wp.element.createElement("rect", { x: "1", y: "2", width: "14", height: "2", rx: "1" }),
                                        wp.element.createElement("rect", { x: "1", y: "7", width: "14", height: "2", rx: "1" }),
                                        wp.element.createElement("rect", { x: "1", y: "12", width: "14", height: "2", rx: "1" })))),
                            wp.element.createElement("div", { className: "wof-select-wrapper" },
                                wp.element.createElement("select", { value: sort, onChange: (e) => setSort(e.target.value), className: "wof-filter-select", "aria-label": __('Sort templates', 'wooptions-pro') },
                                    wp.element.createElement("option", { value: "popular" }, __('Most useful', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "newest" }, __('Newest first', 'wooptions-pro')),
                                    wp.element.createElement("option", { value: "name" }, __('Name A–Z', 'wooptions-pro'))),
                                wp.element.createElement("span", { className: "wof-select-chevron" }, "\u25BE"))))),
                error ? (wp.element.createElement("div", { className: "wof-notice-wrap" },
                    wp.element.createElement(WooOptionsPro.Components.InlineNotice, { type: "error", onClose: () => setError('') }, error))) : null,
                wp.element.createElement("div", { className: `wof-templates-main-layout ${selectedItem ? 'has-drawer' : 'no-drawer'}` },
                    wp.element.createElement("div", { className: "wof-templates-catalog-column" },
                        loading ? (wp.element.createElement(WooOptionsPro.Components.Loading, { label: __('Loading templates…', 'wooptions-pro') })) : visible.length ? (wp.element.createElement("div", { className: `wof-templates-cards-grid is-${viewMode}` }, visible.map((item) => (wp.element.createElement(TemplateCard, { key: item.slug, item: item, selected: selectedItem?.slug === item.slug, busy: busy === item.slug, onSelect: () => setSelectedSlug(item.slug), onPreview: () => setSelectedSlug(item.slug), onUse: () => importTemplate(item.slug) }))))) : (wp.element.createElement(WooOptionsPro.Components.EmptyState, { icon: "search", title: __('No templates found', 'wooptions-pro'), description: __('Try adjusting your search terms or category filters.', 'wooptions-pro'), action: wp.element.createElement(Button, { variant: "secondary", onClick: () => {
                                    setSearch('');
                                    setCategory('all');
                                    setFieldTypeFilter('all');
                                    setLayoutFilter('all');
                                } }, __('Clear all filters', 'wooptions-pro')) })),
                        !loading && filtered.length ? (wp.element.createElement("div", { className: "wof-templates-bottom-bar" },
                            wp.element.createElement("div", { className: "wof-templates-bottom-count" }, sprintf(__('%d original templates', 'wooptions-pro'), filtered.length)),
                            wp.element.createElement("div", { className: "wof-templates-bottom-controls" },
                                wp.element.createElement("div", { className: "wof-per-page-select-wrapper" },
                                    wp.element.createElement("select", { value: perPage, onChange: (e) => setPerPage(Number(e.target.value)), className: "wof-per-page-select", "aria-label": __('Items per page', 'wooptions-pro') },
                                        wp.element.createElement("option", { value: 9 }, __('9 per page', 'wooptions-pro')),
                                        wp.element.createElement("option", { value: 18 }, __('18 per page', 'wooptions-pro')),
                                        wp.element.createElement("option", { value: 36 }, __('36 per page', 'wooptions-pro'))),
                                    wp.element.createElement("span", { className: "wof-select-chevron" }, "\u25BE")),
                                wp.element.createElement("div", { className: "wof-templates-pagination" },
                                    wp.element.createElement("button", { type: "button", disabled: currentPage <= 1, onClick: () => setPage(currentPage - 1), className: "wof-page-nav-btn", "aria-label": __('Previous page', 'wooptions-pro') }, "\u2039"),
                                    wp.element.createElement("span", { className: "wof-page-number-active" }, currentPage),
                                    wp.element.createElement("button", { type: "button", disabled: currentPage >= pages, onClick: () => setPage(currentPage + 1), className: "wof-page-nav-btn", "aria-label": __('Next page', 'wooptions-pro') }, "\u203A"))))) : null),
                    selectedItem ? (wp.element.createElement("aside", { className: "wof-template-drawer" },
                        wp.element.createElement("div", { className: "wof-template-drawer__header" },
                            wp.element.createElement("h2", { className: "wof-template-drawer__title" }, selectedItem.name),
                            wp.element.createElement("button", { type: "button", className: "wof-template-drawer__close", onClick: () => setSelectedSlug(null), "aria-label": __('Close details', 'wooptions-pro') }, "\u2715")),
                        wp.element.createElement("div", { className: "wof-template-drawer__hero" },
                            wp.element.createElement("img", { src: selectedItem.heroImage || selectedItem.previewImage, alt: selectedItem.name, className: "wof-template-drawer__hero-img" })),
                        wp.element.createElement("p", { className: "wof-template-drawer__desc" }, selectedItem.description),
                        wp.element.createElement("div", { className: "wof-template-drawer__section" },
                            wp.element.createElement("h4", { className: "wof-drawer-section-title" }, __('Features', 'wooptions-pro')),
                            wp.element.createElement("ul", { className: "wof-drawer-features-list" }, (selectedItem.features?.length ? selectedItem.features : [
                                __('Image choices', 'wooptions-pro'),
                                __('Per-choice quantity', 'wooptions-pro'),
                                __('Conditional toppings', 'wooptions-pro'),
                                __('Cumulative pricing', 'wooptions-pro')
                            ]).map((feat, idx) => (wp.element.createElement("li", { key: idx, className: "wof-drawer-feature-item" },
                                wp.element.createElement("span", { className: "wof-feature-check" },
                                    wp.element.createElement("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "currentColor" },
                                        wp.element.createElement("path", { fillRule: "evenodd", d: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm3.41 5.41a1 1 0 0 0-1.41 0L7 8.41 5.71 7.12a1 1 0 1 0-1.42 1.42l2 2a1 1 0 0 0 1.42 0l4-4a1 1 0 0 0 0-1.42z" }))),
                                wp.element.createElement("span", null, feat)))))),
                        wp.element.createElement("div", { className: "wof-template-drawer__section" },
                            wp.element.createElement("h4", { className: "wof-drawer-section-title" }, __('Details', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-drawer-details-list" },
                                wp.element.createElement("div", { className: "wof-drawer-detail-item" },
                                    wp.element.createElement("span", { className: "wof-detail-icon" }, "\u2630"),
                                    wp.element.createElement("span", null, selectedItem.details?.fields || `${selectedItem.fieldsCount ?? selectedItem.fieldCount ?? 0} ${__('fields', 'wooptions-pro')}`)),
                                wp.element.createElement("div", { className: "wof-drawer-detail-item" },
                                    wp.element.createElement("span", { className: "wof-detail-icon" }, "\u26A1"),
                                    wp.element.createElement("span", null, selectedItem.details?.rules || `${selectedItem.rulesCount ?? 0} ${__('rules', 'wooptions-pro')}`)),
                                wp.element.createElement("div", { className: "wof-drawer-detail-item" },
                                    wp.element.createElement("span", { className: "wof-detail-icon" }, "\u229E"),
                                    wp.element.createElement("span", null, selectedItem.details?.layout || selectedItem.layoutModel || __('Grid layout', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wof-drawer-detail-item" },
                                    wp.element.createElement("span", { className: "wof-detail-icon is-check" }, "\u2714"),
                                    wp.element.createElement("span", null, selectedItem.details?.tested || __('Tested for accessibility', 'wooptions-pro'))))),
                        wp.element.createElement("div", { className: "wof-template-drawer__actions" },
                            wp.element.createElement(Button, { variant: "primary", className: "wof-drawer-btn-use", isBusy: busy === selectedItem.slug, onClick: () => importTemplate(selectedItem.slug) }, __('Use this template', 'wooptions-pro')),
                            wp.element.createElement("button", { type: "button", className: "wof-drawer-btn-preview", onClick: () => {
                                    if (selectedItem.previewUrl) {
                                        window.open(selectedItem.previewUrl, '_blank');
                                    }
                                    else {
                                        window.alert(__('Storefront preview URL will be configured manually.', 'wooptions-pro'));
                                    }
                                } },
                                wp.element.createElement("span", null, __('Preview storefront', 'wooptions-pro')),
                                wp.element.createElement("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "currentColor" },
                                    wp.element.createElement("path", { d: "M14 2.5a.5.5 0 0 0-.5-.5h-6a.5.5 0 0 0 0 1h4.793L2.146 13.146a.5.5 0 0 0 .708.708L13 3.707V8.5a.5.5 0 0 0 1 0v-6z" })))))) : null)));
        }
        Pages.Templates = Templates;
    })(Pages = WooOptionsPro.Pages || (WooOptionsPro.Pages = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Pages;
    (function (Pages) {
        const { __, sprintf } = wp.i18n;
        const { useCallback, useEffect, useMemo, useRef, useState } = wp.element;
        function formatMoney(amount, symbol = '$', position = 'right') {
            const formatted = Number.isInteger(amount) ? amount.toString() : Number(amount.toFixed(2)).toString();
            switch (position) {
                case 'left':
                    return `${symbol}${formatted}`;
                case 'left_space':
                    return `${symbol} ${formatted}`;
                case 'right_space':
                    return `${formatted} ${symbol}`;
                case 'right':
                default:
                    return `${formatted}${symbol}`;
            }
        }
        function buildMonotoneSpline(points) {
            if (points.length === 0)
                return '';
            if (points.length === 1)
                return `M ${points[0].x} ${points[0].y}`;
            if (points.length === 2) {
                return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
            }
            const n = points.length;
            const d = [];
            const m = [];
            for (let i = 0; i < n - 1; i++) {
                const dx = points[i + 1].x - points[i].x;
                const dy = points[i + 1].y - points[i].y;
                d[i] = dx !== 0 ? dy / dx : 0;
            }
            m[0] = d[0];
            for (let i = 1; i < n - 1; i++) {
                if (d[i - 1] * d[i] <= 0) {
                    m[i] = 0;
                }
                else {
                    m[i] = (d[i - 1] + d[i]) / 2;
                }
            }
            m[n - 1] = d[n - 2];
            for (let i = 0; i < n - 1; i++) {
                if (d[i] === 0) {
                    m[i] = 0;
                    m[i + 1] = 0;
                }
                else {
                    const alpha = m[i] / d[i];
                    const beta = m[i + 1] / d[i];
                    const dist = alpha * alpha + beta * beta;
                    if (dist > 9) {
                        const tau = 3 / Math.sqrt(dist);
                        m[i] = tau * alpha * d[i];
                        m[i + 1] = tau * beta * d[i];
                    }
                }
            }
            let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
            for (let i = 0; i < n - 1; i++) {
                const dx = (points[i + 1].x - points[i].x) / 3;
                const cp1x = points[i].x + dx;
                const cp1y = points[i].y + m[i] * dx;
                const cp2x = points[i + 1].x - dx;
                const cp2y = points[i + 1].y - m[i + 1] * dx;
                path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`;
            }
            return path;
        }
        function Analytics(props) {
            const [range, setRange] = useState('30d');
            const [data, setData] = useState(null);
            const [loading, setLoading] = useState(true);
            const [error, setError] = useState('');
            const [activeMetric, setActiveMetric] = useState('clicks');
            const [hoveredIdx, setHoveredIdx] = useState(null);
            const [tableSearch, setTableSearch] = useState('');
            const [tablePage, setTablePage] = useState(1);
            const perPage = 5;
            const chartSvgRef = useRef(null);
            const loadData = useCallback((selectedRange) => {
                setLoading(true);
                setError('');
                WooOptionsPro.Api.analytics({ range: selectedRange })
                    .then((response) => setData(response))
                    .catch((reason) => setError(WooOptionsPro.Utils.errorMessage(reason)))
                    .finally(() => setLoading(false));
            }, []);
            useEffect(() => {
                loadData(range);
            }, [range, loadData]);
            const rangeOptions = [
                { key: '7d', label: __('Last 7 Days', 'wooptions-pro') },
                { key: '30d', label: __('Last 30 Days', 'wooptions-pro') },
                { key: '12m', label: __('Last 12 Months', 'wooptions-pro') },
            ];
            const currencySymbol = data?.currencySymbol || window.WooOptionsProAdmin?.currencySymbol || '$';
            const currencyPosition = data?.currencyPosition || window.WooOptionsProAdmin?.currencyPosition || 'right';
            // Chart parameters
            const chartWidth = 960;
            const chartHeight = 310;
            const padLeft = 55;
            const padRight = 30;
            const padTop = 25;
            const padBottom = 45;
            const plotWidth = chartWidth - padLeft - padRight;
            const plotHeight = chartHeight - padTop - padBottom;
            const baselineY = chartHeight - padBottom;
            const chartPoints = data?.chart || [];
            const maxVal = useMemo(() => {
                if (!chartPoints.length)
                    return 3;
                const values = chartPoints.map((p) => {
                    if (activeMetric === 'sales')
                        return p.sales;
                    if (activeMetric === 'orders')
                        return p.orders;
                    if (activeMetric === 'addToCart')
                        return p.addToCart;
                    return p.clicks;
                });
                const highest = Math.max(...values);
                if (highest <= 0)
                    return 3;
                if (highest <= 3)
                    return 3;
                if (highest <= 10)
                    return Math.ceil(highest);
                const mag = Math.pow(10, Math.floor(Math.log10(highest)));
                return Math.ceil(highest / mag) * mag;
            }, [chartPoints, activeMetric]);
            const yTicks = useMemo(() => {
                const ticks = [];
                for (let i = 0; i <= 4; i++) {
                    const val = (maxVal * i) / 4;
                    const y = baselineY - (val / maxVal) * plotHeight;
                    const label = activeMetric === 'sales'
                        ? (Number.isInteger(val) ? val.toString() : val.toFixed(1))
                        : (Number.isInteger(val) ? val.toString() : val.toFixed(2));
                    ticks.push({ val, y, label });
                }
                return ticks;
            }, [maxVal, baselineY, plotHeight, activeMetric]);
            const coords = useMemo(() => {
                if (!chartPoints.length)
                    return [];
                const count = chartPoints.length;
                return chartPoints.map((p, idx) => {
                    const x = count === 1 ? padLeft + plotWidth / 2 : padLeft + (idx / (count - 1)) * plotWidth;
                    const val = activeMetric === 'sales' ? p.sales : activeMetric === 'orders' ? p.orders : activeMetric === 'addToCart' ? p.addToCart : p.clicks;
                    const y = baselineY - Math.min(1, Math.max(0, val / maxVal)) * plotHeight;
                    return { x, y };
                });
            }, [chartPoints, activeMetric, maxVal, padLeft, plotWidth, baselineY, plotHeight]);
            const { strokeD, areaD } = useMemo(() => {
                if (coords.length === 0)
                    return { strokeD: '', areaD: '' };
                const stroke = buildMonotoneSpline(coords);
                const first = coords[0];
                const last = coords[coords.length - 1];
                const area = `${stroke} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;
                return { strokeD: stroke, areaD: area };
            }, [coords, baselineY]);
            const xLabels = useMemo(() => {
                if (!chartPoints.length)
                    return [];
                const total = chartPoints.length;
                const step = total > 20 ? 2 : total > 10 ? 1 : 1;
                const labels = [];
                for (let i = 0; i < total; i += step) {
                    const x = total === 1 ? padLeft + plotWidth / 2 : padLeft + (i / (total - 1)) * plotWidth;
                    labels.push({ idx: i, x, label: chartPoints[i].label });
                }
                if (total > 1 && (total - 1) % step !== 0) {
                    labels.push({
                        idx: total - 1,
                        x: padLeft + plotWidth,
                        label: chartPoints[total - 1].label,
                    });
                }
                return labels;
            }, [chartPoints, padLeft, plotWidth]);
            const handleMouseMove = (e) => {
                if (!chartSvgRef.current || !chartPoints.length)
                    return;
                const rect = chartSvgRef.current.getBoundingClientRect();
                const clientX = e.clientX - rect.left;
                const svgX = (clientX / rect.width) * chartWidth;
                if (svgX < padLeft || svgX > padLeft + plotWidth) {
                    setHoveredIdx(null);
                    return;
                }
                const fraction = (svgX - padLeft) / plotWidth;
                const index = Math.round(fraction * (chartPoints.length - 1));
                setHoveredIdx(Math.max(0, Math.min(chartPoints.length - 1, index)));
            };
            const handleMouseLeave = () => {
                setHoveredIdx(null);
            };
            const hoveredPoint = hoveredIdx !== null ? chartPoints[hoveredIdx] : null;
            const hoveredCoord = hoveredIdx !== null ? coords[hoveredIdx] : null;
            // Filter & Paginate Option Sets
            const filteredOptionSets = useMemo(() => {
                const list = data?.optionSets || [];
                if (!tableSearch.trim())
                    return list;
                const q = tableSearch.toLowerCase();
                return list.filter((item) => item.name.toLowerCase().includes(q) || String(item.id).includes(q) || item.uuid.toLowerCase().includes(q));
            }, [data?.optionSets, tableSearch]);
            // Reset to page 1 when search query changes
            useEffect(() => {
                setTablePage(1);
            }, [tableSearch]);
            const totalTableItems = filteredOptionSets.length;
            const totalTablePages = Math.max(1, Math.ceil(totalTableItems / perPage));
            const paginatedOptionSets = useMemo(() => {
                const start = (tablePage - 1) * perPage;
                return filteredOptionSets.slice(start, start + perPage);
            }, [filteredOptionSets, tablePage, perPage]);
            const startItem = totalTableItems > 0 ? (tablePage - 1) * perPage + 1 : 0;
            const endItem = Math.min(totalTableItems, tablePage * perPage);
            // Color theme configuration based on active metric
            const metricThemes = {
                clicks: { color: '#5b4ff5', fillStop: 'rgba(91, 79, 245, 0.24)', label: __('Clicks', 'wooptions-pro'), unit: __('interactions', 'wooptions-pro') },
                addToCart: { color: '#0284c7', fillStop: 'rgba(2, 132, 199, 0.22)', label: __('Add-to-Cart', 'wooptions-pro'), unit: __('items', 'wooptions-pro') },
                orders: { color: '#10b981', fillStop: 'rgba(16, 185, 129, 0.22)', label: __('Orders', 'wooptions-pro'), unit: __('orders', 'wooptions-pro') },
                sales: { color: '#8b5cf6', fillStop: 'rgba(139, 92, 246, 0.24)', label: __('Addon Revenue', 'wooptions-pro'), unit: currencySymbol },
            };
            const currentTheme = metricThemes[activeMetric];
            return (wp.element.createElement("div", { className: "wof-page wof-analytics-page wof-analytics-bespoke" },
                wp.element.createElement("div", { className: "wof-analytics-hero" },
                    wp.element.createElement("div", { className: "wof-analytics-hero__info" },
                        wp.element.createElement("h1", { className: "wof-analytics-hero__title" }, __('Performance & Conversions', 'wooptions-pro')),
                        wp.element.createElement("p", { className: "wof-analytics-hero__desc" }, __('Track user choices, validation impact, and addon revenue contribution in real-time.', 'wooptions-pro'))),
                    wp.element.createElement("div", { className: "wof-analytics-hero__actions" },
                        wp.element.createElement("div", { className: "wof-segmented-range", role: "group", "aria-label": __('Reporting Period', 'wooptions-pro') }, rangeOptions.map((opt) => (wp.element.createElement("button", { type: "button", key: opt.key, className: `wof-segmented-range__btn ${range === opt.key ? 'is-active' : ''}`, onClick: () => setRange(opt.key) }, opt.label)))),
                        wp.element.createElement("button", { type: "button", className: "wof-refresh-btn", onClick: () => loadData(range), title: __('Refresh data', 'wooptions-pro'), disabled: loading },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "update" })))),
                error ? (wp.element.createElement(WooOptionsPro.Components.InlineNotice, { type: "error", onClose: () => setError('') }, error)) : null,
                wp.element.createElement("div", { className: "wof-bespoke-kpi-grid" },
                    wp.element.createElement("div", { className: `wof-bespoke-kpi-card wof-kpi--sales ${activeMetric === 'sales' ? 'is-active' : ''}`, onClick: () => setActiveMetric('sales'), role: "button", tabIndex: 0 },
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-header" },
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-icon wof-icon--sales" },
                                wp.element.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" },
                                    wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                                    wp.element.createElement("path", { d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" }),
                                    wp.element.createElement("path", { d: "M12 18V6" }))),
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-title" }, __('Total Sales (Addons)', 'wooptions-pro')),
                            activeMetric === 'sales' ? (wp.element.createElement("span", { className: "wof-kpi-active-pill" },
                                wp.element.createElement("span", { className: "wof-kpi-active-dot" }),
                                __('Active', 'wooptions-pro'))) : null),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-body" },
                            wp.element.createElement("strong", { className: "wof-bespoke-kpi-num" }, formatMoney(data?.totals?.totalSales ?? 0, currencySymbol, currencyPosition))),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-footer" },
                            wp.element.createElement("span", { className: "wof-kpi-hint" }, __('Net addon contribution to orders', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: `wof-bespoke-kpi-card wof-kpi--orders ${activeMetric === 'orders' ? 'is-active' : ''}`, onClick: () => setActiveMetric('orders'), role: "button", tabIndex: 0 },
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-header" },
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-icon wof-icon--orders" },
                                wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                    wp.element.createElement("path", { d: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" }),
                                    wp.element.createElement("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
                                    wp.element.createElement("path", { d: "M16 10a4 4 0 0 1-8 0" }))),
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-title" }, __('Total Orders (Addons)', 'wooptions-pro')),
                            activeMetric === 'orders' ? (wp.element.createElement("span", { className: "wof-kpi-active-pill" },
                                wp.element.createElement("span", { className: "wof-kpi-active-dot" }),
                                __('Active', 'wooptions-pro'))) : null),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-body" },
                            wp.element.createElement("strong", { className: "wof-bespoke-kpi-num" }, data?.totals?.totalOrders ?? 0)),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-footer" },
                            wp.element.createElement("span", { className: "wof-kpi-hint" }, __('Completed checkouts with options', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: `wof-bespoke-kpi-card wof-kpi--clicks ${activeMetric === 'clicks' ? 'is-active' : ''}`, onClick: () => setActiveMetric('clicks'), role: "button", tabIndex: 0 },
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-header" },
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-icon wof-icon--clicks" },
                                wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                    wp.element.createElement("path", { d: "M15 15l5 5m-5-5l-2.5 7.5L11 14 3.5 11.5 11 9l4 6z" }))),
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-title" }, __('Clicks Count', 'wooptions-pro')),
                            activeMetric === 'clicks' ? (wp.element.createElement("span", { className: "wof-kpi-active-pill" },
                                wp.element.createElement("span", { className: "wof-kpi-active-dot" }),
                                __('Active', 'wooptions-pro'))) : null),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-body" },
                            wp.element.createElement("strong", { className: "wof-bespoke-kpi-num" }, data?.totals?.clicksCount ?? 0)),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-footer" },
                            wp.element.createElement("span", { className: "wof-kpi-hint" }, __('Customer field clicks & inputs', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: `wof-bespoke-kpi-card wof-kpi--cart ${activeMetric === 'addToCart' ? 'is-active' : ''}`, onClick: () => setActiveMetric('addToCart'), role: "button", tabIndex: 0 },
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-header" },
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-icon wof-icon--cart" },
                                wp.element.createElement("svg", { width: "17", height: "17", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                    wp.element.createElement("circle", { cx: "9", cy: "21", r: "1" }),
                                    wp.element.createElement("circle", { cx: "20", cy: "21", r: "1" }),
                                    wp.element.createElement("path", { d: "M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" }))),
                            wp.element.createElement("span", { className: "wof-bespoke-kpi-title" }, __('Add-to-Cart Count', 'wooptions-pro')),
                            activeMetric === 'addToCart' ? (wp.element.createElement("span", { className: "wof-kpi-active-pill" },
                                wp.element.createElement("span", { className: "wof-kpi-active-dot" }),
                                __('Active', 'wooptions-pro'))) : null),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-body" },
                            wp.element.createElement("strong", { className: "wof-bespoke-kpi-num" }, data?.totals?.addToCartCount ?? 0)),
                        wp.element.createElement("div", { className: "wof-bespoke-kpi-footer" },
                            wp.element.createElement("span", { className: "wof-kpi-hint" }, __('Customized configurations carted', 'wooptions-pro'))))),
                wp.element.createElement("section", { className: "wof-panel wof-bespoke-chart-card" },
                    wp.element.createElement("div", { className: "wof-bespoke-chart-header" },
                        wp.element.createElement("div", null,
                            wp.element.createElement("h2", { className: "wof-bespoke-chart-title" }, __('Telemetry Signal Timeline', 'wooptions-pro')),
                            wp.element.createElement("p", { className: "wof-bespoke-chart-subtitle" }, sprintf(__('Daily progression of %s across active storefront option sets.', 'wooptions-pro'), currentTheme.label))),
                        wp.element.createElement("div", { className: "wof-metric-switcher", role: "tablist" }, ['clicks', 'addToCart', 'orders', 'sales'].map((m) => (wp.element.createElement("button", { type: "button", key: m, role: "tab", "aria-selected": activeMetric === m, className: `wof-metric-tab ${activeMetric === m ? 'is-active' : ''}`, onClick: () => setActiveMetric(m) }, metricThemes[m].label))))),
                    wp.element.createElement("div", { className: "wof-bespoke-chart-viewport" },
                        loading ? (wp.element.createElement("div", { className: "wof-bespoke-chart-loading" },
                            wp.element.createElement("span", { className: "wof-loader" }),
                            wp.element.createElement("p", null, __('Calculating telemetry metrics…', 'wooptions-pro')))) : null,
                        wp.element.createElement("div", { className: "wof-bespoke-svg-wrap" },
                            wp.element.createElement("svg", { ref: chartSvgRef, viewBox: `0 0 ${chartWidth} ${chartHeight}`, className: "wof-bespoke-chart-svg", onMouseMove: handleMouseMove, onMouseLeave: handleMouseLeave },
                                wp.element.createElement("defs", null,
                                    wp.element.createElement("linearGradient", { id: "wofBespokeGrad", x1: "0", y1: "0", x2: "0", y2: "1" },
                                        wp.element.createElement("stop", { offset: "0%", stopColor: currentTheme.color, stopOpacity: "0.16" }),
                                        wp.element.createElement("stop", { offset: "80%", stopColor: currentTheme.color, stopOpacity: "0.02" }),
                                        wp.element.createElement("stop", { offset: "100%", stopColor: currentTheme.color, stopOpacity: "0" }))),
                                yTicks.map((tick, idx) => (wp.element.createElement("g", { key: `ytick-${idx}`, className: "wof-chart-tick-group" },
                                    wp.element.createElement("line", { x1: padLeft, y1: tick.y, x2: chartWidth - padRight, y2: tick.y, stroke: "#f1f5f9", strokeDasharray: "4 4", strokeWidth: "1" }),
                                    wp.element.createElement("text", { x: padLeft - 12, y: tick.y + 4, textAnchor: "end", fontSize: "11", fill: "#94a3b8", fontWeight: "400", fontFamily: "system-ui, sans-serif" }, tick.label)))),
                                wp.element.createElement("line", { x1: padLeft, y1: baselineY, x2: chartWidth - padRight, y2: baselineY, stroke: "#e2e8f0", strokeWidth: "1" }),
                                xLabels.map((xl) => (wp.element.createElement("text", { key: `xlabel-${xl.idx}`, x: xl.x, y: baselineY + 22, textAnchor: "middle", fontSize: "11", fill: "#64748b", fontWeight: "450", fontFamily: "system-ui, sans-serif" }, xl.label))),
                                areaD ? wp.element.createElement("path", { d: areaD, fill: "url(#wofBespokeGrad)" }) : null,
                                strokeD ? (wp.element.createElement("path", { d: strokeD, fill: "none", stroke: currentTheme.color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })) : null,
                                hoveredCoord && hoveredPoint ? (wp.element.createElement("g", { className: "wof-chart-hover-indicator" },
                                    wp.element.createElement("line", { x1: hoveredCoord.x, y1: padTop, x2: hoveredCoord.x, y2: baselineY, stroke: currentTheme.color, strokeDasharray: "3 3", strokeWidth: "1.2", opacity: "0.7" }),
                                    wp.element.createElement("circle", { cx: hoveredCoord.x, cy: hoveredCoord.y, r: "5.5", fill: currentTheme.color, stroke: "#ffffff", strokeWidth: "2.5" }))) : null),
                            hoveredCoord && hoveredPoint ? (wp.element.createElement("div", { className: "wof-bespoke-tooltip", style: {
                                    left: `${(hoveredCoord.x / chartWidth) * 100}%`,
                                    top: `${(hoveredCoord.y / chartHeight) * 100}%`,
                                } },
                                wp.element.createElement("div", { className: "wof-bespoke-tooltip__head" },
                                    wp.element.createElement("span", { className: "wof-bespoke-tooltip__calendar" }, "\uD83D\uDCC5"),
                                    wp.element.createElement("span", null,
                                        hoveredPoint.label,
                                        " (",
                                        hoveredPoint.date,
                                        ")")),
                                wp.element.createElement("div", { className: "wof-bespoke-tooltip__highlight" },
                                    wp.element.createElement("span", null,
                                        currentTheme.label,
                                        ":"),
                                    wp.element.createElement("strong", null, activeMetric === 'sales'
                                        ? formatMoney(hoveredPoint.sales, currencySymbol, currencyPosition)
                                        : activeMetric === 'orders'
                                            ? hoveredPoint.orders
                                            : activeMetric === 'addToCart'
                                                ? hoveredPoint.addToCart
                                                : hoveredPoint.clicks)),
                                wp.element.createElement("div", { className: "wof-bespoke-tooltip__grid" },
                                    wp.element.createElement("div", { className: "wof-tt-row" },
                                        wp.element.createElement("span", { className: "wof-tt-dot wof-tt-dot--clicks" }),
                                        wp.element.createElement("span", null,
                                            __('Clicks', 'wooptions-pro'),
                                            ":"),
                                        wp.element.createElement("b", null, hoveredPoint.clicks)),
                                    wp.element.createElement("div", { className: "wof-tt-row" },
                                        wp.element.createElement("span", { className: "wof-tt-dot wof-tt-dot--cart" }),
                                        wp.element.createElement("span", null,
                                            __('Add to Cart', 'wooptions-pro'),
                                            ":"),
                                        wp.element.createElement("b", null, hoveredPoint.addToCart)),
                                    wp.element.createElement("div", { className: "wof-tt-row" },
                                        wp.element.createElement("span", { className: "wof-tt-dot wof-tt-dot--orders" }),
                                        wp.element.createElement("span", null,
                                            __('Orders', 'wooptions-pro'),
                                            ":"),
                                        wp.element.createElement("b", null, hoveredPoint.orders)),
                                    wp.element.createElement("div", { className: "wof-tt-row" },
                                        wp.element.createElement("span", { className: "wof-tt-dot wof-tt-dot--sales" }),
                                        wp.element.createElement("span", null,
                                            __('Revenue', 'wooptions-pro'),
                                            ":"),
                                        wp.element.createElement("b", null, formatMoney(hoveredPoint.sales, currencySymbol, currencyPosition)))))) : null))),
                wp.element.createElement("section", { className: "wof-panel wof-bespoke-table-card" },
                    wp.element.createElement("div", { className: "wof-bespoke-table-header" },
                        wp.element.createElement("div", null,
                            wp.element.createElement("h2", { className: "wof-bespoke-table-title" }, __('Option Sets Performance', 'wooptions-pro')),
                            wp.element.createElement("p", { className: "wof-bespoke-table-desc" }, __('Granular conversion rates and order contributions per option set.', 'wooptions-pro'))),
                        wp.element.createElement("div", { className: "wof-bespoke-table-tools" },
                            wp.element.createElement("div", { className: "wof-table-search-box" },
                                wp.element.createElement("span", { className: "wof-search-icon", "aria-hidden": "true" },
                                    wp.element.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" },
                                        wp.element.createElement("circle", { cx: "11", cy: "11", r: "8" }),
                                        wp.element.createElement("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }))),
                                wp.element.createElement("input", { type: "search", value: tableSearch, onChange: (e) => setTableSearch(e.target.value), placeholder: __('Search option sets…', 'wooptions-pro'), className: "wof-table-search-input" })),
                            wp.element.createElement("span", { className: "wof-count-pill" },
                                totalTableItems,
                                " ",
                                totalTableItems === 1 ? __('Set', 'wooptions-pro') : __('Sets', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: "wof-bespoke-table-wrap" },
                        wp.element.createElement("table", { className: "wof-analytics-table wof-analytics-table--bespoke" },
                            wp.element.createElement("thead", null,
                                wp.element.createElement("tr", null,
                                    wp.element.createElement("th", { className: "wof-col-set" }, __('OPTION SET', 'wooptions-pro')),
                                    wp.element.createElement("th", { className: "wof-col-applied" }, __('SCOPE', 'wooptions-pro')),
                                    wp.element.createElement("th", { className: "wof-col-clickrate" }, __('CLICK RATE', 'wooptions-pro')),
                                    wp.element.createElement("th", { className: "wof-col-cartrate" }, __('CART CONVERSION', 'wooptions-pro')),
                                    wp.element.createElement("th", { className: "wof-col-sales" }, __('ADDON REVENUE', 'wooptions-pro')),
                                    wp.element.createElement("th", { className: "wof-col-actions" }, __('ACTION', 'wooptions-pro')))),
                            wp.element.createElement("tbody", null, paginatedOptionSets.length > 0 ? (paginatedOptionSets.map((set) => (wp.element.createElement("tr", { key: set.uuid, className: "wof-table-row" },
                                wp.element.createElement("td", { className: "wof-cell-set" },
                                    wp.element.createElement("div", { className: "wof-set-identity" },
                                        wp.element.createElement("span", { className: "wof-set-icon" },
                                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "screenoptions" })),
                                        wp.element.createElement("div", { className: "wof-set-meta" },
                                            wp.element.createElement("button", { type: "button", className: "wof-set-name-link", onClick: () => props?.navigate?.(`builder/${set.uuid}`), title: __('Edit in Option Set Builder', 'wooptions-pro') }, set.name),
                                            wp.element.createElement("span", { className: "wof-set-sub" },
                                                "ID: ",
                                                set.id,
                                                " \u2022 ",
                                                set.uuid.slice(0, 8),
                                                "\u2026")))),
                                wp.element.createElement("td", { className: "wof-cell-applied" },
                                    wp.element.createElement("span", { className: "wof-scope-pill" },
                                        set.thumbnailUrl ? (wp.element.createElement("img", { src: set.thumbnailUrl, alt: "", className: "wof-scope-thumb" })) : (wp.element.createElement("span", { className: "wof-scope-glyph-fallback", "aria-hidden": "true" },
                                            wp.element.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                                                wp.element.createElement("path", { d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" }),
                                                wp.element.createElement("polyline", { points: "3.27 6.96 12 12.01 20.73 6.96" }),
                                                wp.element.createElement("line", { x1: "12", y1: "22.08", x2: "12", y2: "12" })))),
                                        wp.element.createElement("span", null, set.appliedText))),
                                wp.element.createElement("td", { className: "wof-cell-clickrate" },
                                    wp.element.createElement("div", { className: "wof-rate-meter" },
                                        wp.element.createElement("div", { className: "wof-rate-bar-track" },
                                            wp.element.createElement("div", { className: "wof-rate-bar-fill wof-fill--clicks", style: { width: `${Math.min(100, Math.max(0, set.clickRate))}%` } })),
                                        wp.element.createElement("span", { className: "wof-rate-text" },
                                            set.clickRate,
                                            "%"))),
                                wp.element.createElement("td", { className: "wof-cell-cartrate" },
                                    wp.element.createElement("div", { className: "wof-rate-meter" },
                                        wp.element.createElement("div", { className: "wof-rate-bar-track" },
                                            wp.element.createElement("div", { className: "wof-rate-bar-fill wof-fill--cart", style: { width: `${Math.min(100, Math.max(0, set.addToCartRate))}%` } })),
                                        wp.element.createElement("span", { className: "wof-rate-text" },
                                            set.addToCartRate,
                                            "%"))),
                                wp.element.createElement("td", { className: "wof-cell-sales" },
                                    wp.element.createElement("div", { className: "wof-sales-badge" },
                                        wp.element.createElement("strong", { className: "wof-sales-amount" }, formatMoney(set.sales, currencySymbol, currencyPosition)),
                                        wp.element.createElement("span", { className: "wof-sales-orders" },
                                            set.orders,
                                            " ",
                                            set.orders === 1 ? __('order', 'wooptions-pro') : __('orders', 'wooptions-pro')))),
                                wp.element.createElement("td", { className: "wof-cell-actions" },
                                    wp.element.createElement("button", { type: "button", className: "wof-table-action-btn", onClick: () => props?.navigate?.(`builder/${set.uuid}`) },
                                        wp.element.createElement("span", null, __('Edit', 'wooptions-pro')),
                                        wp.element.createElement("span", { "aria-hidden": "true" }, "\u2192"))))))) : (wp.element.createElement("tr", null,
                                wp.element.createElement("td", { colSpan: 6, className: "wof-table-empty-row" }, loading
                                    ? __('Calculating performance metrics…', 'wooptions-pro')
                                    : tableSearch
                                        ? __('No option sets match your search filter.', 'wooptions-pro')
                                        : __('No option set activity recorded for this period.', 'wooptions-pro'))))))),
                    totalTableItems > 5 ? (wp.element.createElement("div", { className: "wof-table-pagination" },
                        wp.element.createElement("div", { className: "wof-table-pagination__info" }, sprintf(__('Showing %1$d–%2$d of %3$d option sets', 'wooptions-pro'), startItem, endItem, totalTableItems)),
                        wp.element.createElement("div", { className: "wof-table-pagination__controls" },
                            wp.element.createElement("button", { type: "button", className: "wof-page-nav-btn", disabled: tablePage <= 1, onClick: () => setTablePage(Math.max(1, tablePage - 1)) },
                                wp.element.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("polyline", { points: "15 18 9 12 15 6" })),
                                wp.element.createElement("span", null, __('Previous', 'wooptions-pro'))),
                            wp.element.createElement("div", { className: "wof-page-number-list" }, Array.from({ length: totalTablePages }, (_, i) => i + 1).map((p) => (wp.element.createElement("button", { type: "button", key: p, className: `wof-page-num-btn ${tablePage === p ? 'is-active' : ''}`, onClick: () => setTablePage(p) }, p)))),
                            wp.element.createElement("button", { type: "button", className: "wof-page-nav-btn", disabled: tablePage >= totalTablePages, onClick: () => setTablePage(Math.min(totalTablePages, tablePage + 1)) },
                                wp.element.createElement("span", null, __('Next', 'wooptions-pro')),
                                wp.element.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("polyline", { points: "9 18 15 12 9 6" })))))) : totalTableItems > 0 ? (wp.element.createElement("div", { className: "wof-table-pagination wof-table-pagination--compact" },
                        wp.element.createElement("span", { className: "wof-table-pagination__info" }, sprintf(__('Displaying all %d option sets', 'wooptions-pro'), totalTableItems)))) : null)));
        }
        Pages.Analytics = Analytics;
    })(Pages = WooOptionsPro.Pages || (WooOptionsPro.Pages = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Pages;
    (function (Pages) {
        const { Button, SelectControl, TextControl, ToggleControl } = wp.components;
        const { __ } = wp.i18n;
        const { useEffect, useState } = wp.element;
        function CustomFontsManager(props) {
            const [name, setName] = useState('');
            const [weight, setWeight] = useState('400');
            const [style, setStyle] = useState('normal');
            const [files, setFiles] = useState({});
            // Inject @font-face rules into DOM for instant live preview
            useEffect(() => {
                let styleTag = document.getElementById('wof-custom-fonts-live');
                if (!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = 'wof-custom-fonts-live';
                    document.head.appendChild(styleTag);
                }
                const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
                const fixUrl = (u) => {
                    if (!u || typeof u !== 'string')
                        return '';
                    return isHttps ? u.replace(/^http:\/\//i, 'https://') : u;
                };
                let css = '';
                props.fonts.forEach((f) => {
                    if (!f.files)
                        return;
                    const srcs = [];
                    if (f.files.woff2)
                        srcs.push(`url('${fixUrl(f.files.woff2)}') format('woff2')`);
                    if (f.files.woff)
                        srcs.push(`url('${fixUrl(f.files.woff)}') format('woff')`);
                    if (f.files.ttf)
                        srcs.push(`url('${fixUrl(f.files.ttf)}') format('truetype')`);
                    if (f.files.otf)
                        srcs.push(`url('${fixUrl(f.files.otf)}') format('opentype')`);
                    if (srcs.length > 0) {
                        const clean = (f.name || '').replace(/['"]/g, '');
                        css += `@font-face { font-family: '${clean}'; src: ${srcs.join(', ')}; font-weight: ${f.weight || '400'}; font-style: ${f.style || 'normal'}; font-display: swap; }\n`;
                    }
                });
                if (name && Object.keys(files).length > 0) {
                    const srcs = [];
                    if (files.woff2)
                        srcs.push(`url('${fixUrl(files.woff2)}') format('woff2')`);
                    if (files.woff)
                        srcs.push(`url('${fixUrl(files.woff)}') format('woff')`);
                    if (files.ttf)
                        srcs.push(`url('${fixUrl(files.ttf)}') format('truetype')`);
                    if (files.otf)
                        srcs.push(`url('${fixUrl(files.otf)}') format('opentype')`);
                    if (srcs.length > 0) {
                        const clean = name.replace(/['"]/g, '');
                        css += `@font-face { font-family: '${clean}'; src: ${srcs.join(', ')}; font-weight: ${weight}; font-style: ${style}; font-display: swap; }\n`;
                    }
                }
                styleTag.textContent = css;
            }, [props.fonts, name, files, weight, style]);
            const licenseInfo = window.WooOptionsProAdmin?.license;
            const canConfigure = licenseInfo?.canConfigure !== false && (licenseInfo?.active === true || licenseInfo?.canConfigure === true);
            const openMediaUploader = () => {
                if (!canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to manage custom fonts.', 'wooptions-pro'));
                    return;
                }
                if (!wp.media) {
                    WooOptionsPro.Toast.error(__('WordPress Media Library is unavailable.', 'wooptions-pro'));
                    return;
                }
                const frame = wp.media({
                    title: __('Select or Upload Font File (.woff2, .woff, .ttf, .otf)', 'wooptions-pro'),
                    button: { text: __('Use this font file', 'wooptions-pro') },
                    multiple: true,
                });
                frame.on('select', () => {
                    const selection = frame.state().get('selection');
                    const nextFiles = { ...files };
                    let detectedName = name;
                    const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
                    selection.each((attachmentModel) => {
                        const att = attachmentModel.toJSON();
                        const rawUrl = String(att.url || '');
                        const url = isHttps ? rawUrl.replace(/^http:\/\//i, 'https://') : rawUrl;
                        const filename = String(att.filename || att.title || '');
                        const ext = filename.split('.').pop()?.toLowerCase() || '';
                        if (['woff2', 'woff', 'ttf', 'otf'].includes(ext)) {
                            nextFiles[ext] = url;
                            if (!detectedName) {
                                const base = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
                                detectedName = base.charAt(0).toUpperCase() + base.slice(1);
                            }
                        }
                        else {
                            WooOptionsPro.Toast.error(__('Please select a valid font file: .woff2, .woff, .ttf, or .otf.', 'wooptions-pro'));
                        }
                    });
                    setFiles(nextFiles);
                    if (detectedName && !name) {
                        setName(detectedName);
                    }
                });
                frame.open();
            };
            const addFont = () => {
                if (!canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to add custom fonts.', 'wooptions-pro'));
                    return;
                }
                const trimmedName = name.trim();
                if (!trimmedName) {
                    WooOptionsPro.Toast.error(__('Please enter a font name.', 'wooptions-pro'));
                    return;
                }
                if (Object.keys(files).length === 0) {
                    WooOptionsPro.Toast.error(__('Please upload at least one font file (.woff2, .woff, .ttf, .otf).', 'wooptions-pro'));
                    return;
                }
                const id = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                const newFont = {
                    id,
                    name: trimmedName,
                    family: `'${trimmedName}', sans-serif`,
                    category: 'Custom',
                    source: 'custom',
                    weight,
                    style,
                    files,
                };
                const nextFonts = [...props.fonts, newFont];
                props.onChange(nextFonts);
                WooOptionsPro.injectCustomFontsCss(nextFonts);
                setName('');
                setWeight('400');
                setStyle('normal');
                setFiles({});
                WooOptionsPro.Toast.success(__('Custom font added! Remember to click "Save settings" at top right to finalize.', 'wooptions-pro'));
            };
            const removeFont = (index) => {
                if (!canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to remove custom fonts.', 'wooptions-pro'));
                    return;
                }
                if (window.confirm(__('Are you sure you want to remove this custom font?', 'wooptions-pro'))) {
                    const next = props.fonts.filter((_, i) => i !== index);
                    props.onChange(next);
                    WooOptionsPro.injectCustomFontsCss(next);
                    WooOptionsPro.Toast.success(__('Custom font removed. Click "Save settings" to finalize.', 'wooptions-pro'));
                }
            };
            return (wp.element.createElement("section", { "aria-labelledby": "wof-custom-fonts-heading" },
                wp.element.createElement("div", { className: "wof-settings-panel__header" },
                    wp.element.createElement("h2", { id: "wof-custom-fonts-heading", className: "wof-settings-panel__title" }, __('Custom Web Fonts', 'wooptions-pro')),
                    wp.element.createElement("p", { className: "wof-settings-panel__desc" }, __('Upload brand and custom font files (.woff2, .woff, .ttf, .otf). Uploaded fonts are automatically available in all Font Choice fields across your products.', 'wooptions-pro'))),
                wp.element.createElement("div", { style: { marginBottom: '32px' } },
                    wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' } },
                        wp.element.createElement("h3", { style: { margin: 0, fontSize: '15px', fontWeight: 600, color: '#1e293b' } },
                            __('Installed Custom Fonts', 'wooptions-pro'),
                            " (",
                            props.fonts.length,
                            ")")),
                    props.fonts.length === 0 ? (wp.element.createElement("div", { style: { padding: '36px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' } },
                        wp.element.createElement("div", { style: { fontSize: '32px', marginBottom: '10px', color: '#94a3b8' } },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "editor-textcolor" })),
                        wp.element.createElement("strong", { style: { display: 'block', fontSize: '14px', color: '#334155', marginBottom: '4px' } }, __('No custom fonts uploaded yet', 'wooptions-pro')),
                        wp.element.createElement("p", { style: { margin: 0, fontSize: '13px', color: '#64748b' } }, __('Use the form below to upload your .woff2, .woff, .ttf, or .otf font files.', 'wooptions-pro')))) : (wp.element.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: '14px' } }, props.fonts.map((font, index) => (wp.element.createElement("div", { key: font.id || index, style: {
                            background: '#ffffff',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            padding: '18px 20px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        } },
                        wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } },
                            wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                                wp.element.createElement("strong", { style: { fontSize: '16px', color: '#0f172a' } }, font.name),
                                wp.element.createElement("span", { style: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569' } }, font.category || 'Custom'),
                                wp.element.createElement("span", { style: { fontSize: '11px', color: '#64748b' } },
                                    "Weight: ",
                                    font.weight || '400',
                                    " \u00B7 Style: ",
                                    font.style || 'normal')),
                            wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                                Object.keys(font.files || {}).map((ext) => (wp.element.createElement("span", { key: ext, style: {
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        padding: '3px 7px',
                                        borderRadius: '4px',
                                        background: '#eff6ff',
                                        color: '#2563eb',
                                        border: '1px solid #dbeafe',
                                    } }, ext))),
                                wp.element.createElement(Button, { variant: "tertiary", isDestructive: true, onClick: () => removeFont(index), style: { marginLeft: '12px' } }, __('Delete', 'wooptions-pro')))),
                        wp.element.createElement("div", { style: {
                                fontFamily: font.family,
                                fontSize: '22px',
                                color: '#1e293b',
                                padding: '16px',
                                background: '#f8fafc',
                                borderRadius: '8px',
                                border: '1px solid #f1f5f9',
                                lineHeight: 1.4,
                                wordBreak: 'break-word',
                            } }, "The quick brown fox jumps over the lazy dog. 1234567890"))))))),
                wp.element.createElement("div", { style: { background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' } },
                    wp.element.createElement("h3", { style: { margin: '0 0 6px 0', fontSize: '16px', fontWeight: 600, color: '#0f172a' } }, __('Upload New Custom Font', 'wooptions-pro')),
                    wp.element.createElement("p", { style: { margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' } }, __('Upload font files in .woff2 (recommended), .woff, .ttf, or .otf formats.', 'wooptions-pro')),
                    wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '18px' } },
                        wp.element.createElement(TextControl, { label: __('Font Name', 'wooptions-pro'), placeholder: __('e.g. Brandon Grotesque', 'wooptions-pro'), value: name, onChange: setName }),
                        wp.element.createElement(SelectControl, { label: __('Font Weight', 'wooptions-pro'), value: weight, options: [
                                { label: '100 - Thin', value: '100' },
                                { label: '200 - Extra Light', value: '200' },
                                { label: '300 - Light', value: '300' },
                                { label: '400 - Regular (Normal)', value: '400' },
                                { label: '500 - Medium', value: '500' },
                                { label: '600 - Semi Bold', value: '600' },
                                { label: '700 - Bold', value: '700' },
                                { label: '800 - Extra Bold', value: '800' },
                                { label: '900 - Black', value: '900' },
                            ], onChange: setWeight }),
                        wp.element.createElement(SelectControl, { label: __('Font Style', 'wooptions-pro'), value: style, options: [
                                { label: 'Normal', value: 'normal' },
                                { label: 'Italic', value: 'italic' },
                            ], onChange: (val) => setStyle(val) })),
                    wp.element.createElement("div", { style: { marginBottom: '20px' } },
                        wp.element.createElement("label", { style: { display: 'block', fontWeight: 600, fontSize: '13px', color: '#1e293b', marginBottom: '8px' } }, __('Font Files (.woff2, .woff, .ttf, .otf)', 'wooptions-pro')),
                        wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' } },
                            wp.element.createElement(Button, { variant: "secondary", onClick: openMediaUploader, style: { display: 'inline-flex', alignItems: 'center', gap: '6px' } },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "upload" }),
                                __('Select / Upload Font Files…', 'wooptions-pro')),
                            wp.element.createElement("span", { style: { fontSize: '12px', color: '#64748b' } }, __('You can select multiple formats or upload .woff2 for highest web efficiency.', 'wooptions-pro'))),
                        Object.keys(files).length > 0 ? (wp.element.createElement("div", { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' } }, Object.entries(files).map(([ext, url]) => (wp.element.createElement("div", { key: ext, style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px',
                            } },
                            wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                                wp.element.createElement("span", { style: { fontWeight: 700, textTransform: 'uppercase', color: '#2563eb', padding: '2px 6px', background: '#eff6ff', borderRadius: '4px' } }, ext),
                                wp.element.createElement("span", { style: { color: '#475569', wordBreak: 'break-all' } }, url)),
                            wp.element.createElement("button", { type: "button", onClick: () => {
                                    const copy = { ...files };
                                    delete copy[ext];
                                    setFiles(copy);
                                }, style: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }, title: __('Remove this file', 'wooptions-pro') }, "\u00D7")))))) : null),
                    wp.element.createElement(Button, { variant: "primary", onClick: addFont, disabled: !name.trim() || Object.keys(files).length === 0 }, __('+ Add Custom Font to List', 'wooptions-pro')))));
        }
        function Settings() {
            const [settings, setSettings] = useState(null);
            const [activeTab, setActiveTab] = useState('cleanup');
            const [saving, setSaving] = useState(false);
            useEffect(() => {
                WooOptionsPro.Api.getSettings().then(setSettings);
            }, []);
            if (!settings) {
                return (wp.element.createElement("div", { className: "wof-page" },
                    wp.element.createElement(WooOptionsPro.Components.Loading, null)));
            }
            const licenseInfo = window.WooOptionsProAdmin?.license;
            const canConfigure = licenseInfo?.canConfigure !== false && (licenseInfo?.active === true || licenseInfo?.canConfigure === true);
            const set = (key, value) => {
                if (!canConfigure)
                    return;
                setSettings({ ...settings, [key]: value });
            };
            const save = async () => {
                if (!canConfigure) {
                    WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to save settings.', 'wooptions-pro'));
                    return;
                }
                setSaving(true);
                try {
                    const saved = await WooOptionsPro.Api.saveSettings(settings);
                    setSettings(saved);
                    if (Array.isArray(saved.custom_fonts)) {
                        WooOptionsPro.injectCustomFontsCss(saved.custom_fonts);
                        const otherFonts = (window.WooOptionsProAdmin.fontCatalog || []).filter((f) => f.source !== 'custom');
                        window.WooOptionsProAdmin.fontCatalog = [...saved.custom_fonts, ...otherFonts];
                    }
                    WooOptionsPro.Toast.success(__('Settings saved successfully.', 'wooptions-pro'));
                }
                catch (err) {
                    WooOptionsPro.Toast.error(WooOptionsPro.Utils.errorMessage(err));
                }
                finally {
                    setSaving(false);
                }
            };
            const tabs = [
                {
                    id: 'cleanup',
                    label: __('Upload Cleanup', 'wooptions-pro'),
                    subtitle: __('Storage & file purging', 'wooptions-pro'),
                    icon: 'upload',
                },
                {
                    id: 'custom_fonts',
                    label: __('Custom Fonts', 'wooptions-pro'),
                    subtitle: __('Upload & manage webfonts', 'wooptions-pro'),
                    icon: 'editor-textcolor',
                },
                {
                    id: 'other',
                    label: __('Other Settings', 'wooptions-pro'),
                    subtitle: __('Labels & cart visibility', 'wooptions-pro'),
                    icon: 'admin-appearance',
                },
                {
                    id: 'general',
                    label: __('General & Limits', 'wooptions-pro'),
                    subtitle: __('API limits & features', 'wooptions-pro'),
                    icon: 'admin-settings',
                },
            ];
            return (wp.element.createElement("div", { className: "wof-page" },
                wp.element.createElement(WooOptionsPro.Components.PageHeader, { eyebrow: __('Operational defaults', 'wooptions-pro'), title: __('Settings', 'wooptions-pro'), description: __('Control limits, file retention, summary labels, and storefront visibility without editing code.', 'wooptions-pro'), actions: wp.element.createElement(Button, { variant: "primary", isBusy: saving, disabled: !canConfigure || saving, onClick: save, title: !canConfigure ? __('Activate your license to save settings', 'wooptions-pro') : undefined }, saving ? __('Saving…', 'wooptions-pro') : __('Save settings', 'wooptions-pro')) }),
                wp.element.createElement("div", { className: "wof-settings-layout" },
                    wp.element.createElement("nav", { className: "wof-settings-nav", "aria-label": __('Settings navigation', 'wooptions-pro') }, tabs.map((tab) => (wp.element.createElement("button", { type: "button", key: tab.id, className: WooOptionsPro.Utils.classNames('wof-settings-nav-item', activeTab === tab.id && 'is-active'), onClick: () => setActiveTab(tab.id) },
                        wp.element.createElement("span", { className: "wof-settings-nav-item__icon" },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: tab.icon })),
                        wp.element.createElement("span", { className: "wof-settings-nav-item__text" },
                            wp.element.createElement("span", { className: "wof-settings-nav-item__title" }, tab.label),
                            wp.element.createElement("span", { className: "wof-settings-nav-item__subtitle" }, tab.subtitle)))))),
                    wp.element.createElement("main", { className: "wof-settings-panel" },
                        !canConfigure && (wp.element.createElement("div", { className: "wof-settings-readonly-banner", style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                                padding: '12px 18px',
                                marginBottom: '20px',
                                borderRadius: '8px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#1e40af',
                                fontSize: '13px',
                                fontWeight: 500,
                            } },
                            wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                                wp.element.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
                                    wp.element.createElement("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })),
                                wp.element.createElement("span", null, __('WooOptions Pro license is not active. Settings are in read-only preview mode.', 'wooptions-pro'))),
                            wp.element.createElement("button", { type: "button", style: {
                                    background: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 14px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                }, onClick: () => { window.location.hash = '#license'; } }, __('Activate License', 'wooptions-pro')))),
                        wp.element.createElement("fieldset", { disabled: !canConfigure, style: { border: 0, padding: 0, margin: 0, minWidth: 0 } },
                            activeTab === 'cleanup' && (wp.element.createElement("section", { "aria-labelledby": "wof-cleanup-heading" },
                                wp.element.createElement("div", { className: "wof-settings-panel__header" },
                                    wp.element.createElement("h2", { id: "wof-cleanup-heading", className: "wof-settings-panel__title" }, __('Cleanup Upload Field Files', 'wooptions-pro')),
                                    wp.element.createElement("p", { className: "wof-settings-panel__desc" }, __('Clean up all files uploaded through this field to free storage and remove unused data.', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wof-settings-rows" },
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Files uploaded but not in order', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Removes unplaced temporary uploads after a specified number of days (0 to disable).', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement("div", { className: "wof-setting-input-wrap" },
                                                wp.element.createElement(TextControl, { hideLabelFromVision: true, label: __('Days to retain unplaced uploads', 'wooptions-pro'), type: "number", min: "0", value: String(settings.cleanup_unplaced_upload_days ?? 0), onChange: (val) => set('cleanup_unplaced_upload_days', Math.max(0, parseInt(val, 10) || 0)) }),
                                                wp.element.createElement("span", { className: "wof-setting-input-unit" }, __('days', 'wooptions-pro'))))),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Files uploaded and placed in order', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Removes uploads attached to placed orders after a specified number of days (0 to disable).', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement("div", { className: "wof-setting-input-wrap" },
                                                wp.element.createElement(TextControl, { hideLabelFromVision: true, label: __('Days to retain placed uploads', 'wooptions-pro'), type: "number", min: "0", value: String(settings.cleanup_placed_upload_days ?? 0), onChange: (val) => set('cleanup_placed_upload_days', Math.max(0, parseInt(val, 10) || 0)) }),
                                                wp.element.createElement("span", { className: "wof-setting-input-unit" }, __('days', 'wooptions-pro'))))),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Files uploaded in completed orders', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Removes uploads once their corresponding order is marked Completed (0 to disable).', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement("div", { className: "wof-setting-input-wrap" },
                                                wp.element.createElement(TextControl, { hideLabelFromVision: true, label: __('Days to retain completed uploads', 'wooptions-pro'), type: "number", min: "0", value: String(settings.cleanup_completed_upload_days ?? 0), onChange: (val) => set('cleanup_completed_upload_days', Math.max(0, parseInt(val, 10) || 0)) }),
                                                wp.element.createElement("span", { className: "wof-setting-input-unit" }, __('days', 'wooptions-pro')))))))),
                            activeTab === 'custom_fonts' && (wp.element.createElement(CustomFontsManager, { fonts: settings.custom_fonts || [], onChange: (custom_fonts) => set('custom_fonts', custom_fonts) })),
                            activeTab === 'other' && (wp.element.createElement("section", { "aria-labelledby": "wof-other-heading" },
                                wp.element.createElement("div", { className: "wof-settings-panel__header" },
                                    wp.element.createElement("h2", { id: "wof-other-heading", className: "wof-settings-panel__title" }, __('Other Settings', 'wooptions-pro')),
                                    wp.element.createElement("p", { className: "wof-settings-panel__desc" }, __('Configure summary labels, storefront display text, and cart/checkout visibility.', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wof-settings-rows" },
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Addons Total Price Label', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Customize the total price label shown in the storefront configurator summary.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement(ToggleControl, { label: __('Enable Addons Price Total Text In Product Page', 'wooptions-pro'), checked: Boolean(settings.enable_addons_total_text), onChange: (checked) => set('enable_addons_total_text', checked) }),
                                            settings.enable_addons_total_text ? (wp.element.createElement("div", { className: "wof-setting-row__subfield" },
                                                wp.element.createElement(TextControl, { label: __('TOTAL PRICE TEXT', 'wooptions-pro'), value: settings.addons_total_text ?? 'Total Price', placeholder: "Total Price", help: __('Change your Total Price / Configured price text here.', 'wooptions-pro'), onChange: (val) => set('addons_total_text', val) }))) : null)),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Summary Status Prompt', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Customize the ready state prompt shown in the summary before selection changes.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement(ToggleControl, { label: __('Enable Summary Status Text In Product Page', 'wooptions-pro'), checked: Boolean(settings.enable_summary_status_text), onChange: (checked) => set('enable_summary_status_text', checked) }),
                                            settings.enable_summary_status_text ? (wp.element.createElement("div", { className: "wof-setting-row__subfield" },
                                                wp.element.createElement(TextControl, { label: __('SUMMARY STATUS TEXT', 'wooptions-pro'), value: settings.summary_status_text ?? 'Ready for your choices', placeholder: "Ready for your choices", help: __('Change your summary status prompt text here.', 'wooptions-pro'), onChange: (val) => set('summary_status_text', val) }))) : null)),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Summary Notice Message', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Customize the server-confirmed disclaimer text beneath the summary price.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement(ToggleControl, { label: __('Enable Summary Notice Text In Product Page', 'wooptions-pro'), checked: Boolean(settings.enable_summary_notice_text), onChange: (checked) => set('enable_summary_notice_text', checked) }),
                                            settings.enable_summary_notice_text ? (wp.element.createElement("div", { className: "wof-setting-row__subfield" },
                                                wp.element.createElement(TextControl, { label: __('SUMMARY NOTICE TEXT', 'wooptions-pro'), value: settings.summary_notice_text ?? 'Server-confirmed total, before shipping.', placeholder: "Server-confirmed total, before shipping.", help: __('Change your summary disclaimer text here.', 'wooptions-pro'), onChange: (val) => set('summary_notice_text', val) }))) : null)),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Cart Page Display', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Control whether addon option details are shown under cart line items.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement(ToggleControl, { label: __('Hide addon fields in Cart Page', 'wooptions-pro'), checked: Boolean(settings.hide_addon_in_cart), onChange: (checked) => set('hide_addon_in_cart', checked) }))),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Checkout Page Display', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Control whether addon option details are shown on checkout and order review tables.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement(ToggleControl, { label: __('Hide addon fields in Checkout Page', 'wooptions-pro'), checked: Boolean(settings.hide_addon_in_checkout), onChange: (checked) => set('hide_addon_in_checkout', checked) })))))),
                            activeTab === 'general' && (wp.element.createElement("section", { "aria-labelledby": "wof-general-heading" },
                                wp.element.createElement("div", { className: "wof-settings-panel__header" },
                                    wp.element.createElement("h2", { id: "wof-general-heading", className: "wof-settings-panel__title" }, __('Operational Defaults & Limits', 'wooptions-pro')),
                                    wp.element.createElement("p", { className: "wof-settings-panel__desc" }, __('Configure security limits and optional capabilities across your catalog.', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wof-settings-rows" },
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Quote requests per minute', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Maximum pricing quote calculations allowed per visitor per minute.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement("div", { className: "wof-setting-input-wrap" },
                                                wp.element.createElement(TextControl, { hideLabelFromVision: true, label: __('Quote requests per minute', 'wooptions-pro'), type: "number", value: String(settings.quote_rate_limit_per_minute ?? 60), onChange: (value) => set('quote_rate_limit_per_minute', Number(value)) }),
                                                wp.element.createElement("span", { className: "wof-setting-input-unit" }, __('requests / min', 'wooptions-pro'))))),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Upload size limit', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Maximum allowed file size in megabytes for customer upload fields.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" },
                                            wp.element.createElement("div", { className: "wof-setting-input-wrap" },
                                                wp.element.createElement(TextControl, { hideLabelFromVision: true, label: __('Upload size limit (MB)', 'wooptions-pro'), type: "number", value: String(settings.upload_max_mb ?? 10), onChange: (value) => set('upload_max_mb', Number(value)) }),
                                                wp.element.createElement("span", { className: "wof-setting-input-unit" }, __('MB', 'wooptions-pro'))))),
                                    wp.element.createElement("div", { className: "wof-setting-row" },
                                        wp.element.createElement("div", { className: "wof-setting-row__info" },
                                            wp.element.createElement("strong", { className: "wof-setting-row__title" }, __('Features & Telemetry', 'wooptions-pro')),
                                            wp.element.createElement("p", { className: "wof-setting-row__desc" }, __('Enable or disable global behavior toggles and analytics.', 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: "wof-setting-row__control" }, Object.entries(settings)
                                            .filter(([key, value]) => typeof value === 'boolean' && !['enable_addons_total_text', 'enable_summary_status_text', 'enable_summary_notice_text', 'hide_addon_in_cart', 'hide_addon_in_checkout'].includes(key))
                                            .map(([key, value]) => (wp.element.createElement("div", { key: key, style: { marginBottom: '8px' } },
                                            wp.element.createElement(ToggleControl, { label: key.replace(/_/g, ' '), checked: Boolean(value), onChange: (checked) => set(key, checked) }))))))))))))));
        }
        Pages.Settings = Settings;
    })(Pages = WooOptionsPro.Pages || (WooOptionsPro.Pages = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Pages;
    (function (Pages) {
        const { __ } = wp.i18n;
        const { useState } = wp.element;
        function maskKey(key, start = 4, end = 4) {
            if (!key)
                return '••••••••••••••••';
            if (key.startsWith('v1:'))
                return '••••••••••••••••';
            if (key.includes('•'))
                return key;
            if (key.length <= start + end)
                return key;
            const prefix = key.slice(0, start);
            const suffix = key.slice(-end);
            const bullets = Math.min(14, Math.max(8, key.length - start - end));
            return `${prefix}${'•'.repeat(bullets)}${suffix}`;
        }
        function LicensePage(props) {
            const adminData = window.WooOptionsProAdmin || {};
            const initialLicense = adminData.license || {};
            const [licenseState, setLicenseState] = useState({
                active: !!initialLicense.active || initialLicense.state === 'active' || !!initialLicense.canConfigure,
                key: initialLicense.key || '',
                expires: initialLicense.expires || 'Lifetime',
                licenseTitle: initialLicense.licenseTitle || 'Unlimited Site (Lifetime)',
                supportExpires: initialLicense.supportExpires || 'Unlimited',
                state: initialLicense.state || 'unlicensed',
                message: initialLicense.message || '',
            });
            const [inputKey, setInputKey] = useState('');
            const [inputEmail, setInputEmail] = useState('');
            const [keyError, setKeyError] = useState(false);
            const [busy, setBusy] = useState(false);
            const [notice, setNotice] = useState(null);
            const ajaxUrl = initialLicense.ajaxUrl || adminData.ajaxUrl || 'admin-ajax.php';
            const nonce = initialLicense.nonce || adminData.nonce || '';
            const accountUrl = initialLicense.accountUrl || 'https://portal.themefic.com/my-account/';
            const purchaseUrl = initialLicense.purchaseUrl || 'https://themefic.com/plugins/woooptions-pro/';
            const handleActivate = async (e) => {
                e.preventDefault();
                if (!inputKey.trim()) {
                    setKeyError(true);
                    setNotice({ type: 'error', text: __('Please enter your license key.', 'wooptions-pro') });
                    const inputEl = document.getElementById('wooptions_license_key');
                    if (inputEl)
                        inputEl.focus();
                    return;
                }
                setBusy(true);
                setNotice(null);
                setKeyError(false);
                try {
                    const formData = new URLSearchParams();
                    formData.append('action', 'wooptions-pro_license_activate');
                    formData.append('license_key', inputKey.trim());
                    formData.append('license_email', inputEmail.trim());
                    formData.append('_nonce', nonce);
                    const res = await fetch(ajaxUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                        body: formData.toString(),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!data || !data.success) {
                        throw new Error(data?.data?.message || __('License activation failed. Please check the key.', 'wooptions-pro'));
                    }
                    setNotice({ type: 'success', text: __('License activated successfully! Reloading…', 'wooptions-pro') });
                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                }
                catch (err) {
                    setKeyError(true);
                    setNotice({
                        type: 'error',
                        text: err?.message || __('License activation failed. Please check your credentials.', 'wooptions-pro'),
                    });
                }
                finally {
                    setBusy(false);
                }
            };
            const handleDeactivate = async () => {
                if (!window.confirm(__('Deactivate this license on the current site?', 'wooptions-pro'))) {
                    return;
                }
                setBusy(true);
                setNotice(null);
                try {
                    const formData = new URLSearchParams();
                    formData.append('action', 'wooptions-pro_license_deactivate');
                    formData.append('_nonce', nonce);
                    const res = await fetch(ajaxUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
                        body: formData.toString(),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!data || !data.success) {
                        throw new Error(data?.data?.message || __('Deactivation failed.', 'wooptions-pro'));
                    }
                    setNotice({ type: 'success', text: __('License deactivated successfully! Reloading…', 'wooptions-pro') });
                    setLicenseState({
                        active: false,
                        key: '',
                        expires: '',
                        licenseTitle: '',
                        supportExpires: '',
                        state: 'deactivated',
                        message: __('The WooOptions Pro license is deactivated.', 'wooptions-pro'),
                    });
                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                }
                catch (err) {
                    setNotice({
                        type: 'error',
                        text: err?.message || __('Deactivation failed.', 'wooptions-pro'),
                    });
                }
                finally {
                    setBusy(false);
                }
            };
            const isActivated = licenseState.active;
            return (wp.element.createElement("div", { className: "wholesalefic_licensing_wrap wof-license-wrap" },
                wp.element.createElement("div", { id: "wholesalefic_license_body", className: `wholesalefic_licensing_body ${busy ? 'wholesalefic_loading' : ''}` },
                    wp.element.createElement("div", { className: "wholesalefic-license-layout" },
                        wp.element.createElement("section", { className: "wholesalefic-license-main", "aria-labelledby": "wooptions-license-title" }, isActivated ? (wp.element.createElement(wp.element.Fragment, null,
                            wp.element.createElement("div", { className: "wholesalefic-license-main__header" },
                                wp.element.createElement("div", { className: "wholesalefic-license-title-row" },
                                    wp.element.createElement("h2", { id: "wooptions-license-title" }, __('Your license is active', 'wooptions-pro')),
                                    wp.element.createElement("span", { className: "wholesalefic-license-badge" },
                                        wp.element.createElement("span", { className: "wholesalefic-license-badge__dot", "aria-hidden": "true" }),
                                        __('Activated', 'wooptions-pro'))),
                                wp.element.createElement("p", null, __('This site is licensed and can receive plugin updates and access all premium WooOptions Pro features.', 'wooptions-pro'))),
                            wp.element.createElement("div", { className: "wholesalefic-license-main__body wholesalefic-license-main__body--active" },
                                wp.element.createElement("h3", { className: "wholesalefic-license-section-title" }, __('License details', 'wooptions-pro')),
                                wp.element.createElement("p", { className: "wholesalefic-license-section-description" }, __('Details about the license currently activated on this site', 'wooptions-pro')),
                                wp.element.createElement("div", { className: "wholesalefic-license-info-list" },
                                    wp.element.createElement("div", { className: "wholesalefic-license-info-row" },
                                        wp.element.createElement("span", { className: "label" }, __('License key', 'wooptions-pro')),
                                        wp.element.createElement("span", { className: "value license-key" }, maskKey(licenseState.key))),
                                    wp.element.createElement("div", { className: "wholesalefic-license-info-row" },
                                        wp.element.createElement("span", { className: "label" }, __('License Type', 'wooptions-pro')),
                                        wp.element.createElement("span", { className: "value" }, licenseState.licenseTitle)),
                                    wp.element.createElement("div", { className: "wholesalefic-license-info-row" },
                                        wp.element.createElement("span", { className: "label" }, __('License Expires', 'wooptions-pro')),
                                        wp.element.createElement("span", { className: "value" }, licenseState.expires)),
                                    wp.element.createElement("div", { className: "wholesalefic-license-info-row" },
                                        wp.element.createElement("span", { className: "label" }, __('Support Expires', 'wooptions-pro')),
                                        wp.element.createElement("span", { className: "value" }, licenseState.supportExpires))),
                                wp.element.createElement("div", { className: "wholesalefic-license-quick-actions", style: { marginTop: '24px', display: 'flex', gap: '12px' } },
                                    wp.element.createElement("button", { type: "button", className: "button wholesalefic-license-button wholesalefic-license-button--primary", onClick: () => props?.navigate ? props.navigate('templates') : (window.location.hash = '#/templates') }, __('Browse Templates', 'wooptions-pro')),
                                    wp.element.createElement("button", { type: "button", className: "button wholesalefic-license-button wholesalefic-license-button--ghost", onClick: () => props?.navigate ? props.navigate('option-sets') : (window.location.hash = '#/option-sets') }, __('Option Sets', 'wooptions-pro')))))) : (wp.element.createElement(wp.element.Fragment, null,
                            wp.element.createElement("div", { className: "wholesalefic-license-main__header" },
                                wp.element.createElement("h2", { id: "wooptions-license-title" }, __('Activate License', 'wooptions-pro')),
                                wp.element.createElement("p", null, __('Enter your license key from your purchase email to unlock premium features and receive plugin updates.', 'wooptions-pro'))),
                            wp.element.createElement("div", { className: "wholesalefic-license-main__body" },
                                wp.element.createElement("form", { className: "wholesalefic_licensing_form", onSubmit: handleActivate },
                                    wp.element.createElement("div", { className: "wholesalefic-license-field" },
                                        wp.element.createElement("div", { className: "wholesalefic-license-field__label-row" },
                                            wp.element.createElement("label", { htmlFor: "wooptions_license_key" }, __('License key', 'wooptions-pro')),
                                            wp.element.createElement("a", { className: "wholesalefic-license-field__link", rel: "noopener noreferrer", target: "_blank", href: accountUrl }, __("Can't find your license key?", 'wooptions-pro'))),
                                        wp.element.createElement("div", { className: `license-input ${keyError ? 'license-input--error' : ''}` },
                                            wp.element.createElement("span", { className: "license-input__icon", "aria-hidden": "true" },
                                                wp.element.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                                    wp.element.createElement("circle", { cx: "5.25", cy: "9.25", r: "2.75", stroke: "currentColor", strokeWidth: "1.4" }),
                                                    wp.element.createElement("path", { d: "M7.2 7.3L12.4 2.1M10.6 3.9L12.1 5.4M9.2 5.3L10.7 6.8", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }))),
                                            wp.element.createElement("input", { id: "wooptions_license_key", type: "password", autoComplete: "off", spellCheck: false, name: "wooptions_license_key", value: inputKey, onChange: (e) => {
                                                    setInputKey(e.target.value);
                                                    if (keyError)
                                                        setKeyError(false);
                                                    if (notice)
                                                        setNotice(null);
                                                }, placeholder: __('Enter your license key', 'wooptions-pro'), disabled: busy })),
                                        wp.element.createElement("p", { className: "wholesalefic-license-field__help" }, __('You can find your license key in your purchase confirmation email.', 'wooptions-pro'))),
                                    wp.element.createElement("div", { className: "wholesalefic-license-field" },
                                        wp.element.createElement("div", { className: "wholesalefic-license-field__label-row" },
                                            wp.element.createElement("label", { htmlFor: "wooptions_license_email" },
                                                __('Purchase email', 'wooptions-pro'),
                                                " ",
                                                wp.element.createElement("span", null, __('(Optional)', 'wooptions-pro')))),
                                        wp.element.createElement("div", { className: "license-input" },
                                            wp.element.createElement("span", { className: "license-input__icon", "aria-hidden": "true" },
                                                wp.element.createElement("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                                    wp.element.createElement("rect", { x: "2.25", y: "3.5", width: "11.5", height: "9", rx: "1.25", stroke: "currentColor", strokeWidth: "1.4" }),
                                                    wp.element.createElement("path", { d: "M2.8 4.25L8 8.15L13.2 4.25", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" }))),
                                            wp.element.createElement("input", { id: "wooptions_license_email", type: "email", autoComplete: "email", name: "wooptions_license_email", value: inputEmail, onChange: (e) => setInputEmail(e.target.value), placeholder: __('you@example.com', 'wooptions-pro'), disabled: busy })),
                                        wp.element.createElement("p", { className: "wholesalefic-license-field__help" }, __("Only required if your license can't be verified using the key alone.", 'wooptions-pro'))),
                                    wp.element.createElement("button", { type: "submit", id: "license_key_submit", className: "button wholesalefic-license-button wholesalefic-license-button--primary", disabled: busy }, busy ? __('Activating…', 'wooptions-pro') : __('Activate License', 'wooptions-pro'))),
                                wp.element.createElement("div", { id: "wholesalefic_error_wrapper", role: "alert", "aria-live": "polite" }, notice && (wp.element.createElement("div", { className: notice.type === 'success' ? 'wholesalefic_success_notice' : 'wholesalefic_error_notice' }, notice.text))))))),
                        wp.element.createElement("aside", { className: "wholesalefic-license-aside" },
                            wp.element.createElement("div", { className: "wholesalefic-license-aside__icon", "aria-hidden": "true" },
                                wp.element.createElement("svg", { width: "26", height: "26", viewBox: "0 0 26 26", fill: "none", xmlns: "http://www.w3.org/2000/svg" },
                                    wp.element.createElement("path", { d: "M13 2.5L16.05 5.02L20 4.76L20.98 8.6L24.5 10.5L23 14.17L24.5 17.84L20.98 19.74L20 23.58L16.05 23.32L13 25.84L9.95 23.32L6 23.58L5.02 19.74L1.5 17.84L3 14.17L1.5 10.5L5.02 8.6L6 4.76L9.95 5.02L13 2.5Z", stroke: "white", strokeWidth: "1.8", strokeLinejoin: "round" }),
                                    wp.element.createElement("path", { d: "M13 8.4L14.55 11.55L18 12.05L15.5 14.48L16.09 17.91L13 16.29L9.91 17.91L10.5 14.48L8 12.05L11.45 11.55L13 8.4Z", stroke: "white", strokeWidth: "1.5", strokeLinejoin: "round" }))),
                            isActivated ? (wp.element.createElement(wp.element.Fragment, null,
                                wp.element.createElement("h3", null, __('License Benefits', 'wooptions-pro')),
                                wp.element.createElement("p", null, __('Manage your license or access your WooOptions Pro account', 'wooptions-pro')),
                                wp.element.createElement("ul", { className: "wholesalefic-license-feature-list" },
                                    wp.element.createElement("li", null, __('Automatic plugin updates are enabled', 'wooptions-pro')),
                                    wp.element.createElement("li", null, __('All premium features are available on this site', 'wooptions-pro')),
                                    wp.element.createElement("li", null, __('You can deactivate or transfer this license later if needed', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wholesalefic-license-action-box" },
                                    wp.element.createElement("button", { type: "button", id: "wholesalefic_deactivate_license", className: "button wholesalefic-license-button wholesalefic-license-button--danger", onClick: handleDeactivate, disabled: busy }, busy ? __('Processing…', 'wooptions-pro') : __('Deactivate License', 'wooptions-pro')),
                                    wp.element.createElement("a", { className: "button wholesalefic-license-button wholesalefic-license-button--ghost", rel: "noopener noreferrer", target: "_blank", href: accountUrl }, __('Open My Account', 'wooptions-pro'))),
                                wp.element.createElement("div", { id: "wholesalefic_error_wrapper_active", role: "alert", "aria-live": "polite" }, notice && (wp.element.createElement("div", { className: notice.type === 'success' ? 'wholesalefic_success_notice' : 'wholesalefic_error_notice' }, notice.text))))) : (wp.element.createElement(wp.element.Fragment, null,
                                wp.element.createElement("h3", null, __("After activation, you'll get", 'wooptions-pro')),
                                wp.element.createElement("p", null, __('Activate your license to keep your store updated and unlock premium features.', 'wooptions-pro')),
                                wp.element.createElement("ul", { className: "wholesalefic-license-feature-list" },
                                    wp.element.createElement("li", null, __('Automatic plugin updates', 'wooptions-pro')),
                                    wp.element.createElement("li", null, __('Access to all premium features', 'wooptions-pro')),
                                    wp.element.createElement("li", null, __('License management for this website', 'wooptions-pro'))),
                                wp.element.createElement("div", { className: "wholesalefic-license-purchase-card" },
                                    wp.element.createElement("div", { className: "wholesalefic-license-purchase-card__content" },
                                        wp.element.createElement("span", null, __("DON'T HAVE A LICENSE YET?", 'wooptions-pro')),
                                        wp.element.createElement("strong", null, __('Get WooOptions Pro Premium', 'wooptions-pro'))),
                                    wp.element.createElement("a", { className: "wholesalefic-license-purchase-card__button", rel: "noopener noreferrer", target: "_blank", href: purchaseUrl }, __('Purchase License', 'wooptions-pro'))))))))));
        }
        Pages.LicensePage = LicensePage;
    })(Pages = WooOptionsPro.Pages || (WooOptionsPro.Pages = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { __, sprintf } = wp.i18n;
        function formatChoicePrice(pricing) {
            if (!pricing || pricing.strategy === 'none')
                return '';
            const adminConfig = window.WooOptionsProAdmin;
            const symbol = adminConfig?.currencySymbol || adminConfig?.currency || '$';
            if (pricing.strategy === 'fixed' || pricing.strategy === 'setup') {
                const raw = String(pricing.amount ?? '0').trim();
                if (!raw || raw === '0')
                    return '';
                const isNegative = raw.startsWith('-');
                const clean = isNegative ? raw.slice(1) : raw.startsWith('+') ? raw.slice(1) : raw;
                const prefix = isNegative ? '-' : '+';
                const suffix = pricing.strategy === 'setup' ? ` ${__('setup', 'wooptions-pro')}` : '';
                return `${prefix}${symbol}${clean}${suffix}`;
            }
            if (pricing.strategy === 'percentage') {
                const raw = String(pricing.percent ?? '0').trim();
                if (!raw || raw === '0')
                    return '';
                const isNegative = raw.startsWith('-');
                const clean = isNegative ? raw.slice(1) : raw.startsWith('+') ? raw.slice(1) : raw;
                const prefix = isNegative ? '-' : '+';
                return `${prefix}${clean}%`;
            }
            if (pricing.strategy === 'per_character') {
                const raw = String(pricing.amount ?? '0').trim();
                if (!raw || raw === '0')
                    return '';
                const isNegative = raw.startsWith('-');
                const clean = isNegative ? raw.slice(1) : raw.startsWith('+') ? raw.slice(1) : raw;
                const prefix = isNegative ? '-' : '+';
                return `${prefix}${symbol}${clean}/char`;
            }
            if (pricing.strategy === 'per_unit') {
                const raw = String(pricing.amount ?? '0').trim();
                if (!raw || raw === '0')
                    return '';
                const isNegative = raw.startsWith('-');
                const clean = isNegative ? raw.slice(1) : raw.startsWith('+') ? raw.slice(1) : raw;
                const prefix = isNegative ? '-' : '+';
                return `${prefix}${symbol}${clean}/unit`;
            }
            return '';
        }
        Builder.formatChoicePrice = formatChoicePrice;
        function choiceLabel(choice) {
            const priceText = formatChoicePrice(choice.pricing);
            const amount = priceText ? ` · ${priceText}` : '';
            return `${choice.label}${amount}`;
        }
        function previewColor(field) {
            const value = String(field.default ?? '#5B4FF5').toUpperCase();
            return /^#[0-9A-F]{6}$/.test(value) ? value : '#5B4FF5';
        }
        function renderCheckSvg(size = 11, bolder = false) {
            return (wp.element.createElement("svg", { viewBox: "0 0 20 20", width: size, height: size, fill: "currentColor", "aria-hidden": "true", style: { display: 'block' } },
                wp.element.createElement("path", { fillRule: "evenodd", d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z", clipRule: "evenodd", stroke: bolder ? 'currentColor' : undefined, strokeWidth: bolder ? 0.75 : undefined, strokeLinecap: bolder ? 'round' : undefined, strokeLinejoin: bolder ? 'round' : undefined })));
        }
        function renderFlagSvg(country) {
            const c = (country || 'US').toUpperCase();
            const style = { borderRadius: '2px', overflow: 'hidden', flexShrink: 0, display: 'block', boxShadow: '0 0 1px rgba(0,0,0,0.3)' };
            if (c === 'BD')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#006A4E" }),
                    wp.element.createElement("circle", { cx: "9", cy: "7", r: "4.2", fill: "#F42A41" }));
            if (c === 'US')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#B22234" }),
                    wp.element.createElement("rect", { y: "2.1", width: "20", height: "2", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "6.3", width: "20", height: "2", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "10.5", width: "20", height: "2", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { width: "8", height: "7.2", fill: "#3C3B6E" }),
                    wp.element.createElement("circle", { cx: "4", cy: "3.6", r: "1.5", fill: "#FFFFFF" }));
            if (c === 'GB')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#012169" }),
                    wp.element.createElement("path", { d: "M0 0L20 14M20 0L0 14", stroke: "#FFFFFF", strokeWidth: "2.5" }),
                    wp.element.createElement("path", { d: "M0 0L20 14M20 0L0 14", stroke: "#C8102E", strokeWidth: "1.2" }),
                    wp.element.createElement("path", { d: "M10 0v14M0 7h20", stroke: "#FFFFFF", strokeWidth: "4" }),
                    wp.element.createElement("path", { d: "M10 0v14M0 7h20", stroke: "#C8102E", strokeWidth: "2.2" }));
            if (c === 'CA')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#D80027" }),
                    wp.element.createElement("rect", { x: "5", width: "10", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("polygon", { points: "10,2.5 11,5.5 13.5,5 12,7 13.5,8.5 11,8 10.5,11 9.5,11 9,8 6.5,8.5 8,7 6.5,5 9,5.5", fill: "#D80027" }));
            if (c === 'AU')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#00008B" }),
                    wp.element.createElement("circle", { cx: "14", cy: "4", r: "1", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "16", cy: "7", r: "1", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "13", cy: "10", r: "1", fill: "#FFFFFF" }));
            if (c === 'DE')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "4.66", fill: "#000000" }),
                    wp.element.createElement("rect", { y: "4.66", width: "20", height: "4.66", fill: "#DD0000" }),
                    wp.element.createElement("rect", { y: "9.33", width: "20", height: "4.67", fill: "#FFCE00" }));
            if (c === 'FR')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "6.6", height: "14", fill: "#002654" }),
                    wp.element.createElement("rect", { x: "6.6", width: "6.8", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "13.4", width: "6.6", height: "14", fill: "#CE1126" }));
            if (c === 'IT')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "6.6", height: "14", fill: "#009246" }),
                    wp.element.createElement("rect", { x: "6.6", width: "6.8", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "13.4", width: "6.6", height: "14", fill: "#CE2B37" }));
            if (c === 'ES')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "3.5", fill: "#AA151B" }),
                    wp.element.createElement("rect", { y: "3.5", width: "20", height: "7", fill: "#F1BF00" }),
                    wp.element.createElement("rect", { y: "10.5", width: "20", height: "3.5", fill: "#AA151B" }));
            if (c === 'NL')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "4.66", fill: "#AE1C28" }),
                    wp.element.createElement("rect", { y: "4.66", width: "20", height: "4.66", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "9.33", width: "20", height: "4.67", fill: "#21468B" }));
            if (c === 'BR')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#009C3B" }),
                    wp.element.createElement("polygon", { points: "10,2 18,7 10,12 2,7", fill: "#FEDF00" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "2.5", fill: "#002776" }));
            if (c === 'IN')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "4.66", fill: "#FF9933" }),
                    wp.element.createElement("rect", { y: "4.66", width: "20", height: "4.66", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "9.33", width: "20", height: "4.67", fill: "#138808" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "1.8", fill: "#000080" }));
            if (c === 'CN')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#DE2910" }),
                    wp.element.createElement("polygon", { points: "4,2.5 4.6,4.2 6.2,4.2 4.9,5.2 5.4,6.8 4,5.8 2.6,6.8 3.1,5.2 1.8,4.2 3.4,4.2", fill: "#FFDE00" }));
            if (c === 'JP')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "4", fill: "#BC002D" }));
            if (c === 'KR')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "3.5", fill: "#CD2E3A" }),
                    wp.element.createElement("path", { d: "M10 7a3.5 3.5 0 0 1 0 3.5 3.5 3.5 0 0 0 0-7z", fill: "#0047A0" }));
            if (c === 'MX')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "6.6", height: "14", fill: "#006847" }),
                    wp.element.createElement("rect", { x: "6.6", width: "6.8", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "13.4", width: "6.6", height: "14", fill: "#CE1126" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "1.5", fill: "#8B5A2B" }));
            if (c === 'AE')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { y: "0", width: "20", height: "4.66", fill: "#00732F" }),
                    wp.element.createElement("rect", { y: "4.66", width: "20", height: "4.66", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "9.33", width: "20", height: "4.67", fill: "#000000" }),
                    wp.element.createElement("rect", { width: "5", height: "14", fill: "#FF0000" }));
            if (c === 'SA')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#006C35" }),
                    wp.element.createElement("rect", { x: "4", y: "6.2", width: "12", height: "1.6", fill: "#FFFFFF" }));
            if (c === 'SG')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "7", fill: "#ED2939" }),
                    wp.element.createElement("rect", { y: "7", width: "20", height: "7", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "4.5", cy: "3.5", r: "2.2", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "5.2", cy: "3.5", r: "1.8", fill: "#ED2939" }));
            if (c === 'PK')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "5", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "5", width: "15", height: "14", fill: "#01411C" }),
                    wp.element.createElement("circle", { cx: "12", cy: "7", r: "3.2", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "13", cy: "6.4", r: "2.7", fill: "#01411C" }));
            if (c === 'ZA')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "7", fill: "#E03C31" }),
                    wp.element.createElement("rect", { y: "7", width: "20", height: "7", fill: "#001489" }),
                    wp.element.createElement("polygon", { points: "0,0 8,7 0,14", fill: "#000000" }),
                    wp.element.createElement("path", { d: "M0 0l8.5 7-8.5 7h3l7-5.5v-3l-7-5.5z", fill: "#FFB81C" }),
                    wp.element.createElement("path", { d: "M8 5.5h12v3h-12z", fill: "#007749" }));
            if (c === 'TR')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#E30A17" }),
                    wp.element.createElement("circle", { cx: "8", cy: "7", r: "3.5", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "9", cy: "7", r: "2.8", fill: "#E30A17" }),
                    wp.element.createElement("polygon", { points: "12.5,5.5 13.5,7 15,7 13.8,8 14.2,9.5 13,8.5 11.8,9.5 12.2,8 11,7 12.5,7", fill: "#FFFFFF" }));
            if (c === 'SE')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#005293" }),
                    wp.element.createElement("rect", { x: "6", width: "3", height: "14", fill: "#FECB00" }),
                    wp.element.createElement("rect", { y: "5.5", width: "20", height: "3", fill: "#FECB00" }));
            if (c === 'CH')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#D52B1E" }),
                    wp.element.createElement("rect", { x: "8.5", y: "3", width: "3", height: "8", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "6", y: "5.5", width: "8", height: "3", fill: "#FFFFFF" }));
            if (c === 'PL')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "7", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "7", width: "20", height: "7", fill: "#DC143C" }));
            if (c === 'AR')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "4.66", fill: "#74ACDF" }),
                    wp.element.createElement("rect", { y: "4.66", width: "20", height: "4.66", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "9.33", width: "20", height: "4.67", fill: "#74ACDF" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "1.6", fill: "#F6B40E" }));
            if (c === 'BE')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "6.6", height: "14", fill: "#000000" }),
                    wp.element.createElement("rect", { x: "6.6", width: "6.8", height: "14", fill: "#FDDA24" }),
                    wp.element.createElement("rect", { x: "13.4", width: "6.6", height: "14", fill: "#EF3340" }));
            if (c === 'AT')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "4.66", fill: "#ED2939" }),
                    wp.element.createElement("rect", { y: "4.66", width: "20", height: "4.66", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "9.33", width: "20", height: "4.67", fill: "#ED2939" }));
            if (c === 'NO')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#BA0C2F" }),
                    wp.element.createElement("rect", { x: "5.5", width: "4", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "5", width: "20", height: "4", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "6.5", width: "2", height: "14", fill: "#00205B" }),
                    wp.element.createElement("rect", { y: "6", width: "20", height: "2", fill: "#00205B" }));
            if (c === 'DK')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#C60C30" }),
                    wp.element.createElement("rect", { x: "6", width: "2.5", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "5.7", width: "20", height: "2.5", fill: "#FFFFFF" }));
            if (c === 'FI')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "6", width: "3", height: "14", fill: "#002F6C" }),
                    wp.element.createElement("rect", { y: "5.5", width: "20", height: "3", fill: "#002F6C" }));
            if (c === 'IE')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "6.6", height: "14", fill: "#169B62" }),
                    wp.element.createElement("rect", { x: "6.6", width: "6.8", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "13.4", width: "6.6", height: "14", fill: "#FF883E" }));
            if (c === 'NZ')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#00247D" }),
                    wp.element.createElement("circle", { cx: "14", cy: "4", r: "1.1", fill: "#CC142B" }),
                    wp.element.createElement("circle", { cx: "16.5", cy: "7", r: "1.1", fill: "#CC142B" }),
                    wp.element.createElement("circle", { cx: "13", cy: "10", r: "1.1", fill: "#CC142B" }));
            if (c === 'PT')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "8", height: "14", fill: "#046A38" }),
                    wp.element.createElement("rect", { x: "8", width: "12", height: "14", fill: "#DA291C" }),
                    wp.element.createElement("circle", { cx: "8", cy: "7", r: "2.5", fill: "#FFE900" }));
            if (c === 'GR')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#0D5EAF" }),
                    wp.element.createElement("rect", { y: "1.5", width: "20", height: "1.5", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "4.6", width: "20", height: "1.5", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "7.7", width: "20", height: "1.5", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "10.8", width: "20", height: "1.5", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { width: "7.5", height: "7.7", fill: "#0D5EAF" }),
                    wp.element.createElement("rect", { x: "3", width: "1.5", height: "7.7", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "3.1", width: "7.5", height: "1.5", fill: "#FFFFFF" }));
            if (c === 'IL')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "1.5", width: "20", height: "2", fill: "#0038B8" }),
                    wp.element.createElement("rect", { y: "10.5", width: "20", height: "2", fill: "#0038B8" }),
                    wp.element.createElement("polygon", { points: "10,4.5 12,8 8,8", stroke: "#0038B8", strokeWidth: "0.7", fill: "none" }),
                    wp.element.createElement("polygon", { points: "10,9 12,5.5 8,5.5", stroke: "#0038B8", strokeWidth: "0.7", fill: "none" }));
            if (c === 'HK')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#C8102E" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "3", fill: "#FFFFFF" }));
            if (c === 'MY')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#CC0000" }),
                    wp.element.createElement("rect", { y: "2", width: "20", height: "2", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "6", width: "20", height: "2", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "10", width: "20", height: "2", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { width: "10", height: "8", fill: "#010066" }),
                    wp.element.createElement("circle", { cx: "5", cy: "4", r: "2.5", fill: "#FFCC00" }),
                    wp.element.createElement("circle", { cx: "5.8", cy: "4", r: "2.1", fill: "#010066" }));
            if (c === 'PH')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "7", fill: "#0038A8" }),
                    wp.element.createElement("rect", { y: "7", width: "20", height: "7", fill: "#CE1126" }),
                    wp.element.createElement("polygon", { points: "0,0 8,7 0,14", fill: "#FFFFFF" }),
                    wp.element.createElement("circle", { cx: "2.8", cy: "7", r: "1.3", fill: "#FCD116" }));
            if (c === 'ID')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "7", fill: "#CE1126" }),
                    wp.element.createElement("rect", { y: "7", width: "20", height: "7", fill: "#FFFFFF" }));
            if (c === 'TH')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#A51931" }),
                    wp.element.createElement("rect", { y: "2.3", width: "20", height: "9.4", fill: "#F4F5F8" }),
                    wp.element.createElement("rect", { y: "4.6", width: "20", height: "4.8", fill: "#2D2A4A" }));
            if (c === 'VN')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "14", fill: "#DA251D" }),
                    wp.element.createElement("polygon", { points: "10,3.5 11.2,7.2 14.8,7.2 11.9,9.4 13,13 10,10.8 7,13 8.1,9.4 5.2,7.2 8.8,7.2", fill: "#FFFF00" }));
            if (c === 'EG')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "4.66", fill: "#CE1126" }),
                    wp.element.createElement("rect", { y: "4.66", width: "20", height: "4.66", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "9.33", width: "20", height: "4.67", fill: "#000000" }),
                    wp.element.createElement("circle", { cx: "10", cy: "7", r: "1.3", fill: "#C09A3E" }));
            if (c === 'NG')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "6.6", height: "14", fill: "#008751" }),
                    wp.element.createElement("rect", { x: "6.6", width: "6.8", height: "14", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { x: "13.4", width: "6.6", height: "14", fill: "#008751" }));
            if (c === 'KE')
                return wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                    wp.element.createElement("rect", { width: "20", height: "4", fill: "#000000" }),
                    wp.element.createElement("rect", { y: "4", width: "20", height: "1", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "5", width: "20", height: "4", fill: "#922529" }),
                    wp.element.createElement("rect", { y: "9", width: "20", height: "1", fill: "#FFFFFF" }),
                    wp.element.createElement("rect", { y: "10", width: "20", height: "4", fill: "#006600" }),
                    wp.element.createElement("ellipse", { cx: "10", cy: "7", rx: "2", ry: "3.5", fill: "#922529" }),
                    wp.element.createElement("ellipse", { cx: "10", cy: "7", rx: "0.5", ry: "3.5", fill: "#FFFFFF" }));
            return (wp.element.createElement("svg", { viewBox: "0 0 20 14", width: "20", height: "14", "aria-hidden": "true", style: style },
                wp.element.createElement("rect", { width: "20", height: "14", fill: "#334155" }),
                wp.element.createElement("text", { x: "10", y: "10", fontFamily: "-apple-system,sans-serif", fontSize: "7", fontWeight: "bold", fill: "#ffffff", textAnchor: "middle" }, c.slice(0, 2))));
        }
        function ModalPreviewControl(props) {
            const [isOpen, setIsOpen] = wp.element.useState(false);
            return (wp.element.createElement("div", { className: "wof-preview-modal-shell" },
                wp.element.createElement("button", { type: "button", className: `wof-modal-trigger wof-modal-btn wof-modal-btn--${props.buttonStyle}`, onClick: (e) => {
                        e.stopPropagation();
                        setIsOpen(true);
                    } },
                    wp.element.createElement("span", { className: "wof-modal-btn__text" }, props.buttonText)),
                isOpen ? (wp.element.createElement("div", { className: "wof-modal-backdrop is-canvas-preview", onClick: (e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                    } },
                    wp.element.createElement("div", { className: "wof-modal-dialog", onClick: (e) => e.stopPropagation() },
                        wp.element.createElement("div", { className: "wof-modal-header" },
                            wp.element.createElement("h3", { className: "wof-modal-title" }, props.field.modalTitle || props.field.label || __('Information', 'wooptions-pro')),
                            wp.element.createElement("button", { type: "button", className: "wof-modal-close", onClick: (e) => {
                                    e.stopPropagation();
                                    setIsOpen(false);
                                }, "aria-label": __('Close', 'wooptions-pro') }, "\u00D7")),
                        wp.element.createElement("div", { className: "wof-modal-body wof-modal-content" }, props.field.content ? (wp.element.createElement("div", { dangerouslySetInnerHTML: { __html: props.field.content } })) : (wp.element.createElement("p", { style: { color: '#94a3b8', fontStyle: 'italic' } }, __('No modal content added yet. Add text and images in the inspector.', 'wooptions-pro'))))))) : null));
        }
        function FieldPreview(props) {
            const field = props.field;
            const choices = field.choices ?? [];
            const appliedFontField = (props.allFields || []).find((f) => f.type === 'font' && Array.isArray(f.appliedFields) && f.appliedFields.includes(field.uuid));
            const appliedFontChoice = appliedFontField?.choices?.find((c) => Boolean(c.default)) || appliedFontField?.choices?.[0];
            const appliedFontFamily = appliedFontChoice?.fontFamily || appliedFontChoice?.label || undefined;
            if (field.type === 'heading') {
                const headingText = field.label || field.content || __('Section heading', 'wooptions-pro');
                const helpText = field.help ? String(field.help).trim() : '';
                const helpPos = field.helpTextPosition || 'below_title';
                return (wp.element.createElement("div", { className: "wof-preview-heading-wrap" },
                    wp.element.createElement("h3", { className: "wof-preview-heading" },
                        wp.element.createElement("span", null, headingText),
                        helpText && helpPos === 'tooltip' ? (wp.element.createElement("span", { className: "wof-field__tooltip-preview", title: helpText },
                            wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                                wp.element.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
                                wp.element.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })))) : null),
                    helpText && (helpPos === 'below_title' || helpPos === 'below_field') ? (wp.element.createElement("p", { className: `wof-preview-heading-help wof-preview-heading-help--${helpPos}` }, helpText)) : null));
            }
            if (field.type === 'paragraph') {
                const content = field.description || field.content || field.help || field.label || __('Add supporting product-option content here.', 'wooptions-pro');
                return (wp.element.createElement("div", { className: "wof-preview-paragraph-box" },
                    wp.element.createElement("p", { className: "wof-preview-paragraph-text" }, content)));
            }
            if (field.type === 'help') {
                const content = field.description || field.content || field.help || field.label || __('Helpful information for customers.', 'wooptions-pro');
                return (wp.element.createElement("div", { className: "wof-preview-help-box" },
                    wp.element.createElement("div", { className: "wof-preview-help-icon" },
                        wp.element.createElement("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                            wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                            wp.element.createElement("line", { x1: "12", y1: "16", x2: "12", y2: "12" }),
                            wp.element.createElement("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" }))),
                    wp.element.createElement("div", { className: "wof-preview-help-content" }, content)));
            }
            if (field.type === 'content') {
                const htmlContent = field.content || '';
                return (wp.element.createElement("div", { className: "wof-preview-content-box" }, htmlContent ? (wp.element.createElement("div", { className: "wof-preview-content-html wof-content--rich", dangerouslySetInnerHTML: { __html: htmlContent } })) : (wp.element.createElement("div", { className: "wof-preview-content-empty" },
                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "editor-alignleft" }),
                    wp.element.createElement("span", null, __('Content block — add text and images in the inspector', 'wooptions-pro'))))));
            }
            if (field.type === 'modal') {
                const buttonText = field.buttonText || field.label || __('View details', 'wooptions-pro');
                const buttonStyle = field.buttonStyle || 'outline';
                return wp.element.createElement(ModalPreviewControl, { field: field, buttonText: buttonText, buttonStyle: buttonStyle });
            }
            if (field.type === 'separator') {
                const h = Number(field.height ?? field.style?.height ?? 1);
                const color = String(field.color ?? field.style?.color ?? '#E2E8F0');
                return (wp.element.createElement("hr", { className: "wof-preview-separator", style: {
                        height: `${Math.max(1, h)}px`,
                        backgroundColor: color,
                        border: 'none',
                        margin: '8px 0',
                        width: '100%',
                    } }));
            }
            if (field.type === 'spacer') {
                const h = Number(field.height ?? field.style?.height ?? 24);
                return wp.element.createElement("div", { className: "wof-preview-spacer", style: { height: `${Math.max(0, h)}px` } });
            }
            if (field.type === 'formula')
                return wp.element.createElement("output", { className: "wof-preview-output" }, "0.00");
            if (field.type === 'toggle') {
                const isChecked = Boolean(field.default);
                const priceText = formatChoicePrice(field.pricing);
                return (wp.element.createElement("div", { className: `wof-preview-toggle${isChecked ? ' is-checked' : ''}` },
                    wp.element.createElement("span", { className: "wof-preview-toggle__track" },
                        wp.element.createElement("span", { className: "wof-preview-toggle__thumb" })),
                    wp.element.createElement("strong", { className: "wof-preview-toggle__label" }, field.label || __('Switch', 'wooptions-pro')),
                    priceText ? wp.element.createElement("span", { className: "wof-preview-boolean__price" }, priceText) : null));
            }
            if (field.type === 'checkbox') {
                const isChecked = Boolean(field.default);
                const priceText = formatChoicePrice(field.pricing);
                return (wp.element.createElement("div", { className: `wof-preview-checkbox${isChecked ? ' is-checked' : ''}` },
                    wp.element.createElement("span", { className: "wof-preview-checkbox__box" }, isChecked ? renderCheckSvg(18, true) : null),
                    wp.element.createElement("strong", { className: "wof-preview-checkbox__label" }, field.label || __('Checkbox', 'wooptions-pro')),
                    priceText ? wp.element.createElement("span", { className: "wof-preview-boolean__price" }, priceText) : null));
            }
            if (field.type === 'textarea') {
                const rows = field.rows ? Math.max(1, field.rows) : 4;
                const priceText = formatChoicePrice(field.pricing);
                return (wp.element.createElement("div", { className: "wof-preview-textarea-wrap" },
                    wp.element.createElement("textarea", { className: "wof-preview-textarea", readOnly: true, tabIndex: -1, rows: rows, style: {
                            textTransform: field.textTransform && field.textTransform !== 'none' ? field.textTransform : undefined,
                            fontFamily: appliedFontFamily,
                        }, placeholder: field.placeholder || __('Enter text…', 'wooptions-pro') }),
                    priceText ? wp.element.createElement("span", { className: "wof-preview-scalar__price wof-preview-scalar__price--textarea" }, priceText) : null));
            }
            if (field.type === 'font') {
                const selectedChoice = choices.find(c => Boolean(c.default)) || choices[0];
                const fontFamily = selectedChoice?.fontFamily || selectedChoice?.label || 'inherit';
                const priceText = selectedChoice ? formatChoicePrice(selectedChoice.pricing) : '';
                return (wp.element.createElement("div", { className: "wof-preview-font-control" },
                    wp.element.createElement("div", { className: "wof-preview-font-selected" },
                        wp.element.createElement("span", { className: "wof-preview-font-name", style: { fontFamily } }, selectedChoice ? selectedChoice.label : __('Choose a font…', 'wooptions-pro')),
                        selectedChoice?.fontCategory ? (wp.element.createElement("span", { className: "wof-font-category-tag" }, selectedChoice.fontCategory)) : null,
                        priceText ? (wp.element.createElement("span", { style: { fontSize: '11px', color: '#64748b' } }, priceText)) : null,
                        selectedChoice ? (wp.element.createElement("span", { className: "wof-preview-font-sample", style: { fontFamily } }, "Aa Bb Gg 123")) : null),
                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "arrow-down-alt2" })));
            }
            if (field.type === 'select') {
                const selectedChoice = choices.find(c => Boolean(c.default));
                return (wp.element.createElement("div", { className: "wof-preview-select-control" },
                    wp.element.createElement("select", { "aria-disabled": "true", tabIndex: -1, value: "", onChange: () => undefined },
                        wp.element.createElement("option", { value: "" }, selectedChoice?.label ? choiceLabel(selectedChoice) : __('Choose an option', 'wooptions-pro'))),
                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "arrow-down-alt2" })));
            }
            if (field.type === 'color_picker') {
                const color = previewColor(field);
                const priceText = formatChoicePrice(field.pricing);
                return (wp.element.createElement("div", { className: "wof-preview-color-picker" },
                    wp.element.createElement("span", { className: "wof-preview-color-picker__swatch", style: { background: color } }),
                    wp.element.createElement("span", null,
                        wp.element.createElement("strong", null, color),
                        wp.element.createElement("small", null, __('Click to choose a color', 'wooptions-pro'))),
                    priceText ? wp.element.createElement("span", { className: "wof-preview-color-picker__price" }, priceText) : null,
                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-customizer" })));
            }
            if (field.type === 'range') {
                const min = field.min != null && field.min !== '' ? Number(field.min) : 1;
                const max = field.max != null && field.max !== '' ? Number(field.max) : 100;
                const step = field.step != null && field.step !== '' ? Number(field.step) : 1;
                const def = field.default != null && field.default !== '' ? Number(field.default) : 10;
                const enablePostfix = Boolean(field.enablePostfix);
                const postfix = field.postfix != null ? String(field.postfix) : 'PostFix';
                const pct = max > min ? Math.max(0, Math.min(100, ((def - min) / (max - min)) * 100)) : 10;
                return (wp.element.createElement("div", { className: "wof-preview-range-wrap" },
                    wp.element.createElement("div", { className: "wof-preview-range-slider-container" },
                        wp.element.createElement("input", { disabled: true, type: "range", className: "wof-preview-range-slider", min: min, max: max, step: step, value: def, style: { '--range-progress': `${pct}%` } })),
                    wp.element.createElement("div", { className: `wof-preview-range-box${enablePostfix && postfix ? '' : ' wof-preview-range-box--no-postfix'}` },
                        wp.element.createElement("span", { className: "wof-preview-range-val" }, def),
                        enablePostfix && postfix ? wp.element.createElement("span", { className: "wof-preview-range-postfix" }, postfix) : null)));
            }
            if (field.type === 'file') {
                const maxFiles = Math.max(1, Number(field.maxFiles ?? 1));
                const maxMb = Math.max(1, Number(field.maxFileMb ?? 5));
                return (wp.element.createElement("div", { className: "wof-preview-upload" },
                    wp.element.createElement("div", { className: "wof-preview-upload__picker" },
                        wp.element.createElement("button", { type: "button", className: "wof-preview-upload__button", tabIndex: -1, "aria-disabled": "true" },
                            wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                wp.element.createElement("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
                                wp.element.createElement("polyline", { points: "17 8 12 3 7 8" }),
                                wp.element.createElement("line", { x1: "12", y1: "3", x2: "12", y2: "15" })),
                            __('Upload', 'wooptions-pro')),
                        wp.element.createElement("span", { className: "wof-preview-upload__hint" }, __('Click or drag and drop', 'wooptions-pro')),
                        wp.element.createElement("small", { className: "wof-preview-upload__limit" }, sprintf(__('Up to %1$d file(s), %2$d MB each', 'wooptions-pro'), maxFiles, maxMb)))));
            }
            if (field.type === 'tel') {
                const flagStyle = field.flagStyle ?? 'number_only';
                const country = (field.defaultCountry ?? 'US').toUpperCase();
                const dialCodes = {
                    US: '+1', GB: '+44', CA: '+1', AU: '+61', DE: '+49', FR: '+33', IT: '+39', ES: '+34',
                    NL: '+31', BR: '+55', IN: '+91', CN: '+86', JP: '+81', KR: '+82', MX: '+52', AE: '+971',
                    SA: '+966', SG: '+65', BD: '+880', PK: '+92', ZA: '+27', TR: '+90', SE: '+46', CH: '+41',
                    PL: '+48', AR: '+54', BE: '+32', AT: '+43', NO: '+47', DK: '+45', FI: '+358', IE: '+353',
                    NZ: '+64', PT: '+351', GR: '+30', IL: '+972', HK: '+852', MY: '+60', PH: '+63', ID: '+62',
                    TH: '+66', VN: '+84', EG: '+20', NG: '+234', KE: '+254',
                };
                const dialCode = dialCodes[country] ?? '+1';
                if (flagStyle === 'number_only') {
                    return wp.element.createElement("input", { disabled: true, type: "tel", placeholder: field.placeholder || __('Enter phone number…', 'wooptions-pro') });
                }
                return (wp.element.createElement("div", { className: "wof-preview-tel-wrap" },
                    wp.element.createElement("div", { className: "wof-preview-tel-flag" },
                        renderFlagSvg(country),
                        wp.element.createElement("span", { style: { fontWeight: 600, fontSize: '13px' } }, country),
                        flagStyle === 'number_flag_dialcode' ? wp.element.createElement("span", { style: { color: '#64748b', fontSize: '12px' } }, dialCode) : null,
                        wp.element.createElement("svg", { viewBox: "0 0 20 20", width: "12", height: "12", fill: "#64748b", style: { display: 'block' } },
                            wp.element.createElement("path", { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" }))),
                    wp.element.createElement("input", { disabled: true, type: "tel", placeholder: field.placeholder || __('Enter phone number…', 'wooptions-pro') })));
            }
            if (field.type === 'radio') {
                const isTwoCols = field.columns === 'two' || field.columns === 2;
                const isCircle = field.imageStyle === 'circle';
                const listStyle = isTwoCols ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' } : undefined;
                return (wp.element.createElement("div", { className: `wof-preview-radio-list${isTwoCols ? ' wof-preview-radio-list--cols-2' : ''}`, style: listStyle }, choices.slice(0, 4).map((choice) => {
                    const isSelected = Boolean(choice.default ||
                        choice.selected ||
                        (typeof field.default === 'string' && field.default === choice.uuid));
                    return (wp.element.createElement("label", { className: `wof-preview-radio-item${isSelected ? ' is-selected' : ''}`, key: choice.uuid },
                        wp.element.createElement("span", { className: "wof-preview-radio-item__indicator" }),
                        Boolean(choice.imageId || choice.imageUrl) ? (wp.element.createElement("span", { style: {
                                width: '32px',
                                height: '32px',
                                borderRadius: isCircle ? '50%' : '4px',
                                overflow: 'hidden',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: '#f1f5f9',
                                border: '1px solid #d8deea',
                                marginInlineEnd: '6px',
                            } },
                            wp.element.createElement(WooOptionsPro.Components.MediaImage, { attachmentId: choice.imageId, src: choice.imageUrl, alt: "" }))) : null,
                        wp.element.createElement("span", { style: { display: 'flex', flexDirection: 'column', gap: '1px' } },
                            wp.element.createElement("span", { className: "wof-preview-radio-item__label" }, choice.label),
                            choice.description ? (wp.element.createElement("small", { style: { color: '#64748b', fontSize: '11px', lineHeight: 1.3 } }, choice.description)) : null),
                        formatChoicePrice(choice.pricing) ? wp.element.createElement("span", { className: "wof-preview-radio-item__price" }, formatChoicePrice(choice.pricing)) : null));
                })));
            }
            if (field.type === 'checkbox_group') {
                const isTwoCols = field.columns === 'two' || field.columns === 2;
                const isCircle = field.imageStyle === 'circle';
                const listStyle = isTwoCols ? { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' } : undefined;
                return (wp.element.createElement("div", { className: `wof-preview-checkbox-list${isTwoCols ? ' wof-preview-checkbox-list--cols-2' : ''}`, style: listStyle }, choices.slice(0, 4).map((choice) => {
                    const isSelected = Boolean(choice.default ||
                        choice.selected ||
                        (Array.isArray(field.default) && field.default.includes(choice.uuid)) ||
                        (typeof field.default === 'string' && field.default === choice.uuid));
                    return (wp.element.createElement("label", { className: `wof-preview-checkbox-item${isSelected ? ' is-selected' : ''}`, key: choice.uuid },
                        wp.element.createElement("span", { className: "wof-preview-checkbox-item__indicator" }, isSelected ? renderCheckSvg(18, true) : null),
                        Boolean(choice.imageId || choice.imageUrl) ? (wp.element.createElement("span", { style: {
                                width: '32px',
                                height: '32px',
                                borderRadius: isCircle ? '50%' : '4px',
                                overflow: 'hidden',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: '#f1f5f9',
                                border: '1px solid #d8deea',
                                marginInlineEnd: '6px',
                            } },
                            wp.element.createElement(WooOptionsPro.Components.MediaImage, { attachmentId: choice.imageId, src: choice.imageUrl, alt: "" }))) : null,
                        wp.element.createElement("span", { style: { display: 'flex', flexDirection: 'column', gap: '1px' } },
                            wp.element.createElement("span", { className: "wof-preview-checkbox-item__label" }, choice.label),
                            choice.description ? (wp.element.createElement("small", { style: { color: '#64748b', fontSize: '11px', lineHeight: 1.3 } }, choice.description)) : null),
                        formatChoicePrice(choice.pricing) ? wp.element.createElement("span", { className: "wof-preview-checkbox-item__price" }, formatChoicePrice(choice.pricing)) : null));
                })));
            }
            if (field.type === 'segmented') {
                const isVertical = field.type === 'segmented' && field.displayDirection === 'vertical';
                const hasRadius = field.choiceBorderRadius !== undefined && field.choiceBorderRadius !== null && String(field.choiceBorderRadius).trim() !== '';
                const hasWidth = field.choiceWidth !== undefined && field.choiceWidth !== null && String(field.choiceWidth).trim() !== '';
                const hasHeight = field.choiceHeight !== undefined && field.choiceHeight !== null && String(field.choiceHeight).trim() !== '';
                const btnStyle = {};
                if (hasWidth)
                    btnStyle.minWidth = `${field.choiceWidth}px`;
                if (hasHeight)
                    btnStyle.minHeight = `${field.choiceHeight}px`;
                if (hasRadius)
                    btnStyle.borderRadius = `${field.choiceBorderRadius}px`;
                const wrapStyle = {
                    display: 'flex',
                    flexDirection: isVertical ? 'column' : 'row',
                    flexWrap: isVertical ? 'nowrap' : 'wrap',
                    gap: '8px',
                    alignItems: isVertical ? 'flex-start' : 'center',
                };
                return (wp.element.createElement("div", { style: wrapStyle }, choices.slice(0, 4).map((choice, index) => {
                    const priceText = formatChoicePrice(choice.pricing);
                    const isSelected = Boolean(choice.default) || (index === 0 && !choices.some((c) => c.default));
                    return (wp.element.createElement("span", { key: choice.uuid, style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 14px',
                            minHeight: btnStyle.minHeight ?? '40px',
                            minWidth: btnStyle.minWidth,
                            borderRadius: hasRadius ? `${field.choiceBorderRadius}px` : undefined,
                            border: isSelected ? '1.5px solid var(--wof-preview-primary, #5b4ff5)' : '1px solid var(--wof-preview-border, #d8deea)',
                            background: isSelected ? 'color-mix(in srgb, var(--wof-preview-primary, #5b4ff5) 5%, var(--wof-preview-surface, #fff))' : 'var(--wof-preview-surface, #fff)',
                            color: 'var(--wof-preview-text, #172033)',
                            fontSize: '13px',
                            fontWeight: 550,
                            boxShadow: 'none',
                            cursor: 'default',
                            whiteSpace: 'nowrap',
                        } },
                        Boolean(choice.imageId || choice.imageUrl) ? (wp.element.createElement("span", { style: {
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: '#f1f5f9',
                            } },
                            wp.element.createElement(WooOptionsPro.Components.MediaImage, { attachmentId: choice.imageId, src: choice.imageUrl, alt: "" }))) : null,
                        wp.element.createElement("span", { style: { display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' } },
                            wp.element.createElement("span", null, choice.label),
                            choice.description ? (wp.element.createElement("small", { style: { fontSize: '11px', opacity: 0.72, fontWeight: 400 } }, choice.description)) : null),
                        priceText ? wp.element.createElement("span", { style: { fontSize: '11px', opacity: 0.72 } }, priceText) : null));
                })));
            }
            if (field.type === 'color_swatch') {
                const imageStyle = field.imageStyle || 'default';
                const swatchStyle = {};
                const hasRadius = field.choiceBorderRadius !== undefined && field.choiceBorderRadius !== null && String(field.choiceBorderRadius).trim() !== '';
                const hasWidth = field.choiceWidth !== undefined && field.choiceWidth !== null && String(field.choiceWidth).trim() !== '';
                const hasHeight = field.choiceHeight !== undefined && field.choiceHeight !== null && String(field.choiceHeight).trim() !== '';
                if (hasWidth)
                    swatchStyle.width = `${field.choiceWidth}px`;
                if (hasHeight)
                    swatchStyle.height = `${field.choiceHeight}px`;
                if (hasRadius)
                    swatchStyle.borderRadius = `${field.choiceBorderRadius}px`;
                return (wp.element.createElement("div", { className: "wof-preview-color-blocks" }, (choices.length > 0 ? choices : [{ uuid: 'ph', label: 'Color', color: '#5b4ff5', default: true }]).slice(0, 5).map((choice) => {
                    const isSelected = Boolean(choice.default || choice.selected);
                    return (wp.element.createElement("div", { className: `wof-preview-color-block${isSelected ? ' is-selected' : ''}`, key: choice.uuid, style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
                        wp.element.createElement("span", { className: "wof-preview-color-block__swatch", style: { background: choice.color || '#ddd', ...swatchStyle, position: 'relative', overflow: 'hidden' } },
                            isSelected ? wp.element.createElement("span", { className: "wof-preview-color-block__check", style: { position: 'absolute', top: '2px', right: '2px', background: '#172033', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', zIndex: 3 } }, renderCheckSvg(10)) : null,
                            imageStyle === 'overlay' ? (wp.element.createElement("span", { style: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)', color: '#fff', fontSize: '9px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' } }, choice.label)) : null),
                        imageStyle !== 'only_image' && imageStyle !== 'overlay' ? (wp.element.createElement(wp.element.Fragment, null,
                            wp.element.createElement("small", { style: { minHeight: '1.3em', marginTop: '4px', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' } }, choice.label),
                            wp.element.createElement("span", { className: "wof-preview-color-block__price", style: { minHeight: '1.3em' } }, formatChoicePrice(choice.pricing)))) : null,
                        field.enableQuantity ? (wp.element.createElement("span", { className: "wof-choice-qty-wrap", style: { marginTop: 'auto', paddingTop: '6px', display: 'flex', justifyContent: 'center', width: '100%' } },
                            wp.element.createElement("input", { disabled: true, type: "number", className: "wof-choice-qty-input", defaultValue: field.minQuantity ?? 1, style: { width: '100%', height: '28px', fontSize: '12px', textAlign: 'center' } }))) : null));
                })));
            }
            if (field.type === 'product') {
                const imageStyle = field.imageStyle || 'default';
                const thumbStyle = {};
                if (field.choiceWidth && String(field.choiceWidth).trim())
                    thumbStyle.width = `${field.choiceWidth}px`;
                if (field.choiceHeight && String(field.choiceHeight).trim())
                    thumbStyle.height = `${field.choiceHeight}px`;
                if (field.choiceBorderRadius && String(field.choiceBorderRadius).trim())
                    thumbStyle.borderRadius = `${field.choiceBorderRadius}px`;
                const mergeVars = Boolean(field.mergeVariationProducts);
                const hasAnyVariable = (choices.length > 0 ? choices : []).some((c) => {
                    const isVar = Boolean(c.isVariable || c.productInfo?.isVariable);
                    const selIds = (c.selectedVariationIds || []).map(Number);
                    return isVar && (mergeVars || selIds.length > 0);
                });
                return (wp.element.createElement("div", { className: `wof-preview-image-tiles${hasAnyVariable ? ' wof-preview-image-tiles--has-variables' : ''}` }, (choices.length > 0 ? choices : [{ uuid: 'ph', label: 'Product', imageUrl: '', imageId: 0, productInfo: null, default: true }]).slice(0, 4).map((choice) => {
                    const isSelected = Boolean(choice.default || choice.selected);
                    const imgSrc = choice.productInfo?.image || choice.imageUrl || '';
                    const priceText = formatChoicePrice(choice.pricing) || (choice.productInfo?.price ? `${choice.productInfo.price}` : '');
                    const tileStyle = { ...thumbStyle, position: 'relative' };
                    const isVariable = Boolean(choice.isVariable || choice.productInfo?.isVariable);
                    const selIdNums = (choice.selectedVariationIds || []).map(Number);
                    const hasActiveVariations = isVariable && (mergeVars || selIdNums.length > 0);
                    return (wp.element.createElement("div", { className: `wof-preview-image-tile${isSelected ? ' is-selected' : ''}${hasActiveVariations ? ' wof-preview-image-tile--variable' : ''}`, key: choice.uuid, style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: hasAnyVariable ? '100px' : '68px',
                            maxWidth: hasAnyVariable ? '135px' : '82px',
                        } },
                        wp.element.createElement("span", { className: "wof-preview-image-tile__thumb", style: tileStyle },
                            imgSrc ? (wp.element.createElement("img", { src: imgSrc, alt: "", style: { width: '100%', height: '100%', objectFit: 'cover' } })) : (wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" })),
                            isSelected ? (wp.element.createElement("span", { className: "wof-preview-image-tile__check", style: { position: 'absolute', top: '2px', right: '2px', background: '#172033', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', zIndex: 3 } }, renderCheckSvg(10))) : null,
                            imageStyle === 'overlay' ? (wp.element.createElement("span", { style: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)', color: '#fff', fontSize: '9px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' } }, choice.label)) : null),
                        imageStyle !== 'only_image' && imageStyle !== 'overlay' ? (wp.element.createElement(wp.element.Fragment, null,
                            wp.element.createElement("small", { style: { minHeight: '1.3em', marginTop: '4px', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: hasAnyVariable ? '110px' : '80px' } }, choice.label),
                            priceText ? wp.element.createElement("span", { className: "wof-preview-image-tile__price", style: { minHeight: '1.3em' } }, priceText) : null)) : null,
                        hasActiveVariations ? (() => {
                            const allVars = choice.productInfo?.variations || [];
                            let displayVars = (!mergeVars && selIdNums.length > 0)
                                ? allVars.filter((v) => selIdNums.includes(Number(v.id)))
                                : allVars;
                            if (displayVars.length === 0 && selIdNums.length > 0) {
                                displayVars = selIdNums.map((id) => ({ id, label: `Variation #${id}`, price: '' }));
                            }
                            if (displayVars.length === 0) {
                                return hasAnyVariable ? wp.element.createElement("div", { className: "wof-product-variation-spacer", "aria-hidden": "true" }) : null;
                            }
                            return (wp.element.createElement("div", { style: { width: '100%', marginTop: '4px' }, onClick: (e) => e.stopPropagation() },
                                wp.element.createElement("select", { className: "wof-product-variation-select", disabled: true },
                                    wp.element.createElement("option", { value: "" }, __('Select variation', 'wooptions-pro')),
                                    displayVars.map((v) => (wp.element.createElement("option", { key: v.id, value: v.id },
                                        v.label,
                                        v.price ? ` — ${v.price}` : ''))))));
                        })() : (hasAnyVariable ? (wp.element.createElement("div", { className: "wof-product-variation-spacer", "aria-hidden": "true" })) : null),
                        field.enableQuantity ? (wp.element.createElement("span", { className: "wof-choice-qty-wrap", style: { marginTop: 'auto', paddingTop: '6px', display: 'flex', justifyContent: 'center', width: '100%' } },
                            wp.element.createElement("input", { disabled: true, type: "number", className: "wof-choice-qty-input", defaultValue: field.minQuantity ?? 1, style: { width: '100%', height: '28px', fontSize: '12px', textAlign: 'center' } }))) : null));
                })));
            }
            if (field.type === 'image_swatch') {
                const imageStyle = field.imageStyle || 'default';
                const thumbStyle = {};
                const hasRadius = field.choiceBorderRadius !== undefined && field.choiceBorderRadius !== null && String(field.choiceBorderRadius).trim() !== '';
                const hasWidth = field.choiceWidth !== undefined && field.choiceWidth !== null && String(field.choiceWidth).trim() !== '';
                const hasHeight = field.choiceHeight !== undefined && field.choiceHeight !== null && String(field.choiceHeight).trim() !== '';
                if (hasWidth)
                    thumbStyle.width = `${field.choiceWidth}px`;
                if (hasHeight)
                    thumbStyle.height = `${field.choiceHeight}px`;
                if (hasRadius)
                    thumbStyle.borderRadius = `${field.choiceBorderRadius}px`;
                return (wp.element.createElement("div", { className: "wof-preview-image-tiles" }, (choices.length > 0 ? choices : [{ uuid: 'ph', label: 'Option 1', imageUrl: '', imageId: 0, default: true }]).slice(0, 4).map((choice) => {
                    const isSelected = Boolean(choice.default || choice.selected);
                    return (wp.element.createElement("div", { className: `wof-preview-image-tile${isSelected ? ' is-selected' : ''}`, key: choice.uuid, style: { display: 'flex', flexDirection: 'column', alignItems: 'center' } },
                        wp.element.createElement("span", { className: "wof-preview-image-tile__thumb", style: { ...thumbStyle, position: 'relative', overflow: 'hidden' } },
                            choice.imageId || choice.imageUrl ? wp.element.createElement(WooOptionsPro.Components.MediaImage, { attachmentId: choice.imageId, src: choice.imageUrl, alt: "" }) : wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" }),
                            isSelected ? wp.element.createElement("span", { className: "wof-preview-image-tile__check", style: { position: 'absolute', top: '2px', right: '2px', background: '#172033', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', zIndex: 3 } }, renderCheckSvg(10)) : null,
                            imageStyle === 'overlay' ? (wp.element.createElement("span", { style: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)', color: '#fff', fontSize: '9px', fontWeight: 600, textAlign: 'center', lineHeight: 1.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' } }, choice.label)) : null),
                        imageStyle !== 'only_image' && imageStyle !== 'overlay' ? (wp.element.createElement(wp.element.Fragment, null,
                            wp.element.createElement("small", { style: { minHeight: '1.3em', marginTop: '4px', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' } }, choice.label),
                            choice.description ? (wp.element.createElement("small", { style: { color: '#64748b', fontSize: '10px', textAlign: 'center', lineHeight: 1.2 } }, choice.description)) : null,
                            wp.element.createElement("span", { className: "wof-preview-image-tile__price", style: { minHeight: '1.3em' } }, formatChoicePrice(choice.pricing)))) : null,
                        field.enableQuantity ? (wp.element.createElement("span", { className: "wof-choice-qty-wrap", style: { marginTop: 'auto', paddingTop: '6px', display: 'flex', justifyContent: 'center', width: '100%' } },
                            wp.element.createElement("input", { disabled: true, type: "number", className: "wof-choice-qty-input", defaultValue: field.minQuantity ?? 1, style: { width: '100%', height: '28px', fontSize: '12px', textAlign: 'center' } }))) : null));
                })));
            }
            if (field.type === 'repeater')
                return wp.element.createElement("div", { className: "wof-preview-repeater" },
                    wp.element.createElement("div", null,
                        wp.element.createElement("strong", null, "Item 1"),
                        wp.element.createElement("small", null,
                            field.children?.length ?? 0,
                            " fields")),
                    wp.element.createElement("button", { type: "button", disabled: true }, "+ Add item"));
            if (['datetime', 'date', 'time'].includes(field.type)) {
                const mode = field.dateTimeType || (field.type === 'time' ? 'time' : 'date');
                const calendarSvg = (wp.element.createElement("svg", { className: "wof-picker-icon", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                    wp.element.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
                    wp.element.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
                    wp.element.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
                    wp.element.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })));
                const clockSvg = (wp.element.createElement("svg", { className: "wof-picker-icon", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                    wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                    wp.element.createElement("polyline", { points: "12 6 12 12 16 14" })));
                const timeExample = field.timeFormat === '24' ? '12:00' : '12:00 PM';
                const dateExample = field.placeholder || (field.dateFormat === 'wp_default' ? 'Jul 30, 2025' : (field.dateFormat || 'DD/MM/YYYY'));
                const priceText = formatChoicePrice(field.pricing);
                if (mode === 'date') {
                    return (wp.element.createElement("div", { className: "wof-custom-picker-preview" },
                        wp.element.createElement("div", { className: "wof-custom-picker-input" },
                            calendarSvg,
                            wp.element.createElement("span", { className: "wof-picker-text" }, dateExample),
                            priceText ? wp.element.createElement("span", { className: "wof-preview-datetime__price" }, priceText) : null)));
                }
                if (mode === 'time') {
                    return (wp.element.createElement("div", { className: "wof-custom-picker-preview" },
                        wp.element.createElement("div", { className: "wof-custom-picker-input" },
                            clockSvg,
                            wp.element.createElement("span", { className: "wof-picker-text" }, field.placeholder || timeExample),
                            priceText ? wp.element.createElement("span", { className: "wof-preview-datetime__price" }, priceText) : null)));
                }
                return (wp.element.createElement("div", { className: "wof-custom-picker-preview", style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
                    wp.element.createElement("div", { className: "wof-custom-picker-input" },
                        calendarSvg,
                        wp.element.createElement("span", { className: "wof-picker-text" }, dateExample)),
                    wp.element.createElement("div", { className: "wof-custom-picker-input" },
                        clockSvg,
                        wp.element.createElement("span", { className: "wof-picker-text" }, timeExample),
                        priceText ? wp.element.createElement("span", { className: "wof-preview-datetime__price" }, priceText) : null)));
            }
            if (field.type === 'date_range') {
                const calendarSvg = (wp.element.createElement("svg", { className: "wof-picker-icon", width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                    wp.element.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
                    wp.element.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
                    wp.element.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
                    wp.element.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })));
                const sampleFormat = field.dateFormat === 'wp_default' ? 'Jul 30, 2025' : (field.dateFormat || 'DD/MM/YYYY');
                const startPlaceholder = field.placeholder || sampleFormat;
                const endPlaceholder = sampleFormat;
                const priceText = formatChoicePrice(field.pricing);
                return (wp.element.createElement("div", { className: "wof-custom-daterange-preview", style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                    wp.element.createElement("div", { className: "wof-custom-picker-input", style: { flex: 1 } },
                        calendarSvg,
                        wp.element.createElement("span", { className: "wof-picker-text" }, startPlaceholder)),
                    wp.element.createElement("span", { className: "wof-custom-daterange-preview__sep", style: { color: '#94a3b8', fontSize: '13px', fontWeight: 600 } }, "\u2192"),
                    wp.element.createElement("div", { className: "wof-custom-picker-input", style: { flex: 1 } },
                        calendarSvg,
                        wp.element.createElement("span", { className: "wof-picker-text" }, endPlaceholder),
                        priceText ? wp.element.createElement("span", { className: "wof-preview-datetime__price" }, priceText) : null)));
            }
            if (field.type === 'formula') {
                const mode = field.displayMode || 'currency';
                const decimals = Math.max(0, Math.min(6, field.decimalPlaces ?? 2));
                const adminConfig = window.WooOptionsProAdmin;
                const currencySymbol = adminConfig?.currencySymbol || adminConfig?.currency || '$';
                const currencyPos = adminConfig?.currencyPosition || 'left_space';
                let prefix = field.prefix ?? '';
                const suffix = field.suffix || '';
                if (mode === 'text') {
                    return (wp.element.createElement("span", { className: "wof-preview-formula-value" }, `${prefix}Sample output${suffix}`));
                }
                const sampleVal = (123).toFixed(decimals);
                let val = '';
                if (!prefix) {
                    if (currencyPos === 'right')
                        val = `${sampleVal}${currencySymbol}${suffix}`;
                    else if (currencyPos === 'right_space')
                        val = `${sampleVal} ${currencySymbol}${suffix}`;
                    else if (currencyPos === 'left')
                        val = `${currencySymbol}${sampleVal}${suffix}`;
                    else
                        val = `${currencySymbol} ${sampleVal}${suffix}`;
                }
                else {
                    val = `${prefix}${sampleVal}${suffix}`;
                }
                return (wp.element.createElement("span", { className: "wof-preview-formula-value" }, val));
            }
            const inputType = {
                tel: 'tel', email: 'email', url: 'url', number: 'number', customer_defined_price: 'number',
            };
            const isNum = field.type === 'number';
            const defaultValue = field.default != null && field.default !== '' ? String(field.default) : undefined;
            const priceText = formatChoicePrice(field.pricing);
            const inputElement = (wp.element.createElement("input", { disabled: true, type: inputType[field.type] ?? 'text', value: defaultValue, min: isNum && field.enableMinMax !== false && field.min != null ? String(field.min) : undefined, max: isNum && field.enableMinMax !== false && field.max != null ? String(field.max) : undefined, step: isNum && field.step != null ? String(field.step) : undefined, style: {
                    textTransform: field.textTransform && field.textTransform !== 'none' ? field.textTransform : undefined,
                    fontFamily: appliedFontFamily,
                }, placeholder: defaultValue !== undefined ? undefined : (field.placeholder || __('Enter value…', 'wooptions-pro')) }));
            if (priceText) {
                return (wp.element.createElement("div", { className: "wof-preview-scalar-wrap" },
                    inputElement,
                    wp.element.createElement("span", { className: "wof-preview-scalar__price" }, priceText)));
            }
            return inputElement;
        }
        Builder.FieldPreview = FieldPreview;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { SearchControl } = wp.components;
        const { __ } = wp.i18n;
        const { useMemo, useState } = wp.element;
        const groupLabels = {
            choice: __('Choices', 'wooptions-pro'),
            boolean: __('Yes / no', 'wooptions-pro'),
            scalar: __('Inputs', 'wooptions-pro'),
            upload: __('Assets', 'wooptions-pro'),
            calculated: __('Pricing & outputs', 'wooptions-pro'),
            repeater: __('Structure', 'wooptions-pro'),
            content: __('Content', 'wooptions-pro'),
        };
        function ElementItem(props) {
            const dragStart = (event) => {
                event.dataTransfer?.setData('application/x-wooptions-pro-field-type', props.type);
                if (event.dataTransfer)
                    event.dataTransfer.effectAllowed = 'copy';
            };
            return wp.element.createElement("button", { type: "button", draggable: true, className: "wof-palette-item", onDragStart: dragStart, onClick: () => props.onAdd(WooOptionsPro.FieldFactory.create(props.type)) },
                wp.element.createElement("span", { className: "wof-palette-item__grip" },
                    wp.element.createElement(WooOptionsPro.Components.GripIcon, null)),
                wp.element.createElement("span", { className: "wof-palette-item__icon" },
                    wp.element.createElement(WooOptionsPro.Components.FieldIcon, { type: props.type })),
                wp.element.createElement("strong", null, props.label));
        }
        function ElementsPanel(props) {
            const [search, setSearch] = useState('');
            const groups = useMemo(() => {
                const term = search.trim().toLowerCase();
                const map = new Map();
                Object.entries(window.WooOptionsProAdmin.fieldTypes).forEach(([type, manifest]) => {
                    const groupLabel = groupLabels[manifest.group] ?? manifest.group;
                    if (term && !`${type} ${manifest.label} ${manifest.group} ${groupLabel}`.toLowerCase().includes(term))
                        return;
                    const items = map.get(manifest.group) ?? [];
                    items.push({ type, label: manifest.label });
                    map.set(manifest.group, items);
                });
                return map;
            }, [search]);
            return wp.element.createElement("aside", { className: "wof-builder-palette" },
                wp.element.createElement("div", { className: "wof-builder-pane__heading wof-palette-heading" },
                    wp.element.createElement("div", null,
                        wp.element.createElement("h2", null, __('Elements', 'wooptions-pro')),
                        wp.element.createElement("p", null, __('Drag or click to add to the live product form', 'wooptions-pro'))),
                    wp.element.createElement("button", { type: "button", className: "wof-pane-action", onClick: props.onOpenStyle, "aria-label": __('Open Style Studio', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "ellipsis" }))),
                wp.element.createElement(SearchControl, { label: __('Search field types', 'wooptions-pro'), value: search, onChange: setSearch, placeholder: __('Find a field…', 'wooptions-pro') }),
                wp.element.createElement("div", { className: "wof-palette-groups" },
                    Array.from(groups.entries()).map(([group, items]) => wp.element.createElement("section", { key: group },
                        wp.element.createElement("h3", null, groupLabels[group] ?? group),
                        wp.element.createElement("div", null, items.map((item) => wp.element.createElement(ElementItem, { key: item.type, type: item.type, label: item.label, onAdd: props.onAdd }))))),
                    !groups.size ? wp.element.createElement("p", { className: "wof-palette-empty" }, __('No fields match that search.', 'wooptions-pro')) : null),
                wp.element.createElement("p", { className: "wof-palette-tip" },
                    wp.element.createElement(WooOptionsPro.Components.GripIcon, null),
                    __('Click to add, or drag a field onto the canvas.', 'wooptions-pro')));
        }
        Builder.ElementsPanel = ElementsPanel;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { __ } = wp.i18n;
        const { useEffect, useMemo, useState } = wp.element;
        const FIELD_TYPE_MIME = 'application/x-wooptions-pro-field-type';
        const FIELD_INDEX_MIME = 'application/x-wooptions-pro-field-index';
        const FIELD_UUID_MIME = 'application/x-wooptions-pro-field-uuid';
        const FIELD_CHILD_INDEX_MIME = 'application/x-wooptions-pro-child-index';
        function hasBuilderDrag(event) {
            const types = Array.from(event.dataTransfer?.types ?? []);
            return types.includes(FIELD_TYPE_MIME) || types.includes(FIELD_INDEX_MIME) || types.includes(FIELD_UUID_MIME) || types.includes(FIELD_CHILD_INDEX_MIME);
        }
        function getFormulaPreviewAmount(field) {
            const mode = field.displayMode || 'currency';
            const decimals = Math.max(0, Math.min(6, field.decimalPlaces ?? 2));
            const adminConfig = window.WooOptionsProAdmin;
            const currencySymbol = adminConfig?.currencySymbol || adminConfig?.currency || '$';
            const currencyPos = adminConfig?.currencyPosition || 'left_space';
            let prefix = field.prefix ?? '';
            const suffix = field.suffix || '';
            if (mode === 'text') {
                return `${prefix}Sample output${suffix}`;
            }
            const sampleNum = (123).toFixed(decimals);
            if (!prefix) {
                if (currencyPos === 'right')
                    return `${sampleNum}${currencySymbol}${suffix}`;
                if (currencyPos === 'right_space')
                    return `${sampleNum} ${currencySymbol}${suffix}`;
                if (currencyPos === 'left')
                    return `${currencySymbol}${sampleNum}${suffix}`;
                return `${currencySymbol} ${sampleNum}${suffix}`;
            }
            return `${prefix}${sampleNum}${suffix}`;
        }
        function NestedCanvasField(props) {
            const [dropEdge, setDropEdge] = useState(null);
            const dragStart = (event) => {
                event.stopPropagation();
                event.dataTransfer?.setData(FIELD_CHILD_INDEX_MIME, String(props.index));
                event.dataTransfer?.setData(FIELD_UUID_MIME, props.child.uuid);
                if (event.dataTransfer)
                    event.dataTransfer.effectAllowed = 'move';
            };
            const dragOver = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const element = event.currentTarget;
                const bounds = element.getBoundingClientRect();
                setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
            };
            const dragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setDropEdge(null);
            };
            const drop = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const sourceChild = Number(event.dataTransfer?.getData(FIELD_CHILD_INDEX_MIME));
                const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
                setDropEdge(null);
                if (Number.isInteger(sourceChild) && sourceChild >= 0) {
                    let finalIndex = insertIndex;
                    if (sourceChild < insertIndex)
                        finalIndex -= 1;
                    finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
                    if (finalIndex !== sourceChild)
                        props.onMove(sourceChild, finalIndex);
                }
            };
            const width = props.child.width || '100%';
            const typeLabel = window.WooOptionsProAdmin?.fieldTypes?.[props.child.type]?.label ?? props.child.type;
            return (wp.element.createElement("article", { className: WooOptionsPro.Utils.classNames('wof-canvas-field', 'wof-nested-canvas-field', props.selected && 'is-selected', props.child.disabled && 'is-disabled', dropEdge === 'before' && 'is-drop-before', dropEdge === 'after' && 'is-drop-after', props.child.type === 'formula' && 'wof-canvas-field--formula', `wof-canvas-field--width-${width.replace('%', '')}`), style: {
                    width: width === '33%' ? 'calc(33.333% - 8px)' : width === '50%' ? 'calc(50% - 8px)' : width === '66%' ? 'calc(66.666% - 8px)' : '100%',
                    flex: width === '33%' ? '0 0 calc(33.333% - 8px)' : width === '50%' ? '0 0 calc(50% - 8px)' : width === '66%' ? '0 0 calc(66.666% - 8px)' : '0 0 100%',
                    boxSizing: 'border-box',
                }, onDragOver: dragOver, onDragLeave: dragLeave, onDrop: drop, onClick: (e) => {
                    e.stopPropagation();
                    props.onSelect();
                }, "data-field-uuid": props.child.uuid },
                props.selected ? (wp.element.createElement("span", { className: "wof-canvas-field__type-badge" }, typeLabel)) : null,
                wp.element.createElement("div", { className: "wof-canvas-field__toolbar", onClick: (event) => event.stopPropagation() },
                    wp.element.createElement("button", { type: "button", draggable: true, className: "wof-canvas-field__drag-handle", onDragStart: dragStart, onDragEnd: () => setDropEdge(null), "aria-label": __('Drag field', 'wooptions-pro'), title: __('Drag to reorder', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.GripIcon, null)),
                    wp.element.createElement("button", { type: "button", onClick: props.onSelect, "aria-label": __('Field settings', 'wooptions-pro'), title: __('Settings', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-generic" })),
                    wp.element.createElement("button", { type: "button", onClick: props.onDuplicate, "aria-label": __('Duplicate field', 'wooptions-pro'), title: __('Duplicate', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-page" })),
                    wp.element.createElement("button", { type: "button", className: "is-destructive", onClick: props.onDelete, "aria-label": __('Delete field', 'wooptions-pro'), title: __('Delete', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" }))),
                wp.element.createElement("div", { className: "wof-canvas-field__copy" },
                    wp.element.createElement("strong", { className: "wof-canvas-field__title" },
                        props.child.label || __('Untitled field', 'wooptions-pro'),
                        props.child.help && props.child.helpTextPosition === 'tooltip' ? (wp.element.createElement("span", { className: "wof-field__tooltip-preview", title: props.child.help },
                            wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                                wp.element.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" })))) : null),
                    props.child.type === 'formula' ? (wp.element.createElement("span", { className: "wof-canvas-field__formula-val" }, getFormulaPreviewAmount(props.child))) : null,
                    props.child.required ? wp.element.createElement("span", { className: "wof-canvas-field__required" }, __('REQUIRED', 'wooptions-pro')) : null),
                props.child.type !== 'formula' ? (wp.element.createElement("div", { className: "wof-canvas-field__preview" },
                    wp.element.createElement(Builder.FieldPreview, { field: props.child }))) : null));
        }
        function CanvasSectionField(props) {
            const [dropEdge, setDropEdge] = useState(null);
            const [innerDropActive, setInnerDropActive] = useState(false);
            const [isExpanded, setIsExpanded] = useState(props.field.initialState !== 'close');
            useEffect(() => {
                setIsExpanded(props.field.initialState !== 'close');
            }, [props.field.initialState]);
            const dragStart = (event) => {
                event.stopPropagation();
                event.dataTransfer?.setData(FIELD_INDEX_MIME, String(props.index));
                event.dataTransfer?.setData(FIELD_UUID_MIME, props.field.uuid);
                if (event.dataTransfer)
                    event.dataTransfer.effectAllowed = 'move';
            };
            const dragOver = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
                const element = event.currentTarget;
                const bounds = element.getBoundingClientRect();
                setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
            };
            const dragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setDropEdge(null);
            };
            const drop = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
                const sourceText = event.dataTransfer?.getData(FIELD_INDEX_MIME) ?? '';
                const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
                setDropEdge(null);
                if (type) {
                    props.onAdd(WooOptionsPro.FieldFactory.create(type), insertIndex);
                    return;
                }
                const source = Number(sourceText);
                if (!Number.isInteger(source))
                    return;
                let finalIndex = insertIndex;
                if (source < insertIndex)
                    finalIndex -= 1;
                finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
                if (finalIndex !== source)
                    props.onMove(source, finalIndex);
            };
            const innerDragOver = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                setInnerDropActive(true);
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
            };
            const innerDragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setInnerDropActive(false);
            };
            const innerDrop = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                setInnerDropActive(false);
                const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
                const fieldUuid = event.dataTransfer?.getData(FIELD_UUID_MIME) ?? '';
                if (type) {
                    props.onAddChild?.(props.field.uuid, WooOptionsPro.FieldFactory.create(type));
                    return;
                }
                if (fieldUuid && fieldUuid !== props.field.uuid) {
                    props.onMoveToParent?.(fieldUuid, props.field.uuid);
                }
            };
            const width = props.field.width || '100%';
            const widthStyle = {
                width: width === '33%' ? 'calc(33.333% - 8px)' : width === '50%' ? 'calc(50% - 8px)' : width === '66%' ? 'calc(66.666% - 8px)' : '100%',
                flex: width === '33%' ? '0 0 calc(33.333% - 8px)' : width === '50%' ? '0 0 calc(50% - 8px)' : width === '66%' ? '0 0 calc(66.666% - 8px)' : '0 0 100%',
                boxSizing: 'border-box',
            };
            const styleVariant = props.field.sectionStyle || 'section';
            const isAccordion = styleVariant === 'accordion';
            const children = props.field.children ?? [];
            const adminConfig = window.WooOptionsProAdmin;
            const currency = adminConfig?.currencySymbol || adminConfig?.currency || '$';
            let priceLabel = '';
            if (props.field.repeatPriceType === 'fixed') {
                if (props.field.repeatSalePrice && props.field.repeatRegularPrice) {
                    priceLabel = `${currency} ${props.field.repeatSalePrice}`;
                }
                else if (props.field.repeatRegularPrice) {
                    priceLabel = `${currency} ${props.field.repeatRegularPrice}`;
                }
            }
            else if (props.field.repeatPriceType === 'percentage' && props.field.repeatRegularPrice) {
                priceLabel = `${props.field.repeatRegularPrice}%`;
            }
            const itemTitle = (props.field.repeatLabel || 'Item {n}').replace('{n}', '1');
            return (wp.element.createElement("article", { className: WooOptionsPro.Utils.classNames('wof-canvas-field', 'wof-canvas-section', `wof-canvas-section--${styleVariant}`, props.selected && 'is-selected', props.field.disabled && 'is-disabled', dropEdge === 'before' && 'is-drop-before', dropEdge === 'after' && 'is-drop-after', `wof-canvas-field--width-${width.replace('%', '')}`), style: widthStyle, onDragOver: dragOver, onDragLeave: dragLeave, onDrop: drop, onClick: props.onSelect, "data-field-uuid": props.field.uuid },
                props.selected ? (wp.element.createElement("span", { className: "wof-canvas-field__type-badge" }, __('Repeatable Section', 'wooptions-pro'))) : null,
                wp.element.createElement("div", { className: "wof-canvas-field__toolbar", onClick: (event) => event.stopPropagation() },
                    wp.element.createElement("button", { type: "button", draggable: true, className: "wof-canvas-field__drag-handle", onDragStart: dragStart, onDragEnd: () => setDropEdge(null), "aria-label": __('Drag section', 'wooptions-pro'), title: __('Drag to reorder', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.GripIcon, null)),
                    wp.element.createElement("button", { type: "button", onClick: props.onSelect, "aria-label": __('Section settings', 'wooptions-pro'), title: __('Settings', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-generic" })),
                    wp.element.createElement("button", { type: "button", onClick: props.onDuplicate, "aria-label": __('Duplicate section', 'wooptions-pro'), title: __('Duplicate', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-page" })),
                    wp.element.createElement("button", { type: "button", className: "is-destructive", onClick: props.onDelete, "aria-label": __('Delete section', 'wooptions-pro'), title: __('Delete', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" }))),
                !props.field.hideSectionTitle ? (wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-canvas-section__header', isAccordion && 'is-accordion-trigger'), onClick: (e) => {
                        if (isAccordion) {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }
                    } },
                    wp.element.createElement("strong", { className: "wof-canvas-section__title" },
                        props.field.label || __('Section Container', 'wooptions-pro'),
                        props.field.help && props.field.helpTextPosition === 'tooltip' ? (wp.element.createElement("span", { className: "wof-field__tooltip-preview", title: props.field.help },
                            wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                                wp.element.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
                                wp.element.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })))) : null),
                    isAccordion ? (wp.element.createElement("span", { className: WooOptionsPro.Utils.classNames('wof-canvas-section__chevron', isExpanded && 'is-open') },
                        wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("polyline", { points: "6 9 12 15 18 9" })))) : null)) : null,
                props.field.help && (props.field.helpTextPosition === 'below_title' || !props.field.helpTextPosition) && !props.field.hideSectionTitle ? (wp.element.createElement("p", { className: "wof-canvas-field__help-text wof-canvas-field__help-text--below-title", style: { margin: '-4px 0 12px 0' } }, props.field.help)) : null,
                (!isAccordion || isExpanded) ? (wp.element.createElement("div", { className: "wof-canvas-section__body" },
                    props.field.repeatable ? (wp.element.createElement("div", { className: "wof-canvas-section__item-header" },
                        wp.element.createElement("span", { className: "wof-canvas-section__item-title" }, itemTitle),
                        priceLabel ? wp.element.createElement("span", { className: "wof-canvas-section__item-price" }, priceLabel) : null)) : null,
                    children.length > 0 ? (wp.element.createElement("div", { className: "wof-canvas-section__children-list", style: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' } }, children.map((child, cIdx) => (wp.element.createElement(NestedCanvasField, { key: child.uuid, parentUuid: props.field.uuid, child: child, index: cIdx, count: children.length, selected: child.uuid === props.selectedUuid, onSelect: () => props.onSelectUuid?.(child.uuid), onDuplicate: () => props.onAddChild?.(props.field.uuid, WooOptionsPro.FieldFactory.duplicate(child)), onDelete: () => props.onDeleteField?.(child.uuid), onMove: (from, to) => props.onMoveChild?.(props.field.uuid, from, to) }))))) : null,
                    wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-canvas-section__dropzone', innerDropActive && 'is-drag-over'), onDragOver: innerDragOver, onDragLeave: innerDragLeave, onDrop: innerDrop },
                        wp.element.createElement("div", { className: "wof-canvas-section__dropzone-inner" },
                            wp.element.createElement("button", { type: "button", className: "wof-canvas-section__add-btn", title: __('Add field to section', 'wooptions-pro'), onClick: (e) => {
                                    e.stopPropagation();
                                    props.onAddChild?.(props.field.uuid, WooOptionsPro.FieldFactory.create('text'));
                                } },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" })))),
                    props.field.repeatable ? (props.field.repeatMethod === 'quantity' ? (wp.element.createElement("div", { className: "wof-canvas-section__qty-preview" },
                        wp.element.createElement("span", { className: "wof-canvas-section__qty-label" }, __('Quantity', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-qty-stepper" },
                            wp.element.createElement("button", { type: "button", disabled: true }, "\u2212"),
                            wp.element.createElement("span", null, "1"),
                            wp.element.createElement("button", { type: "button", disabled: true }, "+")))) : (wp.element.createElement("div", { className: "wof-canvas-section__footer" },
                        wp.element.createElement("button", { type: "button", className: "wof-canvas-section__add-another-btn" }, props.field.buttonLabel || __('Add Another', 'wooptions-pro'))))) : null)) : null,
                props.field.help && props.field.helpTextPosition === 'below_field' ? (wp.element.createElement("p", { className: "wof-canvas-field__help-text wof-canvas-field__help-text--below-field", style: { margin: '12px 0 0 0' } }, props.field.help)) : null));
        }
        function CanvasField(props) {
            const [dropEdge, setDropEdge] = useState(null);
            const dragStart = (event) => {
                event.stopPropagation();
                event.dataTransfer?.setData(FIELD_INDEX_MIME, String(props.index));
                event.dataTransfer?.setData(FIELD_UUID_MIME, props.field.uuid);
                if (event.dataTransfer)
                    event.dataTransfer.effectAllowed = 'move';
            };
            if (props.field.type === 'repeater') {
                return (wp.element.createElement(CanvasSectionField, { field: props.field, allFields: props.allFields, index: props.index, count: props.count, selected: props.selected, selectedUuid: props.selectedUuid, onSelect: props.onSelect, onSelectUuid: props.onSelectUuid, onAdd: props.onAdd, onAddChild: props.onAddChild, onMove: props.onMove, onMoveChild: props.onMoveChild, onMoveToParent: props.onMoveToParent, onDuplicate: props.onDuplicate, onDelete: props.onDelete, onDeleteField: props.onDeleteField }));
            }
            const dragOver = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
                const element = event.currentTarget;
                const bounds = element.getBoundingClientRect();
                setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
            };
            const dragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setDropEdge(null);
            };
            const drop = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
                const sourceText = event.dataTransfer?.getData(FIELD_INDEX_MIME) ?? '';
                const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
                setDropEdge(null);
                if (type) {
                    props.onAdd(WooOptionsPro.FieldFactory.create(type), insertIndex);
                    return;
                }
                const source = Number(sourceText);
                if (!Number.isInteger(source))
                    return;
                let finalIndex = insertIndex;
                if (source < insertIndex)
                    finalIndex -= 1;
                finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
                if (finalIndex !== source)
                    props.onMove(source, finalIndex);
            };
            const width = props.field.width || '100%';
            const widthStyle = {
                width: width === '33%' ? 'calc(33.333% - 8px)' : width === '50%' ? 'calc(50% - 8px)' : width === '66%' ? 'calc(66.666% - 8px)' : '100%',
                flex: width === '33%' ? '0 0 calc(33.333% - 8px)' : width === '50%' ? '0 0 calc(50% - 8px)' : width === '66%' ? '0 0 calc(66.666% - 8px)' : '0 0 100%',
                boxSizing: 'border-box',
            };
            const typeLabel = window.WooOptionsProAdmin?.fieldTypes?.[props.field.type]?.label ?? props.field.type;
            const priceText = Builder.formatChoicePrice(props.field.pricing);
            const isContentBlock = ['spacer', 'separator', 'content', 'modal', 'heading', 'paragraph', 'help'].includes(props.field.type);
            return wp.element.createElement("article", { className: WooOptionsPro.Utils.classNames('wof-canvas-field', props.selected && 'is-selected', props.field.disabled && 'is-disabled', dropEdge === 'before' && 'is-drop-before', dropEdge === 'after' && 'is-drop-after', isContentBlock && `wof-canvas-field--${props.field.type}`, props.field.type === 'formula' && 'wof-canvas-field--formula', `wof-canvas-field--width-${width.replace('%', '')}`), style: widthStyle, onDragOver: dragOver, onDragLeave: dragLeave, onDrop: drop, onClick: props.onSelect, "data-field-uuid": props.field.uuid },
                props.selected ? (wp.element.createElement("span", { className: "wof-canvas-field__type-badge" }, typeLabel)) : null,
                wp.element.createElement("div", { className: "wof-canvas-field__toolbar", onClick: (event) => event.stopPropagation() },
                    wp.element.createElement("button", { type: "button", draggable: true, className: "wof-canvas-field__drag-handle", onDragStart: dragStart, onDragEnd: () => setDropEdge(null), "aria-label": __('Drag field', 'wooptions-pro'), title: __('Drag to reorder', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.GripIcon, null)),
                    wp.element.createElement("button", { type: "button", onClick: props.onSelect, "aria-label": __('Field settings', 'wooptions-pro'), title: __('Settings', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-generic" })),
                    wp.element.createElement("button", { type: "button", onClick: props.onDuplicate, "aria-label": __('Duplicate field', 'wooptions-pro'), title: __('Duplicate', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "admin-page" })),
                    wp.element.createElement("button", { type: "button", className: "is-destructive", onClick: props.onDelete, "aria-label": __('Delete field', 'wooptions-pro'), title: __('Delete', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" }))),
                !isContentBlock ? (wp.element.createElement("div", { className: "wof-canvas-field__copy" },
                    wp.element.createElement("strong", { className: "wof-canvas-field__title" },
                        props.field.label || __('Untitled field', 'wooptions-pro'),
                        props.field.help && props.field.helpTextPosition === 'tooltip' ? (wp.element.createElement("span", { className: "wof-field__tooltip-preview", title: props.field.help },
                            wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                                wp.element.createElement("path", { d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" }),
                                wp.element.createElement("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })))) : null),
                    props.field.type === 'formula' ? (wp.element.createElement("span", { className: "wof-canvas-field__formula-val" }, getFormulaPreviewAmount(props.field))) : null,
                    priceText ? wp.element.createElement("span", { className: "wof-canvas-field__price" }, priceText) : null,
                    props.field.required ? wp.element.createElement("span", { className: "wof-canvas-field__required" }, __('REQUIRED', 'wooptions-pro')) : null,
                    props.field.help && (props.field.helpTextPosition === 'below_title' || !props.field.helpTextPosition) ? (wp.element.createElement("p", { className: "wof-canvas-field__help-text wof-canvas-field__help-text--below-title" }, props.field.help)) : null,
                    props.field.choices?.length ? (wp.element.createElement("small", { className: "wof-canvas-field__meta" },
                        props.field.choices.length,
                        " ",
                        __('Choices', 'wooptions-pro'))) : null)) : null,
                props.field.type !== 'formula' ? (wp.element.createElement("div", { className: "wof-canvas-field__preview" },
                    wp.element.createElement(Builder.FieldPreview, { field: props.field, allFields: props.allFields }))) : null,
                props.field.help && props.field.helpTextPosition === 'below_field' && !isContentBlock ? (wp.element.createElement("p", { className: "wof-canvas-field__help-text wof-canvas-field__help-text--below-field" }, props.field.help)) : null);
        }
        function Canvas(props) {
            const [zoom, setZoom] = useState(100);
            const [dragActive, setDragActive] = useState(false);
            const palette = window.WooOptionsProAdmin.palettes[props.document.style.palette] ?? window.WooOptionsProAdmin.palettes['iris-studio'];
            const tokens = { ...(palette?.tokens ?? {}), ...(props.document.style.overrides ?? {}) };
            const typography = props.document.style.typography ?? { family: 'inherit' };
            const fontStack = {
                inherit: 'inherit',
                'system-ui': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                Inter: 'Inter, system-ui, sans-serif',
                Manrope: 'Manrope, system-ui, sans-serif',
                Poppins: 'Poppins, system-ui, sans-serif',
                Outfit: 'Outfit, system-ui, sans-serif',
                'Plus Jakarta Sans': '"Plus Jakarta Sans", system-ui, sans-serif',
                Roboto: 'Roboto, system-ui, sans-serif',
            };
            const style = useMemo(() => ({
                '--wof-preview-primary': tokens.primary ?? '#5B4FF5',
                '--wof-preview-background': tokens.background ?? '#F7F7FC',
                '--wof-preview-surface': tokens.surface ?? '#FFFFFF',
                '--wof-preview-text': tokens.text ?? '#172033',
                '--wof-preview-muted': tokens.muted ?? '#5E6A7D',
                '--wof-preview-border': tokens.border ?? '#D8DEEA',
                '--wof-preview-danger': tokens.danger ?? '#C7353A',
                '--wof-preview-on-primary': tokens.onPrimary ?? '#FFFFFF',
                '--wof-preview-font': fontStack[typography.family] ?? typography.family ?? 'inherit',
                '--wof-preview-label-weight': String(typography.labelWeight ?? 600),
                '--wof-preview-body-weight': String(typography.bodyWeight ?? 400),
                zoom: zoom / 100,
            }), [props.document.style, zoom]);
            useEffect(() => {
                const reset = () => setDragActive(false);
                document.addEventListener('dragend', reset);
                document.addEventListener('drop', reset);
                return () => {
                    document.removeEventListener('dragend', reset);
                    document.removeEventListener('drop', reset);
                };
            }, []);
            const dropAtEnd = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                event.stopPropagation();
                setDragActive(false);
                const type = event.dataTransfer?.getData(FIELD_TYPE_MIME) ?? '';
                const source = Number(event.dataTransfer?.getData(FIELD_INDEX_MIME));
                if (type)
                    props.onAdd(WooOptionsPro.FieldFactory.create(type));
                else if (Number.isInteger(source))
                    props.onMove(source, props.document.fields.length - 1);
            };
            const canvasDragOver = (event) => {
                if (!hasBuilderDrag(event))
                    return;
                event.preventDefault();
                setDragActive(true);
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(FIELD_TYPE_MIME) ? 'copy' : 'move';
            };
            const canvasDragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setDragActive(false);
            };
            return wp.element.createElement("section", { className: WooOptionsPro.Utils.classNames('wof-builder-canvas', 'is-edit-mode', dragActive && 'is-drag-active') },
                wp.element.createElement("div", { className: "wof-canvas-toolbar" },
                    wp.element.createElement("div", { className: "wof-canvas-toolbar__copy" },
                        wp.element.createElement("h2", null, __('Live storefront canvas', 'wooptions-pro')),
                        wp.element.createElement("p", null, __('The builder and product page use the same component stylesheet.', 'wooptions-pro'))),
                    wp.element.createElement("div", { className: "wof-canvas-toolbar__controls" },
                        wp.element.createElement("div", { className: "wof-zoom-control" },
                            wp.element.createElement("button", { type: "button", disabled: zoom <= 75, onClick: () => setZoom(Math.max(75, zoom - 10)) },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "minus" })),
                            wp.element.createElement("output", null,
                                zoom,
                                "%"),
                            wp.element.createElement("button", { type: "button", disabled: zoom >= 125, onClick: () => setZoom(Math.min(125, zoom + 10)) },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }))),
                        wp.element.createElement("span", { className: "wof-interactive-status" },
                            wp.element.createElement("i", null),
                            __('Interactive', 'wooptions-pro')))),
                wp.element.createElement("div", { className: `wof-canvas-device is-${props.device}`, style: style },
                    wp.element.createElement("div", { className: "wof-canvas-device__chrome" },
                        wp.element.createElement("span", null, __('Live customer preview', 'wooptions-pro')),
                        wp.element.createElement("small", null,
                            props.device,
                            " \u00B7 ",
                            props.document.layout.type)),
                    wp.element.createElement("div", { className: "wof-canvas-frame" },
                        wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-canvas-sheet', dragActive && 'is-drag-active'), onDragEnter: canvasDragOver, onDragOver: canvasDragOver, onDragLeave: canvasDragLeave, onDrop: dropAtEnd },
                            wp.element.createElement("div", { className: "wof-product-shell" },
                                wp.element.createElement("aside", { className: "wof-product-shell__media" },
                                    wp.element.createElement("div", { className: "wof-product-gallery__hero" },
                                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" })),
                                    wp.element.createElement("div", { className: "wof-product-gallery__thumbs" },
                                        wp.element.createElement("div", { className: "wof-product-gallery__thumb" },
                                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" })),
                                        wp.element.createElement("div", { className: "wof-product-gallery__thumb" },
                                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" })),
                                        wp.element.createElement("div", { className: "wof-product-gallery__thumb" },
                                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" })))),
                                wp.element.createElement("div", { className: "wof-product-shell__content" },
                                    wp.element.createElement("div", { className: "wof-product-preview-meta" },
                                        wp.element.createElement("span", { className: "wof-product-preview-meta__eyebrow" }, __('Live product preview', 'wooptions-pro')),
                                        wp.element.createElement("h1", null, __('WooOptionsPro Product (Preview)', 'wooptions-pro')),
                                        wp.element.createElement("strong", { className: "wof-product-preview-meta__price" }, `20.00 ${window.WooOptionsProAdmin?.currency || 'USD'}`)),
                                    props.document.fields.length ? wp.element.createElement("div", { className: `wof-canvas-fields is-${props.document.layout.type}`, style: { display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start' } },
                                        props.document.fields.map((field, index) => wp.element.createElement(CanvasField, { key: field.uuid, field: field, allFields: props.document.fields, index: index, count: props.document.fields.length, selected: field.uuid === props.selectedUuid, selectedUuid: props.selectedUuid, onSelect: () => props.onSelect(field.uuid), onSelectUuid: props.onSelect, onAdd: props.onAdd, onAddChild: props.onAddChild, onMove: props.onMove, onMoveChild: props.onMoveChild, onMoveToParent: props.onMoveToParent, onDuplicate: () => props.onDuplicate(field), onDelete: () => props.onDelete(field.uuid), onDeleteField: props.onDelete })),
                                        wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-canvas-drop-end', dragActive && 'is-active'), onDragOver: canvasDragOver, onDrop: dropAtEnd },
                                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }),
                                            __('Drop a field here', 'wooptions-pro'))) : wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-canvas-empty', dragActive && 'is-active'), onDragOver: canvasDragOver, onDrop: dropAtEnd },
                                        wp.element.createElement("div", null,
                                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "layout" })),
                                        wp.element.createElement("h3", null, __('Your canvas is ready', 'wooptions-pro')),
                                        wp.element.createElement("p", null, __('Choose a field from the palette or drag one into this product page preview.', 'wooptions-pro')))))))));
        }
        Builder.Canvas = Canvas;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { ColorPicker, SelectControl, ToggleControl } = wp.components;
        const { __ } = wp.i18n;
        const { useState, useEffect, useRef } = wp.element;
        const COLOR_FIELDS = [
            { key: 'text', label: __('Text Color', 'wooptions-pro'), defaultColor: '#1A1A1A' },
            { key: 'primary', label: __('Primary', 'wooptions-pro'), defaultColor: '#1A1A1A' },
            { key: 'border', label: __('Field Border', 'wooptions-pro'), defaultColor: '#8A8A8A' },
            { key: 'surface', label: __('Field Fill', 'wooptions-pro'), defaultColor: '#FFFFFF' },
            { key: 'onPrimary', label: __('Over Primary Color', 'wooptions-pro'), defaultColor: '#FFFFFF' },
            { key: 'danger', label: __('Required / Error Color', 'wooptions-pro'), defaultColor: '#DF1C41' },
        ];
        function ColorFieldItem(props) {
            const [localHex, setLocalHex] = useState(props.value);
            const [isFocused, setIsFocused] = useState(false);
            const [pickerOpen, setPickerOpen] = useState(false);
            const containerRef = useRef(null);
            useEffect(() => {
                setLocalHex(props.value);
            }, [props.value]);
            useEffect(() => {
                if (!pickerOpen)
                    return;
                const handleDown = (e) => {
                    if (containerRef.current && !containerRef.current.contains(e.target)) {
                        setPickerOpen(false);
                    }
                };
                const handleKeyDown = (e) => {
                    if (e.key === 'Escape') {
                        setPickerOpen(false);
                    }
                };
                document.addEventListener('mousedown', handleDown);
                document.addEventListener('keydown', handleKeyDown);
                return () => {
                    document.removeEventListener('mousedown', handleDown);
                    document.removeEventListener('keydown', handleKeyDown);
                };
            }, [pickerOpen]);
            const handleInputChange = (e) => {
                const raw = e.target.value;
                setLocalHex(raw);
                let val = raw.trim();
                if (!val.startsWith('#') && val.length > 0) {
                    val = '#' + val;
                }
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    props.onChange(val.toUpperCase());
                }
            };
            const handleBlur = () => {
                setIsFocused(false);
                let val = localHex.trim();
                if (!val.startsWith('#') && val.length > 0) {
                    val = '#' + val;
                }
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                    const formatted = val.toUpperCase();
                    setLocalHex(formatted);
                    props.onChange(formatted);
                }
                else {
                    setLocalHex(props.value);
                }
            };
            const handleColorPickerChange = (next) => {
                const hex = typeof next === 'string' ? next : (next?.hex || safeHex);
                const cleanHex = String(hex || '').trim().toUpperCase();
                if (/^#[0-9A-F]{6}$/.test(cleanHex)) {
                    setLocalHex(cleanHex);
                    props.onChange(cleanHex);
                }
            };
            const isLightColor = (hex) => {
                const clean = hex.replace('#', '');
                if (clean.length !== 6)
                    return false;
                const r = parseInt(clean.substring(0, 2), 16);
                const g = parseInt(clean.substring(2, 4), 16);
                const b = parseInt(clean.substring(4, 6), 16);
                return (r * 299 + g * 587 + b * 114) / 1000 > 215;
            };
            const safeHex = /^#[0-9A-Fa-f]{6}$/.test(props.value) ? props.value : '#000000';
            return (wp.element.createElement("div", { className: "wof-color-field-item", ref: containerRef },
                wp.element.createElement("label", { className: "wof-color-field-label", title: props.label }, props.label),
                wp.element.createElement("div", { className: `wof-color-field-control ${isFocused ? 'is-focused' : ''} ${pickerOpen ? 'is-picker-open' : ''}` },
                    wp.element.createElement("button", { type: "button", className: "wof-color-swatch-box", onClick: () => setPickerOpen(!pickerOpen), title: __('Pick color', 'wooptions-pro'), "aria-expanded": pickerOpen },
                        wp.element.createElement("span", { className: `wof-color-circle ${isLightColor(safeHex) ? 'has-border' : ''}`, style: { backgroundColor: safeHex } })),
                    wp.element.createElement("input", { type: "text", className: "wof-color-text-input", value: localHex, onChange: handleInputChange, onFocus: () => setIsFocused(true), onBlur: handleBlur, maxLength: 7, spellCheck: false, "aria-label": `${props.label} Hex Code` }),
                    pickerOpen && (wp.element.createElement("div", { className: `wof-color-popover ${props.columnIndex === 1 ? 'is-right' : 'is-left'} ${props.openUpward ? 'is-upward' : ''}` },
                        wp.element.createElement("div", { className: "wof-color-popover__header" },
                            wp.element.createElement("strong", null, props.label),
                            wp.element.createElement("button", { type: "button", className: "wof-color-popover__close", onClick: () => setPickerOpen(false), "aria-label": __('Close color picker', 'wooptions-pro') }, "\u00D7")),
                        wp.element.createElement("div", { className: "wof-color-popover__body" },
                            wp.element.createElement(ColorPicker, { color: safeHex, enableAlpha: false, onChange: handleColorPickerChange, onChangeComplete: handleColorPickerChange })))))));
        }
        function StyleStudio(props) {
            const document = props.document;
            const [isCustomizeOpen, setIsCustomizeOpen] = useState(true);
            const updateStyle = (patch) => props.onChange({ style: { ...document.style, ...patch } });
            const updateTypography = (patch) => updateStyle({ typography: { ...document.style.typography, ...patch } });
            const updateSettings = (patch) => props.onChange({ settings: { ...document.settings, ...patch } });
            const fonts = ['inherit', 'system-ui', 'Inter', 'Manrope', 'Poppins', 'Outfit', 'Plus Jakarta Sans', 'Roboto'];
            const handleSelectPalette = (key) => {
                const preset = window.WooOptionsProAdmin.palettes[key];
                const newOverrides = preset?.tokens ? { ...preset.tokens } : {};
                updateStyle({
                    palette: key,
                    overrides: newOverrides,
                });
            };
            const handleColorChange = (tokenKey, hex) => {
                const presetTokens = window.WooOptionsProAdmin.palettes[document.style.palette]?.tokens ?? {};
                const currentOverrides = document.style.overrides ?? {};
                const updated = {
                    ...presetTokens,
                    ...currentOverrides,
                    [tokenKey]: hex.toUpperCase(),
                };
                updateStyle({
                    overrides: updated,
                });
            };
            const getFieldColor = (tokenKey, fallback) => {
                let color = '';
                if (document.style?.overrides && document.style.overrides[tokenKey]) {
                    color = document.style.overrides[tokenKey];
                }
                else {
                    const preset = window.WooOptionsProAdmin.palettes?.[document.style?.palette];
                    if (preset?.tokens && preset.tokens[tokenKey]) {
                        color = preset.tokens[tokenKey];
                    }
                }
                if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                    return color.toUpperCase();
                }
                return fallback;
            };
            return wp.element.createElement("div", { className: "wof-style-studio" },
                wp.element.createElement("h3", null, __('Color palette', 'wooptions-pro')),
                wp.element.createElement("div", { className: "wof-palette-picker" }, Object.entries(window.WooOptionsProAdmin.palettes).map(([key, palette]) => (wp.element.createElement("button", { type: "button", key: key, className: document.style.palette === key ? 'is-selected' : '', onClick: () => handleSelectPalette(key) },
                    wp.element.createElement("span", { className: "wof-palette-dots" }, ['primary', 'accent', 'background', 'surface'].map((token) => (wp.element.createElement("i", { key: token, style: { background: palette.tokens[token] } })))),
                    wp.element.createElement("span", null,
                        wp.element.createElement("strong", null, palette.name),
                        wp.element.createElement("small", null, key)),
                    wp.element.createElement("span", { className: "wof-palette-check", "aria-hidden": "true" },
                        wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("polyline", { points: "2.5,8.5 6.5,12.5 13.5,3.5" }))))))),
                wp.element.createElement("div", { className: "wof-customize-colors-section" },
                    wp.element.createElement("button", { type: "button", className: "wof-customize-colors-header", onClick: () => setIsCustomizeOpen(!isCustomizeOpen), "aria-expanded": isCustomizeOpen },
                        wp.element.createElement("h4", null, __('Customize Colors', 'wooptions-pro')),
                        wp.element.createElement("span", { className: `wof-customize-colors-chevron ${isCustomizeOpen ? 'is-open' : ''}` },
                            wp.element.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                                wp.element.createElement("polyline", { points: "18 15 12 9 6 15" })))),
                    isCustomizeOpen && (wp.element.createElement("div", { className: "wof-customize-colors-grid" }, COLOR_FIELDS.map((field, idx) => (wp.element.createElement(ColorFieldItem, { key: field.key, label: field.label, tokenKey: field.key, columnIndex: idx % 2, openUpward: idx >= 4, value: getFieldColor(field.key, field.defaultColor), onChange: (hex) => handleColorChange(field.key, hex) })))))),
                wp.element.createElement("div", { className: "wof-style-divider" }),
                wp.element.createElement("h3", null, __('Typography', 'wooptions-pro')),
                wp.element.createElement(SelectControl, { label: __('Font family', 'wooptions-pro'), value: document.style.typography.family ?? 'inherit', options: fonts.map((font) => ({ label: font === 'inherit' ? __('Inherit from theme', 'wooptions-pro') : font === 'system-ui' ? __('System UI', 'wooptions-pro') : font, value: font })), onChange: (family) => updateTypography({ family }) }),
                wp.element.createElement(SelectControl, { label: __('Label weight', 'wooptions-pro'), value: String(document.style.typography.labelWeight ?? 600), options: [400, 500, 600, 650, 700, 800].map((value) => ({ label: String(value), value: String(value) })), onChange: (value) => updateTypography({ labelWeight: Number(value) }) }),
                wp.element.createElement(SelectControl, { label: __('Body weight', 'wooptions-pro'), value: String(document.style.typography.bodyWeight ?? 400), options: [300, 400, 450, 500, 600, 700].map((value) => ({ label: String(value), value: String(value) })), onChange: (value) => updateTypography({ bodyWeight: Number(value) }) }),
                wp.element.createElement("div", { className: "wof-style-divider" }),
                wp.element.createElement("h3", null, __('Layout & summary', 'wooptions-pro')),
                wp.element.createElement(ToggleControl, { label: __('Show itemized price breakdown', 'wooptions-pro'), checked: document.settings.showPriceBreakdown, onChange: (value) => updateSettings({ showPriceBreakdown: value }) }),
                wp.element.createElement(ToggleControl, { label: __('Keep configuration summary visible', 'wooptions-pro'), checked: document.settings.stickySummary, onChange: (value) => updateSettings({ stickySummary: value }) }),
                wp.element.createElement(ToggleControl, { label: __('Allow saved configurations', 'wooptions-pro'), checked: document.settings.saveEnabled, onChange: (value) => updateSettings({ saveEnabled: value }) }),
                wp.element.createElement(ToggleControl, { label: __('Allow shareable links', 'wooptions-pro'), checked: document.settings.shareEnabled, onChange: (value) => updateSettings({ shareEnabled: value }) }));
        }
        Builder.StyleStudio = StyleStudio;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { SelectControl, TextControl, ToggleControl } = wp.components;
        const { __, sprintf } = wp.i18n;
        const { useMemo } = wp.element;
        const contentOnlyTypes = ['heading', 'paragraph', 'help', 'separator', 'spacer', 'formula'];
        const operatorOptions = [
            { label: __('equals', 'wooptions-pro'), value: 'equals' },
            { label: __('does not equal', 'wooptions-pro'), value: 'not_equals' },
            { label: __('contains / is selected', 'wooptions-pro'), value: 'contains' },
            { label: __('does not contain', 'wooptions-pro'), value: 'not_contains' },
            { label: __('is greater than', 'wooptions-pro'), value: 'greater_than' },
            { label: __('is less than', 'wooptions-pro'), value: 'less_than' },
            { label: __('is empty', 'wooptions-pro'), value: 'empty' },
            { label: __('is not empty', 'wooptions-pro'), value: 'not_empty' },
        ];
        function cloneGroups(groups) {
            return groups.map((group) => ({
                ...group,
                conditions: group.conditions.map((condition) => ({ ...condition })),
            }));
        }
        function defaultCondition(fieldUuid, fields) {
            const source = fields.find((field) => field.uuid === fieldUuid);
            const operator = source?.multiple || ['checkbox_group', 'product'].includes(source?.type ?? '') ? 'contains' : 'equals';
            return {
                field: fieldUuid,
                operator,
                value: String(source?.choices?.[0]?.uuid ?? ''),
            };
        }
        function toConditionRow(expression) {
            return {
                field: String(expression?.left?.field ?? expression?.field ?? ''),
                operator: (expression?.operator ?? 'equals'),
                value: String(expression?.right?.literal ?? expression?.value ?? ''),
            };
        }
        function normalizeState(field, fields) {
            const visibility = (field.conditions ?? {}).visible;
            let effect = 'show';
            let expression = visibility;
            if (expression?.logic === 'not') {
                effect = 'hide';
                expression = expression.not ?? expression.condition ?? {};
            }
            let rootLogic = 'and';
            let storedGroups = [];
            if (expression?.wofRoot && Array.isArray(expression.conditions)) {
                rootLogic = expression.logic === 'or' ? 'or' : 'and';
                storedGroups = expression.conditions;
            }
            else if (['and', 'or'].includes(expression?.logic ?? '') && Array.isArray(expression?.conditions)) {
                const containsNestedGroup = expression.conditions.some((item) => ['and', 'or'].includes(item?.logic ?? '') && Array.isArray(item?.conditions));
                if (containsNestedGroup) {
                    rootLogic = expression.logic === 'or' ? 'or' : 'and';
                    storedGroups = expression.conditions;
                }
                else {
                    storedGroups = [expression];
                }
            }
            else if (expression && (expression.left || expression.field)) {
                storedGroups = [{ logic: 'and', conditions: [expression] }];
            }
            const groups = storedGroups
                .map((group) => ({
                logic: group.logic === 'or' ? 'or' : 'and',
                conditions: (Array.isArray(group.conditions) ? group.conditions : [group])
                    .filter(Boolean)
                    .map(toConditionRow),
            }))
                .filter((group) => group.conditions.length > 0);
            const firstField = fields[0]?.uuid ?? '';
            return {
                enabled: Boolean(visibility),
                effect,
                rootLogic,
                groups: groups.length ? groups : [{ logic: 'and', conditions: [defaultCondition(firstField, fields)] }],
            };
        }
        function LogicEditor(props) {
            const sourceFields = useMemo(() => WooOptionsPro.Utils.allFields(props.allFields).filter((field) => field.uuid !== props.field.uuid && !contentOnlyTypes.includes(field.type)), [props.allFields, props.field.uuid]);
            const state = useMemo(() => normalizeState(props.field, sourceFields), [props.field.conditions, sourceFields]);
            const save = (patch) => {
                const next = { ...state, ...patch };
                const fieldConditions = { ...(props.field.conditions ?? {}) };
                if (!next.enabled) {
                    delete fieldConditions.visible;
                    props.onChange({ ...props.field, conditions: fieldConditions });
                    return;
                }
                const storedGroups = next.groups
                    .map((group) => ({
                    logic: group.logic,
                    conditions: group.conditions
                        .filter((condition) => Boolean(condition.field))
                        .map((condition) => ({
                        left: { field: condition.field },
                        operator: condition.operator,
                        right: { literal: condition.value },
                    })),
                    wofGroup: true,
                }))
                    .filter((group) => Boolean(group.conditions?.length));
                if (!storedGroups.length) {
                    delete fieldConditions.visible;
                }
                else {
                    let visibility = storedGroups.length === 1
                        ? storedGroups[0]
                        : { logic: next.rootLogic, conditions: storedGroups, wofRoot: true };
                    if (next.effect === 'hide')
                        visibility = { logic: 'not', condition: visibility, wofEffect: 'hide' };
                    fieldConditions.visible = visibility;
                }
                props.onChange({ ...props.field, conditions: fieldConditions });
            };
            const updateGroup = (groupIndex, patch) => {
                const groups = cloneGroups(state.groups);
                groups[groupIndex] = { ...groups[groupIndex], ...patch };
                save({ groups });
            };
            const updateCondition = (groupIndex, conditionIndex, patch) => {
                const groups = cloneGroups(state.groups);
                groups[groupIndex].conditions[conditionIndex] = { ...groups[groupIndex].conditions[conditionIndex], ...patch };
                save({ groups });
            };
            const addCondition = (groupIndex) => {
                const groups = cloneGroups(state.groups);
                groups[groupIndex].conditions.push(defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields));
                save({ groups });
            };
            const removeCondition = (groupIndex, conditionIndex) => {
                const groups = cloneGroups(state.groups);
                groups[groupIndex].conditions.splice(conditionIndex, 1);
                if (!groups[groupIndex].conditions.length)
                    groups[groupIndex].conditions.push(defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields));
                save({ groups });
            };
            const removeGroup = (groupIndex) => {
                const groups = cloneGroups(state.groups);
                groups.splice(groupIndex, 1);
                save({ groups: groups.length ? groups : [{ logic: 'and', conditions: [defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields)] }] });
            };
            return wp.element.createElement("div", { className: "wof-inspector-section wof-logic-builder" },
                wp.element.createElement("div", { className: "wof-inspector-section__intro" },
                    wp.element.createElement("div", null,
                        wp.element.createElement("h3", null, __('Conditional logic', 'wooptions-pro')),
                        wp.element.createElement("p", null, __('Show or hide this field using multiple grouped conditions. Rules are rechecked securely on the storefront.', 'wooptions-pro')))),
                wp.element.createElement(ToggleControl, { __nextHasNoMarginBottom: true, label: __('Enable conditional logic', 'wooptions-pro'), checked: state.enabled, disabled: !sourceFields.length, onChange: (enabled) => enabled
                        ? save({ enabled: true, groups: [{ logic: 'and', conditions: [defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields)] }] })
                        : save({ enabled: false }) }),
                !sourceFields.length ? wp.element.createElement("div", { className: "wof-logic-empty" }, __('Add another customer-input field before creating a condition.', 'wooptions-pro')) : null,
                state.enabled && sourceFields.length ? wp.element.createElement(wp.element.Fragment, null,
                    wp.element.createElement("div", { className: "wof-logic-behavior" },
                        wp.element.createElement(SelectControl, { label: __('Action', 'wooptions-pro'), value: state.effect, options: [{ label: __('Show this field', 'wooptions-pro'), value: 'show' }, { label: __('Hide this field', 'wooptions-pro'), value: 'hide' }], onChange: (effect) => save({ effect }) }),
                        state.groups.length > 1 ? wp.element.createElement(SelectControl, { label: __('Match rule groups', 'wooptions-pro'), value: state.rootLogic, options: [{ label: __('All groups must match', 'wooptions-pro'), value: 'and' }, { label: __('Any group may match', 'wooptions-pro'), value: 'or' }], onChange: (rootLogic) => save({ rootLogic }) }) : null),
                    wp.element.createElement("div", { className: "wof-logic-groups" }, state.groups.map((group, groupIndex) => wp.element.createElement("article", { className: "wof-logic-group", key: `group-${groupIndex}` },
                        wp.element.createElement("header", null,
                            wp.element.createElement("div", null,
                                wp.element.createElement("span", null, groupIndex + 1),
                                wp.element.createElement("div", null,
                                    wp.element.createElement("strong", null, sprintf(__('Rule group %d', 'wooptions-pro'), groupIndex + 1)),
                                    wp.element.createElement("small", null, __('Conditions inside this group', 'wooptions-pro')))),
                            wp.element.createElement(SelectControl, { label: __('Group matching', 'wooptions-pro'), hideLabelFromVision: true, value: group.logic, options: [{ label: __('Match all (AND)', 'wooptions-pro'), value: 'and' }, { label: __('Match any (OR)', 'wooptions-pro'), value: 'or' }], onChange: (logic) => updateGroup(groupIndex, { logic }) }),
                            state.groups.length > 1 ? wp.element.createElement("button", { type: "button", className: "wof-logic-delete", onClick: () => removeGroup(groupIndex), "aria-label": __('Delete rule group', 'wooptions-pro') },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" })) : null),
                        wp.element.createElement("div", { className: "wof-logic-conditions" }, group.conditions.map((condition, conditionIndex) => {
                            const source = sourceFields.find((field) => field.uuid === condition.field);
                            const hasChoices = Boolean(source?.choices?.length);
                            const needsValue = !['empty', 'not_empty'].includes(condition.operator);
                            return wp.element.createElement("div", { className: "wof-logic-condition", key: `condition-${groupIndex}-${conditionIndex}` },
                                wp.element.createElement("span", { className: "wof-logic-condition__number" }, conditionIndex + 1),
                                wp.element.createElement(SelectControl, { label: __('Source field', 'wooptions-pro'), hideLabelFromVision: true, value: condition.field, options: sourceFields.map((field) => ({ label: field.label || field.type, value: field.uuid })), onChange: (fieldUuid) => updateCondition(groupIndex, conditionIndex, defaultCondition(fieldUuid, sourceFields)) }),
                                wp.element.createElement(SelectControl, { label: __('Operator', 'wooptions-pro'), hideLabelFromVision: true, value: condition.operator, options: operatorOptions, onChange: (operator) => updateCondition(groupIndex, conditionIndex, { operator }) }),
                                needsValue ? hasChoices ? wp.element.createElement(SelectControl, { label: __('Value', 'wooptions-pro'), hideLabelFromVision: true, value: condition.value, options: [{ label: __('Choose a value…', 'wooptions-pro'), value: '' }, ...(source?.choices ?? []).map((choice) => ({ label: choice.label, value: choice.uuid }))], onChange: (value) => updateCondition(groupIndex, conditionIndex, { value }) }) : ['checkbox', 'toggle'].includes(source?.type ?? '') ? wp.element.createElement(SelectControl, { label: __('Value', 'wooptions-pro'), hideLabelFromVision: true, value: condition.value, options: [{ label: __('Checked / Yes', 'wooptions-pro'), value: '1' }, { label: __('Unchecked / No', 'wooptions-pro'), value: '' }], onChange: (value) => updateCondition(groupIndex, conditionIndex, { value }) }) : wp.element.createElement(TextControl, { label: __('Comparison value', 'wooptions-pro'), hideLabelFromVision: true, value: condition.value, placeholder: __('Enter a value', 'wooptions-pro'), onChange: (value) => updateCondition(groupIndex, conditionIndex, { value }) }) : null,
                                wp.element.createElement("button", { type: "button", className: "wof-logic-condition__remove", disabled: state.groups.length === 1 && group.conditions.length === 1, onClick: () => removeCondition(groupIndex, conditionIndex), "aria-label": __('Remove condition', 'wooptions-pro') },
                                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "no-alt" })));
                        })),
                        wp.element.createElement("button", { type: "button", className: "wof-logic-add-condition", onClick: () => addCondition(groupIndex) },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }),
                            __('Add condition', 'wooptions-pro'))))),
                    wp.element.createElement("button", { type: "button", className: "wof-logic-add-group", onClick: () => save({ groups: [...cloneGroups(state.groups), { logic: 'and', conditions: [defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields)] }] }) },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }),
                        __('Add rule group', 'wooptions-pro')),
                    wp.element.createElement("p", { className: "wof-muted-note" }, __('Use groups to combine AND and OR rules. Choice-based comparisons store stable choice IDs, so renaming labels will not break the logic.', 'wooptions-pro'))) : null);
        }
        Builder.LogicEditor = LogicEditor;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { Button, ColorPicker, Modal, SelectControl, TextControl, TextareaControl, ToggleControl } = wp.components;
        const { __, sprintf } = wp.i18n;
        const { useEffect, useMemo, useRef, useState } = wp.element;
        const tabs = [
            ['content', __('Content', 'wooptions-pro')],
            ['choices', __('Choices', 'wooptions-pro')],
            ['pricing', __('Pricing', 'wooptions-pro')],
            ['logic', __('Logic', 'wooptions-pro')],
            ['style', __('Style', 'wooptions-pro')],
            ['advanced', __('Advanced', 'wooptions-pro')],
        ];
        const COUNTRY_OPTIONS = [
            { label: 'United States (+1)', value: 'US' },
            { label: 'United Kingdom (+44)', value: 'GB' },
            { label: 'Canada (+1)', value: 'CA' },
            { label: 'Australia (+61)', value: 'AU' },
            { label: 'Germany (+49)', value: 'DE' },
            { label: 'France (+33)', value: 'FR' },
            { label: 'Italy (+39)', value: 'IT' },
            { label: 'Spain (+34)', value: 'ES' },
            { label: 'Netherlands (+31)', value: 'NL' },
            { label: 'Brazil (+55)', value: 'BR' },
            { label: 'India (+91)', value: 'IN' },
            { label: 'China (+86)', value: 'CN' },
            { label: 'Japan (+81)', value: 'JP' },
            { label: 'South Korea (+82)', value: 'KR' },
            { label: 'Mexico (+52)', value: 'MX' },
            { label: 'United Arab Emirates (+971)', value: 'AE' },
            { label: 'Saudi Arabia (+966)', value: 'SA' },
            { label: 'Singapore (+65)', value: 'SG' },
            { label: 'Bangladesh (+880)', value: 'BD' },
            { label: 'Pakistan (+92)', value: 'PK' },
            { label: 'South Africa (+27)', value: 'ZA' },
            { label: 'Turkey (+90)', value: 'TR' },
            { label: 'Sweden (+46)', value: 'SE' },
            { label: 'Switzerland (+41)', value: 'CH' },
            { label: 'Poland (+48)', value: 'PL' },
            { label: 'Argentina (+54)', value: 'AR' },
            { label: 'Belgium (+32)', value: 'BE' },
            { label: 'Austria (+43)', value: 'AT' },
            { label: 'Norway (+47)', value: 'NO' },
            { label: 'Denmark (+45)', value: 'DK' },
            { label: 'Finland (+358)', value: 'FI' },
            { label: 'Ireland (+353)', value: 'IE' },
            { label: 'New Zealand (+64)', value: 'NZ' },
            { label: 'Portugal (+351)', value: 'PT' },
            { label: 'Greece (+30)', value: 'GR' },
            { label: 'Israel (+972)', value: 'IL' },
            { label: 'Hong Kong (+852)', value: 'HK' },
            { label: 'Malaysia (+60)', value: 'MY' },
            { label: 'Philippines (+63)', value: 'PH' },
            { label: 'Indonesia (+62)', value: 'ID' },
            { label: 'Thailand (+66)', value: 'TH' },
            { label: 'Vietnam (+84)', value: 'VN' },
            { label: 'Egypt (+20)', value: 'EG' },
            { label: 'Nigeria (+234)', value: 'NG' },
            { label: 'Kenya (+254)', value: 'KE' },
        ];
        const DATE_FORMAT_OPTIONS = [
            { label: 'MMM DD, YYYY ( Jul 30, 2025 )', value: 'MMM DD, YYYY' },
            { label: 'WordPress Default Date Format', value: 'wp_default' },
            { label: 'DD/MM/YYYY ( 30/07/2025 )', value: 'DD/MM/YYYY' },
            { label: 'MM/DD/YYYY ( 07/30/2025 )', value: 'MM/DD/YYYY' },
            { label: 'YYYY-MM-DD ( 2025-07-30 )', value: 'YYYY-MM-DD' },
            { label: 'DD MMMM, YYYY ( 30 July, 2025 )', value: 'DD MMMM, YYYY' },
            { label: 'D.MM.YYYY ( 30.07.2026 )', value: 'D.MM.YYYY' },
        ];
        const WEEKDAY_OPTIONS = [
            { label: __('Sunday', 'wooptions-pro'), value: 0 },
            { label: __('Monday', 'wooptions-pro'), value: 1 },
            { label: __('Tuesday', 'wooptions-pro'), value: 2 },
            { label: __('Wednesday', 'wooptions-pro'), value: 3 },
            { label: __('Thursday', 'wooptions-pro'), value: 4 },
            { label: __('Friday', 'wooptions-pro'), value: 5 },
            { label: __('Saturday', 'wooptions-pro'), value: 6 },
        ];
        const MONTHLY_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
            label: `${__('Day', 'wooptions-pro')} ${i + 1}`,
            value: i + 1,
        }));
        function DatePickerPopup(props) {
            const containerRef = useRef(null);
            const initialDate = useMemo(() => {
                if (props.value && /^\d{4}-\d{2}-\d{2}$/.test(props.value)) {
                    const parts = props.value.split('-').map(Number);
                    return new Date(parts[0], parts[1] - 1, parts[2]);
                }
                return new Date();
            }, [props.value]);
            const [year, setYear] = useState(initialDate.getFullYear());
            const [month, setMonth] = useState(initialDate.getMonth());
            useEffect(() => {
                const handleDown = (e) => {
                    if (containerRef.current && !containerRef.current.contains(e.target)) {
                        props.onClose();
                    }
                };
                document.addEventListener('mousedown', handleDown);
                return () => document.removeEventListener('mousedown', handleDown);
            }, [props.onClose]);
            const prevMonth = (e) => {
                e.stopPropagation();
                if (month === 0) {
                    setMonth(11);
                    setYear((y) => y - 1);
                }
                else {
                    setMonth((m) => m - 1);
                }
            };
            const nextMonth = (e) => {
                e.stopPropagation();
                if (month === 11) {
                    setMonth(0);
                    setYear((y) => y + 1);
                }
                else {
                    setMonth((m) => m + 1);
                }
            };
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            const firstDayOfWeek = new Date(year, month, 1).getDay();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const cells = [];
            const prevMonthDays = new Date(year, month, 0).getDate();
            for (let i = firstDayOfWeek - 1; i >= 0; i--) {
                const d = prevMonthDays - i;
                const prevM = month === 0 ? 11 : month - 1;
                const prevY = month === 0 ? year - 1 : year;
                const mStr = String(prevM + 1).padStart(2, '0');
                const dStr = String(d).padStart(2, '0');
                cells.push({ day: d, isCurrentMonth: false, dateStr: `${prevY}-${mStr}-${dStr}` });
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const mStr = String(month + 1).padStart(2, '0');
                const dStr = String(d).padStart(2, '0');
                cells.push({ day: d, isCurrentMonth: true, dateStr: `${year}-${mStr}-${dStr}` });
            }
            const remaining = 7 - (cells.length % 7);
            if (remaining < 7) {
                for (let d = 1; d <= remaining; d++) {
                    const nextM = month === 11 ? 0 : month + 1;
                    const nextY = month === 11 ? year + 1 : year;
                    const mStr = String(nextM + 1).padStart(2, '0');
                    const dStr = String(d).padStart(2, '0');
                    cells.push({ day: d, isCurrentMonth: false, dateStr: `${nextY}-${mStr}-${dStr}` });
                }
            }
            return (wp.element.createElement("div", { className: "wof-datepicker-popover", ref: containerRef },
                wp.element.createElement("div", { className: "wof-cal-pop-header" },
                    wp.element.createElement("button", { type: "button", className: "wof-cal-nav-btn", onClick: prevMonth, "aria-label": __('Previous month', 'wooptions-pro') }, "\u2039"),
                    wp.element.createElement("span", { className: "wof-cal-pop-title" },
                        monthNames[month],
                        " ",
                        year),
                    wp.element.createElement("button", { type: "button", className: "wof-cal-nav-btn", onClick: nextMonth, "aria-label": __('Next month', 'wooptions-pro') }, "\u203A")),
                wp.element.createElement("div", { className: "wof-cal-pop-weekdays" }, weekDays.map((wd) => (wp.element.createElement("span", { key: wd }, wd)))),
                wp.element.createElement("div", { className: "wof-cal-pop-days" }, cells.map((cell, idx) => {
                    const isSelected = props.value === cell.dateStr;
                    return (wp.element.createElement("button", { type: "button", key: idx, className: WooOptionsPro.Utils.classNames('wof-cal-pop-day', !cell.isCurrentMonth && 'is-other-month', isSelected && 'is-selected'), onClick: (e) => {
                            e.stopPropagation();
                            props.onSelect(cell.dateStr);
                        } }, cell.day));
                }))));
        }
        function DatePickerField(props) {
            const [isOpen, setIsOpen] = useState(false);
            return (wp.element.createElement("div", { className: "wof-datepicker-field-wrap" },
                wp.element.createElement("button", { type: "button", className: WooOptionsPro.Utils.classNames('wof-datepicker-field-trigger', isOpen && 'is-open'), onClick: () => setIsOpen(!isOpen) },
                    wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                        wp.element.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
                        wp.element.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
                        wp.element.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
                        wp.element.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })),
                    wp.element.createElement("span", { className: WooOptionsPro.Utils.classNames('wof-datepicker-field-val', !props.value && 'is-placeholder') }, props.value || props.placeholder || __('Select date...', 'wooptions-pro')),
                    props.value ? (wp.element.createElement("span", { role: "button", tabIndex: 0, className: "wof-datepicker-field-clear", title: __('Clear date', 'wooptions-pro'), onClick: (e) => {
                            e.stopPropagation();
                            props.onChange('');
                        } }, "\u00D7")) : null),
                isOpen ? (wp.element.createElement(DatePickerPopup, { value: props.value, onSelect: (val) => {
                        props.onChange(val);
                        setIsOpen(false);
                    }, onClose: () => setIsOpen(false) })) : null));
        }
        function MultiSelectDropdown(props) {
            const [isOpen, setIsOpen] = useState(false);
            const containerRef = useRef(null);
            useEffect(() => {
                const handleDown = (e) => {
                    if (containerRef.current && !containerRef.current.contains(e.target)) {
                        setIsOpen(false);
                    }
                };
                document.addEventListener('mousedown', handleDown);
                return () => document.removeEventListener('mousedown', handleDown);
            }, []);
            const selectedLabels = useMemo(() => {
                return props.options
                    .filter((opt) => props.selectedValues.includes(opt.value))
                    .map((opt) => opt.label);
            }, [props.options, props.selectedValues]);
            const displayText = useMemo(() => {
                if (selectedLabels.length === 0)
                    return '';
                if (selectedLabels.length <= 3)
                    return selectedLabels.join(', ');
                return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;
            }, [selectedLabels]);
            const toggleOption = (optVal) => {
                if (props.selectedValues.includes(optVal)) {
                    props.onChange(props.selectedValues.filter((v) => v !== optVal));
                }
                else {
                    props.onChange([...props.selectedValues, optVal]);
                }
            };
            const selectAll = () => {
                props.onChange(props.options.map((o) => o.value));
            };
            const clearAll = () => {
                props.onChange([]);
            };
            return (wp.element.createElement("div", { className: "wof-multiselect-container", ref: containerRef },
                wp.element.createElement("button", { type: "button", className: WooOptionsPro.Utils.classNames('wof-multiselect-trigger', isOpen && 'is-open'), onClick: () => setIsOpen(!isOpen), "aria-haspopup": "listbox", "aria-expanded": isOpen },
                    wp.element.createElement("span", { className: WooOptionsPro.Utils.classNames('wof-multiselect-display', !displayText && 'is-placeholder') }, displayText || props.placeholder),
                    wp.element.createElement("svg", { className: WooOptionsPro.Utils.classNames('wof-multiselect-chevron', isOpen && 'is-open'), width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                        wp.element.createElement("polyline", { points: "6 9 12 15 18 9" }))),
                isOpen ? (wp.element.createElement("div", { className: "wof-multiselect-dropdown" },
                    wp.element.createElement("div", { className: "wof-multiselect-header" },
                        wp.element.createElement("button", { type: "button", className: "wof-multiselect-link-btn", onClick: selectAll }, __('Select All', 'wooptions-pro')),
                        wp.element.createElement("button", { type: "button", className: "wof-multiselect-link-btn", onClick: clearAll }, __('Clear', 'wooptions-pro'))),
                    wp.element.createElement("div", { className: "wof-multiselect-options", role: "listbox" }, props.options.map((opt) => {
                        const isChecked = props.selectedValues.includes(opt.value);
                        return (wp.element.createElement("label", { key: opt.value, className: WooOptionsPro.Utils.classNames('wof-multiselect-item', isChecked && 'is-checked') },
                            wp.element.createElement("input", { type: "checkbox", checked: isChecked, onChange: () => toggleOption(opt.value) }),
                            wp.element.createElement("span", null, opt.label)));
                    })))) : null));
        }
        function DateFieldInspector(props) {
            const { field, update } = props;
            const [showAddDatePicker, setShowAddDatePicker] = useState(false);
            return (wp.element.createElement("div", { className: "wof-datetime-settings-wrap" },
                wp.element.createElement("div", { className: "wof-field-width-setting wof-datetime-type-setting" },
                    wp.element.createElement("span", { className: "wof-field-width-label" }, __('Type', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Type', 'wooptions-pro') }, [
                        { label: __('Date', 'wooptions-pro'), value: 'date' },
                        { label: __('Date & Time', 'wooptions-pro'), value: 'datetime' },
                        { label: __('Time', 'wooptions-pro'), value: 'time' },
                    ].map((t) => {
                        const isSelected = (field.dateTimeType || (field.type === 'time' ? 'time' : 'date')) === t.value;
                        return (wp.element.createElement("button", { type: "button", key: t.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ dateTimeType: t.value }) }, t.label));
                    }))),
                (field.dateTimeType || (field.type === 'time' ? 'time' : 'date')) !== 'time' ? (wp.element.createElement("div", { className: "wof-datetime-box" },
                    wp.element.createElement(SelectControl, { label: __('Date Format', 'wooptions-pro'), value: field.dateFormat ?? 'DD/MM/YYYY', options: DATE_FORMAT_OPTIONS, onChange: (dateFormat) => update({ dateFormat }) }),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Min Date', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Min Date', 'wooptions-pro') }, [
                                { label: __('None', 'wooptions-pro'), value: 'none' },
                                { label: __('Current Day', 'wooptions-pro'), value: 'current_day' },
                                { label: __('Custom', 'wooptions-pro'), value: 'custom' },
                            ].map((m) => {
                                const isSelected = (field.minDateType || 'none') === m.value;
                                return (wp.element.createElement("button", { type: "button", key: m.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ minDateType: m.value }) }, m.label));
                            }))),
                        field.minDateType === 'custom' ? (wp.element.createElement("div", { style: { marginTop: '8px' } },
                            wp.element.createElement(DatePickerField, { value: field.minDateCustom ?? '', placeholder: __('Select min date...', 'wooptions-pro'), onChange: (minDateCustom) => update({ minDateCustom }) }))) : null),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Max Date', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Max Date', 'wooptions-pro') }, [
                                { label: __('None', 'wooptions-pro'), value: 'none' },
                                { label: __('Current Day', 'wooptions-pro'), value: 'current_day' },
                                { label: __('Custom', 'wooptions-pro'), value: 'custom' },
                            ].map((m) => {
                                const isSelected = (field.maxDateType || 'none') === m.value;
                                return (wp.element.createElement("button", { type: "button", key: m.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ maxDateType: m.value }) }, m.label));
                            }))),
                        field.maxDateType === 'custom' ? (wp.element.createElement("div", { style: { marginTop: '8px' } },
                            wp.element.createElement(DatePickerField, { value: field.maxDateCustom ?? '', placeholder: __('Select max date...', 'wooptions-pro'), onChange: (maxDateCustom) => update({ maxDateCustom }) }))) : null),
                    wp.element.createElement(ToggleControl, { label: __('Disable Today', 'wooptions-pro'), checked: Boolean(field.disableToday), onChange: (disableToday) => update({ disableToday }) }),
                    wp.element.createElement(TextControl, { label: __('Disable Next N Days', 'wooptions-pro'), type: "number", min: 0, value: String(field.disableNextNDays ?? 0), help: __('Disable N days after today (e.g. 3 disables tomorrow, day after tomorrow, and one more)', 'wooptions-pro'), onChange: (val) => update({ disableNextNDays: Math.max(0, parseInt(val, 10) || 0) }) }),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label", style: { marginBottom: '8px' } }, __('Disable Specific Dates', 'wooptions-pro')),
                        wp.element.createElement("div", { style: { position: 'relative', display: 'inline-block' } },
                            wp.element.createElement("button", { type: "button", className: "wof-btn-add-date", onClick: () => setShowAddDatePicker(!showAddDatePicker) },
                                wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                                    wp.element.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })),
                                __('Add Date', 'wooptions-pro')),
                            showAddDatePicker ? (wp.element.createElement(DatePickerPopup, { onSelect: (dateStr) => {
                                    const current = Array.isArray(field.disabledDates) ? [...field.disabledDates] : [];
                                    if (!current.includes(dateStr)) {
                                        update({ disabledDates: [...current, dateStr] });
                                    }
                                    setShowAddDatePicker(false);
                                }, onClose: () => setShowAddDatePicker(false) })) : null),
                        Array.isArray(field.disabledDates) && field.disabledDates.length > 0 ? (wp.element.createElement("div", { className: "wof-disabled-dates-list" }, field.disabledDates.map((dateVal, idx) => (wp.element.createElement("div", { key: idx, className: "wof-disabled-date-item" },
                            wp.element.createElement("div", { className: "wof-disabled-date-badge" },
                                wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
                                    wp.element.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
                                    wp.element.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
                                    wp.element.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })),
                                wp.element.createElement("span", null, dateVal)),
                            wp.element.createElement("button", { type: "button", className: "wof-disabled-date-delete-btn", title: __('Remove date', 'wooptions-pro'), onClick: () => {
                                    const next = [...(field.disabledDates ?? [])];
                                    next.splice(idx, 1);
                                    update({ disabledDates: next });
                                } },
                                wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                                    wp.element.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" })))))))) : null),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Disable Weekdays', 'wooptions-pro')),
                        wp.element.createElement(MultiSelectDropdown, { placeholder: __('Select weekdays to disable...', 'wooptions-pro'), options: WEEKDAY_OPTIONS, selectedValues: Array.isArray(field.disabledWeekdays) ? field.disabledWeekdays : [], onChange: (selected) => update({ disabledWeekdays: selected.map(Number) }) })),
                    wp.element.createElement("div", { style: { marginBottom: '4px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Disable Monthly Days', 'wooptions-pro')),
                        wp.element.createElement(MultiSelectDropdown, { placeholder: __('Select monthly days to disable...', 'wooptions-pro'), options: MONTHLY_DAY_OPTIONS, selectedValues: String(field.disabledMonthlyDays || '')
                                .split(',')
                                .map((s) => parseInt(s.trim(), 10))
                                .filter((n) => !isNaN(n)), onChange: (selected) => {
                                const sorted = [...selected].map(Number).sort((a, b) => a - b);
                                update({ disabledMonthlyDays: sorted.join(', ') });
                            } })))) : null,
                (field.dateTimeType || (field.type === 'time' ? 'time' : 'date')) !== 'date' ? (wp.element.createElement("div", { className: "wof-datetime-box" },
                    wp.element.createElement("div", { className: "wof-time-range-row" },
                        wp.element.createElement("div", { className: "wof-time-range-col" },
                            wp.element.createElement("span", { className: "wof-datetime-label" }, __('Time Range (Min)', 'wooptions-pro')),
                            renderTimeInput(field.minTime || '12:00 AM', field.timeFormat || '12', (val) => update({ minTime: val }))),
                        wp.element.createElement("div", { className: "wof-time-range-col" },
                            wp.element.createElement("span", { className: "wof-datetime-label" }, __('Time Range (Max)', 'wooptions-pro')),
                            renderTimeInput(field.maxTime || '12:00 PM', field.timeFormat || '12', (val) => update({ maxTime: val })))),
                    wp.element.createElement("div", null,
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Time Format', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Time Format', 'wooptions-pro') }, [
                                { label: __('12 Hours', 'wooptions-pro'), value: '12' },
                                { label: __('24 Hours', 'wooptions-pro'), value: '24' },
                            ].map((fmt) => {
                                const isSelected = (field.timeFormat || '12') === fmt.value;
                                return (wp.element.createElement("button", { type: "button", key: fmt.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ timeFormat: fmt.value }) }, fmt.label));
                            })))))) : null));
        }
        function DateRangeFieldInspector(props) {
            const { field, update } = props;
            const [showAddDatePicker, setShowAddDatePicker] = useState(false);
            return (wp.element.createElement("div", { className: "wof-datetime-settings-wrap" },
                wp.element.createElement("div", { className: "wof-datetime-box" },
                    wp.element.createElement(SelectControl, { label: __('Date Format', 'wooptions-pro'), value: field.dateFormat ?? 'DD/MM/YYYY', options: DATE_FORMAT_OPTIONS, onChange: (dateFormat) => update({ dateFormat }) }),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Min Date', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Min Date', 'wooptions-pro') }, [
                                { label: __('None', 'wooptions-pro'), value: 'none' },
                                { label: __('Current Day', 'wooptions-pro'), value: 'current_day' },
                                { label: __('Custom', 'wooptions-pro'), value: 'custom' },
                            ].map((m) => {
                                const isSelected = (field.minDateType || 'none') === m.value;
                                return (wp.element.createElement("button", { type: "button", key: m.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ minDateType: m.value }) }, m.label));
                            }))),
                        field.minDateType === 'custom' ? (wp.element.createElement("div", { style: { marginTop: '8px' } },
                            wp.element.createElement(DatePickerField, { value: field.minDateCustom ?? '', placeholder: __('Select min date...', 'wooptions-pro'), onChange: (minDateCustom) => update({ minDateCustom }) }))) : null),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Max Date', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Max Date', 'wooptions-pro') }, [
                                { label: __('None', 'wooptions-pro'), value: 'none' },
                                { label: __('Current Day', 'wooptions-pro'), value: 'current_day' },
                                { label: __('Custom', 'wooptions-pro'), value: 'custom' },
                            ].map((m) => {
                                const isSelected = (field.maxDateType || 'none') === m.value;
                                return (wp.element.createElement("button", { type: "button", key: m.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ maxDateType: m.value }) }, m.label));
                            }))),
                        field.maxDateType === 'custom' ? (wp.element.createElement("div", { style: { marginTop: '8px' } },
                            wp.element.createElement(DatePickerField, { value: field.maxDateCustom ?? '', placeholder: __('Select max date...', 'wooptions-pro'), onChange: (maxDateCustom) => update({ maxDateCustom }) }))) : null),
                    wp.element.createElement(ToggleControl, { label: __('Disable Today', 'wooptions-pro'), checked: Boolean(field.disableToday), onChange: (disableToday) => update({ disableToday }) }),
                    wp.element.createElement(TextControl, { label: __('Disable Next N Days', 'wooptions-pro'), type: "number", min: 0, value: String(field.disableNextNDays ?? 0), help: __('Disable N days after today (e.g. 3 disables tomorrow, day after tomorrow, and one more)', 'wooptions-pro'), onChange: (val) => update({ disableNextNDays: Math.max(0, parseInt(val, 10) || 0) }) }),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label", style: { marginBottom: '8px' } }, __('Disable Specific Dates', 'wooptions-pro')),
                        wp.element.createElement("div", { style: { position: 'relative', display: 'inline-block' } },
                            wp.element.createElement("button", { type: "button", className: "wof-btn-add-date", onClick: () => setShowAddDatePicker(!showAddDatePicker) },
                                wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                                    wp.element.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" })),
                                __('Add Date', 'wooptions-pro')),
                            showAddDatePicker ? (wp.element.createElement(DatePickerPopup, { onSelect: (dateStr) => {
                                    const current = Array.isArray(field.disabledDates) ? [...field.disabledDates] : [];
                                    if (!current.includes(dateStr)) {
                                        update({ disabledDates: [...current, dateStr] });
                                    }
                                    setShowAddDatePicker(false);
                                }, onClose: () => setShowAddDatePicker(false) })) : null),
                        Array.isArray(field.disabledDates) && field.disabledDates.length > 0 ? (wp.element.createElement("div", { className: "wof-disabled-dates-list" }, field.disabledDates.map((dateVal, idx) => (wp.element.createElement("div", { key: idx, className: "wof-disabled-date-item" },
                            wp.element.createElement("div", { className: "wof-disabled-date-badge" },
                                wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
                                    wp.element.createElement("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
                                    wp.element.createElement("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
                                    wp.element.createElement("line", { x1: "3", y1: "10", x2: "21", y2: "10" })),
                                wp.element.createElement("span", null, dateVal)),
                            wp.element.createElement("button", { type: "button", className: "wof-disabled-date-delete-btn", title: __('Remove date', 'wooptions-pro'), onClick: () => {
                                    const next = [...(field.disabledDates ?? [])];
                                    next.splice(idx, 1);
                                    update({ disabledDates: next });
                                } },
                                wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                                    wp.element.createElement("line", { x1: "6", y1: "6", x2: "18", y2: "18" })))))))) : null),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Disable Weekdays', 'wooptions-pro')),
                        wp.element.createElement(MultiSelectDropdown, { placeholder: __('Select weekdays to disable...', 'wooptions-pro'), options: WEEKDAY_OPTIONS, selectedValues: Array.isArray(field.disabledWeekdays) ? field.disabledWeekdays : [], onChange: (selected) => update({ disabledWeekdays: selected.map(Number) }) })),
                    wp.element.createElement("div", { style: { marginBottom: '14px' } },
                        wp.element.createElement("span", { className: "wof-datetime-label" }, __('Disable Monthly Days', 'wooptions-pro')),
                        wp.element.createElement(MultiSelectDropdown, { placeholder: __('Select monthly days to disable...', 'wooptions-pro'), options: MONTHLY_DAY_OPTIONS, selectedValues: String(field.disabledMonthlyDays || '')
                                .split(',')
                                .map((s) => parseInt(s.trim(), 10))
                                .filter((n) => !isNaN(n)), onChange: (selected) => {
                                const sorted = [...selected].map(Number).sort((a, b) => a - b);
                                update({ disabledMonthlyDays: sorted.join(', ') });
                            } })),
                    wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' } },
                        wp.element.createElement(TextControl, { label: __('Min Days', 'wooptions-pro'), type: "number", min: 0, value: String(field.minDays ?? 0), help: __('Min duration (0 for none)', 'wooptions-pro'), onChange: (val) => update({ minDays: Math.max(0, parseInt(val, 10) || 0) }) }),
                        wp.element.createElement(TextControl, { label: __('Max Days', 'wooptions-pro'), type: "number", min: 0, value: String(field.maxDays ?? 0), help: __('Max duration (0 for none)', 'wooptions-pro'), onChange: (val) => update({ maxDays: Math.max(0, parseInt(val, 10) || 0) }) })),
                    wp.element.createElement(ToggleControl, { label: __('Allow Same Day Selection', 'wooptions-pro'), help: __('Allow start and end date to be on the same day', 'wooptions-pro'), checked: field.allowSameDay !== false, onChange: (allowSameDay) => update({ allowSameDay }) }))));
        }
        function TimePickerInput(props) {
            const is12 = props.format === '12';
            const minuteInputRef = useRef(null);
            const parseValue = (val) => {
                const match = (val || '').match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);
                const h = match ? match[1] : (is12 ? '12' : '00');
                const m = match ? match[2] : '00';
                const mer = (match && match[3] ? match[3].toUpperCase() : 'AM');
                return { h, m, mer };
            };
            const initial = parseValue(props.value);
            const [localHours, setLocalHours] = useState(initial.h.padStart(2, '0'));
            const [localMinutes, setLocalMinutes] = useState(initial.m.padStart(2, '0'));
            const [localMeridiem, setLocalMeridiem] = useState(initial.mer);
            useEffect(() => {
                const p = parseValue(props.value);
                setLocalHours(p.h.padStart(2, '0'));
                setLocalMinutes(p.m.padStart(2, '0'));
                setLocalMeridiem(p.mer);
            }, [props.value, props.format]);
            const commit = (h, m, mer) => {
                props.onChange(is12 ? `${h}:${m} ${mer}` : `${h}:${m}`);
            };
            const handleHoursChange = (e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                setLocalHours(raw);
                if (raw.length === 2) {
                    let num = parseInt(raw, 10);
                    if (is12) {
                        if (num < 1)
                            num = 12;
                        if (num > 12)
                            num = 12;
                    }
                    else {
                        if (num > 23)
                            num = 23;
                    }
                    const formattedH = String(num).padStart(2, '0');
                    setLocalHours(formattedH);
                    commit(formattedH, (localMinutes || '00').padStart(2, '0'), localMeridiem);
                    minuteInputRef.current?.focus();
                    minuteInputRef.current?.select();
                }
            };
            const handleHoursBlur = () => {
                let num = parseInt(localHours, 10);
                if (isNaN(num)) {
                    num = is12 ? 12 : 0;
                }
                else if (is12) {
                    if (num < 1)
                        num = 12;
                    if (num > 12)
                        num = 12;
                }
                else {
                    if (num < 0)
                        num = 0;
                    if (num > 23)
                        num = 23;
                }
                const formattedH = String(num).padStart(2, '0');
                setLocalHours(formattedH);
                commit(formattedH, (localMinutes || '00').padStart(2, '0'), localMeridiem);
            };
            const handleHoursKeyDown = (e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    let num = parseInt(localHours, 10);
                    if (isNaN(num))
                        num = is12 ? 12 : 0;
                    num += e.key === 'ArrowUp' ? 1 : -1;
                    if (is12) {
                        if (num < 1)
                            num = 12;
                        else if (num > 12)
                            num = 1;
                    }
                    else {
                        if (num < 0)
                            num = 23;
                        else if (num > 23)
                            num = 0;
                    }
                    const formattedH = String(num).padStart(2, '0');
                    setLocalHours(formattedH);
                    commit(formattedH, (localMinutes || '00').padStart(2, '0'), localMeridiem);
                }
                else if (e.key === ':' || e.key === 'Enter') {
                    e.preventDefault();
                    minuteInputRef.current?.focus();
                    minuteInputRef.current?.select();
                }
            };
            const handleMinutesChange = (e) => {
                const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                setLocalMinutes(raw);
                if (raw.length === 2) {
                    let num = parseInt(raw, 10);
                    if (num < 0)
                        num = 0;
                    if (num > 59)
                        num = 59;
                    const formattedM = String(num).padStart(2, '0');
                    setLocalMinutes(formattedM);
                    commit((localHours || (is12 ? '12' : '00')).padStart(2, '0'), formattedM, localMeridiem);
                }
            };
            const handleMinutesBlur = () => {
                let num = parseInt(localMinutes, 10);
                if (isNaN(num)) {
                    num = 0;
                }
                else {
                    if (num < 0)
                        num = 0;
                    if (num > 59)
                        num = 59;
                }
                const formattedM = String(num).padStart(2, '0');
                setLocalMinutes(formattedM);
                commit((localHours || (is12 ? '12' : '00')).padStart(2, '0'), formattedM, localMeridiem);
            };
            const handleMinutesKeyDown = (e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    let num = parseInt(localMinutes, 10);
                    if (isNaN(num))
                        num = 0;
                    num += e.key === 'ArrowUp' ? 1 : -1;
                    if (num < 0)
                        num = 59;
                    else if (num > 59)
                        num = 0;
                    const formattedM = String(num).padStart(2, '0');
                    setLocalMinutes(formattedM);
                    commit((localHours || (is12 ? '12' : '00')).padStart(2, '0'), formattedM, localMeridiem);
                }
            };
            return (wp.element.createElement("div", { className: "wof-time-input-group" },
                wp.element.createElement("div", { className: "wof-time-spinner-box" },
                    wp.element.createElement("input", { type: "text", maxLength: 2, value: localHours, "aria-label": __('Hours', 'wooptions-pro'), onFocus: (e) => e.target.select(), onChange: handleHoursChange, onBlur: handleHoursBlur, onKeyDown: handleHoursKeyDown }),
                    wp.element.createElement("span", { className: "wof-time-colon" }, ":"),
                    wp.element.createElement("input", { ref: minuteInputRef, type: "text", maxLength: 2, value: localMinutes, "aria-label": __('Minutes', 'wooptions-pro'), onFocus: (e) => e.target.select(), onChange: handleMinutesChange, onBlur: handleMinutesBlur, onKeyDown: handleMinutesKeyDown })),
                is12 ? (wp.element.createElement("div", { className: "wof-meridiem-group" },
                    wp.element.createElement("button", { type: "button", className: WooOptionsPro.Utils.classNames('wof-meridiem-btn', localMeridiem === 'AM' && 'is-active'), onClick: () => {
                            setLocalMeridiem('AM');
                            commit((localHours || '12').padStart(2, '0'), (localMinutes || '00').padStart(2, '0'), 'AM');
                        } }, "AM"),
                    wp.element.createElement("button", { type: "button", className: WooOptionsPro.Utils.classNames('wof-meridiem-btn', localMeridiem === 'PM' && 'is-active'), onClick: () => {
                            setLocalMeridiem('PM');
                            commit((localHours || '12').padStart(2, '0'), (localMinutes || '00').padStart(2, '0'), 'PM');
                        } }, "PM"))) : null));
        }
        function renderTimeInput(value, format, onChange) {
            return wp.element.createElement(TimePickerInput, { value: value, format: format, onChange: onChange });
        }
        function normalizeHexColor(value, fallback = '#5B4FF5') {
            const color = String(value || '').trim().toUpperCase();
            return /^#[0-9A-F]{6}$/.test(color) ? color : fallback;
        }
        function ChoiceColorControl(props) {
            const [open, setOpen] = useState(false);
            const color = normalizeHexColor(props.color);
            return wp.element.createElement("div", { className: WooOptionsPro.Utils.classNames('wof-choice-color-control', open && 'is-open') },
                wp.element.createElement("span", { className: "wof-choice-color-control__label" }, props.label ?? __('Swatch color', 'wooptions-pro')),
                wp.element.createElement("div", { className: "wof-choice-color-control__row" },
                    wp.element.createElement("button", { type: "button", className: "wof-choice-color-control__trigger", onClick: () => setOpen((value) => !value), "aria-expanded": open },
                        wp.element.createElement("span", { style: { background: color }, "aria-hidden": "true" }),
                        wp.element.createElement("code", null, color),
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "arrow-down-alt2" })),
                    wp.element.createElement(TextControl, { label: __('Hex color', 'wooptions-pro'), hideLabelFromVision: true, value: color, onChange: (next) => {
                            if (/^#[0-9a-f]{6}$/i.test(next.trim()))
                                props.onChange(next.trim().toUpperCase());
                        } })),
                open ? wp.element.createElement("div", { className: "wof-choice-color-control__picker" },
                    wp.element.createElement(ColorPicker, { color: color, enableAlpha: false, onChange: (next) => props.onChange(normalizeHexColor(next, color)) })) : null);
        }
        function ChoiceMediaControl(props) {
            const [previewUrl, setPreviewUrl] = useState(props.choice.imageUrl ?? '');
            useEffect(() => {
                let active = true;
                setPreviewUrl(props.choice.imageUrl ?? '');
                const attachmentId = Number(props.choice.imageId ?? 0);
                if (!attachmentId || !wp.media?.attachment)
                    return () => { active = false; };
                const attachment = wp.media.attachment(attachmentId);
                const update = () => {
                    if (!active)
                        return;
                    const data = attachment.toJSON?.() ?? {};
                    const source = data.sizes?.thumbnail?.url ?? data.sizes?.medium?.url ?? data.url ?? '';
                    if (source)
                        setPreviewUrl(String(source));
                };
                update();
                const request = attachment.fetch?.();
                if (request)
                    Promise.resolve(request).then(update).catch(() => undefined);
                return () => { active = false; };
            }, [props.choice.imageId, props.choice.imageUrl]);
            const openPicker = () => {
                if (!wp.media)
                    return;
                const frame = wp.media({
                    title: __('Choose a choice image', 'wooptions-pro'),
                    button: { text: __('Use this image', 'wooptions-pro') },
                    library: { type: 'image' },
                    multiple: false,
                });
                frame.on('select', () => {
                    const attachment = frame.state().get('selection').first().toJSON();
                    const imageId = Math.max(0, Number(attachment.id ?? 0));
                    const imageUrl = String(attachment.sizes?.thumbnail?.url ?? attachment.sizes?.medium?.url ?? attachment.url ?? '');
                    if (!imageId)
                        return;
                    setPreviewUrl(imageUrl);
                    props.onChange({ imageId, imageUrl });
                });
                frame.open();
            };
            const hasImage = Number(props.choice.imageId ?? 0) > 0 || Boolean(previewUrl);
            return (wp.element.createElement("div", { className: "wof-media-control" },
                wp.element.createElement("button", { type: "button", className: `wof-media-control__preview ${hasImage ? 'has-image' : ''}`, onClick: openPicker }, previewUrl ? wp.element.createElement("img", { src: previewUrl, alt: "" }) : wp.element.createElement("span", { className: "dashicons dashicons-format-image", "aria-hidden": "true" })),
                wp.element.createElement("div", null,
                    wp.element.createElement("strong", null, props.required ? __('Swatch image', 'wooptions-pro') : __('Choice image (optional)', 'wooptions-pro')),
                    wp.element.createElement("small", null, props.choice.imageId ? `Media #${props.choice.imageId}` : __('No image selected', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-media-control__actions" },
                        wp.element.createElement(Button, { variant: "secondary", onClick: openPicker }, hasImage ? __('Replace', 'wooptions-pro') : __('Choose image', 'wooptions-pro')),
                        hasImage ? (wp.element.createElement(Button, { variant: "tertiary", isDestructive: true, onClick: () => {
                                setPreviewUrl('');
                                props.onChange({ imageId: 0, imageUrl: '' });
                            } }, __('Remove', 'wooptions-pro'))) : null))));
        }
        const CHOICE_INDEX_MIME = 'application/x-wooptions-pro-choice-index';
        function truncateWords(str, maxWords = 5) {
            if (!str)
                return '';
            const trimmed = str.trim();
            const words = trimmed.split(/\s+/);
            if (words.length <= maxWords)
                return trimmed;
            return words.slice(0, maxWords).join(' ') + '...';
        }
        function ChoiceItemCard(props) {
            const [dropEdge, setDropEdge] = useState(null);
            const [isDragging, setIsDragging] = useState(false);
            const cardRef = useRef(null);
            const dragStart = (event) => {
                event.stopPropagation();
                event.dataTransfer?.setData(CHOICE_INDEX_MIME, String(props.index));
                event.dataTransfer?.setData('text/plain', String(props.index));
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    if (cardRef.current && event.dataTransfer.setDragImage) {
                        const bounds = cardRef.current.getBoundingClientRect();
                        event.dataTransfer.setDragImage(cardRef.current, event.clientX - bounds.left, event.clientY - bounds.top);
                    }
                }
                setIsDragging(true);
            };
            const dragEnd = () => {
                setIsDragging(false);
                setDropEdge(null);
            };
            const dragOver = (event) => {
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain'))
                    return;
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = 'move';
                const element = event.currentTarget;
                const bounds = element.getBoundingClientRect();
                setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
            };
            const dragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setDropEdge(null);
            };
            const drop = (event) => {
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain'))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const sourceText = event.dataTransfer?.getData(CHOICE_INDEX_MIME) || event.dataTransfer?.getData('text/plain') || '';
                const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
                setDropEdge(null);
                setIsDragging(false);
                const source = Number(sourceText);
                if (!Number.isInteger(source))
                    return;
                let finalIndex = insertIndex;
                if (source < insertIndex)
                    finalIndex -= 1;
                finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
                if (finalIndex !== source)
                    props.onMove(source, finalIndex);
            };
            return (wp.element.createElement("article", { ref: cardRef, className: WooOptionsPro.Utils.classNames('wof-choice-card', !props.isOpen && 'is-collapsed', isDragging && 'is-dragging', dropEdge === 'before' && 'is-drop-before', dropEdge === 'after' && 'is-drop-after'), onDragOver: dragOver, onDragLeave: dragLeave, onDrop: drop },
                wp.element.createElement("header", { className: "wof-choice-card__header" },
                    wp.element.createElement("button", { type: "button", draggable: true, className: "wof-choice-drag-handle", onDragStart: dragStart, onDragEnd: dragEnd, "aria-label": __('Drag choice to reorder', 'wooptions-pro'), title: __('Drag to reorder', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.GripIcon, null),
                        wp.element.createElement("span", { className: "wof-choice-header-label-badge", title: props.choice.label }, props.choice.label || `${__('Choice', 'wooptions-pro')} ${props.index + 1}`)),
                    wp.element.createElement("div", { className: "wof-choice-header-actions" },
                        wp.element.createElement("button", { type: "button", className: "wof-choice-accordion-toggle", onClick: props.onToggle, "aria-expanded": props.isOpen, "aria-label": props.isOpen ? __('Collapse choice', 'wooptions-pro') : __('Expand choice', 'wooptions-pro'), title: props.isOpen ? __('Collapse choice', 'wooptions-pro') : __('Expand choice', 'wooptions-pro') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: props.isOpen ? 'arrow-up-alt2' : 'arrow-down-alt2' })),
                        wp.element.createElement("button", { type: "button", className: "wof-choice-delete-btn", onClick: props.onRemove, "aria-label": __('Delete choice', 'wooptions-pro'), title: __('Delete choice', 'wooptions-pro') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" })))),
                props.isOpen ? (wp.element.createElement("div", { className: "wof-choice-card__body" },
                    wp.element.createElement(TextControl, { label: __('Label', 'wooptions-pro'), value: props.choice.label, onChange: (label) => props.onUpdate({ label }) }),
                    wp.element.createElement(TextControl, { label: __('Description', 'wooptions-pro'), value: props.choice.description, onChange: (description) => props.onUpdate({ description }) }),
                    props.fieldType === 'color_swatch' ? (wp.element.createElement(ChoiceColorControl, { color: props.choice.color || '#5B4FF5', onChange: (color) => props.onUpdate({ color }) })) : null,
                    ['image_swatch', 'product', 'radio', 'checkbox_group', 'segmented', 'select'].includes(props.fieldType) ? (wp.element.createElement(ChoiceMediaControl, { choice: props.choice, required: props.fieldType === 'image_swatch', onChange: (patch) => props.onUpdate(patch) })) : null,
                    wp.element.createElement("div", { className: "wof-choice-pricing-row" },
                        wp.element.createElement(SelectControl, { label: __('Price type', 'wooptions-pro'), value: props.choice.pricing.strategy, options: [
                                { label: __('No adjustment', 'wooptions-pro'), value: 'none' },
                                { label: __('Fixed amount', 'wooptions-pro'), value: 'fixed' },
                                { label: __('Percentage', 'wooptions-pro'), value: 'percentage' },
                            ], onChange: (strategy) => props.onUpdate({ pricing: { ...props.choice.pricing, strategy } }) }),
                        props.choice.pricing.strategy === 'percentage' ? (wp.element.createElement(TextControl, { label: __('Percent', 'wooptions-pro'), type: "number", value: props.choice.pricing.percent, onChange: (percent) => props.onUpdate({ pricing: { ...props.choice.pricing, percent } }) })) : props.choice.pricing.strategy !== 'none' ? (wp.element.createElement(TextControl, { label: __('Amount', 'wooptions-pro'), type: "number", value: props.choice.pricing.amount, onChange: (amount) => props.onUpdate({ pricing: { ...props.choice.pricing, amount } }) })) : null),
                    wp.element.createElement("div", { className: "wof-choice-toggles-row" },
                        wp.element.createElement(ToggleControl, { label: __('Default choice', 'wooptions-pro'), checked: props.choice.default, onChange: (val) => props.onUpdate({ default: val }) }),
                        wp.element.createElement(ToggleControl, { label: __('Disable choice', 'wooptions-pro'), checked: props.choice.disabled, onChange: (val) => props.onUpdate({ disabled: val }) })))) : null));
        }
        // ─── Product Choice Editor ────────────────────────────────────────────────
        function ProductChoiceCard(props) {
            const [dropEdge, setDropEdge] = useState(null);
            const [isDragging, setIsDragging] = useState(false);
            const cardRef = useRef(null);
            // Product replacement search state
            const [showChangeSearch, setShowChangeSearch] = useState(false);
            const [changeQuery, setChangeQuery] = useState('');
            const [changeSuggestions, setChangeSuggestions] = useState([]);
            const [isChangingSearch, setIsChangingSearch] = useState(false);
            const changeSearchTimeout = useRef(null);
            // Variations filter state
            const [varFilter, setVarFilter] = useState('');
            const info = props.choice.productInfo;
            const isVariable = Boolean(props.choice.isVariable || info?.isVariable);
            const selectedVarIds = props.choice.selectedVariationIds ?? [];
            const allVariations = info?.variations ?? [];
            const productId = props.choice.productId || props.choice.linkedProductId;
            const productPrice = info?.salePrice ? `${info.salePrice} (regular: ${info.regularPrice})` : (info?.price || info?.regularPrice || '');
            // variation badge in header
            let varBadge;
            if (!isVariable) {
                varBadge = __('N/A', 'wooptions-pro');
            }
            else if (props.mergeVariations) {
                varBadge = __('All Variations', 'wooptions-pro');
            }
            else if (selectedVarIds.length === 0) {
                varBadge = __('N/A', 'wooptions-pro');
            }
            else {
                varBadge = `${selectedVarIds.length} ${__('Variations', 'wooptions-pro')}`;
            }
            // Auto-load variations if variable product info was saved without variations array
            useEffect(() => {
                const pid = props.choice.productId || props.choice.linkedProductId;
                if (isVariable && allVariations.length === 0 && pid) {
                    WooOptionsPro.Api.searchProductsForChoices('', [pid]).then((res) => {
                        const found = (res.items || []).find((it) => it.id === pid);
                        if (found && found.variations && found.variations.length > 0) {
                            props.onUpdate({
                                productInfo: {
                                    ...(props.choice.productInfo || {}),
                                    price: found.price || '',
                                    regularPrice: found.regularPrice || '',
                                    salePrice: found.salePrice || '',
                                    image: found.image || '',
                                    isVariable: true,
                                    variations: found.variations,
                                },
                            });
                        }
                    }).catch(() => { });
                }
            }, [props.choice.productId, props.choice.linkedProductId, isVariable, allVariations.length]);
            // Live search for product replacement
            useEffect(() => {
                if (!showChangeSearch)
                    return;
                clearTimeout(changeSearchTimeout.current);
                setIsChangingSearch(true);
                changeSearchTimeout.current = setTimeout(async () => {
                    try {
                        const result = await WooOptionsPro.Api.searchProductsForChoices(changeQuery);
                        setChangeSuggestions(result.items ?? []);
                    }
                    catch {
                        setChangeSuggestions([]);
                    }
                    setIsChangingSearch(false);
                }, 250);
                return () => clearTimeout(changeSearchTimeout.current);
            }, [changeQuery, showChangeSearch]);
            const selectNewProduct = (product) => {
                props.onUpdate({
                    label: product.label || props.choice.label,
                    imageUrl: product.image || '',
                    linkedProductId: product.id,
                    productId: product.id,
                    isVariable: Boolean(product.isVariable),
                    selectedVariationIds: [],
                    pricing: {
                        strategy: 'fixed',
                        amount: product.price || '0',
                        percent: '0',
                        mode: 'adjustment',
                    },
                    productInfo: {
                        price: product.price || '',
                        regularPrice: product.regularPrice || '',
                        salePrice: product.salePrice || '',
                        image: product.image || '',
                        isVariable: Boolean(product.isVariable),
                        variations: product.variations || [],
                    },
                });
                setShowChangeSearch(false);
                setChangeQuery('');
            };
            const toggleVarId = (id) => {
                const next = selectedVarIds.includes(id) ? selectedVarIds.filter((x) => x !== id) : [...selectedVarIds, id];
                props.onUpdate({ selectedVariationIds: next });
            };
            const filteredVariations = useMemo(() => {
                if (!varFilter.trim())
                    return allVariations;
                const q = varFilter.toLowerCase();
                return allVariations.filter((v) => String(v.label || '').toLowerCase().includes(q));
            }, [allVariations, varFilter]);
            // Drag & Drop
            const dragStart = (event) => {
                event.stopPropagation();
                event.dataTransfer?.setData(CHOICE_INDEX_MIME, String(props.index));
                event.dataTransfer?.setData('text/plain', String(props.index));
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    if (cardRef.current && event.dataTransfer.setDragImage) {
                        const bounds = cardRef.current.getBoundingClientRect();
                        event.dataTransfer.setDragImage(cardRef.current, event.clientX - bounds.left, event.clientY - bounds.top);
                    }
                }
                setIsDragging(true);
            };
            const dragEnd = () => {
                setIsDragging(false);
                setDropEdge(null);
            };
            const dragOver = (event) => {
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain'))
                    return;
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = 'move';
                const element = event.currentTarget;
                const bounds = element.getBoundingClientRect();
                setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
            };
            const dragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setDropEdge(null);
            };
            const drop = (event) => {
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain'))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const sourceText = event.dataTransfer?.getData(CHOICE_INDEX_MIME) || event.dataTransfer?.getData('text/plain') || '';
                const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
                setDropEdge(null);
                setIsDragging(false);
                const source = Number(sourceText);
                if (!Number.isInteger(source))
                    return;
                let finalIndex = insertIndex;
                if (source < insertIndex)
                    finalIndex -= 1;
                finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
                if (finalIndex !== source)
                    props.onMove(source, finalIndex);
            };
            return (wp.element.createElement("article", { ref: cardRef, className: WooOptionsPro.Utils.classNames('wof-choice-card', !props.isOpen && 'is-collapsed', isDragging && 'is-dragging', dropEdge === 'before' && 'is-drop-before', dropEdge === 'after' && 'is-drop-after'), onDragOver: dragOver, onDragLeave: dragLeave, onDrop: drop },
                wp.element.createElement("header", { className: "wof-choice-card__header" },
                    wp.element.createElement("button", { type: "button", draggable: true, className: "wof-choice-drag-handle", onDragStart: dragStart, onDragEnd: dragEnd, "aria-label": __('Drag choice to reorder', 'wooptions-pro'), title: __('Drag to reorder', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.GripIcon, null),
                        wp.element.createElement("span", { className: "wof-choice-header-thumb" }, (info?.image || props.choice.imageUrl) ? (wp.element.createElement("img", { src: info?.image || props.choice.imageUrl, alt: "" })) : (wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" }))),
                        wp.element.createElement("span", { className: "wof-choice-header-label-badge", title: props.choice.label }, truncateWords(props.choice.label || `${__('Choice', 'wooptions-pro')} ${props.index + 1}`, 5)),
                        wp.element.createElement("span", { className: WooOptionsPro.Utils.classNames('wof-choice-header-var-badge', !isVariable && 'is-na') }, varBadge)),
                    wp.element.createElement("div", { className: "wof-choice-header-actions" },
                        wp.element.createElement("button", { type: "button", className: "wof-choice-accordion-toggle", onClick: props.onToggle, "aria-expanded": props.isOpen, "aria-label": props.isOpen ? __('Collapse choice', 'wooptions-pro') : __('Expand choice', 'wooptions-pro'), title: props.isOpen ? __('Collapse choice', 'wooptions-pro') : __('Expand choice', 'wooptions-pro') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: props.isOpen ? 'arrow-up-alt2' : 'arrow-down-alt2' })),
                        wp.element.createElement("button", { type: "button", className: "wof-choice-delete-btn", onClick: props.onRemove, "aria-label": __('Delete choice', 'wooptions-pro'), title: __('Delete choice', 'wooptions-pro') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" })))),
                props.isOpen ? (wp.element.createElement("div", { className: "wof-choice-card__body" },
                    wp.element.createElement("div", { className: "wof-product-choice-selected-card" },
                        wp.element.createElement("div", { className: "wof-product-choice-selected-card__thumb" }, (info?.image || props.choice.imageUrl) ? (wp.element.createElement("img", { src: info?.image || props.choice.imageUrl, alt: "" })) : (wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" }))),
                        wp.element.createElement("div", { className: "wof-product-choice-selected-card__meta" },
                            wp.element.createElement("div", { className: "wof-product-choice-selected-card__title", title: props.choice.label }, truncateWords(props.choice.label || __('(No product selected)', 'wooptions-pro'), 5)),
                            wp.element.createElement("div", { className: "wof-product-choice-selected-card__sub" },
                                productPrice ? wp.element.createElement("span", { className: "wof-product-choice-selected-card__price" }, productPrice) : null,
                                isVariable ? wp.element.createElement("span", { className: "wof-choice-header-var-badge" }, __('Variable', 'wooptions-pro')) : null,
                                productId ? wp.element.createElement("span", { className: "wof-product-choice-selected-card__id" },
                                    "#",
                                    productId) : null)),
                        wp.element.createElement("button", { type: "button", className: "wof-product-choice-change-btn", onClick: () => setShowChangeSearch((prev) => !prev) }, showChangeSearch ? __('Cancel', 'wooptions-pro') : __('Change', 'wooptions-pro'))),
                    showChangeSearch ? (wp.element.createElement("div", { className: "wof-product-change-search-wrap" },
                        wp.element.createElement("div", { className: "wof-product-search-input-row" },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "search" }),
                            wp.element.createElement("input", { type: "text", className: "wof-product-search-input", placeholder: __('Search product to replace…', 'wooptions-pro'), value: changeQuery, onChange: (e) => setChangeQuery(e.target.value), autoFocus: true }),
                            isChangingSearch ? wp.element.createElement("span", { className: "wof-product-search-spinner" }, "\u2026") : null),
                        changeSuggestions.length > 0 ? (wp.element.createElement("div", { className: "wof-product-search-dropdown" }, changeSuggestions.map((s) => (wp.element.createElement("button", { key: s.id, type: "button", className: "wof-product-search-option", onMouseDown: (e) => {
                                e.preventDefault();
                                selectNewProduct(s);
                            } },
                            s.image ? (wp.element.createElement("img", { src: s.image, alt: "", className: "wof-product-search-option__thumb" })) : (wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" })),
                            wp.element.createElement("span", { className: "wof-product-search-option__label" }, s.label),
                            wp.element.createElement("span", { className: "wof-product-search-option__meta" }, s.meta),
                            s.isVariable ? wp.element.createElement("span", { className: "wof-product-search-option__badge" }, __('Variable', 'wooptions-pro')) : null))))) : null)) : null,
                    isVariable ? (props.mergeVariations ? (wp.element.createElement("div", { className: "wof-product-variations-merged-notice" },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "info" }),
                        wp.element.createElement("span", null, __('All variations are merged into this product choice because "Merge Variation Products" is enabled.', 'wooptions-pro')))) : (wp.element.createElement("div", { className: "wof-product-variations-section" },
                        wp.element.createElement("div", { className: "wof-product-variations-header" },
                            wp.element.createElement("strong", null, __('Variations', 'wooptions-pro')),
                            wp.element.createElement("span", { className: "wof-product-variations-count" },
                                selectedVarIds.length,
                                " / ",
                                allVariations.length,
                                " ",
                                __('selected', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-product-variations-actions" },
                                wp.element.createElement("button", { type: "button", className: "wof-btn-link", onClick: () => props.onUpdate({ selectedVariationIds: allVariations.map((v) => v.id) }) }, __('Select all', 'wooptions-pro')),
                                wp.element.createElement("button", { type: "button", className: "wof-btn-link", onClick: () => props.onUpdate({ selectedVariationIds: [] }) }, __('Clear', 'wooptions-pro')))),
                        allVariations.length > 5 ? (wp.element.createElement("input", { type: "text", className: "wof-var-filter-input", placeholder: __('Filter variations…', 'wooptions-pro'), value: varFilter, onChange: (e) => setVarFilter(e.target.value) })) : null,
                        wp.element.createElement("div", { className: "wof-product-variations-list" }, filteredVariations.length === 0 ? (wp.element.createElement("p", { className: "wof-muted-note", style: { margin: 0, padding: '8px' } }, allVariations.length === 0
                            ? __('No variations loaded for this product.', 'wooptions-pro')
                            : __('No matching variations.', 'wooptions-pro'))) : (filteredVariations.map((v) => {
                            const isChecked = selectedVarIds.includes(v.id);
                            return (wp.element.createElement("label", { key: v.id, className: "wof-product-variation-item" },
                                wp.element.createElement("input", { type: "checkbox", checked: isChecked, onChange: () => toggleVarId(v.id) }),
                                wp.element.createElement("span", { className: "wof-product-variation-label", title: v.label }, truncateWords(v.label, 5)),
                                v.price ? wp.element.createElement("span", { className: "wof-product-variation-price" }, v.price) : null));
                        })))))) : null,
                    wp.element.createElement("div", { className: "wof-choice-toggles-row" },
                        wp.element.createElement(ToggleControl, { label: __('Default choice', 'wooptions-pro'), checked: props.choice.default, onChange: (val) => props.onUpdate({ default: val }) }),
                        wp.element.createElement(ToggleControl, { label: __('Disable choice', 'wooptions-pro'), checked: props.choice.disabled, onChange: (val) => props.onUpdate({ disabled: val }) })))) : null));
        }
        function ProductChoiceEditor(props) {
            const choices = props.field.choices ?? [];
            const [collapsedMap, setCollapsedMap] = useState({});
            const [searchQuery, setSearchQuery] = useState('');
            const [suggestions, setSuggestions] = useState([]);
            const [isSearching, setIsSearching] = useState(false);
            const [searchFocused, setSearchFocused] = useState(false);
            const searchRef = useRef(null);
            const searchWrap = useRef(null);
            const debounceRef = useRef(null);
            const mergeVariations = Boolean(props.field.mergeVariationProducts);
            const toggleChoice = (uuid) => {
                setCollapsedMap((prev) => ({ ...prev, [uuid]: !prev[uuid] }));
            };
            const isAllCollapsed = choices.length > 0 && choices.every((c) => Boolean(collapsedMap[c.uuid]));
            const toggleAll = () => {
                const nextState = !isAllCollapsed;
                const nextMap = {};
                choices.forEach((c) => {
                    nextMap[c.uuid] = nextState;
                });
                setCollapsedMap(nextMap);
            };
            useEffect(() => {
                const handleDown = (e) => {
                    if (searchWrap.current && !searchWrap.current.contains(e.target)) {
                        setSearchFocused(false);
                    }
                };
                document.addEventListener('mousedown', handleDown);
                return () => document.removeEventListener('mousedown', handleDown);
            }, []);
            useEffect(() => {
                if (!searchFocused)
                    return;
                clearTimeout(debounceRef.current);
                setIsSearching(true);
                debounceRef.current = setTimeout(async () => {
                    try {
                        const result = await WooOptionsPro.Api.searchProductsForChoices(searchQuery);
                        setSuggestions(result.items ?? []);
                    }
                    catch { }
                    setIsSearching(false);
                }, 280);
                return () => clearTimeout(debounceRef.current);
            }, [searchQuery, searchFocused]);
            const addProduct = (product) => {
                const uuid = WooOptionsPro.Utils.uuid();
                const newChoice = {
                    uuid,
                    label: product.label || '',
                    description: '',
                    adminLabel: '',
                    color: '',
                    imageId: 0,
                    imageUrl: product.image || '',
                    disabled: false,
                    default: choices.length === 0,
                    pricing: { strategy: 'fixed', amount: product.price || '0', percent: '0', mode: 'adjustment' },
                    quantityEnabled: false,
                    linkedProductId: product.id,
                    linkedVariationId: 0,
                    linkedQuantity: 1,
                    preview: {},
                    productId: product.id,
                    isVariable: Boolean(product.isVariable),
                    selectedVariationIds: [],
                    productInfo: {
                        price: product.price || '',
                        regularPrice: product.regularPrice || '',
                        salePrice: product.salePrice || '',
                        image: product.image || '',
                        isVariable: Boolean(product.isVariable),
                        variations: product.variations || [],
                    },
                };
                props.onChange({ ...props.field, choices: [...choices, newChoice] });
                setCollapsedMap((prev) => ({ ...prev, [uuid]: false }));
                setSearchQuery('');
                setSearchFocused(false);
            };
            const removeChoice = (uuid) => props.onChange({ ...props.field, choices: choices.filter((c) => c.uuid !== uuid) });
            const updateChoice = (uuid, patch) => props.onChange({ ...props.field, choices: choices.map((c) => c.uuid === uuid ? { ...c, ...patch } : c) });
            const moveChoice = (from, to) => {
                if (from === to || from < 0 || to < 0 || from >= choices.length || to >= choices.length)
                    return;
                const reordered = [...choices];
                const [moved] = reordered.splice(from, 1);
                reordered.splice(to, 0, moved);
                props.onChange({ ...props.field, choices: reordered });
            };
            const showDropdown = searchFocused && suggestions.length > 0;
            return (wp.element.createElement("div", { className: "wof-product-choice-editor" },
                wp.element.createElement("div", { style: { marginBottom: '16px' } },
                    wp.element.createElement("label", { className: "components-base-control__label", style: { display: 'block', marginBottom: '8px' } }, __('Image Style', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-image-style-cards" }, [
                        { value: 'default', label: __('Default', 'wooptions-pro') },
                        { value: 'overlay', label: __('Image overlay', 'wooptions-pro') },
                        { value: 'only_image', label: __('Only Image', 'wooptions-pro') },
                    ].map((st) => {
                        const currentStyle = props.field.imageStyle || 'default';
                        const isSelected = currentStyle === st.value;
                        return (wp.element.createElement("button", { key: st.value, type: "button", className: WooOptionsPro.Utils.classNames('wof-image-style-card', isSelected && 'is-active'), onClick: () => props.onChange({ ...props.field, imageStyle: st.value }), title: st.label },
                            wp.element.createElement("span", { className: "wof-image-style-card__preview" },
                                wp.element.createElement("svg", { viewBox: "0 0 60 45", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true" },
                                    wp.element.createElement("rect", { x: "1", y: "1", width: "58", height: "43", rx: "5", fill: "#e8ecf0", stroke: "#c8d0da", strokeWidth: "1" }),
                                    wp.element.createElement("rect", { x: "8", y: "7", width: "44", height: "24", rx: "3", fill: "#b4bfcb" }),
                                    wp.element.createElement("circle", { cx: "18", cy: "19", r: "5", fill: "#8e9db0" }),
                                    wp.element.createElement("polygon", { points: "14,28 24,15 32,24 38,18 52,31 8,31", fill: "#9eb0c2" }),
                                    st.value === 'overlay' ? (wp.element.createElement(wp.element.Fragment, null,
                                        wp.element.createElement("rect", { x: "8", y: "21", width: "44", height: "10", rx: "0", fill: "rgba(0,0,0,0.45)" }),
                                        wp.element.createElement("rect", { x: "12", y: "23", width: "20", height: "3", rx: "1.5", fill: "#fff", opacity: "0.8" }),
                                        wp.element.createElement("rect", { x: "12", y: "27", width: "14", height: "2", rx: "1", fill: "#fff", opacity: "0.5" }))) : null,
                                    st.value === 'default' ? (wp.element.createElement("rect", { x: "12", y: "36", width: "20", height: "3", rx: "1.5", fill: "#b4bfcb" })) : null)),
                            wp.element.createElement("span", { className: "wof-image-style-card__label" }, st.label)));
                    }))),
                choices.length > 1 ? (wp.element.createElement("div", { className: "wof-choice-list-toolbar" },
                    wp.element.createElement("span", { className: "wof-choice-list-count" },
                        choices.length,
                        " ",
                        __('Products', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", className: "wof-choice-collapse-all-btn", onClick: toggleAll }, isAllCollapsed ? __('Expand all', 'wooptions-pro') : __('Collapse all', 'wooptions-pro')))) : null,
                wp.element.createElement("div", { className: "wof-choice-editor-list" }, choices.map((choice, index) => (wp.element.createElement(ProductChoiceCard, { key: choice.uuid, choice: choice, index: index, count: choices.length, mergeVariations: mergeVariations, isOpen: !collapsedMap[choice.uuid], onToggle: () => toggleChoice(choice.uuid), onUpdate: (patch) => updateChoice(choice.uuid, patch), onRemove: () => removeChoice(choice.uuid), onMove: moveChoice })))),
                wp.element.createElement("div", { className: "wof-product-search-wrap", ref: searchWrap, style: { marginTop: '10px', marginBottom: '16px' } },
                    wp.element.createElement("div", { className: "wof-product-search-input-row" },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }),
                        wp.element.createElement("input", { ref: searchRef, type: "text", className: "wof-product-search-input", placeholder: __('Add Product…', 'wooptions-pro'), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onFocus: () => setSearchFocused(true), autoComplete: "off" }),
                        isSearching ? wp.element.createElement("span", { className: "wof-product-search-spinner" }, "\u2026") : null),
                    showDropdown ? (wp.element.createElement("div", { className: "wof-product-search-dropdown" }, suggestions.map((s) => (wp.element.createElement("button", { key: s.id, type: "button", className: "wof-product-search-option", onMouseDown: (e) => { e.preventDefault(); addProduct(s); } },
                        s.image ? wp.element.createElement("img", { src: s.image, alt: "", className: "wof-product-search-option__thumb" }) : wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "format-image" }),
                        wp.element.createElement("span", { className: "wof-product-search-option__label" }, s.label),
                        wp.element.createElement("span", { className: "wof-product-search-option__meta" }, s.meta),
                        s.isVariable ? wp.element.createElement("span", { className: "wof-product-search-option__badge" }, __('Variable', 'wooptions-pro')) : null))))) : null),
                wp.element.createElement(ToggleControl, { label: __('Merge Variation Products into one product', 'wooptions-pro'), checked: mergeVariations, onChange: (val) => props.onChange({ ...props.field, mergeVariationProducts: val }) }),
                wp.element.createElement(ToggleControl, { label: __('Allow Multiple Choices', 'wooptions-pro'), checked: Boolean(props.field.multiple), onChange: (val) => props.onChange({ ...props.field, multiple: val }) }),
                props.field.multiple ? (wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' } },
                    wp.element.createElement(TextControl, { label: __('Min choices', 'wooptions-pro'), type: "number", value: String(props.field.minChoices ?? 0), onChange: (v) => props.onChange({ ...props.field, minChoices: Math.max(0, parseInt(v, 10) || 0) }) }),
                    wp.element.createElement(TextControl, { label: __('Max choices', 'wooptions-pro'), type: "number", value: String(props.field.maxChoices ?? 0), onChange: (v) => props.onChange({ ...props.field, maxChoices: Math.max(0, parseInt(v, 10) || 0) }) }))) : null,
                wp.element.createElement(ToggleControl, { label: __('Enable Quantity', 'wooptions-pro'), checked: Boolean(props.field.enableQuantity), onChange: (val) => props.onChange({ ...props.field, enableQuantity: val }) }),
                props.field.enableQuantity ? (wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' } },
                    wp.element.createElement(TextControl, { label: __('Min quantity', 'wooptions-pro'), type: "number", min: 1, value: String(props.field.minQuantity ?? 1), onChange: (v) => props.onChange({ ...props.field, minQuantity: Math.max(1, parseInt(v, 10) || 1) }) }),
                    wp.element.createElement(TextControl, { label: __('Max quantity', 'wooptions-pro'), type: "number", min: 1, value: String(props.field.maxQuantity ?? 100), onChange: (v) => props.onChange({ ...props.field, maxQuantity: Math.max(0, parseInt(v, 10) || 0) }) }))) : null));
        }
        // ─── Font Choice Editor ───────────────────────────────────────────────────
        function FontChoiceCard(props) {
            const [dropEdge, setDropEdge] = useState(null);
            const [isDragging, setIsDragging] = useState(false);
            const cardRef = useRef(null);
            const dragStart = (event) => {
                event.stopPropagation();
                event.dataTransfer?.setData(CHOICE_INDEX_MIME, String(props.index));
                event.dataTransfer?.setData('text/plain', String(props.index));
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    if (cardRef.current && event.dataTransfer.setDragImage) {
                        const bounds = cardRef.current.getBoundingClientRect();
                        event.dataTransfer.setDragImage(cardRef.current, event.clientX - bounds.left, event.clientY - bounds.top);
                    }
                }
                setIsDragging(true);
            };
            const dragEnd = () => {
                setIsDragging(false);
                setDropEdge(null);
            };
            const dragOver = (event) => {
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain'))
                    return;
                event.preventDefault();
                event.stopPropagation();
                if (event.dataTransfer)
                    event.dataTransfer.dropEffect = 'move';
                const element = event.currentTarget;
                const bounds = element.getBoundingClientRect();
                setDropEdge(event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after');
            };
            const dragLeave = (event) => {
                const element = event.currentTarget;
                if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget))
                    return;
                setDropEdge(null);
            };
            const drop = (event) => {
                const types = Array.from(event.dataTransfer?.types ?? []);
                if (!types.includes(CHOICE_INDEX_MIME) && !types.includes('text/plain'))
                    return;
                event.preventDefault();
                event.stopPropagation();
                const sourceText = event.dataTransfer?.getData(CHOICE_INDEX_MIME) || event.dataTransfer?.getData('text/plain') || '';
                const insertIndex = props.index + (dropEdge === 'after' ? 1 : 0);
                setDropEdge(null);
                setIsDragging(false);
                const source = Number(sourceText);
                if (!Number.isInteger(source))
                    return;
                let finalIndex = insertIndex;
                if (source < insertIndex)
                    finalIndex -= 1;
                finalIndex = Math.max(0, Math.min(props.count - 1, finalIndex));
                if (finalIndex !== source)
                    props.onMove(source, finalIndex);
            };
            const fontFamily = props.choice.fontFamily || props.choice.label;
            const primaryFontName = (props.choice.fontFamily || props.choice.label || '').split(',')[0].replace(/['"]/g, '').trim();
            return (wp.element.createElement("article", { ref: cardRef, className: WooOptionsPro.Utils.classNames('wof-choice-card wof-font-choice-card', !props.isOpen && 'is-collapsed', isDragging && 'is-dragging', dropEdge === 'before' && 'is-drop-before', dropEdge === 'after' && 'is-drop-after'), onDragOver: dragOver, onDragLeave: dragLeave, onDrop: drop },
                wp.element.createElement("header", { className: "wof-choice-card__header" },
                    wp.element.createElement("button", { type: "button", draggable: true, className: "wof-choice-drag-handle", onDragStart: dragStart, onDragEnd: dragEnd, "aria-label": __('Drag to reorder', 'wooptions-pro'), title: __('Drag to reorder', 'wooptions-pro') },
                        wp.element.createElement(WooOptionsPro.Components.GripIcon, null),
                        wp.element.createElement("div", { className: "wof-font-card-header-info" },
                            wp.element.createElement("span", { className: "wof-font-card-name", style: { fontFamily: fontFamily || 'inherit' } }, primaryFontName || props.choice.label || __('Untitled Font', 'wooptions-pro')),
                            props.choice.fontCategory ? (wp.element.createElement("span", { className: "wof-font-category-tag" }, props.choice.fontCategory)) : null,
                            props.choice.default ? (wp.element.createElement("span", { className: "wof-badge-default-font" }, __('Default', 'wooptions-pro'))) : null)),
                    wp.element.createElement("div", { className: "wof-choice-header-actions" },
                        wp.element.createElement("button", { type: "button", className: "wof-choice-accordion-toggle", onClick: props.onToggle, "aria-expanded": props.isOpen, title: props.isOpen ? __('Collapse', 'wooptions-pro') : __('Expand', 'wooptions-pro') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: props.isOpen ? 'arrow-up-alt2' : 'arrow-down-alt2' })),
                        wp.element.createElement("button", { type: "button", className: "wof-choice-delete-btn", onClick: props.onRemove, "aria-label": __('Remove font', 'wooptions-pro'), title: __('Remove font', 'wooptions-pro') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "trash" })))),
                !props.isOpen ? (wp.element.createElement("div", { className: "wof-font-card-preview-strip", style: { fontFamily: fontFamily || 'inherit' } }, "Aa Bb Gg 123")) : null,
                props.isOpen ? (wp.element.createElement("div", { className: "wof-choice-card__body" },
                    wp.element.createElement("div", { className: "wof-font-preview-box", style: { fontFamily: fontFamily || 'inherit' } },
                        wp.element.createElement("div", { className: "wof-font-preview-headline" }, "Aa Bb Gg 123"),
                        wp.element.createElement("div", { className: "wof-font-preview-alphabet" }, "Quick brown fox \u00B7 0123456789")),
                    wp.element.createElement("div", { className: "wof-font-selector-field", style: { marginBottom: '14px' } },
                        wp.element.createElement("label", { className: "components-base-control__label", style: { display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569' } }, __('Font Family', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-font-selector-trigger", onClick: props.onOpenCatalog, role: "button", tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                props.onOpenCatalog();
                            } }, style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                background: '#ffffff',
                                border: '1.5px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }, title: __('Click to select or change font from catalog', 'wooptions-pro') },
                            wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                                wp.element.createElement("span", { style: { fontFamily: fontFamily || 'inherit', fontSize: '15px', fontWeight: 600, color: '#0f172a' } }, primaryFontName || props.choice.label),
                                wp.element.createElement("span", { style: { fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#64748b' } }, props.choice.fontCategory || 'Font')),
                            wp.element.createElement("span", { style: { fontSize: '12px', color: 'var(--wof-admin-primary, #5b4ff5)', fontWeight: 600 } }, __('Change…', 'wooptions-pro')))),
                    wp.element.createElement(TextControl, { label: __('Customer Display Label', 'wooptions-pro'), value: props.choice.label, help: __('Label displayed to customers in the dropdown (e.g. "Dancing Script" or "Modern Sans").', 'wooptions-pro'), onChange: (label) => props.onUpdate({ label }) }),
                    wp.element.createElement("div", { className: "wof-choice-pricing-row" },
                        wp.element.createElement(SelectControl, { label: __('Price adjustment', 'wooptions-pro'), value: props.choice.pricing.strategy, options: [
                                { label: __('No extra charge', 'wooptions-pro'), value: 'none' },
                                { label: __('Fixed fee', 'wooptions-pro'), value: 'fixed' },
                                { label: __('Percentage', 'wooptions-pro'), value: 'percentage' },
                            ], onChange: (strategy) => props.onUpdate({ pricing: { ...props.choice.pricing, strategy } }) }),
                        props.choice.pricing.strategy === 'percentage' ? (wp.element.createElement(TextControl, { label: __('Percent', 'wooptions-pro'), type: "number", value: props.choice.pricing.percent, onChange: (percent) => props.onUpdate({ pricing: { ...props.choice.pricing, percent } }) })) : props.choice.pricing.strategy !== 'none' ? (wp.element.createElement(TextControl, { label: __('Amount', 'wooptions-pro'), type: "number", value: props.choice.pricing.amount, onChange: (amount) => props.onUpdate({ pricing: { ...props.choice.pricing, amount } }) })) : null),
                    wp.element.createElement("div", { className: "wof-choice-toggles-row" },
                        wp.element.createElement(ToggleControl, { label: __('Default font', 'wooptions-pro'), checked: props.choice.default, onChange: (val) => props.onUpdate({ default: val }) }),
                        wp.element.createElement(ToggleControl, { label: __('Disable font', 'wooptions-pro'), checked: props.choice.disabled, onChange: (val) => props.onUpdate({ disabled: val }) })))) : null));
        }
        function FontChoiceEditor(props) {
            const choices = props.field.choices ?? [];
            const [collapsedMap, setCollapsedMap] = useState({});
            const [showCatalogModal, setShowCatalogModal] = useState(false);
            const [replacingChoiceUuid, setReplacingChoiceUuid] = useState(null);
            const [categoryFilter, setCategoryFilter] = useState('all');
            const [searchQuery, setSearchQuery] = useState('');
            const catalog = window.WooOptionsProAdmin?.fontCatalog ?? [];
            const toggleChoice = (uuid) => {
                setCollapsedMap((prev) => ({ ...prev, [uuid]: !prev[uuid] }));
            };
            const isAllCollapsed = choices.length > 0 && choices.every((c) => Boolean(collapsedMap[c.uuid]));
            const toggleAll = () => {
                const nextState = !isAllCollapsed;
                const nextMap = {};
                choices.forEach((c) => {
                    nextMap[c.uuid] = nextState;
                });
                setCollapsedMap(nextMap);
            };
            const updateChoice = (uuid, patch) => {
                let nextChoices = choices.map((c) => {
                    if (c.uuid === uuid) {
                        return { ...c, ...patch };
                    }
                    if (patch.default) {
                        return { ...c, default: false };
                    }
                    return c;
                });
                props.onChange({ ...props.field, choices: nextChoices });
            };
            const removeChoice = (uuid) => {
                props.onChange({
                    ...props.field,
                    choices: choices.filter((c) => c.uuid !== uuid),
                });
            };
            const moveChoice = (from, to) => {
                if (from === to || from < 0 || to < 0 || from >= choices.length || to >= choices.length)
                    return;
                const reordered = [...choices];
                const [moved] = reordered.splice(from, 1);
                reordered.splice(to, 0, moved);
                props.onChange({ ...props.field, choices: reordered });
            };
            const addCatalogFont = (item) => {
                if (choices.some((c) => c.label.toLowerCase() === item.name.toLowerCase())) {
                    return;
                }
                const newChoice = {
                    uuid: WooOptionsPro.Utils.uuid(),
                    label: item.name,
                    description: '',
                    adminLabel: '',
                    color: '',
                    imageId: 0,
                    imageUrl: '',
                    disabled: false,
                    default: choices.length === 0,
                    pricing: WooOptionsPro.FieldFactory.emptyPricing(),
                    quantityEnabled: false,
                    linkedProductId: 0,
                    linkedVariationId: 0,
                    linkedQuantity: 1,
                    preview: {},
                    fontFamily: item.family,
                    fontCategory: item.category,
                    fontSource: item.source,
                };
                props.onChange({
                    ...props.field,
                    choices: [...choices, newChoice],
                });
                setCollapsedMap((prev) => ({ ...prev, [newChoice.uuid]: true }));
            };
            const selectFontFromModal = (item) => {
                if (replacingChoiceUuid) {
                    const choice = choices.find((c) => c.uuid === replacingChoiceUuid);
                    if (choice) {
                        const oldPrimary = (choice.fontFamily || choice.label).split(',')[0].replace(/['"]/g, '').trim();
                        const patch = {
                            fontFamily: item.family,
                            fontCategory: item.category,
                            fontSource: item.source,
                        };
                        if (!choice.label || choice.label === oldPrimary || choice.label === 'Choice' || choice.label === 'Modern sans' || choice.label === 'Classic serif' || choice.label === 'Soft script') {
                            patch.label = item.name;
                        }
                        updateChoice(replacingChoiceUuid, patch);
                        setReplacingChoiceUuid(null);
                        setShowCatalogModal(false);
                        WooOptionsPro.Toast.success(__('Font updated to ', 'wooptions-pro') + item.name);
                        return;
                    }
                }
                addCatalogFont(item);
            };
            const categories = useMemo(() => {
                const set = new Set();
                catalog.forEach((f) => {
                    if (f.category)
                        set.add(f.category);
                });
                const list = Array.from(set);
                const hasCustom = list.includes('Custom');
                const rest = list.filter((c) => c !== 'Custom');
                return ['all', ...(hasCustom ? ['Custom'] : []), ...rest];
            }, [catalog]);
            const filteredCatalog = useMemo(() => {
                return catalog.filter((item) => {
                    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
                    const matchesQuery = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesCat && matchesQuery;
                });
            }, [catalog, categoryFilter, searchQuery]);
            // Dynamically load Google WebFonts for configured choices in admin document head
            useEffect(() => {
                const gFonts = choices
                    .filter((c) => c.fontSource !== 'system')
                    .map((c) => {
                    const primary = (c.fontFamily || c.label || '').split(',')[0].replace(/['"]/g, '').trim();
                    const found = catalog.find((item) => item.name.toLowerCase() === primary.toLowerCase() || item.name.toLowerCase() === c.label.toLowerCase());
                    if (found && found.source === 'system')
                        return '';
                    if (found && found.googleParam)
                        return found.googleParam;
                    const clean = (primary || c.label).replace(/[^a-zA-Z0-9 ]/g, '').replace(/ /g, '+');
                    return clean ? `${clean}:wght@400;700` : '';
                })
                    .filter(Boolean);
                if (gFonts.length > 0) {
                    const id = 'wof-builder-google-fonts';
                    let link = document.getElementById(id);
                    const href = 'https://fonts.googleapis.com/css2?' + Array.from(new Set(gFonts)).map(f => 'family=' + f).join('&') + '&display=swap';
                    if (!link) {
                        link = document.createElement('link');
                        link.id = id;
                        link.rel = 'stylesheet';
                        document.head.appendChild(link);
                    }
                    else if (link.href !== href) {
                        link.href = href;
                    }
                }
            }, [choices, catalog]);
            // Also load catalog fonts into admin document head when modal opens
            useEffect(() => {
                if (showCatalogModal) {
                    const catFonts = catalog
                        .filter((f) => f.source !== 'system' && f.googleParam)
                        .map((f) => f.googleParam);
                    if (catFonts.length > 0) {
                        const id = 'wof-builder-catalog-fonts';
                        let link = document.getElementById(id);
                        const href = 'https://fonts.googleapis.com/css2?' + catFonts.map(f => 'family=' + f).join('&') + '&display=swap';
                        if (!link) {
                            link = document.createElement('link');
                            link.id = id;
                            link.rel = 'stylesheet';
                            document.head.appendChild(link);
                        }
                    }
                }
            }, [showCatalogModal, catalog]);
            return (wp.element.createElement("div", { className: "wof-choice-editor-list wof-font-choice-editor" },
                wp.element.createElement("div", { style: { marginBottom: '14px' } },
                    wp.element.createElement("p", { style: { margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.4 } }, __('Select which specific fonts are available for customers in this Font Choice field. Only the fonts you add below will be loaded.', 'wooptions-pro'))),
                wp.element.createElement("div", { className: "wof-choice-list-toolbar", style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } },
                    wp.element.createElement("span", { className: "wof-choice-list-count", style: { fontWeight: 600, fontSize: '13px', color: '#334155' } },
                        choices.length,
                        " ",
                        __('Available Fonts', 'wooptions-pro')),
                    choices.length > 1 ? (wp.element.createElement("button", { type: "button", className: "wof-choice-collapse-all-btn", onClick: toggleAll }, isAllCollapsed ? __('Expand all', 'wooptions-pro') : __('Collapse all', 'wooptions-pro'))) : null),
                choices.length === 0 ? (wp.element.createElement("div", { style: { padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '14px' } },
                    wp.element.createElement("p", { style: { margin: '0 0 10px 0', color: '#64748b', fontSize: '13px' } }, __('No fonts added yet. Click "+ Add Fonts" to choose fonts from the Google Fonts catalog.', 'wooptions-pro')),
                    wp.element.createElement(Button, { variant: "primary", onClick: () => setShowCatalogModal(true) }, __('+ Add Fonts from Catalog', 'wooptions-pro')))) : (wp.element.createElement("div", { className: "wof-font-choices-list", style: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' } }, choices.map((choice, index) => (wp.element.createElement(FontChoiceCard, { key: choice.uuid, choice: choice, index: index, count: choices.length, isOpen: !collapsedMap[choice.uuid], onToggle: () => toggleChoice(choice.uuid), onUpdate: (patch) => updateChoice(choice.uuid, patch), onRemove: () => removeChoice(choice.uuid), onMove: moveChoice, onOpenCatalog: () => {
                        setReplacingChoiceUuid(choice.uuid);
                        setShowCatalogModal(true);
                    } }))))),
                wp.element.createElement("div", { style: { marginBottom: '16px' } },
                    wp.element.createElement(Button, { variant: "primary", onClick: () => {
                            setReplacingChoiceUuid(null);
                            setShowCatalogModal(true);
                        }, style: { width: '100%', minHeight: '38px', justifyContent: 'center' } },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }),
                        __('Select Fonts from Catalog…', 'wooptions-pro')),
                    wp.element.createElement("p", { style: { margin: '8px 0 0 0', fontSize: '12px', color: '#64748b', textAlign: 'center', lineHeight: 1.4 } }, __('Need custom brand fonts? Upload .woff2, .woff, .ttf, or .otf files in WooOptions Pro → Settings → Custom Fonts.', 'wooptions-pro'))),
                showCatalogModal ? (wp.element.createElement(Modal, { title: replacingChoiceUuid ? __('Select Replacement Font', 'wooptions-pro') : __('Select Fonts to Make Available', 'wooptions-pro'), onRequestClose: () => {
                        setShowCatalogModal(false);
                        setReplacingChoiceUuid(null);
                    }, className: "wof-font-catalog-modal" },
                    wp.element.createElement("div", { className: "wof-font-catalog-modal-content" },
                        wp.element.createElement("div", { className: "wof-font-catalog-modal-header-section" },
                            wp.element.createElement("p", { className: "wof-font-catalog-modal-subtitle", style: { margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' } }, replacingChoiceUuid
                                ? __('Select a font from the catalog to replace this choice. Google, System, and Custom fonts are supported.', 'wooptions-pro')
                                : __('Click any font to make it available for customers. Only enabled fonts will be downloaded by customers.', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-font-catalog-toolbar" },
                                wp.element.createElement("input", { type: "text", className: "wof-font-search-input", placeholder: __('Search fonts (e.g. Dancing Script, Roboto)…', 'wooptions-pro'), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), autoFocus: true }),
                                wp.element.createElement("div", { className: "wof-font-category-chips" }, categories.map((cat) => (wp.element.createElement("button", { key: cat, type: "button", className: WooOptionsPro.Utils.classNames('wof-font-category-chip', categoryFilter === cat && 'is-active'), onClick: () => setCategoryFilter(cat) },
                                    cat === 'all' ? __('All Categories', 'wooptions-pro') : cat,
                                    cat === 'Custom' ? ` (${catalog.filter((f) => f.category === 'Custom').length})` : '')))))),
                        wp.element.createElement("div", { className: "wof-font-catalog-grid" }, filteredCatalog.length === 0 ? (wp.element.createElement("div", { style: { gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', color: '#64748b' } },
                            wp.element.createElement("p", { style: { margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 } }, __('No fonts found matching your search.', 'wooptions-pro')),
                            categoryFilter === 'Custom' ? (wp.element.createElement("p", { style: { margin: 0, fontSize: '12px', color: '#94a3b8' } }, __('You can upload custom .woff2, .woff, .ttf, or .otf font files in WooOptions Pro → Settings → Custom Fonts.', 'wooptions-pro'))) : null)) : (filteredCatalog.map((item) => {
                            const isAdded = choices.some((c) => (c.fontFamily || c.label).toLowerCase().includes(item.name.toLowerCase()));
                            return (wp.element.createElement("div", { key: item.id, className: WooOptionsPro.Utils.classNames('wof-font-catalog-card', isAdded && !replacingChoiceUuid && 'is-added'), onClick: () => selectFontFromModal(item) },
                                wp.element.createElement("div", { className: "wof-font-catalog-card-header" },
                                    wp.element.createElement("span", { className: "wof-font-catalog-card-name" }, item.name),
                                    wp.element.createElement("span", { className: "wof-font-category-tag" }, item.category)),
                                wp.element.createElement("div", { className: "wof-font-catalog-card-sample", style: { fontFamily: item.family } }, "Aa Bb Gg 123"),
                                wp.element.createElement("div", { className: "wof-font-catalog-card-footer" },
                                    wp.element.createElement("span", { style: { fontSize: '11px', color: '#94a3b8' } }, item.source === 'system'
                                        ? __('System Font', 'wooptions-pro')
                                        : item.source === 'custom'
                                            ? __('Custom Uploaded Font', 'wooptions-pro')
                                            : __('Google WebFont', 'wooptions-pro')),
                                    wp.element.createElement("button", { type: "button", className: "wof-font-catalog-card-btn", disabled: isAdded && !replacingChoiceUuid }, replacingChoiceUuid
                                        ? __('Select Font →', 'wooptions-pro')
                                        : isAdded
                                            ? __('Added ✓', 'wooptions-pro')
                                            : __('+ Select', 'wooptions-pro')))));
                        }))),
                        wp.element.createElement("footer", { className: "wof-font-catalog-modal-footer" },
                            wp.element.createElement("span", { style: { fontSize: '13px', color: '#64748b' } },
                                choices.length,
                                " ",
                                __('font(s) selected for this field', 'wooptions-pro')),
                            wp.element.createElement(Button, { variant: "primary", onClick: () => { setShowCatalogModal(false); setReplacingChoiceUuid(null); } }, __('Done Selecting', 'wooptions-pro')))))) : null));
        }
        function ChoiceEditor(props) {
            // Product fields use their own dedicated editor.
            if (props.field.type === 'product') {
                return wp.element.createElement(ProductChoiceEditor, { field: props.field, onChange: props.onChange });
            }
            // Font fields use their own dedicated font manager editor.
            if (props.field.type === 'font') {
                return wp.element.createElement(FontChoiceEditor, { field: props.field, onChange: props.onChange });
            }
            const choices = props.field.choices ?? [];
            const [collapsedMap, setCollapsedMap] = useState({});
            const toggleChoice = (uuid) => {
                setCollapsedMap((prev) => ({ ...prev, [uuid]: !prev[uuid] }));
            };
            const isAllCollapsed = choices.length > 0 && choices.every((c) => Boolean(collapsedMap[c.uuid]));
            const toggleAll = () => {
                const nextState = !isAllCollapsed;
                const nextMap = {};
                choices.forEach((c) => {
                    nextMap[c.uuid] = nextState;
                });
                setCollapsedMap(nextMap);
            };
            const updateChoice = (uuid, patch) => props.onChange({
                ...props.field,
                choices: choices.map((choice) => choice.uuid === uuid ? { ...choice, ...patch } : choice),
            });
            const removeChoice = (uuid) => props.onChange({
                ...props.field,
                choices: choices.filter((choice) => choice.uuid !== uuid),
            });
            const addChoice = () => {
                const newChoice = WooOptionsPro.FieldFactory.choice(`Choice ${choices.length + 1}`, choices.length);
                props.onChange({
                    ...props.field,
                    choices: [...choices, newChoice],
                });
                setCollapsedMap((prev) => ({ ...prev, [newChoice.uuid]: false }));
            };
            const moveChoice = (from, to) => {
                if (from === to || from < 0 || to < 0 || from >= choices.length || to >= choices.length)
                    return;
                const reordered = [...choices];
                const [moved] = reordered.splice(from, 1);
                reordered.splice(to, 0, moved);
                props.onChange({ ...props.field, choices: reordered });
            };
            if (!props.field.choices)
                return wp.element.createElement("p", { className: "wof-muted-note" }, __('This element has no choices.', 'wooptions-pro'));
            return (wp.element.createElement("div", { className: "wof-choice-editor-list" },
                props.field.type === 'segmented' ? (wp.element.createElement("div", { className: "wof-field-width-setting" },
                    wp.element.createElement("span", { className: "wof-field-width-label" }, __('Display Direction', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Display Direction', 'wooptions-pro') }, ['vertical', 'horizontal'].map((dir) => {
                        const isSelected = (props.field.displayDirection || 'horizontal') === dir;
                        return (wp.element.createElement("button", { type: "button", key: dir, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => props.onChange({ ...props.field, displayDirection: dir }) }, dir === 'horizontal' ? __('Horizontal', 'wooptions-pro') : __('Vertical', 'wooptions-pro')));
                    })))) : null,
                ['image_swatch', 'color_swatch'].includes(props.field.type) ? (wp.element.createElement("div", { style: { marginBottom: '16px' } },
                    wp.element.createElement("label", { className: "components-base-control__label", style: { display: 'block', marginBottom: '8px' } }, __('Image Style', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-image-style-cards" }, [
                        { value: 'default', label: __('Default', 'wooptions-pro'), svgTop: true, svgBottom: true },
                        { value: 'overlay', label: __('Image overlay', 'wooptions-pro'), svgTop: false, svgBottom: false },
                        { value: 'only_image', label: __('Only Image', 'wooptions-pro'), svgTop: false, svgBottom: false },
                    ].map((st) => {
                        const currentStyle = props.field.imageStyle || 'default';
                        const isSelected = currentStyle === st.value;
                        return (wp.element.createElement("button", { key: st.value, type: "button", className: WooOptionsPro.Utils.classNames('wof-image-style-card', isSelected && 'is-active'), onClick: () => props.onChange({ ...props.field, imageStyle: st.value }), title: st.label },
                            wp.element.createElement("span", { className: "wof-image-style-card__preview" },
                                wp.element.createElement("svg", { viewBox: "0 0 60 45", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": "true" },
                                    wp.element.createElement("rect", { x: "1", y: "1", width: "58", height: "43", rx: "5", fill: "#e8ecf0", stroke: "#c8d0da", strokeWidth: "1" }),
                                    wp.element.createElement("rect", { x: "8", y: "7", width: "44", height: "24", rx: "3", fill: "#b4bfcb" }),
                                    wp.element.createElement("circle", { cx: "18", cy: "19", r: "5", fill: "#8e9db0" }),
                                    wp.element.createElement("polygon", { points: "14,28 24,15 32,24 38,18 52,31 8,31", fill: "#9eb0c2" }),
                                    st.value === 'overlay' ? (wp.element.createElement(wp.element.Fragment, null,
                                        wp.element.createElement("rect", { x: "8", y: "21", width: "44", height: "10", rx: "0", fill: "rgba(0,0,0,0.45)" }),
                                        wp.element.createElement("rect", { x: "12", y: "23", width: "20", height: "3", rx: "1.5", fill: "#fff", opacity: "0.8" }),
                                        wp.element.createElement("rect", { x: "12", y: "27", width: "14", height: "2", rx: "1", fill: "#fff", opacity: "0.5" }))) : null,
                                    st.svgBottom ? (wp.element.createElement("rect", { x: "12", y: "36", width: "20", height: "3", rx: "1.5", fill: "#b4bfcb" })) : null)),
                            wp.element.createElement("span", { className: "wof-image-style-card__label" }, st.label)));
                    })))) : null,
                ['radio', 'checkbox_group'].includes(props.field.type) ? (wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' } },
                    wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                        wp.element.createElement("span", { className: "wof-field-width-label" }, __('Columns', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Columns', 'wooptions-pro') }, [
                            { label: __('One', 'wooptions-pro'), value: 'one' },
                            { label: __('Two', 'wooptions-pro'), value: 'two' },
                        ].map((col) => {
                            const isSelected = (props.field.columns || 'one') === col.value;
                            return (wp.element.createElement("button", { type: "button", key: col.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => props.onChange({ ...props.field, columns: col.value }) }, col.label));
                        }))),
                    wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                        wp.element.createElement("span", { className: "wof-field-width-label" }, __('Image Style', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Image Style', 'wooptions-pro') }, [
                            { label: __('Normal', 'wooptions-pro'), value: 'normal' },
                            { label: __('Circle', 'wooptions-pro'), value: 'circle' },
                        ].map((st) => {
                            const isSelected = (props.field.imageStyle || 'normal') === st.value;
                            return (wp.element.createElement("button", { type: "button", key: st.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => props.onChange({ ...props.field, imageStyle: st.value }) }, st.label));
                        }))))) : props.field.type === 'select' ? (wp.element.createElement("div", { style: { marginBottom: '18px' } },
                    wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: 0 } },
                        wp.element.createElement("span", { className: "wof-field-width-label" }, __('Image Style', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Image Style', 'wooptions-pro') }, [
                            { label: __('Normal', 'wooptions-pro'), value: 'normal' },
                            { label: __('Circle', 'wooptions-pro'), value: 'circle' },
                        ].map((st) => {
                            const isSelected = (props.field.imageStyle || 'normal') === st.value;
                            return (wp.element.createElement("button", { type: "button", key: st.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => props.onChange({ ...props.field, imageStyle: st.value }) }, st.label));
                        }))))) : null,
                props.field.type === 'image_swatch' ? wp.element.createElement("div", { className: "wof-image-swatch-behavior" },
                    wp.element.createElement(ToggleControl, { label: __('Update product image on selection', 'wooptions-pro'), help: __('Replace the main WooCommerce product image with the selected swatch image.', 'wooptions-pro'), checked: Boolean(props.field.updateProductImage), onChange: (updateProductImage) => props.onChange({ ...props.field, updateProductImage }) })) : null,
                choices.length > 1 ? (wp.element.createElement("div", { className: "wof-choice-list-toolbar" },
                    wp.element.createElement("span", { className: "wof-choice-list-count" },
                        choices.length,
                        " ",
                        __('Choices', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", className: "wof-choice-collapse-all-btn", onClick: toggleAll }, isAllCollapsed ? __('Expand all', 'wooptions-pro') : __('Collapse all', 'wooptions-pro')))) : null,
                choices.map((choice, index) => (wp.element.createElement(ChoiceItemCard, { key: choice.uuid, choice: choice, index: index, count: choices.length, fieldType: props.field.type, isOpen: !collapsedMap[choice.uuid], onToggle: () => toggleChoice(choice.uuid), onUpdate: (patch) => updateChoice(choice.uuid, patch), onRemove: () => removeChoice(choice.uuid), onMove: moveChoice }))),
                wp.element.createElement(Button, { variant: "secondary", onClick: addChoice },
                    wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "plus-alt2" }),
                    __('Add choice', 'wooptions-pro'))));
        }
        function FormulaPanel(props) {
            const { field, allFields, onChange } = props;
            const update = (patch) => onChange({ ...field, ...patch });
            const exprRef = useRef(null);
            const [testResult, setTestResult] = useState(null);
            const [testing, setTesting] = useState(false);
            const [refOpen, setRefOpen] = useState(false);
            const [openDropdown, setOpenDropdown] = useState(null);
            const [dropdownPos, setDropdownPos] = useState(null);
            const activeDropdownRef = useRef(null);
            // Event delegation: close open dropdown on click outside
            useEffect(() => {
                if (!openDropdown)
                    return;
                const onDocClick = (e) => {
                    const target = e.target;
                    if (!target?.closest('.wof-dv-wrap') && !target?.closest('.wof-dv-portal')) {
                        setOpenDropdown(null);
                        setDropdownPos(null);
                    }
                };
                document.addEventListener('mousedown', onDocClick);
                return () => {
                    document.removeEventListener('mousedown', onDocClick);
                };
            }, [openDropdown]);
            // Close dropdown on window/sidebar scroll to avoid detached floating menus
            useEffect(() => {
                if (!openDropdown)
                    return;
                const onScroll = () => {
                    setOpenDropdown(null);
                    setDropdownPos(null);
                };
                window.addEventListener('scroll', onScroll, true);
                return () => {
                    window.removeEventListener('scroll', onScroll, true);
                };
            }, [openDropdown]);
            // Keep dropdown inside screen boundaries
            useEffect(() => {
                if (!openDropdown || !activeDropdownRef.current)
                    return;
                const el = activeDropdownRef.current;
                const rect = el.getBoundingClientRect();
                if (rect.right > window.innerWidth - 8) {
                    el.classList.add('is-align-right');
                }
                else {
                    el.classList.remove('is-align-right');
                }
            }, [openDropdown]);
            // Sub-panel boundary check: dynamically adjust orientation to stay within viewport
            const handleSubMouseEnter = (e) => {
                const item = e.currentTarget;
                const sub = item.querySelector(':scope > .wof-dv-sub-panel');
                if (!sub)
                    return;
                const itemRect = item.getBoundingClientRect();
                const subWidth = 180;
                if (itemRect.left - subWidth < 10) {
                    sub.style.left = '100%';
                    sub.style.right = 'auto';
                    sub.style.marginLeft = '3px';
                    sub.style.marginRight = '0';
                }
                else {
                    sub.style.left = 'auto';
                    sub.style.right = '100%';
                    sub.style.marginLeft = '0';
                    sub.style.marginRight = '3px';
                }
                const subHeight = sub.offsetHeight || 150;
                if (itemRect.top + subHeight > window.innerHeight - 10) {
                    sub.style.top = 'auto';
                    sub.style.bottom = '-4px';
                }
                else {
                    sub.style.top = '-4px';
                    sub.style.bottom = 'auto';
                }
            };
            // Insert text at the current cursor position in the expression textarea.
            const insertAtCursor = (text) => {
                const el = exprRef.current;
                const current = field.expression ?? '0';
                if (!el) {
                    const next = current === '0' || current === '' ? text : current + text;
                    update({ expression: next });
                    return;
                }
                const start = el.selectionStart ?? 0;
                const end = el.selectionEnd ?? 0;
                let next = '';
                let newCursorPos = 0;
                if ((current === '0' || current === '') && (start === 0 && end <= 1)) {
                    next = text;
                    newCursorPos = text.length;
                }
                else {
                    next = current.slice(0, start) + text + current.slice(end);
                    newCursorPos = start + text.length;
                }
                update({ expression: next });
                setTimeout(() => {
                    el.focus();
                    el.setSelectionRange(newCursorPos, newCursorPos);
                }, 0);
            };
            const testExpression = async () => {
                setTesting(true);
                setTestResult(null);
                try {
                    const result = await WooOptionsPro.Api.request('/test-formula', {
                        method: 'POST',
                        data: {
                            expression: field.expression ?? '0',
                            fields: allFields.map((f) => ({
                                uuid: f.uuid,
                                type: f.type,
                                label: f.label || f.type,
                                name: f.name || '',
                                default: f.default ?? '10',
                                choices: f.choices ?? f.options ?? [],
                                pricing: f.pricing ?? {},
                                enableQuantity: Boolean(f.enableQuantity),
                            })),
                            context: {
                                basePrice: '100',
                                quantity: 1,
                            },
                        },
                    });
                    setTestResult({ value: result.result });
                }
                catch (err) {
                    const msg = err?.message ?? String(err);
                    setTestResult({ error: msg.replace(/^wooptions-pro_formula_?/, '').replace(/_/g, ' ') });
                }
                finally {
                    setTesting(false);
                }
            };
            // Sibling fields that can be referenced with [Field Label] or FIELD("uuid").
            const siblingFields = allFields.filter((f) => f.uuid !== field.uuid && !['formula', 'heading', 'paragraph', 'help', 'separator', 'spacer', 'content', 'modal'].includes(f.type));
            const FUNCTION_REF = [
                { name: 'IF(cond, true, false)', stub: 'IF(, , )' },
                { name: 'FIELD("uuid")', stub: 'FIELD("")' },
                { name: 'ROUND(n, places)', stub: 'ROUND(, 2)' },
                { name: 'ABS(n)', stub: 'ABS()' },
                { name: 'CEIL(n)', stub: 'CEIL()' },
                { name: 'FLOOR(n)', stub: 'FLOOR()' },
                { name: 'MIN(a, b, …)', stub: 'MIN(, )' },
                { name: 'MAX(a, b, …)', stub: 'MAX(, )' },
                { name: 'POW(base, exp)', stub: 'POW(, 2)' },
                { name: 'SUM(rows, "field")', stub: 'SUM(rows, "")' },
                { name: 'AVG(rows, "field")', stub: 'AVG(rows, "")' },
                { name: 'COUNT(rows)', stub: 'COUNT(rows)' },
            ];
            // Readable slug: spaces → underscores
            const toSlug = (s) => (s || '').trim().replace(/\s+/g, '_');
            // Build readable token: [FieldLabel.property]
            const fieldToken = (f, prop) => `[${toSlug(f.label || f.type)}.${prop}]`;
            // Build readable option token: [FieldLabel.options.ChoiceLabel.prop]
            const optionToken = (f, choiceLabel, prop) => `[${toSlug(f.label || f.type)}.options.${toSlug(choiceLabel)}.${prop}]`;
            const DYNAMIC_VALUES = {
                checkbox: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If none selected', prop: 'selected-none' },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'If all selected', prop: 'selected-all' },
                    { label: 'Count selected', prop: 'count-selected' },
                    { label: 'Min selected formula value', prop: 'min-formula' },
                    { label: 'Max selected formula value', prop: 'max-formula' },
                    { label: 'Sum of selected value', prop: 'sum-formula' },
                    { label: 'Total quantity', prop: 'total-qty' },
                ],
                checkbox_group: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If none selected', prop: 'selected-none' },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'If all selected', prop: 'selected-all' },
                    { label: 'Count selected', prop: 'count-selected' },
                    { label: 'Min selected formula value', prop: 'min-formula' },
                    { label: 'Max selected formula value', prop: 'max-formula' },
                    { label: 'Sum of selected value', prop: 'sum-formula' },
                    { label: 'Total quantity', prop: 'total-qty' },
                ],
                image_swatch: [
                    { label: 'Images', prop: '', isOptions: true },
                    { label: 'If none selected', prop: 'selected-none' },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'If all selected', prop: 'selected-all' },
                    { label: 'Count selected', prop: 'count-selected' },
                    { label: 'Min selected formula value', prop: 'min-formula' },
                    { label: 'Max selected formula value', prop: 'max-formula' },
                    { label: 'Sum of selected value', prop: 'sum-formula' },
                    { label: 'Total quantity', prop: 'total-qty' },
                ],
                color_swatch: [
                    { label: 'Colors', prop: '', isOptions: true },
                    { label: 'If none selected', prop: 'selected-none' },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'If all selected', prop: 'selected-all' },
                    { label: 'Count selected', prop: 'count-selected' },
                    { label: 'Min selected formula value', prop: 'min-formula' },
                    { label: 'Max selected formula value', prop: 'max-formula' },
                    { label: 'Sum of selected value', prop: 'sum-formula' },
                    { label: 'Total quantity', prop: 'total-qty' },
                ],
                radio: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'Selected formula value', prop: 'selected-formula' },
                    { label: 'Quantity', prop: 'qty' },
                ],
                select: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'Selected formula value', prop: 'selected-formula' },
                ],
                segmented: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If none selected', prop: 'selected-none' },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'If all selected', prop: 'selected-all' },
                    { label: 'Count selected', prop: 'count-selected' },
                    { label: 'Min selected formula value', prop: 'min-formula' },
                    { label: 'Max selected formula value', prop: 'max-formula' },
                    { label: 'Sum of selected value', prop: 'sum-formula' },
                ],
                button: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If none selected', prop: 'selected-none' },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'If all selected', prop: 'selected-all' },
                    { label: 'Count selected', prop: 'count-selected' },
                    { label: 'Min selected formula value', prop: 'min-formula' },
                    { label: 'Max selected formula value', prop: 'max-formula' },
                    { label: 'Sum of selected value', prop: 'sum-formula' },
                ],
                product: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If none selected', prop: 'selected-none' },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'If all selected', prop: 'selected-all' },
                    { label: 'Count selected', prop: 'count-selected' },
                    { label: 'Min selected formula value', prop: 'min-formula' },
                    { label: 'Max selected formula value', prop: 'max-formula' },
                    { label: 'Sum of selected value', prop: 'sum-formula' },
                    { label: 'Total quantity', prop: 'total-qty' },
                ],
                font: [
                    { label: 'Options', prop: '', isOptions: true },
                    { label: 'If any selected', prop: 'selected-any' },
                    { label: 'Selected formula value', prop: 'selected-formula' },
                ],
                date: [
                    { label: 'Days from today', prop: 'days-from-today' },
                    { label: 'Year', prop: 'year' },
                    { label: 'Month (1–12)', prop: 'month' },
                    { label: 'Day (1–31)', prop: 'day' },
                    { label: 'Weekday (Mon:1, Sun:7)', prop: 'weekday' },
                ],
                datetime: [
                    { label: 'Days from today', prop: 'days-from-today' },
                    { label: 'Year', prop: 'year' },
                    { label: 'Month (1–12)', prop: 'month' },
                    { label: 'Day (1–31)', prop: 'day' },
                    { label: 'Weekday (Mon:1, Sun:7)', prop: 'weekday' },
                ],
                date_range: [
                    { label: 'Days from today', prop: 'days-from-today' },
                    { label: 'Year', prop: 'year' },
                    { label: 'Month (1–12)', prop: 'month' },
                    { label: 'Day (1–31)', prop: 'day' },
                ],
                switch: [
                    { label: 'Selected', prop: 'selected' },
                    { label: 'Formula Value', prop: 'formula-value' },
                    { label: 'Quantity', prop: 'qty' },
                ],
                toggle: [
                    { label: 'Selected', prop: 'selected' },
                    { label: 'Formula Value', prop: 'formula-value' },
                    { label: 'Quantity', prop: 'qty' },
                ],
                email: [
                    { label: 'Character count', prop: 'char-count' },
                    { label: 'Word count', prop: 'word-count' },
                ],
                textarea: [
                    { label: 'Character count', prop: 'char-count' },
                    { label: 'Word count', prop: 'word-count' },
                ],
                text: [
                    { label: 'Character count', prop: 'char-count' },
                    { label: 'Word count', prop: 'word-count' },
                ],
                url: [
                    { label: 'Character count', prop: 'char-count' },
                    { label: 'Word count', prop: 'word-count' },
                ],
                tel: [
                    { label: 'Character count', prop: 'char-count' },
                    { label: 'Word count', prop: 'word-count' },
                ],
                range: [
                    { label: 'Range value', prop: 'value' },
                ],
                number: [
                    { label: 'Number value', prop: 'value' },
                ],
                customer_defined_price: [
                    { label: 'Price value', prop: 'value' },
                ],
                upload: [
                    { label: 'File count', prop: 'value' },
                ],
                file: [
                    { label: 'File count', prop: 'value' },
                ],
            };
            const getDynamicValues = (f) => {
                const t = f.type;
                let values = DYNAMIC_VALUES[t] ??
                    DYNAMIC_VALUES[t.replace('-', '_')] ??
                    [{ label: f.label || f.type, prop: 'value' }];
                // Safety: If this field is a choice type or has choices configured, ensure an 'Options' entry is present
                const isChoiceField = ['select', 'radio', 'checkbox_group', 'checkbox', 'segmented', 'button', 'color_swatch', 'image_swatch', 'product', 'font'].includes(t);
                const choices = f.choices ?? f.options ?? [];
                if ((isChoiceField || choices.length > 0) && !values.some((v) => v.isOptions)) {
                    values = [{ label: 'Options', prop: '', isOptions: true }, ...values];
                }
                return values;
            };
            // Per-choice option sub-items: Option Price, Checked, Quantity (type-aware)
            const getChoiceOptionProps = (fieldType) => {
                if (['radio', 'select', 'font'].includes(fieldType)) {
                    return [
                        { label: 'Option Price', prop: 'formula' },
                        { label: 'Checked', prop: 'checked' },
                    ];
                }
                return [
                    { label: 'Option Price', prop: 'formula' },
                    { label: 'Checked', prop: 'checked' },
                    { label: 'Quantity', prop: 'qty' },
                ];
            };
            const getFieldChoices = (f) => f.choices ?? f.options ?? [];
            return (wp.element.createElement("div", { className: "wof-formula-panel" },
                wp.element.createElement("div", { className: "wof-formula-section" },
                    wp.element.createElement(TextControl, { label: __('Label', 'wooptions-pro'), value: field.label, onChange: (label) => update({ label }) }),
                    wp.element.createElement(TextareaControl, { label: __('Help text', 'wooptions-pro'), value: field.help ?? field.description ?? '', onChange: (help) => update({ help, description: help }), placeholder: __('Add helpful explanation for customers…', 'wooptions-pro') }),
                    wp.element.createElement("div", { className: "wof-help-position-control" },
                        wp.element.createElement("label", { className: "wof-segmented-label" }, __('HELP TEXT POSITION', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-segmented-group" }, [
                            { label: __('Below Title', 'wooptions-pro'), value: 'below_title' },
                            { label: __('Tooltip', 'wooptions-pro'), value: 'tooltip' },
                            { label: __('Below Field', 'wooptions-pro'), value: 'below_field' },
                        ].map((opt) => {
                            const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
                            return (wp.element.createElement("button", { key: opt.value, type: "button", className: WooOptionsPro.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected'), onClick: () => update({ helpTextPosition: opt.value }) }, opt.label));
                        }))),
                    wp.element.createElement("div", { className: "wof-field-width-setting" },
                        wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                            const isSelected = (field.width || '100%') === w;
                            return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                        })))),
                wp.element.createElement("div", { className: "wof-formula-section" },
                    wp.element.createElement("div", { className: "wof-formula-expr-header" },
                        wp.element.createElement("strong", { className: "wof-formula-section__title" }, __('Formula Expression', 'wooptions-pro')),
                        wp.element.createElement("button", { type: "button", className: "wof-formula-run-test-btn", onClick: testExpression, disabled: testing }, testing ? __('Testing…', 'wooptions-pro') : __('▶ Run Test', 'wooptions-pro'))),
                    wp.element.createElement("p", { className: "wof-formula-hint" }, __('Use arithmetic operators (+, -, *, /), [Field Name], IF(), and built-in functions.', 'wooptions-pro')),
                    wp.element.createElement("textarea", { ref: exprRef, id: "wof-formula-expression", className: "wof-formula-textarea", value: field.expression ?? '0', rows: 5, spellCheck: false, autoComplete: "off", onChange: (e) => update({ expression: e.target.value }), "aria-label": __('Formula expression', 'wooptions-pro') }),
                    testResult ? (testResult.error ? (wp.element.createElement("span", { className: "wof-formula-test-result is-error" }, testResult.error)) : (wp.element.createElement("span", { className: "wof-formula-test-result is-success" },
                        __('Result:', 'wooptions-pro'),
                        " ",
                        testResult.value))) : null,
                    wp.element.createElement("div", { className: "wof-formula-tokens" },
                        wp.element.createElement("span", { className: "wof-formula-tokens__label" }, __('Insert field:', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-formula-tokens__list" },
                            wp.element.createElement("button", { type: "button", className: "wof-formula-token-btn", title: __('Base product price [product_price]', 'wooptions-pro'), onClick: () => insertAtCursor('[product_price]') },
                                wp.element.createElement("span", { className: "wof-formula-token-text" }, __('Product Price', 'wooptions-pro'))),
                            siblingFields.map((f) => {
                                const tokenName = f.label || f.type;
                                const dynValues = getDynamicValues(f);
                                const isOpen = openDropdown === f.uuid;
                                const hasDynOptions = dynValues.length > 0;
                                const choices = getFieldChoices(f);
                                const choiceOptionProps = getChoiceOptionProps(f.type);
                                return (wp.element.createElement("div", { key: f.uuid, className: "wof-dv-wrap", onClick: (e) => e.stopPropagation() },
                                    wp.element.createElement("button", { type: "button", className: `wof-formula-token-btn${isOpen ? ' is-open' : ''}`, title: sprintf(__('Dynamic values for %s', 'wooptions-pro'), tokenName), onClick: (e) => {
                                            if (hasDynOptions) {
                                                if (isOpen) {
                                                    setOpenDropdown(null);
                                                    setDropdownPos(null);
                                                }
                                                else {
                                                    const btn = e.currentTarget;
                                                    const rect = btn.getBoundingClientRect();
                                                    const alignRight = rect.left + 230 > window.innerWidth - 10;
                                                    const left = alignRight ? Math.max(10, rect.right - 210) : rect.left;
                                                    setDropdownPos({ top: rect.bottom + 4, left });
                                                    setOpenDropdown(f.uuid);
                                                }
                                            }
                                            else {
                                                insertAtCursor(fieldToken(f, 'value'));
                                            }
                                        } },
                                        wp.element.createElement("span", { className: "wof-formula-token-text" }, tokenName),
                                        hasDynOptions && (wp.element.createElement("span", { className: "wof-formula-token-arrow", "aria-hidden": "true" }, "\u25BE"))),
                                    isOpen && hasDynOptions && (() => {
                                        const renderItems = () => dynValues.map((dv, dvIdx) => {
                                            // "Options" row — flyout with choices
                                            if (dv.isOptions) {
                                                return (wp.element.createElement("div", { key: dvIdx, className: "wof-dv-item wof-dv-item--has-sub", onMouseEnter: handleSubMouseEnter },
                                                    wp.element.createElement("span", { className: "wof-dv-item-label" }, dv.label),
                                                    wp.element.createElement("span", { className: "wof-dv-item-arrow" }, "\u203A"),
                                                    wp.element.createElement("div", { className: "wof-dv-sub-panel" }, choices.length === 0 ? (wp.element.createElement("span", { className: "wof-dv-empty-msg" }, __('No options configured', 'wooptions-pro'))) : (choices.map((c, ci) => {
                                                        const choiceLabel = (c.label || c.title || c.productTitle || c.adminLabel || c.value || `Option ${ci + 1}`).trim();
                                                        return (wp.element.createElement("div", { key: ci, className: "wof-dv-item wof-dv-item--has-sub", onMouseEnter: handleSubMouseEnter },
                                                            wp.element.createElement("span", { className: "wof-dv-item-label", onClick: (e) => {
                                                                    e.stopPropagation();
                                                                    insertAtCursor(optionToken(f, choiceLabel, 'formula'));
                                                                    setOpenDropdown(null);
                                                                    setDropdownPos(null);
                                                                }, title: __('Click to insert option price, or hover for more properties', 'wooptions-pro') }, choiceLabel),
                                                            wp.element.createElement("span", { className: "wof-dv-item-arrow" }, "\u203A"),
                                                            wp.element.createElement("div", { className: "wof-dv-sub-panel" }, choiceOptionProps.map((op) => (wp.element.createElement("button", { key: op.prop, type: "button", className: "wof-dv-item", onClick: () => {
                                                                    insertAtCursor(optionToken(f, choiceLabel, op.prop));
                                                                    setOpenDropdown(null);
                                                                    setDropdownPos(null);
                                                                } }, op.label))))));
                                                    })))));
                                            }
                                            // Regular value row
                                            return (wp.element.createElement("button", { key: dvIdx, type: "button", className: "wof-dv-item", onClick: () => {
                                                    insertAtCursor(fieldToken(f, dv.prop));
                                                    setOpenDropdown(null);
                                                    setDropdownPos(null);
                                                } }, dv.label));
                                        });
                                        const createPortalFn = wp.element.createPortal;
                                        if (typeof createPortalFn === 'function' && dropdownPos) {
                                            return createPortalFn(wp.element.createElement("div", { className: "wof-formula-panel wof-dv-portal", style: {
                                                    position: 'fixed',
                                                    top: dropdownPos.top,
                                                    left: dropdownPos.left,
                                                    zIndex: 999999,
                                                }, onClick: (e) => e.stopPropagation() },
                                                wp.element.createElement("div", { className: "wof-formula-section", style: { padding: 0, margin: 0, border: 'none' } },
                                                    wp.element.createElement("div", { className: "wof-formula-tokens", style: { padding: 0, margin: 0, border: 'none', background: 'transparent' } },
                                                        wp.element.createElement("div", { className: "wof-dv-wrap" },
                                                            wp.element.createElement("div", { ref: activeDropdownRef, className: "wof-dv-dropdown is-portal", style: { position: 'static' } }, renderItems()))))), document.body);
                                        }
                                        return (wp.element.createElement("div", { ref: activeDropdownRef, className: "wof-dv-dropdown" }, renderItems()));
                                    })()));
                            }))),
                    wp.element.createElement("div", { className: "wof-formula-ref-inline" },
                        wp.element.createElement("button", { type: "button", className: "wof-formula-ref-toggle", onClick: () => setRefOpen((o) => !o), "aria-expanded": refOpen },
                            wp.element.createElement("span", null, __('Function Reference', 'wooptions-pro')),
                            wp.element.createElement("span", { className: "wof-formula-ref-toggle__icon" }, refOpen ? '▲' : '▼')),
                        refOpen ? (wp.element.createElement("div", { className: "wof-formula-ref-list" }, FUNCTION_REF.map((fn) => (wp.element.createElement("button", { key: fn.stub, type: "button", className: "wof-formula-ref-item", onClick: () => insertAtCursor(fn.stub), title: __('Click to insert', 'wooptions-pro') },
                            wp.element.createElement("code", null, fn.name)))))) : null)),
                wp.element.createElement("div", { className: "wof-formula-section" },
                    wp.element.createElement("strong", { className: "wof-formula-section__title" }, __('Display Settings', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: '12px' } },
                        wp.element.createElement("span", { className: "wof-field-width-label" }, __('Output Mode', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Output mode', 'wooptions-pro') }, [
                            { label: __('Currency', 'wooptions-pro'), value: 'currency' },
                            { label: __('Number', 'wooptions-pro'), value: 'number' },
                            { label: __('Text', 'wooptions-pro'), value: 'text' },
                        ].map((opt) => {
                            const isSelected = (field.displayMode ?? 'currency') === opt.value;
                            return (wp.element.createElement("button", { key: opt.value, type: "button", role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ displayMode: opt.value }) }, opt.label));
                        }))),
                    (field.displayMode ?? 'number') !== 'text' ? (wp.element.createElement(TextControl, { label: __('Decimal Places', 'wooptions-pro'), type: "number", min: 0, max: 6, value: String(field.decimalPlaces ?? 2), onChange: (val) => update({ decimalPlaces: Math.max(0, Math.min(6, parseInt(val, 10) || 0)) }) })) : null,
                    wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' } },
                        wp.element.createElement(TextControl, { label: __('Prefix', 'wooptions-pro'), value: field.prefix ?? '', placeholder: __('e.g. $', 'wooptions-pro'), onChange: (prefix) => update({ prefix }) }),
                        wp.element.createElement(TextControl, { label: __('Suffix', 'wooptions-pro'), value: field.suffix ?? '', placeholder: __('e.g.  days', 'wooptions-pro'), onChange: (suffix) => update({ suffix }) })),
                    wp.element.createElement("div", { style: { marginTop: '8px' } },
                        wp.element.createElement(ToggleControl, { label: __('Hide when zero', 'wooptions-pro'), help: __('Do not display the field when the formula evaluates to 0.', 'wooptions-pro'), checked: Boolean(field.hideWhenZero), onChange: (hideWhenZero) => update({ hideWhenZero }) })))));
        }
        function PricingPanel(props) {
            const pricing = props.field.pricing ?? WooOptionsPro.FieldFactory.emptyPricing();
            const update = (patch) => props.onChange({ ...props.field, pricing: { ...pricing, ...patch } });
            return wp.element.createElement("div", null,
                wp.element.createElement(SelectControl, { label: __('Pricing strategy', 'wooptions-pro'), value: pricing.strategy, options: [{ label: __('No price change', 'wooptions-pro'), value: 'none' }, { label: __('Fixed amount', 'wooptions-pro'), value: 'fixed' }, { label: __('Percentage', 'wooptions-pro'), value: 'percentage' }, { label: __('Per character', 'wooptions-pro'), value: 'per_character' }, { label: __('Per unit', 'wooptions-pro'), value: 'per_unit' }, { label: __('Setup fee', 'wooptions-pro'), value: 'setup' }, { label: __('Formula', 'wooptions-pro'), value: 'formula' }], onChange: (strategy) => update({ strategy }) }),
                wp.element.createElement(SelectControl, { label: __('Price mode', 'wooptions-pro'), value: pricing.mode, options: [{ label: __('Add to product price', 'wooptions-pro'), value: 'adjustment' }, { label: __('Replace unit price', 'wooptions-pro'), value: 'unit_price' }], onChange: (mode) => update({ mode }) }),
                pricing.strategy === 'percentage' ? wp.element.createElement(TextControl, { label: __('Percentage', 'wooptions-pro'), type: "number", value: pricing.percent, onChange: (percent) => update({ percent }) }) : pricing.strategy === 'formula' ? wp.element.createElement(TextareaControl, { label: __('Formula expression', 'wooptions-pro'), value: pricing.expression ?? '0', onChange: (expression) => update({ expression }), help: __('Use server-supported FIELD("uuid") and arithmetic expressions.', 'wooptions-pro') }) : pricing.strategy !== 'none' ? wp.element.createElement(TextControl, { label: __('Amount', 'wooptions-pro'), type: "number", value: pricing.amount, onChange: (amount) => update({ amount }) }) : null);
        }
        function SpacerHeightControl(props) {
            const min = props.min ?? 0;
            const max = props.max ?? 300;
            const def = props.defaultValue ?? 24;
            const currentVal = Number.isFinite(props.value) ? Math.max(min, props.value) : def;
            const pct = Math.min(100, Math.max(0, ((currentVal - min) / (max - min)) * 100));
            return (wp.element.createElement("div", { className: "wof-spacer-height-control" },
                wp.element.createElement("label", { className: "wof-spacer-height-label", htmlFor: "wof-spacer-height-slider" }, props.label ?? __('HEIGHT (PX)', 'wooptions-pro')),
                wp.element.createElement("div", { className: "wof-spacer-height-row" },
                    wp.element.createElement("input", { id: "wof-spacer-height-slider", type: "range", min: min, max: max, value: currentVal, style: {
                            background: `linear-gradient(to right, #2563eb 0%, #2563eb ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
                        }, className: "wof-spacer-slider", onChange: (e) => props.onChange(Number(e.target.value)), "aria-label": props.label ?? __('Height in pixels', 'wooptions-pro') }),
                    wp.element.createElement("input", { type: "number", min: min, value: currentVal, className: "wof-spacer-number-input", onChange: (e) => {
                            const val = e.target.value === '' ? min : Math.max(min, parseInt(e.target.value, 10) || min);
                            props.onChange(val);
                        }, "aria-label": props.label ?? __('Height in pixels input', 'wooptions-pro') }))));
        }
        function SectionRepeaterInspector(props) {
            const { field, update } = props;
            const isAccordion = field.sectionStyle === 'accordion';
            return (wp.element.createElement("div", { className: "wof-section-repeater-settings" },
                wp.element.createElement(TextControl, { label: __('Section Title', 'wooptions-pro'), value: field.label ?? '', placeholder: "Section Container", onChange: (label) => update({ label }) }),
                wp.element.createElement(ToggleControl, { label: __('Hide Section Title', 'wooptions-pro'), checked: Boolean(field.hideSectionTitle), onChange: (hideSectionTitle) => update({ hideSectionTitle }) }),
                wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: '16px' } },
                    wp.element.createElement("span", { className: "wof-field-width-label" }, __('Style', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Style', 'wooptions-pro') }, [
                        { label: __('Section', 'wooptions-pro'), value: 'section' },
                        { label: __('Accordion', 'wooptions-pro'), value: 'accordion' },
                        { label: __('Blank', 'wooptions-pro'), value: 'blank' },
                    ].map((st) => {
                        const isSelected = (field.sectionStyle || 'section') === st.value;
                        return (wp.element.createElement("button", { type: "button", key: st.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ sectionStyle: st.value }) }, st.label));
                    }))),
                isAccordion ? (wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: '16px' } },
                    wp.element.createElement("span", { className: "wof-field-width-label" }, __('Initial State', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Initial State', 'wooptions-pro') }, [
                        { label: __('Open', 'wooptions-pro'), value: 'open' },
                        { label: __('Close', 'wooptions-pro'), value: 'close' },
                    ].map((st) => {
                        const isSelected = (field.initialState || 'open') === st.value;
                        return (wp.element.createElement("button", { type: "button", key: st.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ initialState: st.value }) }, st.label));
                    })))) : null,
                wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: '16px' } },
                    wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                        const isSelected = (field.width || '100%') === w;
                        return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                    }))),
                wp.element.createElement("div", { className: "wof-repeater-toggle-wrap", style: { marginBottom: '16px' } },
                    wp.element.createElement(ToggleControl, { label: __('Enable Repeatable Section', 'wooptions-pro'), help: __('Let customers add the same fields multiple times on the product page.', 'wooptions-pro'), checked: Boolean(field.repeatable), onChange: (repeatable) => update({ repeatable }) })),
                field.repeatable ? (wp.element.createElement("div", { className: "wof-repeater-config", style: { borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginBottom: '16px' } },
                    wp.element.createElement("div", { className: "wof-field-width-setting", style: { marginBottom: '16px' } },
                        wp.element.createElement("span", { className: "wof-field-width-label" }, __('Repeat Method', 'wooptions-pro')),
                        wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Repeat Method', 'wooptions-pro') }, [
                            { label: __('Add Button', 'wooptions-pro'), value: 'button' },
                            { label: __('Quantity Selector', 'wooptions-pro'), value: 'quantity' },
                        ].map((m) => {
                            const isSelected = (field.repeatMethod || 'button') === m.value;
                            return (wp.element.createElement("button", { type: "button", key: m.value, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ repeatMethod: m.value }) }, m.label));
                        }))),
                    wp.element.createElement("div", { style: { marginBottom: '16px' } },
                        wp.element.createElement(TextControl, { label: __('Repeat Label', 'wooptions-pro'), value: field.repeatLabel ?? 'Item {n}', placeholder: "Item {n}", help: __('Use {n} for auto-numbering, like Person {n} → Person 1, Person 2.', 'wooptions-pro'), onChange: (repeatLabel) => update({ repeatLabel }) })),
                    wp.element.createElement("div", { className: "wof-repeater-price-card", style: {
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '16px',
                        } },
                        wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '8px', marginBottom: '6px' } },
                            wp.element.createElement("span", { style: { fontSize: '12px', fontWeight: 600, color: '#475569' } }, __('Price Type', 'wooptions-pro')),
                            wp.element.createElement("span", { style: { fontSize: '12px', fontWeight: 600, color: '#475569' } }, __('Regular', 'wooptions-pro')),
                            wp.element.createElement("span", { style: { fontSize: '12px', fontWeight: 600, color: '#475569' } }, __('Sales', 'wooptions-pro'))),
                        wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '8px' } },
                            wp.element.createElement("select", { value: field.repeatPriceType ?? 'none', style: {
                                    height: '36px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    padding: '0 8px',
                                    fontSize: '13px',
                                    background: '#fff',
                                    width: '100%',
                                }, onChange: (e) => {
                                    const priceType = e.target.value;
                                    update({
                                        repeatPriceType: priceType,
                                        pricing: {
                                            strategy: priceType === 'percentage' ? 'percentage' : priceType === 'fixed' ? 'fixed' : 'none',
                                            amount: field.repeatRegularPrice ?? '',
                                            percent: priceType === 'percentage' ? (field.repeatRegularPrice ?? '') : '',
                                            mode: 'adjustment',
                                        },
                                    });
                                } },
                                wp.element.createElement("option", { value: "none" }, __('No cost', 'wooptions-pro')),
                                wp.element.createElement("option", { value: "fixed" }, __('Fixed Price', 'wooptions-pro')),
                                wp.element.createElement("option", { value: "percentage" }, __('Percentage', 'wooptions-pro'))),
                            wp.element.createElement("input", { type: "number", step: "any", min: "0", value: field.repeatRegularPrice ?? '', placeholder: "0", disabled: field.repeatPriceType === 'none', style: {
                                    height: '36px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    padding: '0 8px',
                                    fontSize: '13px',
                                    background: field.repeatPriceType === 'none' ? '#f1f5f9' : '#fff',
                                    width: '100%',
                                }, onChange: (e) => {
                                    const val = e.target.value;
                                    update({
                                        repeatRegularPrice: val,
                                        pricing: {
                                            ...(field.pricing ?? { mode: 'adjustment' }),
                                            strategy: field.repeatPriceType === 'percentage' ? 'percentage' : field.repeatPriceType === 'fixed' ? 'fixed' : 'none',
                                            amount: val,
                                            percent: field.repeatPriceType === 'percentage' ? val : '',
                                        },
                                    });
                                } }),
                            wp.element.createElement("input", { type: "number", step: "any", min: "0", value: field.repeatSalePrice ?? '', placeholder: "", disabled: field.repeatPriceType === 'none', style: {
                                    height: '36px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    padding: '0 8px',
                                    fontSize: '13px',
                                    background: field.repeatPriceType === 'none' ? '#f1f5f9' : '#fff',
                                    width: '100%',
                                }, onChange: (e) => update({ repeatSalePrice: e.target.value }) }))),
                    field.repeatMethod !== 'quantity' ? (wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' } },
                        wp.element.createElement(TextControl, { label: __('Button Label', 'wooptions-pro'), value: field.buttonLabel ?? 'Add Another', placeholder: "Add Another", onChange: (buttonLabel) => update({ buttonLabel }) }),
                        wp.element.createElement(TextControl, { label: __('Maximum Repeats', 'wooptions-pro'), type: "number", min: 0, value: field.maxRepeats != null ? String(field.maxRepeats) : '0', placeholder: "0", help: __('Enter 0 to allow unlimited repeats.', 'wooptions-pro'), onChange: (val) => update({ maxRepeats: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) }) }))) : null)) : null,
                wp.element.createElement(TextareaControl, { label: __('Help text', 'wooptions-pro'), value: field.help ?? '', onChange: (help) => update({ help }) }),
                wp.element.createElement("div", { className: "wof-help-position-control" },
                    wp.element.createElement("label", { className: "wof-segmented-label" }, __('HELP TEXT POSITION', 'wooptions-pro')),
                    wp.element.createElement("div", { className: "wof-segmented-group" }, [
                        { label: __('Below Title', 'wooptions-pro'), value: 'below_title' },
                        { label: __('Tooltip', 'wooptions-pro'), value: 'tooltip' },
                        { label: __('Below Field', 'wooptions-pro'), value: 'below_field' },
                    ].map((opt) => {
                        const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
                        return (wp.element.createElement("button", { key: opt.value, type: "button", className: WooOptionsPro.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected'), onClick: () => update({ helpTextPosition: opt.value }) }, opt.label));
                    }))),
                wp.element.createElement(ToggleControl, { label: __('Required', 'wooptions-pro'), checked: Boolean(field.required), onChange: (required) => update({ required }) })));
        }
        function Inspector(props) {
            const scrollerRef = useRef(null);
            const [canLeft, setCanLeft] = useState(false);
            const [canRight, setCanRight] = useState(false);
            const updateScroll = () => {
                const element = scrollerRef.current;
                if (!element)
                    return;
                setCanLeft(element.scrollLeft > 2);
                setCanRight(element.scrollLeft + element.clientWidth < element.scrollWidth - 2);
            };
            useEffect(() => {
                updateScroll();
                window.addEventListener('resize', updateScroll);
                const element = scrollerRef.current;
                element?.addEventListener('scroll', updateScroll, { passive: true });
                const onWheel = (e) => {
                    if (element && element.scrollWidth > element.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        e.preventDefault();
                        element.scrollLeft += e.deltaY;
                        updateScroll();
                    }
                };
                element?.addEventListener('wheel', onWheel, { passive: false });
                return () => {
                    window.removeEventListener('resize', updateScroll);
                    element?.removeEventListener('scroll', updateScroll);
                    element?.removeEventListener('wheel', onWheel);
                };
            }, [props.field]);
            if (!props.field)
                return wp.element.createElement("aside", { className: "wof-builder-inspector" },
                    wp.element.createElement("div", { className: "wof-builder-pane__heading" },
                        wp.element.createElement("div", null,
                            wp.element.createElement("h2", null, __('Option set styling', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: "wof-inspector-body" },
                        wp.element.createElement("section", { className: "wof-inspector-section" },
                            wp.element.createElement(Builder.StyleStudio, { document: props.document, onChange: props.onDocumentChange }))));
            const field = props.field;
            const update = (patch) => props.onFieldChange({ ...field, ...patch });
            const contentFieldTypes = ['content', 'modal', 'spacer', 'separator', 'heading', 'paragraph', 'help', 'formula', 'repeater'];
            const visibleTabs = tabs.filter(([tab]) => {
                if (tab === 'choices' && !Boolean(field.choices))
                    return false;
                if (tab === 'pricing' && contentFieldTypes.includes(field.type))
                    return false;
                return true;
            });
            const activeTab = visibleTabs.some(([tab]) => tab === props.tab) ? props.tab : 'content';
            return wp.element.createElement("aside", { className: "wof-builder-inspector" },
                wp.element.createElement("div", { className: "wof-builder-pane__heading" },
                    wp.element.createElement("div", null,
                        wp.element.createElement("h2", null, field.type === 'spacer' ? __('Spacer', 'wooptions-pro') : field.type === 'separator' ? __('Separator', 'wooptions-pro') : field.label)),
                    wp.element.createElement("div", { className: "wof-inspector-heading-actions" },
                        wp.element.createElement("button", { type: "button", onClick: props.onDuplicate, "aria-label": __('Duplicate field', 'wooptions-pro'), title: __('Duplicate', 'wooptions-pro') },
                            wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                wp.element.createElement("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
                                wp.element.createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }))),
                        wp.element.createElement("button", { type: "button", className: "is-destructive", onClick: props.onDelete, "aria-label": __('Delete field', 'wooptions-pro'), title: __('Delete', 'wooptions-pro') },
                            wp.element.createElement("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                wp.element.createElement("polyline", { points: "3 6 5 6 21 6" }),
                                wp.element.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
                                wp.element.createElement("line", { x1: "10", y1: "11", x2: "10", y2: "17" }),
                                wp.element.createElement("line", { x1: "14", y1: "11", x2: "14", y2: "17" }))))),
                wp.element.createElement("div", { className: "wof-inspector-tabs-shell" },
                    canLeft ? wp.element.createElement("button", { type: "button", className: "wof-inspector-tabs-arrow is-left", "aria-label": __('Scroll tabs left', 'wooptions-pro'), onClick: () => scrollerRef.current?.scrollBy({ left: -140, behavior: 'smooth' }) },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "arrow-left-alt2" })) : null,
                    wp.element.createElement("div", { className: "wof-inspector-tabs", ref: scrollerRef, role: "tablist", "aria-label": __('Field Inspector Tabs', 'wooptions-pro') }, visibleTabs.map(([tab, label]) => (wp.element.createElement("button", { type: "button", key: tab, role: "tab", "aria-selected": activeTab === tab, className: activeTab === tab ? 'is-active' : '', onClick: (event) => {
                            props.onTabChange(tab);
                            event.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                        } }, label)))),
                    canRight ? wp.element.createElement("button", { type: "button", className: "wof-inspector-tabs-arrow is-right", "aria-label": __('Scroll tabs right', 'wooptions-pro'), onClick: () => scrollerRef.current?.scrollBy({ left: 140, behavior: 'smooth' }) },
                        wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "arrow-right-alt2" })) : null),
                wp.element.createElement("div", { className: "wof-inspector-body" },
                    wp.element.createElement("section", { className: "wof-inspector-section" }, activeTab === 'content' ? (field.type === 'repeater' ? (wp.element.createElement(SectionRepeaterInspector, { field: field, update: update })) : field.type === 'separator' ? (wp.element.createElement("div", { className: "wof-spacer-settings" },
                        wp.element.createElement(SpacerHeightControl, { value: Number(field.height ?? field.style?.height ?? 1), defaultValue: 1, onChange: (height) => update({ height, style: { ...(field.style ?? {}), height } }) }),
                        wp.element.createElement(ChoiceColorControl, { label: __('Spacer color', 'wooptions-pro'), color: String(field.color ?? field.style?.color ?? '#E2E8F0'), onChange: (color) => update({ color, style: { ...(field.style ?? {}), color } }) }),
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))))) : field.type === 'spacer' ? (wp.element.createElement("div", { className: "wof-spacer-settings" },
                        wp.element.createElement(SpacerHeightControl, { value: Number(field.height ?? field.style?.height ?? 24), defaultValue: 24, onChange: (height) => update({ height, style: { ...(field.style ?? {}), height } }) }),
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))))) : field.type === 'content' ? (wp.element.createElement("div", { className: "wof-content-field-settings" },
                        wp.element.createElement(TextControl, { label: __('Label (Internal reference)', 'wooptions-pro'), value: field.label, onChange: (label) => update({ label }) }),
                        wp.element.createElement(WooOptionsPro.Components.WpWysiwygEditor, { id: field.uuid, label: __('Content', 'wooptions-pro'), value: field.content ?? '', onChange: (content) => update({ content }) }),
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))))) : field.type === 'modal' ? (wp.element.createElement("div", { className: "wof-modal-field-settings" },
                        wp.element.createElement(TextControl, { label: __('Label (Internal reference)', 'wooptions-pro'), value: field.label, onChange: (label) => update({ label }) }),
                        wp.element.createElement(TextControl, { label: __('Button Text', 'wooptions-pro'), value: field.buttonText ?? 'View details', placeholder: __('e.g. Size Guide, View details', 'wooptions-pro'), onChange: (buttonText) => update({ buttonText }) }),
                        wp.element.createElement(SelectControl, { label: __('Button Style', 'wooptions-pro'), value: field.buttonStyle ?? 'outline', options: [
                                { label: __('Outline', 'wooptions-pro'), value: 'outline' },
                                { label: __('Primary', 'wooptions-pro'), value: 'primary' },
                                { label: __('Secondary', 'wooptions-pro'), value: 'secondary' },
                                { label: __('Link / Text only', 'wooptions-pro'), value: 'link' },
                            ], onChange: (buttonStyle) => update({ buttonStyle }) }),
                        wp.element.createElement(TextControl, { label: __('Modal Header Title', 'wooptions-pro'), value: field.modalTitle ?? 'Information', placeholder: __('e.g. Size Guide & Dimensions', 'wooptions-pro'), onChange: (modalTitle) => update({ modalTitle }) }),
                        wp.element.createElement(WooOptionsPro.Components.WpWysiwygEditor, { id: field.uuid, label: __('Modal Content', 'wooptions-pro'), value: field.content ?? '', onChange: (content) => update({ content }) }),
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))))) : field.type === 'formula' ? (wp.element.createElement(FormulaPanel, { field: field, allFields: props.document.fields, onChange: props.onFieldChange })) : field.type === 'heading' ? (wp.element.createElement("div", { className: "wof-heading-field-settings" },
                        wp.element.createElement(TextControl, { label: __('Heading Text', 'wooptions-pro'), value: field.label, onChange: (label) => update({ label }) }),
                        wp.element.createElement(TextareaControl, { label: __('Help text', 'wooptions-pro'), value: field.help ?? '', onChange: (help) => update({ help }) }),
                        wp.element.createElement("div", { className: "wof-help-position-control" },
                            wp.element.createElement("label", { className: "wof-segmented-label" }, __('HELP TEXT POSITION', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-segmented-group" }, [
                                { label: __('Below Title', 'wooptions-pro'), value: 'below_title' },
                                { label: __('Tooltip', 'wooptions-pro'), value: 'tooltip' },
                                { label: __('Below Field', 'wooptions-pro'), value: 'below_field' },
                            ].map(opt => {
                                const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
                                return (wp.element.createElement("button", { key: opt.value, type: "button", className: WooOptionsPro.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected'), onClick: () => update({ helpTextPosition: opt.value }) }, opt.label));
                            }))),
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))))) : field.type === 'paragraph' ? (wp.element.createElement("div", { className: "wof-paragraph-field-settings" },
                        wp.element.createElement(TextControl, { label: __('Label (Internal reference)', 'wooptions-pro'), value: field.label, onChange: (label) => update({ label }) }),
                        wp.element.createElement(TextareaControl, { label: __('Content', 'wooptions-pro'), rows: 4, value: field.description || field.content || '', onChange: (content) => update({ description: content, content }) }),
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))))) : field.type === 'help' ? (wp.element.createElement("div", { className: "wof-help-field-settings" },
                        wp.element.createElement(TextControl, { label: __('Label (Internal reference)', 'wooptions-pro'), value: field.label, onChange: (label) => update({ label }) }),
                        wp.element.createElement(TextareaControl, { label: __('Help Content', 'wooptions-pro'), rows: 4, value: field.description || field.content || field.help || '', onChange: (content) => update({ description: content, content }) }),
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))))) : (wp.element.createElement(wp.element.Fragment, null,
                        wp.element.createElement(TextControl, { label: __('Label', 'wooptions-pro'), value: field.label, onChange: (label) => update({ label }) }),
                        field.type === 'font' ? (wp.element.createElement("div", { className: "wof-applied-fields-box", style: { marginBottom: '16px', padding: '14px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' } },
                            wp.element.createElement("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' } },
                                wp.element.createElement("strong", { style: { fontSize: '13px', color: '#1e293b' } }, __('Applied Text Fields', 'wooptions-pro')),
                                wp.element.createElement("span", { style: { fontSize: '11px', background: 'color-mix(in srgb, var(--wof-admin-primary, #5b4ff5) 12%, transparent)', color: 'var(--wof-admin-primary, #5b4ff5)', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 } },
                                    Array.isArray(field.appliedFields) ? field.appliedFields.length : 0,
                                    " ",
                                    __('linked', 'wooptions-pro'))),
                            wp.element.createElement("p", { style: { fontSize: '12px', color: '#64748b', margin: '0 0 10px 0', lineHeight: 1.4 } }, __('Select which Text or Textarea field(s) will change their font in real-time as the customer chooses a font.', 'wooptions-pro')),
                            (() => {
                                const textFields = (props.document.fields || []).filter((f) => (f.type === 'text' || f.type === 'textarea') && f.uuid !== field.uuid);
                                if (textFields.length === 0) {
                                    return (wp.element.createElement("div", { style: { padding: '10px', background: '#fff', borderRadius: '6px', border: '1px dashed #cbd5e1', fontSize: '12px', color: '#64748b', textAlign: 'center' } },
                                        wp.element.createElement("p", { style: { margin: 0 } }, __('No Text or Textarea fields found in this option set.', 'wooptions-pro')),
                                        wp.element.createElement("small", { style: { display: 'block', marginTop: '4px', color: '#94a3b8' } }, __('Add a Text or Textarea field to enable real-time font styling.', 'wooptions-pro'))));
                                }
                                const applied = Array.isArray(field.appliedFields) ? field.appliedFields : [];
                                return (wp.element.createElement("div", { className: "wof-applied-fields-list", style: { display: 'flex', flexDirection: 'column', gap: '6px' } }, textFields.map((tf) => {
                                    const isChecked = applied.includes(tf.uuid);
                                    return (wp.element.createElement("label", { key: tf.uuid, style: {
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 10px',
                                            background: isChecked ? 'color-mix(in srgb, var(--wof-admin-primary, #5b4ff5) 8%, #fff)' : '#fff',
                                            border: isChecked ? '1.5px solid var(--wof-admin-primary, #5b4ff5)' : '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'all 0.12s ease',
                                        } },
                                        wp.element.createElement("input", { type: "checkbox", checked: isChecked, onChange: (e) => {
                                                let next;
                                                if (e.target.checked) {
                                                    next = [...applied, tf.uuid];
                                                }
                                                else {
                                                    next = applied.filter((id) => id !== tf.uuid);
                                                }
                                                update({ appliedFields: next });
                                            } }),
                                        wp.element.createElement("span", { style: { fontWeight: 500, fontSize: '13px', flex: 1, color: '#1e293b' } }, tf.label || __('Untitled text field', 'wooptions-pro')),
                                        wp.element.createElement("span", { style: { fontSize: '10px', textTransform: 'uppercase', padding: '1px 6px', background: '#f1f5f9', borderRadius: '4px', color: '#64748b', fontWeight: 600 } }, tf.type === 'textarea' ? __('Textarea', 'wooptions-pro') : __('Text', 'wooptions-pro'))));
                                })));
                            })())) : null,
                        wp.element.createElement("div", { className: "wof-field-width-setting" },
                            wp.element.createElement("span", { className: "wof-field-width-label" }, __('Width', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-field-width-group", role: "radiogroup", "aria-label": __('Width', 'wooptions-pro') }, ['33%', '50%', '66%', '100%'].map((w) => {
                                const isSelected = (field.width || '100%') === w;
                                return (wp.element.createElement("button", { type: "button", key: w, role: "radio", "aria-checked": isSelected, className: WooOptionsPro.Utils.classNames('wof-width-btn', isSelected && 'is-active'), onClick: () => update({ width: w }) }, w));
                            }))),
                        Boolean(field.choices) && !['radio', 'checkbox_group', 'select', 'font'].includes(field.type) ? (wp.element.createElement("div", { className: "wof-choice-dimensions-box", style: { padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)', marginBottom: '16px' } },
                            wp.element.createElement("strong", { style: { display: 'block', fontSize: '13px', marginBottom: '8px' } }, __('Choice Item Dimensions & Style', 'wooptions-pro')),
                            wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' } },
                                wp.element.createElement(TextControl, { label: __('Width (px)', 'wooptions-pro'), type: "number", min: 0, value: String(field.choiceWidth ?? ''), placeholder: "Auto", onChange: (choiceWidth) => update({ choiceWidth }) }),
                                wp.element.createElement(TextControl, { label: __('Height (px)', 'wooptions-pro'), type: "number", min: 0, value: String(field.choiceHeight ?? ''), placeholder: "Auto", onChange: (choiceHeight) => update({ choiceHeight }) }),
                                wp.element.createElement(TextControl, { label: __('Radius (px)', 'wooptions-pro'), type: "number", min: 0, value: String(field.choiceBorderRadius ?? ''), placeholder: "Default", onChange: (choiceBorderRadius) => update({ choiceBorderRadius }) })))) : null,
                        'placeholder' in field && field.type !== 'range' ? wp.element.createElement(TextControl, { label: __('Placeholder', 'wooptions-pro'), value: field.placeholder ?? '', onChange: (placeholder) => update({ placeholder }) }) : null,
                        ['text', 'textarea'].includes(field.type) ? (wp.element.createElement("div", { className: "wof-text-settings", style: { marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' } },
                            wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' } },
                                wp.element.createElement(TextControl, { label: __('Minimum Character', 'wooptions-pro'), type: "number", min: 0, value: field.minLength ? String(field.minLength) : '', placeholder: "0", onChange: (val) => update({ minLength: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) }) }),
                                wp.element.createElement(TextControl, { label: __('Maximum Character', 'wooptions-pro'), type: "number", min: 0, value: field.maxLength ? String(field.maxLength) : '', placeholder: "0", onChange: (val) => update({ maxLength: val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0) }) })),
                            wp.element.createElement(SelectControl, { label: __('Text Transform', 'wooptions-pro'), value: field.textTransform ?? 'none', options: [
                                    { label: __('None', 'wooptions-pro'), value: 'none' },
                                    { label: __('Uppercase', 'wooptions-pro'), value: 'uppercase' },
                                    { label: __('Lowercase', 'wooptions-pro'), value: 'lowercase' },
                                    { label: __('Capitalize', 'wooptions-pro'), value: 'capitalize' },
                                ], onChange: (textTransform) => update({ textTransform }) }),
                            field.type === 'textarea' ? (wp.element.createElement("div", { style: { marginTop: '12px' } },
                                wp.element.createElement(TextControl, { label: __('Row', 'wooptions-pro'), type: "number", min: 1, max: 50, value: field.rows ? String(field.rows) : '4', placeholder: "4", onChange: (val) => update({ rows: val === '' ? 4 : Math.max(1, parseInt(val, 10) || 4) }) }))) : null)) : null,
                        field.type === 'number' ? (wp.element.createElement("div", { className: "wof-number-settings", style: { marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' } },
                            wp.element.createElement(ToggleControl, { label: __('Enable Min/Max Restriction', 'wooptions-pro'), checked: field.enableMinMax !== false, onChange: (enableMinMax) => update({
                                    enableMinMax,
                                    min: enableMinMax ? (field.min ?? '1') : null,
                                    max: enableMinMax ? (field.max ?? '100') : null,
                                }) }),
                            field.enableMinMax !== false ? (wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' } },
                                wp.element.createElement(TextControl, { label: __('MINIMUM VALUE', 'wooptions-pro'), type: "number", value: field.min != null ? String(field.min) : '1', placeholder: "1", onChange: (min) => update({ min }) }),
                                wp.element.createElement(TextControl, { label: __('MAXIMUM VALUE', 'wooptions-pro'), type: "number", value: field.max != null ? String(field.max) : '100', placeholder: "100", onChange: (max) => update({ max }) }))) : null,
                            wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' } },
                                wp.element.createElement(TextControl, { label: __('STEPS', 'wooptions-pro'), type: "number", value: field.step != null ? String(field.step) : '1', placeholder: "1", onChange: (step) => update({ step }) }),
                                wp.element.createElement(TextControl, { label: __('DEFAULT VALUE', 'wooptions-pro'), type: "number", value: field.default != null && field.default !== '' ? String(field.default) : '', placeholder: "", onChange: (def) => update({ default: def }) })))) : null,
                        field.type === 'range' ? (wp.element.createElement("div", { className: "wof-range-settings", style: { marginBottom: '16px' } },
                            wp.element.createElement(ToggleControl, { label: __('Enable PostFix', 'wooptions-pro'), checked: Boolean(field.enablePostfix), onChange: (enablePostfix) => update({ enablePostfix }) }),
                            field.enablePostfix ? (wp.element.createElement("div", { style: { marginTop: '10px' } },
                                wp.element.createElement(TextControl, { label: __('POSTFIX TEXT', 'wooptions-pro'), value: field.postfix != null ? String(field.postfix) : 'PostFix', placeholder: "PostFix", onChange: (postfix) => update({ postfix }) }))) : null,
                            wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' } },
                                wp.element.createElement(TextControl, { label: __('MINIMUM VALUE', 'wooptions-pro'), type: "number", value: field.min != null ? String(field.min) : '1', placeholder: "1", onChange: (min) => update({ min }) }),
                                wp.element.createElement(TextControl, { label: __('MAXIMUM VALUE', 'wooptions-pro'), type: "number", value: field.max != null ? String(field.max) : '100', placeholder: "100", onChange: (max) => update({ max }) })),
                            wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' } },
                                wp.element.createElement(TextControl, { label: __('STEPS', 'wooptions-pro'), type: "number", value: field.step != null ? String(field.step) : '1', placeholder: "1", onChange: (step) => update({ step }) }),
                                wp.element.createElement(TextControl, { label: __('DEFAULT VALUE', 'wooptions-pro'), type: "number", value: field.default != null && field.default !== '' ? String(field.default) : '10', placeholder: "10", onChange: (def) => update({ default: def }) })))) : null,
                        field.type === 'tel' ? (wp.element.createElement("div", { className: "wof-phone-settings", style: { marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' } },
                            wp.element.createElement(SelectControl, { label: __('Flag Style', 'wooptions-pro'), value: field.flagStyle ?? 'number_only', options: [
                                    { label: __('Number Only', 'wooptions-pro'), value: 'number_only' },
                                    { label: __('Number Only & Flag', 'wooptions-pro'), value: 'number_flag' },
                                    { label: __('Number Only & Flag and Dial Code', 'wooptions-pro'), value: 'number_flag_dialcode' },
                                ], onChange: (flagStyle) => update({ flagStyle }) }),
                            (field.flagStyle === 'number_flag' || field.flagStyle === 'number_flag_dialcode') ? (wp.element.createElement(SelectControl, { label: __('Default Country', 'wooptions-pro'), value: field.defaultCountry ?? 'US', options: COUNTRY_OPTIONS, onChange: (defaultCountry) => update({ defaultCountry }) })) : null)) : null,
                        ['datetime', 'date', 'time'].includes(field.type) ? (wp.element.createElement(DateFieldInspector, { field: field, update: update })) : null,
                        field.type === 'date_range' ? (wp.element.createElement(DateRangeFieldInspector, { field: field, update: update })) : null,
                        ['color_swatch', 'image_swatch', 'segmented'].includes(field.type) ? (wp.element.createElement("div", { className: "wof-multiple-choice-settings", style: { marginBottom: '16px' } },
                            wp.element.createElement(ToggleControl, { label: __('Allow Multiple Choices', 'wooptions-pro'), help: __('Allow customers to select more than one option.', 'wooptions-pro'), checked: Boolean(field.multiple), onChange: (multiple) => update({ multiple }) }),
                            field.multiple ? (wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' } },
                                wp.element.createElement(TextControl, { label: __('Min Restriction', 'wooptions-pro'), type: "number", min: 0, value: String(field.minChoices ?? ''), placeholder: __('Min', 'wooptions-pro'), onChange: (val) => update({ minChoices: val === '' ? 0 : Math.max(0, Number(val)) }) }),
                                wp.element.createElement(TextControl, { label: __('Max Restriction', 'wooptions-pro'), type: "number", min: 0, value: String(field.maxChoices ?? ''), placeholder: __('Max', 'wooptions-pro'), onChange: (val) => update({ maxChoices: val === '' ? 0 : Math.max(0, Number(val)) }) }))) : null)) : null,
                        field.type === 'checkbox_group' ? (wp.element.createElement("div", { className: "wof-checkbox-restrictions-box", style: { padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)', marginBottom: '16px' } },
                            wp.element.createElement("strong", { style: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' } }, __('Choice Selection Restrictions', 'wooptions-pro')),
                            wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } },
                                wp.element.createElement(TextControl, { label: __('Min Restriction', 'wooptions-pro'), type: "number", min: 0, value: String(field.minChoices ?? ''), placeholder: __('Min', 'wooptions-pro'), onChange: (val) => update({ minChoices: val === '' ? 0 : Math.max(0, Number(val)) }) }),
                                wp.element.createElement(TextControl, { label: __('Max Restriction', 'wooptions-pro'), type: "number", min: 0, value: String(field.maxChoices ?? ''), placeholder: __('Max', 'wooptions-pro'), onChange: (val) => update({ maxChoices: val === '' ? 0 : Math.max(0, Number(val)) }) })))) : null,
                        Boolean(field.choices) && !['segmented', 'radio', 'checkbox_group', 'font', 'select', 'product'].includes(field.type) ? (wp.element.createElement("div", { className: "wof-quantity-setting", style: { marginBottom: '16px', padding: '12px', background: 'var(--wof-admin-surface-subtle, #f8fafc)', borderRadius: '8px', border: '1px solid var(--wof-admin-border, #e2e8f0)' } },
                            wp.element.createElement(ToggleControl, { label: __('Enable Quantity', 'wooptions-pro'), help: __('Allow customers to specify quantity for each choice option.', 'wooptions-pro'), checked: Boolean(field.enableQuantity), onChange: (enableQuantity) => update({ enableQuantity }) }),
                            field.enableQuantity ? (wp.element.createElement("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' } },
                                wp.element.createElement(TextControl, { label: __('Minimum Quantity', 'wooptions-pro'), type: "number", min: 1, value: String(field.minQuantity ?? 1), placeholder: "1", onChange: (val) => update({ minQuantity: val === '' ? 1 : Math.max(1, Number(val)) }) }),
                                wp.element.createElement(TextControl, { label: __('Maximum Quantity', 'wooptions-pro'), type: "number", min: 1, value: String(field.maxQuantity ?? 100), placeholder: "100", onChange: (val) => update({ maxQuantity: val === '' ? 0 : Math.max(1, Number(val)) }) }))) : null)) : null,
                        field.type === 'color_picker' ? (wp.element.createElement(ChoiceColorControl, { label: __('Default color', 'wooptions-pro'), color: String(field.default ?? '#5B4FF5'), onChange: (color) => update({ default: color }) })) : null,
                        ['checkbox', 'toggle'].includes(field.type) ? (wp.element.createElement(ToggleControl, { label: __('Checked by default', 'wooptions-pro'), checked: Boolean(field.default), onChange: (defaultVal) => update({ default: defaultVal }) })) : null,
                        wp.element.createElement(TextareaControl, { label: __('Help text', 'wooptions-pro'), value: field.help, onChange: (help) => update({ help }) }),
                        wp.element.createElement("div", { className: "wof-help-position-control" },
                            wp.element.createElement("label", { className: "wof-segmented-label" }, __('HELP TEXT POSITION', 'wooptions-pro')),
                            wp.element.createElement("div", { className: "wof-segmented-group" }, [
                                { label: __('Below Title', 'wooptions-pro'), value: 'below_title' },
                                { label: __('Tooltip', 'wooptions-pro'), value: 'tooltip' },
                                { label: __('Below Field', 'wooptions-pro'), value: 'below_field' },
                            ].map(opt => {
                                const isSelected = (field.helpTextPosition ?? 'below_title') === opt.value;
                                return (wp.element.createElement("button", { key: opt.value, type: "button", className: WooOptionsPro.Utils.classNames('wof-segmented-btn', isSelected && 'is-selected'), onClick: () => update({ helpTextPosition: opt.value }) }, opt.label));
                            }))),
                        wp.element.createElement(ToggleControl, { label: __('Required', 'wooptions-pro'), checked: field.required, onChange: (required) => update({ required }) })))) : activeTab === 'choices' ? (wp.element.createElement(ChoiceEditor, { field: field, onChange: props.onFieldChange })) : activeTab === 'pricing' ? (wp.element.createElement(PricingPanel, { field: field, onChange: props.onFieldChange })) : activeTab === 'logic' ? (wp.element.createElement(Builder.LogicEditor, { field: field, allFields: props.document.fields, onChange: props.onFieldChange })) : activeTab === 'style' ? (wp.element.createElement(Builder.StyleStudio, { document: props.document, onChange: props.onDocumentChange })) : (wp.element.createElement(wp.element.Fragment, null,
                        wp.element.createElement(ToggleControl, { label: __('Disable this field', 'wooptions-pro'), checked: field.disabled, onChange: (disabled) => update({ disabled }) }),
                        field.type === 'file' ? (wp.element.createElement(wp.element.Fragment, null,
                            wp.element.createElement(TextControl, { label: __('Allowed extensions', 'wooptions-pro'), value: (field.allowedExtensions ?? []).join(', '), onChange: (value) => update({ allowedExtensions: value.split(',').map((item) => item.trim().replace(/^\./, '')).filter(Boolean) }) }),
                            wp.element.createElement(TextControl, { label: __('Maximum files', 'wooptions-pro'), type: "number", value: String(field.maxFiles ?? 1), onChange: (value) => update({ maxFiles: Math.max(1, Number(value)) }) }),
                            wp.element.createElement(TextControl, { label: __('Maximum file size (MB)', 'wooptions-pro'), type: "number", value: String(field.maxFileMb ?? 5), onChange: (value) => update({ maxFileMb: Math.max(1, Number(value)) }) }))) : null,
                        field.type === 'customer_defined_price' ? (wp.element.createElement(wp.element.Fragment, null,
                            wp.element.createElement(TextControl, { label: __('Minimum', 'wooptions-pro'), value: field.min ?? '', onChange: (value) => update({ min: value || null }) }),
                            wp.element.createElement(TextControl, { label: __('Maximum', 'wooptions-pro'), value: field.max ?? '', onChange: (value) => update({ max: value || null }) }),
                            wp.element.createElement(TextControl, { label: __('Step', 'wooptions-pro'), value: field.step ?? '', onChange: (value) => update({ step: value || null }) }))) : null,
                        wp.element.createElement(TextControl, { label: __('Field UUID', 'wooptions-pro'), value: field.uuid, disabled: true }))))));
        }
        Builder.Inspector = Inspector;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { Button, Modal } = wp.components;
        const { __ } = wp.i18n;
        const { useMemo, useState } = wp.element;
        function HistoryModal(props) {
            const [restoring, setRestoring] = useState(null);
            const revisions = useMemo(() => [...props.revisions].sort((left, right) => Number(right.revisionNumber) - Number(left.revisionNumber)), [props.revisions]);
            const publishedCount = revisions.filter((revision) => revision.state === 'published').length;
            const latestNumber = revisions.reduce((latest, revision) => Math.max(latest, Number(revision.revisionNumber) || 0), 0);
            const restore = async (revisionUuid) => {
                setRestoring(revisionUuid);
                try {
                    await props.onRollback(revisionUuid);
                }
                finally {
                    setRestoring(null);
                }
            };
            return (wp.element.createElement(Modal, { title: __('Version history', 'wooptions-pro'), onRequestClose: props.onClose, className: "wof-modal wof-history-modal" },
                wp.element.createElement("section", { className: "wof-version-header" },
                    wp.element.createElement("div", { className: "wof-version-header__copy" },
                        wp.element.createElement("span", { className: "wof-version-header__icon dashicons dashicons-backup", "aria-hidden": "true" }),
                        wp.element.createElement("div", null,
                            wp.element.createElement("h3", null, __('A clear record of every saved version', 'wooptions-pro')),
                            wp.element.createElement("p", null, __('Published versions stay immutable. Restoring creates a new draft, so the current live configuration remains protected.', 'wooptions-pro')))),
                    wp.element.createElement("div", { className: "wof-version-overview" },
                        wp.element.createElement("span", null,
                            wp.element.createElement("small", null, __('Versions', 'wooptions-pro')),
                            wp.element.createElement("strong", null, revisions.length)),
                        wp.element.createElement("span", null,
                            wp.element.createElement("small", null, __('Published', 'wooptions-pro')),
                            wp.element.createElement("strong", null, publishedCount)),
                        wp.element.createElement("span", null,
                            wp.element.createElement("small", null, __('Latest', 'wooptions-pro')),
                            wp.element.createElement("strong", null,
                                "#",
                                latestNumber || '—')))),
                props.busy && !revisions.length ? (wp.element.createElement(WooOptionsPro.Components.ModalLoading, { label: __('Loading version history…', 'wooptions-pro') })) : revisions.length ? (wp.element.createElement("div", { className: "wof-version-list" }, revisions.map((revision, index) => {
                    const published = revision.state === 'published';
                    const latest = index === 0;
                    return (wp.element.createElement("article", { key: revision.uuid, className: `wof-version-row ${published ? 'is-published' : 'is-draft'} ${latest ? 'is-latest' : ''}` },
                        wp.element.createElement("div", { className: "wof-version-number" },
                            wp.element.createElement("small", null, __('Version', 'wooptions-pro')),
                            wp.element.createElement("strong", null,
                                "#",
                                revision.revisionNumber)),
                        wp.element.createElement("div", { className: "wof-version-details" },
                            wp.element.createElement("div", { className: "wof-version-details__top" },
                                wp.element.createElement("div", { className: "wof-version-badges" },
                                    wp.element.createElement("span", { className: `wof-version-state is-${revision.state}` }, published ? __('Published', 'wooptions-pro') : __('Draft', 'wooptions-pro')),
                                    latest ? wp.element.createElement("span", { className: "wof-version-latest" }, __('Latest', 'wooptions-pro')) : null),
                                wp.element.createElement("time", { dateTime: revision.createdAtGmt }, WooOptionsPro.Utils.formatDate(revision.createdAtGmt))),
                            wp.element.createElement("p", null, revision.versionNote || __('No version note was added for this save.', 'wooptions-pro'))),
                        wp.element.createElement(Button, { variant: "secondary", className: "wof-version-restore", isBusy: restoring === revision.uuid, disabled: props.busy || Boolean(restoring), onClick: () => restore(revision.uuid) },
                            wp.element.createElement("span", { className: "dashicons dashicons-image-rotate", "aria-hidden": "true" }),
                            __('Restore', 'wooptions-pro'))));
                }))) : (wp.element.createElement("div", { className: "wof-history-empty" },
                    wp.element.createElement("span", { className: "dashicons dashicons-backup", "aria-hidden": "true" }),
                    wp.element.createElement("h3", null, __('No saved versions yet', 'wooptions-pro')),
                    wp.element.createElement("p", null, __('Save a draft or publish this option set to create the first version.', 'wooptions-pro'))))));
        }
        Builder.HistoryModal = HistoryModal;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { Button, Modal, SelectControl, TextControl } = wp.components;
        const { __ } = wp.i18n;
        const { useEffect, useMemo, useState } = wp.element;
        const assignmentTypes = [
            { type: 'product', label: __('Products', 'wooptions-pro'), icon: 'dashicons-products' },
            { type: 'category', label: __('Categories', 'wooptions-pro'), icon: 'dashicons-category' },
            { type: 'tag', label: __('Tags', 'wooptions-pro'), icon: 'dashicons-tag' },
            { type: 'variation', label: __('Variations', 'wooptions-pro'), icon: 'dashicons-image-rotate' },
            { type: 'global', label: __('All products', 'wooptions-pro'), icon: 'dashicons-admin-site-alt3' },
        ];
        function assignmentTypeLabel(type) {
            const labels = {
                global: __('All products', 'wooptions-pro'),
                product: __('Product', 'wooptions-pro'),
                category: __('Category', 'wooptions-pro'),
                tag: __('Tag', 'wooptions-pro'),
                variation: __('Variation', 'wooptions-pro'),
                product_type: __('Product type', 'wooptions-pro'),
            };
            return labels[type] ?? type;
        }
        function assignmentTypeIcon(type) {
            const icons = {
                global: 'dashicons-admin-site-alt3',
                product: 'dashicons-products',
                category: 'dashicons-category',
                tag: 'dashicons-tag',
                variation: 'dashicons-image-rotate',
                product_type: 'dashicons-filter',
            };
            return icons[type] ?? 'dashicons-marker';
        }
        function renderTypeIcon(type) {
            switch (type) {
                case 'global':
                    return wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                        wp.element.createElement("circle", { cx: "12", cy: "12", r: "10" }),
                        wp.element.createElement("line", { x1: "2", y1: "12", x2: "22", y2: "12" }),
                        wp.element.createElement("path", { d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" }));
                case 'product':
                    return wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                        wp.element.createElement("path", { d: "M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" }),
                        wp.element.createElement("line", { x1: "3", y1: "6", x2: "21", y2: "6" }),
                        wp.element.createElement("path", { d: "M16 10a4 4 0 0 1-8 0" }));
                case 'category':
                    return wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                        wp.element.createElement("path", { d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" }));
                case 'tag':
                    return wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                        wp.element.createElement("path", { d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" }),
                        wp.element.createElement("line", { x1: "7", y1: "7", x2: "7.01", y2: "7" }));
                case 'variation':
                    return wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                        wp.element.createElement("polyline", { points: "23 4 23 10 17 10" }),
                        wp.element.createElement("path", { d: "M20.49 15a9 9 0 1 1-2.12-9.36L23 10" }));
                default:
                    return wp.element.createElement("span", { className: `dashicons ${assignmentTypeIcon(type)}`, "aria-hidden": "true" });
            }
        }
        function TargetSearch(props) {
            const [query, setQuery] = useState('');
            const [results, setResults] = useState([]);
            const [loading, setLoading] = useState(false);
            const [focused, setFocused] = useState(false);
            const [error, setError] = useState('');
            const selectedIds = useMemo(() => new Set(props.assignments
                .filter((assignment) => assignment.targetType === props.type)
                .map((assignment) => String(assignment.targetId ?? 'global'))), [props.assignments, props.type]);
            useEffect(() => {
                setQuery('');
                setResults([]);
                setError('');
            }, [props.type]);
            useEffect(() => {
                const targetType = props.type;
                if (!focused || targetType === 'global')
                    return;
                let active = true;
                const timeout = window.setTimeout(() => {
                    setLoading(true);
                    setError('');
                    WooOptionsPro.Api.searchAssignmentTargets(targetType, query)
                        .then((response) => {
                        if (active)
                            setResults(Array.isArray(response.items) ? response.items : []);
                    })
                        .catch((reason) => {
                        if (active)
                            setError(WooOptionsPro.Utils.errorMessage(reason));
                    })
                        .finally(() => {
                        if (active)
                            setLoading(false);
                    });
                }, 220);
                return () => {
                    active = false;
                    window.clearTimeout(timeout);
                };
            }, [query, props.type, focused]);
            if (props.type === 'global') {
                const selected = selectedIds.has('global');
                return (wp.element.createElement("button", { type: "button", className: `wof-assignment-global ${selected ? 'is-selected' : ''}`, disabled: selected, onClick: () => props.onAdd({
                        id: null,
                        type: 'global',
                        label: __('All WooCommerce products', 'wooptions-pro'),
                        meta: __('Every product in the store', 'wooptions-pro'),
                        image: '',
                    }) },
                    wp.element.createElement("span", { className: "wof-assignment-global__icon", "aria-hidden": "true" }, renderTypeIcon('global')),
                    wp.element.createElement("span", null,
                        wp.element.createElement("strong", null, __('All products', 'wooptions-pro')),
                        wp.element.createElement("small", null, selected ? __('Already assigned', 'wooptions-pro') : __('Apply this option set store-wide', 'wooptions-pro'))),
                    wp.element.createElement("span", { className: "wof-assignment-global__status", "aria-hidden": "true" }, selected ? (wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                        wp.element.createElement("polyline", { points: "20 6 9 17 4 12" }))) : (wp.element.createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" },
                        wp.element.createElement("line", { x1: "12", y1: "5", x2: "12", y2: "19" }),
                        wp.element.createElement("line", { x1: "5", y1: "12", x2: "19", y2: "12" }))))));
            }
            const placeholder = props.type === 'product'
                ? __('Search products by name, ID, or SKU…', 'wooptions-pro')
                : props.type === 'category'
                    ? __('Search product categories…', 'wooptions-pro')
                    : props.type === 'tag'
                        ? __('Search product tags…', 'wooptions-pro')
                        : __('Search variations by name, ID, or SKU…', 'wooptions-pro');
            return (wp.element.createElement("div", { className: "wof-target-search" },
                wp.element.createElement("div", { className: "wof-target-search__input" },
                    wp.element.createElement("span", { className: "dashicons dashicons-search", "aria-hidden": "true" }),
                    wp.element.createElement("input", { type: "search", value: query, placeholder: placeholder, onChange: (event) => setQuery(event.target.value), onFocus: () => setFocused(true), onBlur: () => window.setTimeout(() => setFocused(false), 160), "aria-label": __('Search assignment targets', 'wooptions-pro') }),
                    loading || query ? (wp.element.createElement("button", { type: "button", className: "wof-target-search__clear", onMouseDown: (event) => event.preventDefault(), onClick: () => setQuery(''), "aria-label": __('Clear search', 'wooptions-pro') }, loading ? wp.element.createElement("span", { className: "wof-mini-spinner", "aria-hidden": "true" }) : wp.element.createElement("span", { className: "dashicons dashicons-no-alt", "aria-hidden": "true" }))) : null),
                focused ? (wp.element.createElement("div", { className: "wof-target-results" },
                    error ? wp.element.createElement("p", { className: "wof-target-results__message is-error" }, error) : null,
                    !error && !loading && !results.length ? (wp.element.createElement("p", { className: "wof-target-results__message" }, query ? __('No matching items found.', 'wooptions-pro') : __('Start typing or choose from recent items.', 'wooptions-pro'))) : null,
                    results.map((target) => {
                        const selected = selectedIds.has(String(target.id));
                        return (wp.element.createElement("button", { type: "button", key: `${props.type}-${target.id}`, className: selected ? 'is-selected' : '', disabled: selected, onMouseDown: (event) => event.preventDefault(), onClick: () => props.onAdd({ ...target, type: props.type }) },
                            target.image ? wp.element.createElement("img", { src: target.image, alt: "" }) : wp.element.createElement("span", { className: `wof-target-result__icon dashicons ${assignmentTypeIcon(props.type)}`, "aria-hidden": "true" }),
                            wp.element.createElement("span", { className: "wof-target-result__copy" },
                                wp.element.createElement("strong", null, target.label),
                                wp.element.createElement("small", null, target.meta || `${assignmentTypeLabel(props.type)} #${target.id}`)),
                            wp.element.createElement("span", { className: `dashicons ${selected ? 'dashicons-yes-alt' : 'dashicons-plus-alt2'}`, "aria-hidden": "true" })));
                    }))) : null));
        }
        function AssignmentsModal(props) {
            const [type, setType] = useState('product');
            const [draft, setDraft] = useState(() => WooOptionsPro.Utils.clone(props.assignments));
            const [targetDetails, setTargetDetails] = useState({});
            const [saving, setSaving] = useState(false);
            useEffect(() => {
                setDraft(WooOptionsPro.Utils.clone(props.assignments));
            }, [props.assignments]);
            const assignmentKey = useMemo(() => draft.map((assignment) => `${assignment.targetType}:${assignment.targetId ?? 'global'}`).sort().join('|'), [draft]);
            useEffect(() => {
                let active = true;
                const grouped = new Map();
                draft.forEach((assignment) => {
                    if (!['product', 'variation', 'category', 'tag'].includes(assignment.targetType) || assignment.targetId === null)
                        return;
                    const targetType = assignment.targetType;
                    grouped.set(targetType, [...(grouped.get(targetType) ?? []), Number(assignment.targetId)]);
                });
                Promise.all(Array.from(grouped.entries()).map(async ([targetType, ids]) => {
                    try {
                        const response = await WooOptionsPro.Api.searchAssignmentTargets(targetType, '', [...new Set(ids)]);
                        return response.items.map((item) => [`${targetType}:${item.id}`, item]);
                    }
                    catch {
                        return [];
                    }
                })).then((groups) => {
                    if (!active)
                        return;
                    const next = {};
                    groups.flat().forEach(([key, item]) => { next[key] = item; });
                    setTargetDetails(next);
                });
                return () => { active = false; };
            }, [assignmentKey]);
            const updateAssignment = (index, patch) => {
                setDraft((current) => current.map((assignment, assignmentIndex) => assignmentIndex === index ? { ...assignment, ...patch } : assignment));
            };
            const addTarget = (target) => {
                const targetId = target.type === 'global' ? null : Number(target.id);
                if (draft.some((assignment) => assignment.targetType === target.type && assignment.targetId === targetId))
                    return;
                const assignment = {
                    uuid: WooOptionsPro.Utils.uuid(),
                    targetType: target.type,
                    targetId,
                    mode: 'include',
                    priority: 10,
                    context: {},
                    targetLabel: target.label,
                    targetMeta: target.meta,
                    targetImage: target.image,
                };
                setDraft((current) => [...current, assignment]);
                if (target.type !== 'global' && target.id !== null) {
                    setTargetDetails((current) => ({
                        ...current,
                        [`${target.type}:${target.id}`]: {
                            id: Number(target.id),
                            type: target.type,
                            label: target.label,
                            meta: target.meta,
                            image: target.image,
                        },
                    }));
                }
            };
            const save = async () => {
                setSaving(true);
                try {
                    await props.onSave(draft);
                }
                finally {
                    setSaving(false);
                }
            };
            return (wp.element.createElement(Modal, { title: __('Product assignments', 'wooptions-pro'), onRequestClose: props.onClose, className: "wof-modal wof-assignment-modal" },
                wp.element.createElement("div", { className: "wof-assignment-hero" },
                    wp.element.createElement("span", { className: "wof-assignment-hero__icon", "aria-hidden": "true" },
                        wp.element.createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
                            wp.element.createElement("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }))),
                    wp.element.createElement("div", null,
                        wp.element.createElement("h3", null, __('Choose exactly where this option set appears', 'wooptions-pro')),
                        wp.element.createElement("p", null, __('Search and select multiple products, categories, tags, or variations. Product-specific rules take priority over broader category rules.', 'wooptions-pro')))),
                wp.element.createElement("section", { className: "wof-assignment-picker" },
                    wp.element.createElement("div", { className: "wof-assignment-type-tabs", role: "tablist" }, assignmentTypes.map((assignmentType) => (wp.element.createElement("button", { type: "button", role: "tab", key: assignmentType.type, "aria-selected": type === assignmentType.type, className: type === assignmentType.type ? 'is-active' : '', onClick: () => setType(assignmentType.type) },
                        wp.element.createElement("span", { className: "wof-type-tab-icon", "aria-hidden": "true" }, renderTypeIcon(assignmentType.type)),
                        assignmentType.label)))),
                    wp.element.createElement(TargetSearch, { type: type, assignments: draft, onAdd: addTarget })),
                wp.element.createElement("div", { className: "wof-assignment-section-head" },
                    wp.element.createElement("div", null,
                        wp.element.createElement("h3", null, __('Assigned targets', 'wooptions-pro')),
                        wp.element.createElement("p", null, __('Adjust inclusion mode or priority for each selected target.', 'wooptions-pro'))),
                    wp.element.createElement("span", null,
                        draft.length,
                        " ",
                        draft.length === 1 ? __('rule', 'wooptions-pro') : __('rules', 'wooptions-pro'))),
                props.busy && !draft.length ? (wp.element.createElement(WooOptionsPro.Components.ModalLoading, { label: __('Loading assigned targets…', 'wooptions-pro') })) : draft.length ? (wp.element.createElement("div", { className: "wof-assignment-cards" }, draft.map((assignment, index) => {
                    const key = `${assignment.targetType}:${assignment.targetId ?? 'global'}`;
                    const target = targetDetails[key];
                    const label = assignment.targetLabel
                        || target?.label
                        || (assignment.targetType === 'global'
                            ? __('All WooCommerce products', 'wooptions-pro')
                            : `${assignmentTypeLabel(assignment.targetType)} #${assignment.targetId}`);
                    const meta = assignment.targetMeta
                        || target?.meta
                        || (assignment.targetType === 'global' ? __('Store-wide assignment', 'wooptions-pro') : `ID: ${assignment.targetId}`);
                    const image = assignment.targetImage || target?.image || '';
                    return (wp.element.createElement("article", { className: "wof-assignment-card", key: assignment.uuid || key },
                        wp.element.createElement("div", { className: "wof-assignment-card__visual" }, image ? wp.element.createElement("img", { src: image, alt: "" }) : wp.element.createElement("span", { className: "wof-assignment-visual-icon", "aria-hidden": "true" }, renderTypeIcon(assignment.targetType))),
                        wp.element.createElement("div", { className: "wof-assignment-card__identity" },
                            wp.element.createElement("div", null,
                                wp.element.createElement("strong", null, label),
                                wp.element.createElement("span", { className: "wof-target-type-badge" }, assignmentTypeLabel(assignment.targetType))),
                            wp.element.createElement("small", null, meta)),
                        wp.element.createElement("div", { className: "wof-assignment-card__controls" },
                            wp.element.createElement(SelectControl, { label: __('Mode', 'wooptions-pro'), value: assignment.mode, options: [
                                    { label: __('Include', 'wooptions-pro'), value: 'include' },
                                    { label: __('Exclude', 'wooptions-pro'), value: 'exclude' },
                                ], onChange: (mode) => updateAssignment(index, { mode }) }),
                            wp.element.createElement(TextControl, { type: "number", label: __('Priority', 'wooptions-pro'), value: String(assignment.priority), min: -1000, max: 1000, onChange: (priority) => updateAssignment(index, { priority: Number(priority) }) }),
                            wp.element.createElement("button", { type: "button", className: "wof-assignment-card__remove", onClick: () => setDraft((current) => current.filter((candidate) => candidate !== assignment)), "aria-label": __('Remove assignment', 'wooptions-pro'), title: __('Remove assignment', 'wooptions-pro') },
                                wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.9", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" },
                                    wp.element.createElement("polyline", { points: "3 6 5 6 21 6" }),
                                    wp.element.createElement("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }),
                                    wp.element.createElement("line", { x1: "10", y1: "11", x2: "10", y2: "17" }),
                                    wp.element.createElement("line", { x1: "14", y1: "11", x2: "14", y2: "17" }))))));
                }))) : (wp.element.createElement("div", { className: "wof-assignment-empty" },
                    wp.element.createElement("span", { className: "wof-assignment-empty__icon", "aria-hidden": "true" },
                        wp.element.createElement("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round" },
                            wp.element.createElement("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" }),
                            wp.element.createElement("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" }))),
                    wp.element.createElement("h3", null, __('No products assigned yet', 'wooptions-pro')),
                    wp.element.createElement("p", null, __('Use the search above to select one or more targets.', 'wooptions-pro')))),
                wp.element.createElement("div", { className: "wof-modal__actions wof-assignment-actions" },
                    wp.element.createElement(Button, { variant: "secondary", className: "wof-btn-cancel", disabled: saving || props.busy, onClick: props.onClose }, __('Cancel', 'wooptions-pro')),
                    wp.element.createElement(Button, { variant: "primary", className: "wof-btn-save", isBusy: saving || props.busy, disabled: saving || props.busy, onClick: save },
                        saving || props.busy ? (wp.element.createElement("svg", { className: "wof-btn-spinner", width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", "aria-hidden": "true", style: { fill: 'none', stroke: 'currentColor' } },
                            wp.element.createElement("circle", { cx: "12", cy: "12", r: "10", stroke: "currentColor", strokeWidth: "2.8", strokeDasharray: "31.4 31.4", strokeDashoffset: "10", fill: "none" }))) : (wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { fill: 'none', stroke: 'currentColor' } },
                            wp.element.createElement("path", { d: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z", fill: "none", stroke: "currentColor", strokeWidth: "2" }),
                            wp.element.createElement("polyline", { points: "17 21 17 13 7 13 7 21", fill: "none", stroke: "currentColor", strokeWidth: "2" }),
                            wp.element.createElement("polyline", { points: "7 3 7 8 15 8", fill: "none", stroke: "currentColor", strokeWidth: "2" }))),
                        wp.element.createElement("span", null, saving || props.busy ? __('Saving…', 'wooptions-pro') : __('Save assignments', 'wooptions-pro'))))));
        }
        Builder.AssignmentsModal = AssignmentsModal;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    var Builder;
    (function (Builder) {
        const { Button, TextControl } = wp.components;
        const { __ } = wp.i18n;
        const { useCallback, useEffect, useRef, useState } = wp.element;
        function BuilderPage(props) {
            const state = wp.data.useSelect((select) => select(WooOptionsPro.BuilderStore.STORE_KEY).getState(), []);
            const actions = wp.data.useDispatch(WooOptionsPro.BuilderStore.STORE_KEY);
            const [loading, setLoading] = useState(true);
            const [fatal, setFatal] = useState('');
            const [historyOpen, setHistoryOpen] = useState(false);
            const [assignmentOpen, setAssignmentOpen] = useState(false);
            const [revisions, setRevisions] = useState([]);
            const [assignments, setAssignments] = useState([]);
            const [modalBusy, setModalBusy] = useState(false);
            const [deleteUuid, setDeleteUuid] = useState(null);
            const [publishBusy, setPublishBusy] = useState(false);
            const savePromise = useRef(null);
            useEffect(() => {
                let active = true;
                setLoading(true);
                Promise.all([
                    WooOptionsPro.Api.getOptionSet(props.uuid),
                    WooOptionsPro.Api.getAssignments(props.uuid).catch(() => ({ items: [] })),
                ])
                    .then(([optionSet, asg]) => {
                    if (!active)
                        return;
                    actions.loadSet(optionSet);
                    setAssignments(asg.items);
                })
                    .catch((reason) => active && setFatal(WooOptionsPro.Utils.errorMessage(reason)))
                    .finally(() => active && setLoading(false));
                return () => { active = false; };
            }, [props.uuid]);
            const licenseInfo = window.WooOptionsProAdmin?.license;
            const isLicenseActive = licenseInfo?.active === true || licenseInfo?.canConfigure === true;
            const canConfigure = licenseInfo?.canConfigure !== false && isLicenseActive;
            const [overlayDismissed, setOverlayDismissed] = useState(false);
            const saveNow = useCallback(async (note = 'Manual save') => {
                if (savePromise.current)
                    return savePromise.current;
                if (!canConfigure) {
                    const msg = licenseInfo?.message || __('Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro');
                    actions.setSaveStatus('error');
                    WooOptionsPro.Toast.error(msg, __('License Required', 'wooptions-pro'));
                    throw new Error(msg);
                }
                if (!state.optionSet || !state.document)
                    throw new Error(__('The builder is not ready.', 'wooptions-pro'));
                actions.setSaveStatus('saving');
                const expectedHash = state.optionSet.currentRevision?.contentHash ?? '';
                savePromise.current = WooOptionsPro.Api.saveRevision(state.optionSet.uuid, state.document, expectedHash, note);
                try {
                    const result = await savePromise.current;
                    actions.saved(result, result.currentRevision?.definition ?? state.document);
                    return result;
                }
                catch (reason) {
                    actions.setSaveStatus(reason?.code === 'wooptions-pro_revision_conflict' ? 'conflict' : 'error');
                    WooOptionsPro.Toast.error(WooOptionsPro.Utils.errorMessage(reason));
                    throw reason;
                }
                finally {
                    savePromise.current = null;
                }
            }, [state.optionSet, state.document, canConfigure]);
            /* Autosave removed — saves are now manual via "Save draft" button */
            useEffect(() => {
                if (!state.document || !state.optionSet)
                    return;
                const timeout = window.setTimeout(() => {
                    WooOptionsPro.Api.validateDefinition(state.optionSet.uuid, state.document)
                        .then((result) => actions.setValidation(result.errors, result.warnings))
                        .catch(() => undefined);
                }, 500);
                return () => window.clearTimeout(timeout);
            }, [state.document, state.optionSet]);
            const publish = async () => {
                if (!canConfigure) {
                    const msg = licenseInfo?.message || __('Activate your WooOptions Pro license to create and edit product option sets.', 'wooptions-pro');
                    WooOptionsPro.Toast.error(msg, __('License Required', 'wooptions-pro'));
                    return;
                }
                if (!state.optionSet || !state.document)
                    return;
                if (state.errors.length) {
                    WooOptionsPro.Toast.error(__('Please resolve configuration errors before publishing.', 'wooptions-pro'));
                    return;
                }
                setPublishBusy(true);
                try {
                    const saved = state.dirty ? await saveNow('Pre-publish save') : state.optionSet;
                    actions.setSaveStatus('saving');
                    const result = await WooOptionsPro.Api.publishOptionSet(saved.uuid, saved.currentRevision?.contentHash ?? '');
                    actions.saved(result, result.currentRevision?.definition ?? state.document);
                    WooOptionsPro.Toast.success(__('Published. This live revision is now immutable.', 'wooptions-pro'), __('Option Set Published', 'wooptions-pro'));
                }
                catch (reason) {
                    WooOptionsPro.Toast.error(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setPublishBusy(false);
                }
            };
            const openHistory = async () => {
                if (!state.optionSet)
                    return;
                setHistoryOpen(true);
                setModalBusy(true);
                try {
                    setRevisions(await WooOptionsPro.Api.listRevisions(state.optionSet.uuid));
                }
                finally {
                    setModalBusy(false);
                }
            };
            const openAssignments = async () => {
                if (!state.optionSet)
                    return;
                setAssignmentOpen(true);
                setModalBusy(true);
                try {
                    setAssignments((await WooOptionsPro.Api.getAssignments(state.optionSet.uuid)).items);
                }
                catch (reason) {
                    WooOptionsPro.Toast.error(WooOptionsPro.Utils.errorMessage(reason));
                }
                finally {
                    setModalBusy(false);
                }
            };
            if (loading)
                return wp.element.createElement(WooOptionsPro.Components.Loading, { label: __('Opening the Precision Workshop…', 'wooptions-pro') });
            if (fatal || !state.optionSet || !state.document)
                return wp.element.createElement("div", { className: "wof-fatal" },
                    wp.element.createElement("h1", null, __('This option set could not be opened', 'wooptions-pro')),
                    wp.element.createElement("p", null, fatal),
                    wp.element.createElement(Button, { variant: "primary", onClick: () => props.navigate('option-sets') }, __('Back to option sets', 'wooptions-pro')));
            const selectedField = WooOptionsPro.Utils.fieldByUuid(state.document, state.selectedUuid);
            const addField = (field, index, parentUuid) => { actions.addField(field, index, parentUuid); actions.selectField(field.uuid); actions.setInspectorTab('content'); };
            const duplicateSelected = () => selectedField && addField(WooOptionsPro.FieldFactory.duplicate(selectedField));
            const showOverlay = !canConfigure && !overlayDismissed;
            return wp.element.createElement("div", { className: `wof-builder ${showOverlay ? 'wof-builder--locked' : ''}` },
                wp.element.createElement("header", { className: "wof-builder-topbar" },
                    wp.element.createElement("div", { className: "wof-builder-context" },
                        wp.element.createElement("button", { type: "button", className: "wof-builder-brand", onClick: () => props.navigate('dashboard') },
                            wp.element.createElement("span", { className: "wof-builder-brand-mark" },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "screenoptions" })),
                            wp.element.createElement("strong", null, "WooOptionsPro")),
                        wp.element.createElement("span", { className: "wof-builder-divider" }),
                        wp.element.createElement("button", { type: "button", className: "wof-builder-back", onClick: () => props.navigate('option-sets') },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "arrow-left-alt2" })),
                        wp.element.createElement("div", { className: "wof-builder-breadcrumb" },
                            wp.element.createElement("button", { type: "button", onClick: () => props.navigate('option-sets') }, __('Option Sets', 'wooptions-pro')),
                            wp.element.createElement("span", null, "/"),
                            wp.element.createElement("div", { className: "wof-builder-title-editor" },
                                wp.element.createElement(TextControl, { label: __('Option set title', 'wooptions-pro'), hideLabelFromVision: true, value: state.document.title, onChange: (title) => actions.updateDocument({ title }) }),
                                wp.element.createElement("span", { className: "wof-builder-title-icon", "aria-hidden": "true" },
                                    wp.element.createElement("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" },
                                        wp.element.createElement("path", { d: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" }),
                                        wp.element.createElement("path", { d: "m15 5 4 4" })))))),
                    wp.element.createElement("div", { className: "wof-builder-tools" },
                        wp.element.createElement("div", { className: "wof-tool-group wof-history-tools" },
                            wp.element.createElement("button", { type: "button", disabled: !state.history.length, onClick: actions.undo },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "undo" })),
                            wp.element.createElement("button", { type: "button", disabled: !state.future.length, onClick: actions.redo },
                                wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: "redo" }))),
                        wp.element.createElement("div", { className: "wof-tool-group wof-device-switcher" }, ['desktop', 'tablet', 'mobile'].map((device) => wp.element.createElement("button", { type: "button", key: device, className: state.device === device ? 'is-active' : '', onClick: () => actions.setDevice(device) },
                            wp.element.createElement(WooOptionsPro.Components.Dashicon, { name: device === 'desktop' ? 'desktop' : device === 'tablet' ? 'tablet' : 'smartphone' })))),
                        wp.element.createElement(Button, { variant: "tertiary", className: "wof-header-action", onClick: openHistory },
                            wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { fill: 'none', stroke: 'currentColor' } },
                                wp.element.createElement("circle", { cx: "12", cy: "12", r: "9", fill: "none", stroke: "currentColor", strokeWidth: "2" }),
                                wp.element.createElement("polyline", { points: "12 7 12 12 15 15", fill: "none", stroke: "currentColor", strokeWidth: "2" })),
                            __('History', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "tertiary", className: "wof-header-action", onClick: openAssignments },
                            wp.element.createElement("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", style: { fill: 'none', stroke: 'currentColor' } },
                                wp.element.createElement("path", { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", fill: "none", stroke: "currentColor", strokeWidth: "2" }),
                                wp.element.createElement("path", { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", fill: "none", stroke: "currentColor", strokeWidth: "2" })),
                            __('Assignments', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "secondary", className: "wof-header-action wof-header-save", isBusy: state.saveStatus === 'saving', onClick: () => saveNow('Manual save').then(() => WooOptionsPro.Toast.success(__('Draft saved.', 'wooptions-pro'))).catch(() => undefined) }, state.saveStatus === 'saving' ? __('Saving…', 'wooptions-pro') : __('Save draft', 'wooptions-pro')),
                        wp.element.createElement(Button, { variant: "primary", className: "wof-header-publish", isBusy: publishBusy, disabled: state.errors.length > 0 || publishBusy, onClick: publish }, publishBusy ? __('Publishing…', 'wooptions-pro') : __('Publish', 'wooptions-pro')))),
                wp.element.createElement("div", { className: "wof-builder-workspace", inert: showOverlay ? true : undefined },
                    wp.element.createElement(Builder.ElementsPanel, { onAdd: addField, onOpenStyle: () => { actions.selectField(null); actions.setInspectorTab('style'); } }),
                    wp.element.createElement(Builder.Canvas, { document: state.document, selectedUuid: state.selectedUuid, device: state.device, onSelect: (uuid) => { actions.selectField(uuid); actions.setInspectorTab('content'); }, onAdd: addField, onAddChild: (parentUuid, field, index) => addField(field, index, parentUuid), onMove: actions.moveField, onMoveChild: actions.moveChildField, onMoveToParent: actions.moveFieldToParent, onDuplicate: (field) => addField(WooOptionsPro.FieldFactory.duplicate(field)), onDelete: setDeleteUuid }),
                    wp.element.createElement(Builder.Inspector, { field: selectedField, document: state.document, tab: state.inspectorTab, onTabChange: actions.setInspectorTab, onFieldChange: (field) => actions.replaceField(field.uuid, field), onDocumentChange: actions.updateDocument, onDuplicate: duplicateSelected, onDelete: () => selectedField && setDeleteUuid(selectedField.uuid) })),
                historyOpen ? wp.element.createElement(Builder.HistoryModal, { revisions: revisions, busy: modalBusy, onClose: () => setHistoryOpen(false), onRollback: async (revisionUuid) => { if (!canConfigure) {
                        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to rollback revisions.', 'wooptions-pro'));
                        return;
                    } setModalBusy(true); try {
                        const result = await WooOptionsPro.Api.rollback(state.optionSet.uuid, revisionUuid);
                        actions.loadSet(result);
                        setHistoryOpen(false);
                        WooOptionsPro.Toast.success(__('A new draft was created from that revision.', 'wooptions-pro'));
                    }
                    finally {
                        setModalBusy(false);
                    } } }) : null,
                assignmentOpen ? wp.element.createElement(Builder.AssignmentsModal, { assignments: assignments, busy: modalBusy, onClose: () => setAssignmentOpen(false), onSave: async (nextAssignments) => { if (!canConfigure) {
                        WooOptionsPro.Toast.error(__('Activate your WooOptions Pro license to save assignments.', 'wooptions-pro'));
                        return;
                    } setModalBusy(true); try {
                        const response = await WooOptionsPro.Api.saveAssignments(state.optionSet.uuid, nextAssignments);
                        setAssignments(response.items);
                        setAssignmentOpen(false);
                        WooOptionsPro.Toast.success(__('Product assignments saved.', 'wooptions-pro'));
                    }
                    finally {
                        setModalBusy(false);
                    } } }) : null,
                deleteUuid ? wp.element.createElement(WooOptionsPro.Components.ConfirmModal, { title: __('Delete field?', 'wooptions-pro'), message: __('Delete this field and its configuration? This can be undone until you leave the builder.', 'wooptions-pro'), confirmLabel: __('Delete field', 'wooptions-pro'), destructive: true, onCancel: () => setDeleteUuid(null), onConfirm: () => { actions.deleteField(deleteUuid); setDeleteUuid(null); } }) : null,
                showOverlay && (wp.element.createElement(WooOptionsPro.Components.LicenseOverlayModal, { featureTitle: __('Precision Option Builder', 'wooptions-pro'), onActivate: () => props.navigate('license'), onDismiss: () => setOverlayDismissed(true) })));
        }
        Builder.BuilderPage = BuilderPage;
    })(Builder = WooOptionsPro.Builder || (WooOptionsPro.Builder = {}));
})(WooOptionsPro || (WooOptionsPro = {}));
var WooOptionsPro;
(function (WooOptionsPro) {
    const { useEffect, useState } = wp.element;
    const { __ } = wp.i18n;
    function routeFromLocation() {
        const hash = window.location.hash.replace(/^#\/?/, '').trim();
        if (hash) {
            return hash;
        }
        try {
            const url = new URL(window.location.href);
            const pageParam = url.searchParams.get('page');
            if (pageParam === 'wooptions-pro-license')
                return 'license';
            if (pageParam === 'wooptions-pro-option-sets')
                return 'option-sets';
            if (pageParam === 'wooptions-pro-templates')
                return 'templates';
            if (pageParam === 'wooptions-pro-analytics')
                return 'analytics';
            if (pageParam === 'wooptions-pro-settings')
                return 'settings';
            if (pageParam === 'wooptions-pro')
                return 'dashboard';
        }
        catch (e) { }
        return window.WooOptionsProAdmin?.initialRoute || 'dashboard';
    }
    function getPageSlugForRoute(r) {
        if (r === 'license')
            return 'wooptions-pro-license';
        if (r === 'option-sets')
            return 'wooptions-pro-option-sets';
        if (r === 'templates')
            return 'wooptions-pro-templates';
        if (r === 'analytics')
            return 'wooptions-pro-analytics';
        if (r === 'settings')
            return 'wooptions-pro-settings';
        return 'wooptions-pro';
    }
    function injectCustomFontsCss(customFonts) {
        if (!Array.isArray(customFonts) || customFonts.length === 0)
            return;
        const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
        const fixUrl = (url) => {
            if (!url || typeof url !== 'string')
                return '';
            return isHttps ? url.replace(/^http:\/\//i, 'https://') : url;
        };
        let css = '';
        for (const font of customFonts) {
            const files = font.files || {};
            const sources = [];
            if (files.woff2) {
                const u = fixUrl(files.woff2);
                sources.push(`url('${u}') format('woff2')`, `url('${u}')`);
            }
            if (files.woff) {
                const u = fixUrl(files.woff);
                sources.push(`url('${u}') format('woff')`, `url('${u}')`);
            }
            if (files.ttf) {
                const u = fixUrl(files.ttf);
                sources.push(`url('${u}') format('truetype')`, `url('${u}') format('opentype')`, `url('${u}')`);
            }
            if (files.otf) {
                const u = fixUrl(files.otf);
                sources.push(`url('${u}') format('opentype')`, `url('${u}') format('truetype')`, `url('${u}')`);
            }
            if (sources.length === 0)
                continue;
            const cleanName = (font.family || font.name || '').split(',')[0].replace(/['"]/g, '').trim();
            css += `@font-face {\n  font-family: '${cleanName}';\n  src: ${sources.join(', ')};\n  font-weight: 100 900;\n  font-style: ${font.style || 'normal'};\n  font-display: swap;\n}\n`;
            if (cleanName.includes(' ')) {
                css += `@font-face {\n  font-family: ${cleanName};\n  src: ${sources.join(', ')};\n  font-weight: 100 900;\n  font-style: ${font.style || 'normal'};\n  font-display: swap;\n}\n`;
            }
        }
        let el = document.getElementById('wof-dynamic-custom-fonts');
        if (!el) {
            el = document.createElement('style');
            el.id = 'wof-dynamic-custom-fonts';
            document.head.appendChild(el);
        }
        el.textContent = css;
    }
    WooOptionsPro.injectCustomFontsCss = injectCustomFontsCss;
    function App() {
        const [route, setRoute] = useState(routeFromLocation());
        useEffect(() => {
            const update = () => setRoute(routeFromLocation());
            window.addEventListener('hashchange', update);
            window.addEventListener('popstate', update);
            injectCustomFontsCss((window.WooOptionsProAdmin?.settings?.custom_fonts) || []);
            // Normalize URL if opened on a subpage like wooptions-pro-license#/builder/...
            const initial = routeFromLocation();
            if (initial.startsWith('builder/')) {
                try {
                    const url = new URL(window.location.href);
                    if (url.searchParams.get('page') !== 'wooptions-pro') {
                        url.searchParams.set('page', 'wooptions-pro');
                        window.history.replaceState({ route: initial }, '', url.toString());
                    }
                }
                catch (e) { }
            }
            return () => {
                window.removeEventListener('hashchange', update);
                window.removeEventListener('popstate', update);
            };
        }, []);
        const navigate = (nextRoute) => {
            const nextHash = `#/${nextRoute}`;
            const targetPage = getPageSlugForRoute(nextRoute);
            try {
                const url = new URL(window.location.href);
                url.searchParams.set('page', targetPage);
                url.hash = nextHash;
                if (window.location.href !== url.toString()) {
                    window.history.pushState({ route: nextRoute }, '', url.toString());
                }
            }
            catch (e) {
                window.location.hash = nextHash;
            }
            setRoute(nextRoute);
        };
        let page;
        if (route.startsWith('builder/')) {
            page = wp.element.createElement(WooOptionsPro.Builder.BuilderPage, { uuid: route.slice('builder/'.length), navigate: navigate });
        }
        else {
            switch (route) {
                case 'dashboard':
                    page = wp.element.createElement(WooOptionsPro.Pages.Dashboard, { navigate: navigate });
                    break;
                case 'option-sets':
                    page = wp.element.createElement(WooOptionsPro.Pages.OptionSets, { navigate: navigate });
                    break;
                case 'templates':
                    page = wp.element.createElement(WooOptionsPro.Pages.Templates, { navigate: navigate });
                    break;
                case 'analytics':
                    page = wp.element.createElement(WooOptionsPro.Pages.Analytics, { navigate: navigate });
                    break;
                case 'settings':
                    page = wp.element.createElement(WooOptionsPro.Pages.Settings, null);
                    break;
                case 'license':
                    page = wp.element.createElement(WooOptionsPro.Pages.LicensePage, { navigate: navigate });
                    break;
                default: page = wp.element.createElement("div", { className: "wof-fatal" },
                    wp.element.createElement("h1", null, __('Page not found', 'wooptions-pro')),
                    wp.element.createElement("p", null, __('This WooOptions Pro route does not exist.', 'wooptions-pro')),
                    wp.element.createElement("button", { type: "button", onClick: () => navigate('dashboard') }, __('Open dashboard', 'wooptions-pro')));
            }
        }
        return wp.element.createElement(WooOptionsPro.Components.AdminShell, { route: route, navigate: navigate }, page);
    }
    WooOptionsPro.App = App;
})(WooOptionsPro || (WooOptionsPro = {}));
(() => {
    const rootElement = document.getElementById('wooptions-pro-admin-root');
    if (!rootElement)
        return;
    try {
        wp.element.createRoot(rootElement).render(wp.element.createElement(WooOptionsPro.App, null));
    }
    catch (error) {
        window.console.error('WooOptions Pro admin failed to initialize.', error);
        rootElement.innerHTML = '<div class="wof-fatal"><h1>The workshop hit a snag</h1><p>Your saved configuration is safe. Reload the page to restart the builder.</p><button type="button" onclick="window.location.reload()">Reload WooOptions Pro</button></div>';
    }
})();
//# sourceMappingURL=admin.js.map
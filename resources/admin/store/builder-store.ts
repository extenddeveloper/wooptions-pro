namespace WooOptionsPro.BuilderStore {
  export const STORE_KEY = 'wooptions-pro/builder';

  const initialState: WooOptionsPro.BuilderState = {
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

  function pushHistory(state: WooOptionsPro.BuilderState): WooOptionsPro.BuilderState {
    if (!state.document) return state;
    const history = [...state.history, WooOptionsPro.Utils.clone(state.document)].slice(-60);
    return { ...state, history, future: [] };
  }

  const actions = {
    loadSet(optionSet: WooOptionsPro.OptionSetRecord) {
      return { type: 'LOAD_SET', optionSet };
    },
    replaceDocument(document: WooOptionsPro.OptionSetDefinition) {
      return { type: 'REPLACE_DOCUMENT', document };
    },
    updateDocument(patch: Partial<WooOptionsPro.OptionSetDefinition>) {
      return { type: 'UPDATE_DOCUMENT', patch };
    },
    addField(field: WooOptionsPro.FieldDefinition, index?: number, parentUuid?: string) {
      return { type: 'ADD_FIELD', field, index, parentUuid };
    },
    updateField(uuid: string, patch: Partial<WooOptionsPro.FieldDefinition>) {
      return { type: 'UPDATE_FIELD', uuid, patch };
    },
    replaceField(uuid: string, field: WooOptionsPro.FieldDefinition) {
      return { type: 'REPLACE_FIELD', uuid, field };
    },
    deleteField(uuid: string) {
      return { type: 'DELETE_FIELD', uuid };
    },
    moveField(from: number, to: number) {
      return { type: 'MOVE_FIELD', from, to };
    },
    moveChildField(parentUuid: string, from: number, to: number) {
      return { type: 'MOVE_CHILD_FIELD', parentUuid, from, to };
    },
    moveFieldToParent(fieldUuid: string, parentUuid: string, index?: number) {
      return { type: 'MOVE_FIELD_TO_PARENT', fieldUuid, parentUuid, index };
    },
    selectField(uuid: string | null) {
      return { type: 'SELECT_FIELD', uuid };
    },
    setInspectorTab(tab: WooOptionsPro.InspectorTab) {
      return { type: 'SET_INSPECTOR_TAB', tab };
    },
    setDevice(device: WooOptionsPro.PreviewDevice) {
      return { type: 'SET_DEVICE', device };
    },
    setSaveStatus(status: WooOptionsPro.SaveStatus) {
      return { type: 'SET_SAVE_STATUS', status };
    },
    setValidation(errors: WooOptionsPro.ValidationIssue[], warnings: WooOptionsPro.ValidationIssue[]) {
      return { type: 'SET_VALIDATION', errors, warnings };
    },
    saved(optionSet: WooOptionsPro.OptionSetRecord, document?: WooOptionsPro.OptionSetDefinition) {
      return { type: 'SAVED', optionSet, document };
    },
    undo() {
      return { type: 'UNDO' };
    },
    redo() {
      return { type: 'REDO' };
    },
  };

  function reducer(state: WooOptionsPro.BuilderState = initialState, action: any): WooOptionsPro.BuilderState {
    switch (action.type) {
      case 'LOAD_SET': {
        const optionSet = action.optionSet as WooOptionsPro.OptionSetRecord;
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
        if (!state.document) return state;
        const next = pushHistory(state);
        return {
          ...next,
          document: { ...state.document, ...action.patch },
          dirty: true,
          saveStatus: 'dirty',
        };
      }
      case 'ADD_FIELD': {
        if (!state.document) return state;
        const next = pushHistory(state);
        let fields = [...state.document.fields];
        if (action.parentUuid) {
          fields = WooOptionsPro.Utils.updateFieldTree(fields, action.parentUuid, (parent) => {
            const children = [...(parent.children ?? [])];
            const index = typeof action.index === 'number' ? Math.max(0, Math.min(children.length, action.index)) : children.length;
            children.splice(index, 0, action.field);
            return { ...parent, children };
          });
        } else {
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
        if (!state.document) return state;
        const next = pushHistory(state);
        const fields = WooOptionsPro.Utils.updateFieldTree(state.document.fields, action.uuid, (field) => ({ ...field, ...action.patch }));
        return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
      }
      case 'REPLACE_FIELD': {
        if (!state.document) return state;
        const next = pushHistory(state);
        const fields = WooOptionsPro.Utils.updateFieldTree(state.document.fields, action.uuid, () => action.field);
        return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
      }
      case 'DELETE_FIELD': {
        if (!state.document) return state;
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
        if (!state.document || action.from === action.to) return state;
        const next = pushHistory(state);
        const fields = [...state.document.fields];
        const from = Math.max(0, Math.min(fields.length - 1, action.from));
        const to = Math.max(0, Math.min(fields.length - 1, action.to));
        const [field] = fields.splice(from, 1);
        fields.splice(to, 0, field);
        return { ...next, document: { ...state.document, fields }, dirty: true, saveStatus: 'dirty' };
      }
      case 'MOVE_CHILD_FIELD': {
        if (!state.document || action.from === action.to) return state;
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
        if (!state.document) return state;
        const fieldToMove = WooOptionsPro.Utils.fieldByUuid(state.document, action.fieldUuid);
        if (!fieldToMove || fieldToMove.uuid === action.parentUuid) return state;
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
        const optionSet = action.optionSet as WooOptionsPro.OptionSetRecord;
        return {
          ...state,
          optionSet,
          document: action.document ?? state.document,
          dirty: false,
          saveStatus: 'saved',
        };
      }
      case 'UNDO': {
        if (!state.document || !state.history.length) return state;
        const history = [...state.history];
        const previous = history.pop()!;
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
        if (!state.document || !state.future.length) return state;
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
    getState(state: WooOptionsPro.BuilderState): WooOptionsPro.BuilderState {
      return state;
    },
    getDocument(state: WooOptionsPro.BuilderState): WooOptionsPro.OptionSetDefinition | null {
      return state.document;
    },
    getSelectedField(state: WooOptionsPro.BuilderState): WooOptionsPro.FieldDefinition | null {
      return WooOptionsPro.Utils.fieldByUuid(state.document, state.selectedUuid);
    },
  };

  wp.data.registerStore(STORE_KEY, { reducer, actions, selectors });
}

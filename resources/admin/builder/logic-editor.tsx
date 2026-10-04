namespace WooptionsFic.Builder {
  const { SelectControl, TextControl, ToggleControl } = wp.components;
  const { __, sprintf } = wp.i18n;
  const { useMemo } = wp.element;

  type LogicOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'empty' | 'not_empty';
  type LogicJoin = 'and' | 'or';
  type LogicEffect = 'show' | 'hide';

  interface LogicConditionRow {
    field: string;
    operator: LogicOperator;
    value: string;
  }

  interface LogicGroupState {
    logic: LogicJoin;
    conditions: LogicConditionRow[];
  }

  interface LogicEditorState {
    enabled: boolean;
    effect: LogicEffect;
    rootLogic: LogicJoin;
    groups: LogicGroupState[];
  }

  interface StoredExpression {
    logic?: string;
    conditions?: StoredExpression[];
    condition?: StoredExpression;
    not?: StoredExpression;
    left?: { field?: string };
    right?: { literal?: unknown };
    field?: string;
    operator?: string;
    value?: unknown;
    wofGroup?: boolean;
    wofRoot?: boolean;
    wofEffect?: string;
  }

  const contentOnlyTypes = ['heading', 'paragraph', 'help', 'separator', 'spacer', 'formula'];

  const operatorOptions = [
    { label: __('equals', 'wooptionsfic'), value: 'equals' },
    { label: __('does not equal', 'wooptionsfic'), value: 'not_equals' },
    { label: __('contains / is selected', 'wooptionsfic'), value: 'contains' },
    { label: __('does not contain', 'wooptionsfic'), value: 'not_contains' },
    { label: __('is greater than', 'wooptionsfic'), value: 'greater_than' },
    { label: __('is less than', 'wooptionsfic'), value: 'less_than' },
    { label: __('is empty', 'wooptionsfic'), value: 'empty' },
    { label: __('is not empty', 'wooptionsfic'), value: 'not_empty' },
  ];

  function cloneGroups(groups: LogicGroupState[]): LogicGroupState[] {
    return groups.map((group) => ({
      ...group,
      conditions: group.conditions.map((condition) => ({ ...condition })),
    }));
  }

  function defaultCondition(fieldUuid: string, fields: WooptionsFic.FieldDefinition[]): LogicConditionRow {
    const source = fields.find((field) => field.uuid === fieldUuid);
    const operator: LogicOperator = source?.multiple || ['checkbox_group', 'product'].includes(source?.type ?? '') ? 'contains' : 'equals';
    return {
      field: fieldUuid,
      operator,
      value: String(source?.choices?.[0]?.uuid ?? ''),
    };
  }

  function toConditionRow(expression: StoredExpression): LogicConditionRow {
    return {
      field: String(expression?.left?.field ?? expression?.field ?? ''),
      operator: (expression?.operator ?? 'equals') as LogicOperator,
      value: String(expression?.right?.literal ?? expression?.value ?? ''),
    };
  }

  function normalizeState(field: WooptionsFic.FieldDefinition, fields: WooptionsFic.FieldDefinition[]): LogicEditorState {
    const visibility = ((field.conditions as unknown as Record<string, StoredExpression> | undefined) ?? {}).visible;
    let effect: LogicEffect = 'show';
    let expression = visibility;

    if (expression?.logic === 'not') {
      effect = 'hide';
      expression = expression.not ?? expression.condition ?? {};
    }

    let rootLogic: LogicJoin = 'and';
    let storedGroups: StoredExpression[] = [];

    if (expression?.wofRoot && Array.isArray(expression.conditions)) {
      rootLogic = expression.logic === 'or' ? 'or' : 'and';
      storedGroups = expression.conditions;
    } else if (['and', 'or'].includes(expression?.logic ?? '') && Array.isArray(expression?.conditions)) {
      const containsNestedGroup = expression.conditions.some((item) => ['and', 'or'].includes(item?.logic ?? '') && Array.isArray(item?.conditions));
      if (containsNestedGroup) {
        rootLogic = expression.logic === 'or' ? 'or' : 'and';
        storedGroups = expression.conditions;
      } else {
        storedGroups = [expression];
      }
    } else if (expression && (expression.left || expression.field)) {
      storedGroups = [{ logic: 'and', conditions: [expression] }];
    }

    const groups = storedGroups
      .map((group) => ({
        logic: group.logic === 'or' ? 'or' as const : 'and' as const,
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

  export function LogicEditor(props: {
    field: WooptionsFic.FieldDefinition;
    allFields: WooptionsFic.FieldDefinition[];
    onChange: (field: WooptionsFic.FieldDefinition) => void;
  }): any {
    const sourceFields = useMemo(
      () => WooptionsFic.Utils.allFields(props.allFields).filter((field) => field.uuid !== props.field.uuid && !contentOnlyTypes.includes(field.type)),
      [props.allFields, props.field.uuid],
    );
    const state = useMemo(() => normalizeState(props.field, sourceFields), [props.field.conditions, sourceFields]);

    const save = (patch: Partial<LogicEditorState>) => {
      const next: LogicEditorState = { ...state, ...patch };
      const fieldConditions = { ...((props.field.conditions as unknown as Record<string, unknown>) ?? {}) };

      if (!next.enabled) {
        delete fieldConditions.visible;
        props.onChange({ ...props.field, conditions: fieldConditions as unknown as WooptionsFic.FieldDefinition['conditions'] });
        return;
      }

      const storedGroups: StoredExpression[] = next.groups
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
      } else {
        let visibility: StoredExpression = storedGroups.length === 1
          ? storedGroups[0]
          : { logic: next.rootLogic, conditions: storedGroups, wofRoot: true };
        if (next.effect === 'hide') visibility = { logic: 'not', condition: visibility, wofEffect: 'hide' };
        fieldConditions.visible = visibility;
      }

      props.onChange({ ...props.field, conditions: fieldConditions as unknown as WooptionsFic.FieldDefinition['conditions'] });
    };

    const updateGroup = (groupIndex: number, patch: Partial<LogicGroupState>) => {
      const groups = cloneGroups(state.groups);
      groups[groupIndex] = { ...groups[groupIndex], ...patch };
      save({ groups });
    };

    const updateCondition = (groupIndex: number, conditionIndex: number, patch: Partial<LogicConditionRow>) => {
      const groups = cloneGroups(state.groups);
      groups[groupIndex].conditions[conditionIndex] = { ...groups[groupIndex].conditions[conditionIndex], ...patch };
      save({ groups });
    };

    const addCondition = (groupIndex: number) => {
      const groups = cloneGroups(state.groups);
      groups[groupIndex].conditions.push(defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields));
      save({ groups });
    };

    const removeCondition = (groupIndex: number, conditionIndex: number) => {
      const groups = cloneGroups(state.groups);
      groups[groupIndex].conditions.splice(conditionIndex, 1);
      if (!groups[groupIndex].conditions.length) groups[groupIndex].conditions.push(defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields));
      save({ groups });
    };

    const removeGroup = (groupIndex: number) => {
      const groups = cloneGroups(state.groups);
      groups.splice(groupIndex, 1);
      save({ groups: groups.length ? groups : [{ logic: 'and', conditions: [defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields)] }] });
    };

    return <div className="wof-inspector-section wof-logic-builder">
      <div className="wof-inspector-section__intro"><div><h3>{__('Conditional logic', 'wooptionsfic')}</h3><p>{__('Show or hide this field using multiple grouped conditions. Rules are rechecked securely on the storefront.', 'wooptionsfic')}</p></div></div>
      <ToggleControl
        __nextHasNoMarginBottom
        label={__('Enable conditional logic', 'wooptionsfic')}
        checked={state.enabled}
        disabled={!sourceFields.length}
        onChange={(enabled: boolean) => enabled
          ? save({ enabled: true, groups: [{ logic: 'and', conditions: [defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields)] }] })
          : save({ enabled: false })}
      />
      {!sourceFields.length ? <div className="wof-logic-empty">{__('Add another customer-input field before creating a condition.', 'wooptionsfic')}</div> : null}
      {state.enabled && sourceFields.length ? <>
        <div className="wof-logic-behavior">
          <SelectControl label={__('Action', 'wooptionsfic')} value={state.effect} options={[{ label: __('Show this field', 'wooptionsfic'), value: 'show' }, { label: __('Hide this field', 'wooptionsfic'), value: 'hide' }]} onChange={(effect: LogicEffect) => save({ effect })} />
          {state.groups.length > 1 ? <SelectControl label={__('Match rule groups', 'wooptionsfic')} value={state.rootLogic} options={[{ label: __('All groups must match', 'wooptionsfic'), value: 'and' }, { label: __('Any group may match', 'wooptionsfic'), value: 'or' }]} onChange={(rootLogic: LogicJoin) => save({ rootLogic })} /> : null}
        </div>
        <div className="wof-logic-groups">
          {state.groups.map((group, groupIndex) => <article className="wof-logic-group" key={`group-${groupIndex}`}>
            <header>
              <div><span>{groupIndex + 1}</span><div><strong>{sprintf(__('Rule group %d', 'wooptionsfic'), groupIndex + 1)}</strong><small>{__('Conditions inside this group', 'wooptionsfic')}</small></div></div>
              <SelectControl label={__('Group matching', 'wooptionsfic')} hideLabelFromVision value={group.logic} options={[{ label: __('Match all (AND)', 'wooptionsfic'), value: 'and' }, { label: __('Match any (OR)', 'wooptionsfic'), value: 'or' }]} onChange={(logic: LogicJoin) => updateGroup(groupIndex, { logic })} />
              {state.groups.length > 1 ? <button type="button" className="wof-logic-delete" onClick={() => removeGroup(groupIndex)} aria-label={__('Delete rule group', 'wooptionsfic')}><WooptionsFic.Components.Dashicon name="trash" /></button> : null}
            </header>
            <div className="wof-logic-conditions">
              {group.conditions.map((condition, conditionIndex) => {
                const source = sourceFields.find((field) => field.uuid === condition.field);
                const hasChoices = Boolean(source?.choices?.length);
                const needsValue = !['empty', 'not_empty'].includes(condition.operator);
                return <div className="wof-logic-condition" key={`condition-${groupIndex}-${conditionIndex}`}>
                  <span className="wof-logic-condition__number">{conditionIndex + 1}</span>
                  <SelectControl label={__('Source field', 'wooptionsfic')} hideLabelFromVision value={condition.field} options={sourceFields.map((field) => ({ label: field.label || field.type, value: field.uuid }))} onChange={(fieldUuid: string) => updateCondition(groupIndex, conditionIndex, defaultCondition(fieldUuid, sourceFields))} />
                  <SelectControl label={__('Operator', 'wooptionsfic')} hideLabelFromVision value={condition.operator} options={operatorOptions} onChange={(operator: LogicOperator) => updateCondition(groupIndex, conditionIndex, { operator })} />
                  {needsValue ? hasChoices ? <SelectControl label={__('Value', 'wooptionsfic')} hideLabelFromVision value={condition.value} options={[{ label: __('Choose a value…', 'wooptionsfic'), value: '' }, ...(source?.choices ?? []).map((choice) => ({ label: choice.label, value: choice.uuid }))]} onChange={(value: string) => updateCondition(groupIndex, conditionIndex, { value })} /> : ['checkbox', 'toggle'].includes(source?.type ?? '') ? <SelectControl label={__('Value', 'wooptionsfic')} hideLabelFromVision value={condition.value} options={[{ label: __('Checked / Yes', 'wooptionsfic'), value: '1' }, { label: __('Unchecked / No', 'wooptionsfic'), value: '' }]} onChange={(value: string) => updateCondition(groupIndex, conditionIndex, { value })} /> : <TextControl label={__('Comparison value', 'wooptionsfic')} hideLabelFromVision value={condition.value} placeholder={__('Enter a value', 'wooptionsfic')} onChange={(value: string) => updateCondition(groupIndex, conditionIndex, { value })} /> : null}
                  <button type="button" className="wof-logic-condition__remove" disabled={state.groups.length === 1 && group.conditions.length === 1} onClick={() => removeCondition(groupIndex, conditionIndex)} aria-label={__('Remove condition', 'wooptionsfic')}><WooptionsFic.Components.Dashicon name="no-alt" /></button>
                </div>;
              })}
            </div>
            <button type="button" className="wof-logic-add-condition" onClick={() => addCondition(groupIndex)}><WooptionsFic.Components.Dashicon name="plus-alt2" />{__('Add condition', 'wooptionsfic')}</button>
          </article>)}
        </div>
        <button type="button" className="wof-logic-add-group" onClick={() => save({ groups: [...cloneGroups(state.groups), { logic: 'and', conditions: [defaultCondition(sourceFields[0]?.uuid ?? '', sourceFields)] }] })}><WooptionsFic.Components.Dashicon name="plus-alt2" />{__('Add rule group', 'wooptionsfic')}</button>
        <p className="wof-muted-note">{__('Use groups to combine AND and OR rules. Choice-based comparisons store stable choice IDs, so renaming labels will not break the logic.', 'wooptionsfic')}</p>
      </> : null}
    </div>;
  }
}

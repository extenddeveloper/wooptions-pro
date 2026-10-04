namespace WooptionsFic.Builder {
  const { Button, TextControl } = wp.components;
  const { __ } = wp.i18n;
  const { useCallback, useEffect, useRef, useState } = wp.element;

  export function BuilderPage(props: { uuid: string; navigate: (route: string) => void }): any {
    const state = wp.data.useSelect<WooptionsFic.BuilderState>((select: any) => select(WooptionsFic.BuilderStore.STORE_KEY).getState(), []);
    const actions = wp.data.useDispatch(WooptionsFic.BuilderStore.STORE_KEY);
    const [loading, setLoading] = useState(true);
    const [fatal, setFatal] = useState('');
    const [historyOpen, setHistoryOpen] = useState(false);
    const [assignmentOpen, setAssignmentOpen] = useState(false);
    const [revisions, setRevisions] = useState<WooptionsFic.RevisionRecord[]>([]);
    const [assignments, setAssignments] = useState<WooptionsFic.AssignmentRecord[]>([]);
    const [modalBusy, setModalBusy] = useState(false);
    const [deleteUuid, setDeleteUuid] = useState<string | null>(null);
    const [publishBusy, setPublishBusy] = useState(false);
    const savePromise = useRef<Promise<WooptionsFic.OptionSetRecord> | null>(null);

    useEffect(() => {
      let active = true;
      setLoading(true);
      Promise.all([
        WooptionsFic.Api.getOptionSet(props.uuid),
        WooptionsFic.Api.getAssignments(props.uuid).catch(() => ({ items: [] as WooptionsFic.AssignmentRecord[] })),
      ])
        .then(([optionSet, asg]) => {
          if (!active) return;
          actions.loadSet(optionSet);
          setAssignments(asg.items);
        })
        .catch((reason) => active && setFatal(WooptionsFic.Utils.errorMessage(reason)))
        .finally(() => active && setLoading(false));
      return () => { active = false; };
    }, [props.uuid]);

    const saveNow = useCallback(async (note = 'Manual save'): Promise<WooptionsFic.OptionSetRecord> => {
      if (savePromise.current) return savePromise.current;
      if (!state.optionSet || !state.document) throw new Error(__('The builder is not ready.', 'wooptionsfic'));
      actions.setSaveStatus('saving');
      const expectedHash = state.optionSet.currentRevision?.contentHash ?? '';
      savePromise.current = WooptionsFic.Api.saveRevision(state.optionSet.uuid, state.document, expectedHash, note);
      try {
        const result = await savePromise.current;
        actions.saved(result, result.currentRevision?.definition ?? state.document);
        return result;
      } catch (reason: any) {
        actions.setSaveStatus(reason?.code === 'wooptionsfic_revision_conflict' ? 'conflict' : 'error');
        WooptionsFic.Toast.error(WooptionsFic.Utils.errorMessage(reason));
        throw reason;
      } finally {
        savePromise.current = null;
      }
    }, [state.optionSet, state.document]);

    /* Autosave removed — saves are now manual via "Save draft" button */

    useEffect(() => {
      if (!state.document || !state.optionSet) return;
      const timeout = window.setTimeout(() => {
        WooptionsFic.Api.validateDefinition(state.optionSet!.uuid, state.document!)
          .then((result) => actions.setValidation(result.errors, result.warnings))
          .catch(() => undefined);
      }, 500);
      return () => window.clearTimeout(timeout);
    }, [state.document, state.optionSet]);

    const publish = async () => {
      if (!state.optionSet || !state.document) return;
      if (state.errors.length) {
        WooptionsFic.Toast.error(__('Please resolve configuration errors before publishing.', 'wooptionsfic'));
        return;
      }
      setPublishBusy(true);
      try {
        const saved = state.dirty ? await saveNow('Pre-publish save') : state.optionSet;
        actions.setSaveStatus('saving');
        const result = await WooptionsFic.Api.publishOptionSet(saved.uuid, saved.currentRevision?.contentHash ?? '');
        actions.saved(result, result.currentRevision?.definition ?? state.document);
        WooptionsFic.Toast.success(__('Published. This live revision is now immutable.', 'wooptionsfic'), __('Option Set Published', 'wooptionsfic'));
      } catch (reason) {
        WooptionsFic.Toast.error(WooptionsFic.Utils.errorMessage(reason));
      } finally {
        setPublishBusy(false);
      }
    };

    const openHistory = async () => {
      if (!state.optionSet) return;
      setHistoryOpen(true); setModalBusy(true);
      try { setRevisions(await WooptionsFic.Api.listRevisions(state.optionSet.uuid)); }
      finally { setModalBusy(false); }
    };
    const openAssignments = async () => {
      if (!state.optionSet) return;
      setAssignmentOpen(true); setModalBusy(true);
      try { setAssignments((await WooptionsFic.Api.getAssignments(state.optionSet.uuid)).items); }
      catch (reason) { WooptionsFic.Toast.error(WooptionsFic.Utils.errorMessage(reason)); }
      finally { setModalBusy(false); }
    };

    if (loading) return <WooptionsFic.Components.Loading label={__('Opening the Precision Workshop…', 'wooptionsfic')} />;
    if (fatal || !state.optionSet || !state.document) return <div className="wof-fatal"><h1>{__('This option set could not be opened', 'wooptionsfic')}</h1><p>{fatal}</p><Button variant="primary" onClick={() => props.navigate('option-sets')}>{__('Back to option sets', 'wooptionsfic')}</Button></div>;

    const selectedField = WooptionsFic.Utils.fieldByUuid(state.document, state.selectedUuid);
    const addField = (field: WooptionsFic.FieldDefinition, index?: number, parentUuid?: string) => { actions.addField(field, index, parentUuid); actions.selectField(field.uuid); actions.setInspectorTab('content'); };
    const duplicateSelected = () => selectedField && addField(WooptionsFic.FieldFactory.duplicate(selectedField));

    return <div className="wof-builder">
      <header className="wof-builder-topbar"><div className="wof-builder-context"><button type="button" className="wof-builder-brand" onClick={() => props.navigate('dashboard')}><span className="wof-builder-brand-mark"><WooptionsFic.Components.Dashicon name="screenoptions" /></span><strong>WooptionsFic</strong></button><span className="wof-builder-divider" /><button type="button" className="wof-builder-back" onClick={() => props.navigate('option-sets')}><WooptionsFic.Components.Dashicon name="arrow-left-alt2" /></button><div className="wof-builder-breadcrumb"><button type="button" onClick={() => props.navigate('option-sets')}>{__('Option Sets', 'wooptionsfic')}</button><span>/</span><div className="wof-builder-title-editor"><TextControl label={__('Option set title', 'wooptionsfic')} hideLabelFromVision value={state.document.title} onChange={(title: string) => actions.updateDocument({ title })} /><span className="wof-builder-title-icon" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg></span></div></div></div><div className="wof-builder-tools"><div className="wof-tool-group wof-history-tools"><button type="button" disabled={!state.history.length} onClick={actions.undo}><WooptionsFic.Components.Dashicon name="undo" /></button><button type="button" disabled={!state.future.length} onClick={actions.redo}><WooptionsFic.Components.Dashicon name="redo" /></button></div><div className="wof-tool-group wof-device-switcher">{(['desktop', 'tablet', 'mobile'] as WooptionsFic.PreviewDevice[]).map((device) => <button type="button" key={device} className={state.device === device ? 'is-active' : ''} onClick={() => actions.setDevice(device)}><WooptionsFic.Components.Dashicon name={device === 'desktop' ? 'desktop' : device === 'tablet' ? 'tablet' : 'smartphone'} /></button>)}</div><Button variant="tertiary" className="wof-header-action" onClick={openHistory}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }}><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" /><polyline points="12 7 12 12 15 15" fill="none" stroke="currentColor" strokeWidth="2" /></svg>{__('History', 'wooptionsfic')}</Button><Button variant="tertiary" className="wof-header-action" onClick={openAssignments}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" fill="none" stroke="currentColor" strokeWidth="2" /></svg>{__('Assignments', 'wooptionsfic')}</Button><Button variant="secondary" className="wof-header-action wof-header-save" isBusy={state.saveStatus === 'saving'} onClick={() => saveNow('Manual save').then(() => WooptionsFic.Toast.success(__('Draft saved.', 'wooptionsfic'))).catch(() => undefined)}>{state.saveStatus === 'saving' ? __('Saving…', 'wooptionsfic') : __('Save draft', 'wooptionsfic')}</Button><Button variant="primary" className="wof-header-publish" isBusy={publishBusy} disabled={state.errors.length > 0 || publishBusy} onClick={publish}>{publishBusy ? __('Publishing…', 'wooptionsfic') : __('Publish', 'wooptionsfic')}</Button></div></header>
      <div className="wof-builder-workspace"><ElementsPanel onAdd={addField} onOpenStyle={() => { actions.selectField(null); actions.setInspectorTab('style'); }} /><Canvas document={state.document} selectedUuid={state.selectedUuid} device={state.device} onSelect={(uuid) => { actions.selectField(uuid); actions.setInspectorTab('content'); }} onAdd={addField} onAddChild={(parentUuid, field, index) => addField(field, index, parentUuid)} onMove={actions.moveField} onMoveChild={actions.moveChildField} onMoveToParent={actions.moveFieldToParent} onDuplicate={(field) => addField(WooptionsFic.FieldFactory.duplicate(field))} onDelete={setDeleteUuid} /><Inspector field={selectedField} document={state.document} tab={state.inspectorTab} onTabChange={actions.setInspectorTab} onFieldChange={(field) => actions.replaceField(field.uuid, field)} onDocumentChange={actions.updateDocument} onDuplicate={duplicateSelected} onDelete={() => selectedField && setDeleteUuid(selectedField.uuid)} /></div>
      {historyOpen ? <HistoryModal revisions={revisions} busy={modalBusy} onClose={() => setHistoryOpen(false)} onRollback={async (revisionUuid) => { setModalBusy(true); try { const result = await WooptionsFic.Api.rollback(state.optionSet!.uuid, revisionUuid); actions.loadSet(result); setHistoryOpen(false); WooptionsFic.Toast.success(__('A new draft was created from that revision.', 'wooptionsfic')); } finally { setModalBusy(false); } }} /> : null}
      {assignmentOpen ? <AssignmentsModal assignments={assignments} busy={modalBusy} onClose={() => setAssignmentOpen(false)} onSave={async (nextAssignments) => { setModalBusy(true); try { const response = await WooptionsFic.Api.saveAssignments(state.optionSet!.uuid, nextAssignments); setAssignments(response.items); setAssignmentOpen(false); WooptionsFic.Toast.success(__('Product assignments saved.', 'wooptionsfic')); } finally { setModalBusy(false); } }} /> : null}
      {deleteUuid ? <WooptionsFic.Components.ConfirmModal title={__('Delete field?', 'wooptionsfic')} message={__('Delete this field and its configuration? This can be undone until you leave the builder.', 'wooptionsfic')} confirmLabel={__('Delete field', 'wooptionsfic')} destructive onCancel={() => setDeleteUuid(null)} onConfirm={() => { actions.deleteField(deleteUuid); setDeleteUuid(null); }} /> : null}
    </div>;
  }
}

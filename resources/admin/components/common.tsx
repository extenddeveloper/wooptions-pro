namespace WooptionsFic.Components {
  const { Button, Modal, Spinner } = wp.components;
  const { __ } = wp.i18n;
  const { useEffect, useState } = wp.element;

  export function MediaImage(props: { attachmentId?: number; src?: string; alt?: string; className?: string }): any {
    const [resolvedSrc, setResolvedSrc] = useState(props.src ?? '');

    useEffect(() => {
      let active = true;
      setResolvedSrc(props.src ?? '');
      const attachmentId = Number(props.attachmentId ?? 0);
      if (!attachmentId || !wp.media?.attachment) return () => { active = false; };
      const attachment = wp.media.attachment(attachmentId);
      const update = () => {
        if (!active) return;
        const data = attachment.toJSON?.() ?? {};
        const source = data.sizes?.thumbnail?.url ?? data.sizes?.medium?.url ?? data.url ?? '';
        if (source) setResolvedSrc(String(source));
      };
      update();
      const request = attachment.fetch?.();
      if (request) Promise.resolve(request).then(update).catch(() => undefined);
      return () => { active = false; };
    }, [props.attachmentId, props.src]);

    return resolvedSrc ? <img src={resolvedSrc} alt={props.alt ?? ''} className={props.className} /> : null;
  }

  export function Loading(props: { label?: string; overlay?: boolean }): any {
    return (
      <div className={WooptionsFic.Utils.classNames('wof-loading', props.overlay && 'is-overlay')} role="status">
        <span className="wof-loader" aria-hidden="true" />
        <span>{props.label ?? __('Loading…', 'wooptionsfic')}</span>
      </div>
    );
  }

  export function PageHeader(props: { eyebrow?: string; title: string; description?: string; actions?: any }): any {
    return (
      <header className="wof-page-header">
        <div>
          <h1>{props.title}</h1>
          {props.description ? <p>{props.description}</p> : null}
        </div>
        {props.actions ? <div className="wof-page-header__actions">{props.actions}</div> : null}
      </header>
    );
  }

  export function EmptyState(props: { icon: string; title: string; description: string; action?: any }): any {
    return (
      <div className="wof-empty">
        <div className="wof-empty__icon"><Dashicon name={props.icon} /></div>
        <h2>{props.title}</h2>
        <p>{props.description}</p>
        {props.action}
      </div>
    );
  }

  export function StatusPill(props: { status: string }): any {
    const normalized = props.status.toLowerCase().replace(/[^a-z-]/g, '');
    return <span className={`wof-status-pill is-${normalized}`}><span aria-hidden="true" />{props.status}</span>;
  }

  export function ConfirmModal(props: {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    busy?: boolean;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }): any {
    return (
      <Modal
        title={props.title}
        onRequestClose={() => !props.busy && props.onCancel()}
        className={WooptionsFic.Utils.classNames(
          'wof-modal',
          'wof-confirm-modal',
          props.destructive && 'is-destructive'
        )}
      >
        <div className="wof-confirm-modal__header-custom">
          <h3 className="wof-confirm-modal__title-custom">{props.title}</h3>
          <button
            type="button"
            className="wof-confirm-modal__close-custom"
            onClick={props.onCancel}
            aria-label={__('Close', 'wooptionsfic')}
          >
            ✕
          </button>
        </div>

        <div className="wof-confirm-modal__body">
          {props.destructive ? (
            <div className="wof-confirm-modal__icon-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>
          ) : null}
          <div className="wof-confirm-modal__text">
            <p className="wof-confirm-modal__message">{props.message}</p>
          </div>
        </div>

        <div className="wof-modal__actions wof-confirm-modal__actions">
          <button
            type="button"
            className="wof-btn-modal-cancel"
            disabled={props.busy}
            onClick={props.onCancel}
          >
            {props.cancelLabel ?? __('Cancel', 'wooptionsfic')}
          </button>
          <button
            type="button"
            className={WooptionsFic.Utils.classNames(
              'wof-btn-modal-confirm',
              props.destructive && 'is-destructive'
            )}
            disabled={props.busy}
            onClick={props.onConfirm}
          >
            {props.busy ? (
              <span className="wof-btn-busy-spinner">
                <Spinner />
                <span>{__('Deleting…', 'wooptionsfic')}</span>
              </span>
            ) : (
              props.confirmLabel
            )}
          </button>
        </div>
      </Modal>
    );
  }

  export function InlineNotice(props: { type?: 'error' | 'success' | 'warning'; children?: any; onClose?: () => void }): any {
    return (
      <div className={WooptionsFic.Utils.classNames('wof-inline-notice', props.type && `is-${props.type}`)} role={props.type === 'error' ? 'alert' : 'status'}>
        <span aria-hidden="true">{props.type === 'error' ? '!' : props.type === 'warning' ? '•' : '✓'}</span>
        <div>{props.children}</div>
        {props.onClose ? <button type="button" onClick={props.onClose} aria-label={__('Dismiss', 'wooptionsfic')}>×</button> : null}
      </div>
    );
  }

  export function ModalLoading(props: { label?: string }): any {
    return <div className="wof-modal-loading"><Spinner /><span>{props.label ?? __('Loading…', 'wooptionsfic')}</span></div>;
  }

  export function WpWysiwygEditor(props: { id: string; value: string; label?: string; onChange: (content: string) => void }): any {
    const rawId = props.id.replace(/[^a-zA-Z0-9_]/g, '');
    const editorId = `wof_editor_${rawId}`;
    const [activeTab, setActiveTab] = wp.element.useState<'visual' | 'text'>('visual');
    const [textValue, setTextValue] = wp.element.useState(props.value ?? '');
    const textTextareaRef = wp.element.useRef<HTMLTextAreaElement | null>(null);

    const onChangeRef = wp.element.useRef(props.onChange);
    onChangeRef.current = props.onChange;

    const valueRef = wp.element.useRef(props.value);
    valueRef.current = props.value;

    wp.element.useEffect(() => {
      setTextValue(props.value ?? '');
    }, [props.id]);

    wp.element.useEffect(() => {
      let isMounted = true;
      let timer: any = null;

      const initEditor = () => {
        if (!isMounted) return true;
        const tinymce = (window as any).tinymce;
        if (!tinymce || typeof tinymce.init !== 'function') return false;

        const target = document.getElementById(editorId);
        if (!target) return false;

        try {
          const prev = tinymce.get(editorId);
          if (prev) {
            prev.remove();
          }
        } catch {
          // ignore
        }

        const preInit = (window as any).tinyMCEPreInit?.mceInit?.wof_admin_dummy_editor;
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
            setup: (ed: any) => {
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
        } catch {
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
        if (timer) clearInterval(timer);
        const tinymce = (window as any).tinymce;
        if (tinymce) {
          try {
            const ed = tinymce.get(editorId);
            if (ed) ed.remove();
          } catch {
            // ignore
          }
        }
      };
    }, [editorId]);

    const handleSwitchTab = (tab: 'visual' | 'text') => {
      if (tab === activeTab) return;
      const tinymce = (window as any).tinymce;
      const editor = tinymce ? tinymce.get(editorId) : null;

      if (tab === 'text') {
        let currentHtml = textValue;
        if (editor) {
          try {
            currentHtml = editor.getContent();
          } catch {
            // ignore
          }
        }
        setTextValue(currentHtml);
        setActiveTab('text');
      } else {
        setActiveTab('visual');
        if (editor) {
          try {
            editor.setContent(textValue);
          } catch {
            // ignore
          }
        }
      }
    };

    const handleOpenMedia = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      const wpMedia = (window as any).wp?.media;
      if (!wpMedia) return;

      const frame = wpMedia({
        title: __('Add Media', 'wooptionsfic'),
        button: { text: __('Insert into field', 'wooptionsfic') },
        multiple: false,
        library: { type: 'image' },
      });

      frame.on('select', () => {
        const attachment = frame.state().get('selection').first().toJSON();
        const imgUrl = attachment.url;
        const imgAlt = attachment.alt || attachment.title || '';
        const imgHtml = `<img src="${imgUrl}" alt="${imgAlt}" class="alignnone size-full" />`;

        const tinymce = (window as any).tinymce;
        const editor = tinymce ? tinymce.get(editorId) : null;

        if (activeTab === 'visual' && editor) {
          try {
            editor.insertContent(imgHtml);
            const updated = editor.getContent();
            setTextValue(updated);
            onChangeRef.current(updated);
          } catch {
            const updated = (textValue || '') + imgHtml;
            setTextValue(updated);
            onChangeRef.current(updated);
          }
        } else {
          const ta = textTextareaRef.current;
          if (ta) {
            const start = ta.selectionStart ?? 0;
            const end = ta.selectionEnd ?? 0;
            const val = ta.value;
            const updated = val.substring(0, start) + imgHtml + val.substring(end);
            setTextValue(updated);
            onChangeRef.current(updated);
          } else {
            const updated = (textValue || '') + imgHtml;
            setTextValue(updated);
            onChangeRef.current(updated);
          }
        }
      });

      frame.open();
    };

    const handleTextChange = (newVal: string) => {
      setTextValue(newVal);
      onChangeRef.current(newVal);
      const tinymce = (window as any).tinymce;
      const editor = tinymce ? tinymce.get(editorId) : null;
      if (editor) {
        try {
          editor.setContent(newVal);
        } catch {
          // ignore
        }
      }
    };

    return (
      <div className="wof-wp-editor-field">
        {props.label ? <label className="wof-wp-editor-label">{props.label}</label> : null}
        <div className="wof-wp-editor-mount">
          <div className={`wp-core-ui wp-editor-wrap ${activeTab === 'visual' ? 'tmce-active' : 'html-active'}`}>
            <div className="wp-editor-tools hide-if-no-js">
              <div className="wp-media-buttons">
                <button
                  type="button"
                  className="button insert-media add_media"
                  onClick={handleOpenMedia}
                >
                  <span className="wp-media-buttons-icon" />
                  {__('Add Media', 'wooptionsfic')}
                </button>
              </div>
              <div className="wp-editor-tabs">
                <button
                  type="button"
                  className={`wp-switch-editor switch-tmce ${activeTab === 'visual' ? 'is-active' : ''}`}
                  onClick={() => handleSwitchTab('visual')}
                >
                  {__('Visual', 'wooptionsfic')}
                </button>
                <button
                  type="button"
                  className={`wp-switch-editor switch-html ${activeTab === 'text' ? 'is-active' : ''}`}
                  onClick={() => handleSwitchTab('text')}
                >
                  {__('Text', 'wooptionsfic')}
                </button>
              </div>
            </div>
            <div className="wp-editor-container">
              <div style={{ display: activeTab === 'visual' ? 'block' : 'none' }}>
                <textarea
                  id={editorId}
                  name={editorId}
                  className="wp-editor-area"
                  rows={8}
                  style={{ width: '100%', height: '220px' }}
                  defaultValue={props.value ?? ''}
                />
              </div>
              <div style={{ display: activeTab === 'text' ? 'block' : 'none' }}>
                <textarea
                  ref={textTextareaRef}
                  id={`${editorId}_html`}
                  className="wp-editor-area wof-editor-text-mode"
                  rows={9}
                  style={{
                    width: '100%',
                    height: '220px',
                    padding: '12px',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '13px',
                    lineHeight: 1.6,
                    border: 'none',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  value={textValue}
                  onChange={(e: any) => handleTextChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

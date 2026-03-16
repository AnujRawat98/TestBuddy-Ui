import React, { useEffect, useRef, useState, useCallback } from 'react';
import './RichTextEditor.css';

interface Props {
    value:        string;
    onChange:     (html: string) => void;
    placeholder?: string;
    minHeight?:   number;
}

const RichTextEditor: React.FC<Props> = ({
    value,
    onChange,
    placeholder = 'Type the question here…',
    minHeight   = 130,
}) => {
    const divRef      = useRef<HTMLDivElement>(null);
    const fileRef     = useRef<HTMLInputElement>(null);
    const cbRef       = useRef(onChange);
    const mounted     = useRef(false);
    const [focused,   setFocused]  = useState(false);
    const [showMath,  setShowMath] = useState(false);
    const [mathVal,   setMathVal]  = useState('');

    // Always keep cbRef pointing to latest onChange — never a dep
    useEffect(() => { cbRef.current = onChange; });

    // Set innerHTML ONCE on mount only — never again
    useEffect(() => {
        if (!mounted.current && divRef.current) {
            divRef.current.innerHTML = value || '';
            mounted.current = true;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Only reset if parent explicitly clears (e.g. after save new question)
    const prevKey = useRef(value);
    useEffect(() => {
        if (value === '' && prevKey.current !== '' && divRef.current) {
            divRef.current.innerHTML = '';
        }
        prevKey.current = value;
    }, [value]);

    const emit = useCallback(() => {
        if (divRef.current) cbRef.current(divRef.current.innerHTML);
    }, []);

    const cmd = useCallback((command: string, arg?: string) => {
        divRef.current?.focus();
        document.execCommand(command, false, arg);
        // Use setTimeout so DOM settles before reading
        setTimeout(emit, 0);
    }, [emit]);

    const insertCode = useCallback(() => {
        const sel = window.getSelection()?.toString().trim() || '// code here';
        cmd('insertHTML',
            `<pre class="rte-code"><code>${esc(sel)}</code></pre><p><br></p>`
        );
    }, [cmd]);

    const doMath = useCallback(() => {
        if (!mathVal.trim()) { setShowMath(false); return; }
        cmd('insertHTML',
            `<span class="rte-math" contenteditable="false">\\(${esc(mathVal)}\\)</span>&nbsp;`
        );
        setMathVal('');
        setShowMath(false);
    }, [cmd, mathVal]);

    const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = ev =>
            cmd('insertHTML', `<img src="${ev.target?.result}" class="rte-img" alt="" />`);
        r.readAsDataURL(f);
        e.target.value = '';
    }, [cmd]);

    const esc = (s: string) =>
        s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const tools: Array<{ title: string; icon: React.ReactNode; action: () => void } | { divider: true }> = [
        { title: 'Bold',          icon: <strong>B</strong>,   action: () => cmd('bold')               },
        { title: 'Italic',        icon: <em>I</em>,           action: () => cmd('italic')             },
        { title: 'Underline',     icon: <span style={{textDecoration:'underline'}}>U</span>,
                                                               action: () => cmd('underline')          },
        { title: 'Strike',        icon: <span style={{textDecoration:'line-through'}}>S</span>,
                                                               action: () => cmd('strikeThrough')      },
        { divider: true },
        { title: 'Bullets',       icon: <span>• ≡</span>,     action: () => cmd('insertUnorderedList') },
        { title: 'Numbers',       icon: <span>1.2.</span>,    action: () => cmd('insertOrderedList')  },
        { divider: true },
        { title: 'Code',          icon: <span style={{fontFamily:'monospace',fontSize:12}}>&lt;/&gt;</span>,
                                                               action: insertCode                      },
        { title: 'Math',          icon: <span style={{fontStyle:'italic',fontFamily:'serif',fontSize:16}}>∑</span>,
                                                               action: () => setShowMath(v => !v)      },
        { divider: true },
        { title: 'Image',         icon: <span>🖼</span>,      action: () => fileRef.current?.click()  },
        { divider: true },
        { title: 'Clear',         icon: <span style={{fontSize:12}}>Tx</span>,
                                                               action: () => cmd('removeFormat')       },
    ];

    const empty = !value || value === '' || value === '<br>' || value === '<p><br></p>';

    return (
        <div className={`rte-wrap${focused ? ' focused' : ''}`}>

            {/* ── Toolbar ── */}
            <div className="rte-toolbar" onMouseDown={e => e.preventDefault()}>
                {tools.map((t, i) =>
                    'divider' in t
                        ? <span key={i} className="rte-div" />
                        : <button key={i} type="button" className="rte-btn" title={t.title}
                            onClick={() => t.action()}>
                            {t.icon}
                          </button>
                )}
            </div>

            {/* ── Math row ── */}
            {showMath && (
                <div className="rte-math-row">
                    <span className="rte-math-label">LaTeX</span>
                    <input className="rte-math-input" autoFocus
                        placeholder="\frac{a}{b}  x^2  \sqrt{x}"
                        value={mathVal}
                        onChange={e => setMathVal(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter')  { e.preventDefault(); doMath(); }
                            if (e.key === 'Escape') setShowMath(false);
                        }}
                    />
                    <button type="button" className="rte-math-ok"
                        onMouseDown={e => { e.preventDefault(); doMath(); }}>Insert</button>
                    <button type="button" className="rte-math-x"
                        onMouseDown={e => { e.preventDefault(); setShowMath(false); }}>✕</button>
                </div>
            )}

            {/* ── Editor ── */}
            <div style={{ position: 'relative' }}>
                <div
                    ref={divRef}
                    className="rte-editor"
                    contentEditable
                    suppressContentEditableWarning
                    style={{ minHeight }}
                    onFocus={() => setFocused(true)}
                    onBlur={()  => { setFocused(false); emit(); }}
                    onInput={emit}
                    onKeyDown={e => {
                        if (e.key === 'Tab') {
                            e.preventDefault();
                            cmd('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
                        }
                    }}
                />
                {/* Placeholder shown only when truly empty and not focused */}
                {empty && !focused && (
                    <div className="rte-ph" onClick={() => divRef.current?.focus()}>
                        {placeholder}
                    </div>
                )}
            </div>

            <input ref={fileRef} type="file" accept="image/*"
                style={{ display:'none' }} onChange={onFile} />
        </div>
    );
};

export default RichTextEditor;

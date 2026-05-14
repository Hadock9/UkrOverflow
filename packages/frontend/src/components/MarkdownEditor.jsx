/**
 * Markdown Editor з preview та Brutalism дизайном
 */

import { useState, useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './MarkdownEditor.css';

// Налаштування marked
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false
});

export function MarkdownEditor({
  value = '',
  onChange,
  placeholder = 'Введіть текст (підтримується Маркдаун)...',
  minHeight = '200px',
  showPreview = true,
  showToolbar = true
}) {
  const [activeTab, setActiveTab] = useState('write');

  const previewHtml = useMemo(() => {
    if (!value) return '';
    const rawHtml = marked(value);
    return DOMPurify.sanitize(rawHtml);
  }, [value]);

  const insertMarkdown = (before, after = '') => {
    const textarea = document.querySelector('.md-textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);

    onChange(newText);

    // Встановити курсор
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const toolbarButtons = [
    { label: 'H1', action: () => insertMarkdown('# '), title: 'Заголовок 1' },
    { label: 'H2', action: () => insertMarkdown('## '), title: 'Заголовок 2' },
    { label: 'H3', action: () => insertMarkdown('### '), title: 'Заголовок 3' },
    { label: 'B', action: () => insertMarkdown('**', '**'), title: 'Жирний' },
    { label: 'I', action: () => insertMarkdown('_', '_'), title: 'Курсив' },
    { label: 'КОД', action: () => insertMarkdown('`', '`'), title: 'Код' },
    { label: 'ЛІНК', action: () => insertMarkdown('[', '](url)'), title: 'Посилання' },
    { label: 'UL', action: () => insertMarkdown('- '), title: 'Список' },
    { label: 'OL', action: () => insertMarkdown('1. '), title: 'Нумерований список' },
    { label: 'ЦИТ', action: () => insertMarkdown('> '), title: 'Цитата' }
  ];

  return (
    <div className="md-editor">
      {showToolbar && (
        <div className="md-toolbar">
          {toolbarButtons.map((btn, idx) => (
            <button
              key={idx}
              type="button"
              className="md-toolbar-btn"
              onClick={btn.action}
              title={btn.title}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {showPreview && (
        <div className="md-tabs">
          <button
            type="button"
            className={`md-tab ${activeTab === 'write' ? 'active' : ''}`}
            onClick={() => setActiveTab('write')}
          >
            НАПИСАТИ
          </button>
          <button
            type="button"
            className={`md-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            ПОПЕРЕДНІЙ ПЕРЕГЛЯД
          </button>
        </div>
      )}

      <div className="md-content">
        {(!showPreview || activeTab === 'write') && (
          <textarea
            className="md-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ minHeight }}
          />
        )}

        {showPreview && activeTab === 'preview' && (
          <div
            className="md-preview"
            style={{ minHeight }}
            dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="md-empty">Нічого для відображення</p>' }}
          />
        )}
      </div>

      <div className="md-help">
        <details>
          <summary>ДОВІДКА MARKDOWN</summary>
          <div className="md-help-content">
            <div className="md-help-item">
              <code># Заголовок 1</code>
              <span>→ Великий заголовок</span>
            </div>
            <div className="md-help-item">
              <code>## Заголовок 2</code>
              <span>→ Середній заголовок</span>
            </div>
            <div className="md-help-item">
              <code>**жирний**</code>
              <span>→ <strong>жирний</strong></span>
            </div>
            <div className="md-help-item">
              <code>_курсив_</code>
              <span>→ <em>курсив</em></span>
            </div>
            <div className="md-help-item">
              <code>`код`</code>
              <span>→ <code>код</code></span>
            </div>
            <div className="md-help-item">
              <code>[текст](url)</code>
              <span>→ Посилання</span>
            </div>
            <div className="md-help-item">
              <code>- пункт</code>
              <span>→ Список</span>
            </div>
            <div className="md-help-item">
              <code>&gt; цитата</code>
              <span>→ Цитата</span>
            </div>
            <div className="md-help-item">
              <code>```код```</code>
              <span>→ Блок коду</span>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export default MarkdownEditor;

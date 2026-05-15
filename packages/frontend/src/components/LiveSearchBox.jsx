/**
 * Поле пошуку з миттєвими підказками (live).
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveSearch } from '../hooks/useLiveSearch';
import { LiveSearchResults } from './LiveSearchResults';

export function LiveSearchBox({
  value,
  onChange,
  onSubmitQuery,
  placeholder = 'Пошук…',
  className = '',
  inputClassName = 'form-input',
  variant = 'header',
  showSubmitButton = true,
  syncUrlOnType = false,
}) {
  const navigate = useNavigate();
  const listId = useId();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  const live = useLiveSearch(value, {
    debounceMs: 280,
    minChars: 2,
    enabled: variant === 'page' || open || value.length >= 2,
  });

  useEffect(() => {
    if (value.length >= 2) setOpen(true);
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const goSearch = (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setOpen(false);
    if (onSubmitQuery) {
      onSubmitQuery(trimmed);
    } else {
      navigate(`/search?q=${encodeURIComponent(trimmed)}&page=1`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    goSearch(value);
  };

  useEffect(() => {
    if (!syncUrlOnType || live.debouncedQ.length < 2) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('q') === live.debouncedQ) return;
    navigate(`/search?q=${encodeURIComponent(live.debouncedQ)}&page=1`, { replace: true });
  }, [live.debouncedQ, syncUrlOnType, navigate]);

  const isHeader = variant === 'header';

  return (
    <div
      ref={wrapRef}
      className={`live-search-wrap ${isHeader ? 'live-search-wrap--header' : ''} ${className}`}
    >
      <form
        className={isHeader ? 'header-search' : 'live-search-form'}
        onSubmit={handleSubmit}
        role="search"
      >
        <input
          type="search"
          className={inputClassName}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => value.length >= 2 && setOpen(true)}
          placeholder={placeholder}
          aria-label="Глобальний пошук"
          aria-expanded={open && live.active}
          aria-controls={listId}
          autoComplete="off"
          style={isHeader ? {
            width: 200,
            maxWidth: '32vw',
            padding: '6px 10px',
            border: '2px solid #000',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
          } : undefined}
        />
        {showSubmitButton && (
          <button
            type="submit"
            className="btn"
            style={isHeader ? { padding: '6px 10px', fontSize: 12 } : undefined}
          >
            {isHeader ? 'OK' : 'ШУКАТИ'}
          </button>
        )}
      </form>

      {(variant === 'page' ? live.active : open && live.active) && (
        <div id={listId}>
          <LiveSearchResults
            {...live}
            variant={variant === 'page' ? 'inline' : 'dropdown'}
            onPick={() => setOpen(false)}
            showViewAll={variant !== 'page'}
          />
        </div>
      )}
    </div>
  );
}

export default LiveSearchBox;

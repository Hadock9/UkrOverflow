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
  onDebouncedChange,
  placeholder = 'Пошук…',
  className = '',
  inputClassName = 'form-input',
  variant = 'header',
  scope = 'all',
  showSubmitButton = true,
  showViewAll,
  syncUrlOnType = false,
  minChars = 2,
  ariaLabel = 'Пошук',
}) {
  const navigate = useNavigate();
  const listId = useId();
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);

  const isHeader = variant === 'header';
  const isFilter = variant === 'filter';

  const live = useLiveSearch(value, {
    debounceMs: 280,
    minChars,
    scope,
    enabled: isHeader ? open || value.length >= minChars : true,
  });

  useEffect(() => {
    if (value.length >= minChars) setOpen(true);
  }, [value, minChars]);

  useEffect(() => {
    if (!onDebouncedChange) return;
    if (live.debouncedQ.length >= minChars) {
      onDebouncedChange(live.debouncedQ);
    } else if (live.debouncedQ.length < minChars) {
      onDebouncedChange('');
    }
  }, [live.debouncedQ, onDebouncedChange, minChars]);

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
    if (trimmed.length < minChars) return;
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
    if (!syncUrlOnType || live.debouncedQ.length < minChars) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('q') === live.debouncedQ) return;
    navigate(`/search?q=${encodeURIComponent(live.debouncedQ)}&page=1`, { replace: true });
  }, [live.debouncedQ, syncUrlOnType, navigate, minChars]);

  const showPanel = isHeader ? open && live.active : live.active;
  const viewAll =
    showViewAll !== undefined ? showViewAll : !isFilter && scope !== 'tags';

  return (
    <div
      ref={wrapRef}
      className={`live-search-wrap ${isHeader ? 'live-search-wrap--header' : ''} ${isFilter ? 'live-search-wrap--filter' : ''} ${className}`}
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
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={showPanel}
          aria-controls={listId}
          autoComplete="off"
        />
        {showSubmitButton && (
          <button type="submit" className="btn">
            {isHeader ? 'OK' : 'ШУКАТИ'}
          </button>
        )}
      </form>

      {showPanel && (
        <div id={listId}>
          <LiveSearchResults
            {...live}
            variant={variant === 'page' || isFilter ? 'inline' : 'dropdown'}
            onPick={() => setOpen(false)}
            showViewAll={viewAll}
            scope={scope}
          />
        </div>
      )}
    </div>
  );
}

export default LiveSearchBox;

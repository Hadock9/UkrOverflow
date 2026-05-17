/**
 * Віджет живої активності для головної сторінки.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { activity as activityApi } from '../services/api';
import wsClient from '../services/websocket';
import '../pages/SocialPages.css';
import './LiveActivityWidget.css';

const DOTS = {
  asking: '#f5d142',
  answering: '#9bd3ff',
  learning: '#9ee6a0',
  in_room: '#c9b8ff',
};

export function LiveActivityWidget() {
  const [totals, setTotals] = useState({ asking: 0, answering: 0, learning: 0, inRoom: 0 });

  const load = async () => {
    try {
      const res = await activityApi.getLive({ limit: 10 });
      setTotals(res.data.data.totals || {});
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    load();
    const unsub = wsClient.on('activity', load);
    const interval = setInterval(load, 45000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="social-widget live-activity-widget">
      <div className="live-activity-widget-head">
        <strong>ЗАРАЗ НА ПЛАТФОРМІ</strong>
        <Link to="/activity" className="live-activity-widget-link">
          Детальніше →
        </Link>
      </div>
      <div className="social-widget-live">
        <span className="social-widget-stat">
          <span className="social-widget-dot" style={{ background: DOTS.asking }} />
          {totals.asking || 0} питають
        </span>
        <span className="social-widget-stat">
          <span className="social-widget-dot" style={{ background: DOTS.answering }} />
          {totals.answering || 0} відповідають
        </span>
        <span className="social-widget-stat">
          <span className="social-widget-dot" style={{ background: DOTS.learning }} />
          {totals.learning || 0} вчаться
        </span>
        <span className="social-widget-stat">
          <span className="social-widget-dot" style={{ background: DOTS.in_room }} />
          {totals.inRoom || 0} у кімнатах
        </span>
      </div>
    </div>
  );
}

/**
 * Деталі кімнати парного програмування — чат + код.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { pairRooms } from '../services/api';
import wsClient from '../services/websocket';
import '../styles/brutalism.css';
import './SocialPages.css';
import { notifyNotificationsUpdated } from '../utils/notificationUi';
import { setExplicitPresence, clearExplicitPresence } from '../hooks/useReportPresence';

function appendMessage(prev, msg) {
  if (!msg?.id) return prev;
  if (prev.some((m) => m.id === msg.id)) return prev;
  return [...prev, msg];
}

export function PairRoomDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const chatEndRef = useRef(null);

  const [code, setCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [joined, setJoined] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pair-room', slug],
    queryFn: async () => {
      const r = await pairRooms.get(slug);
      return r.data.data;
    },
    enabled: !!slug,
  });

  const room = data?.room;
  const members = data?.members || [];

  useEffect(() => {
    if (data?.messages) setMessages(data.messages);
    if (data?.room?.codeSnippet != null) setCode(data.room.codeSnippet || '');
    if (data?.room?.isMember) setJoined(true);
  }, [data]);

  useEffect(() => {
    if (!joined || !room?.id) return undefined;
    setExplicitPresence({
      status: 'in_room',
      context: { roomTitle: room.title },
      entityType: 'pair_room',
      entityId: room.id,
    });
    return () => clearExplicitPresence();
  }, [joined, room?.id, room?.title]);

  useEffect(() => {
    if (!room?.id) return undefined;
    const channel = `pair-room:${room.id}`;
    const unsub = wsClient.on(channel, (payload) => {
      if (payload.type === 'message' && payload.message) {
        setMessages((prev) => appendMessage(prev, payload.message));
      }
      if (payload.type === 'code_update' && payload.codeSnippet != null) {
        if (payload.userId !== user?.id) setCode(payload.codeSnippet);
      }
      if (payload.type === 'member_join' || payload.type === 'member_leave') {
        refetch();
      }
    });
    return unsub;
  }, [room?.id, user?.id, refetch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinMutation = useMutation({
    mutationFn: () => pairRooms.join(room.id),
    onSuccess: () => {
      setJoined(true);
      refetch();
      notifyNotificationsUpdated();
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => pairRooms.leave(room.id),
    onSuccess: () => {
      setJoined(false);
      navigate('/pair-rooms');
    },
  });

  const sendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (!chatInput.trim() || !room?.id || !joined) return;
      try {
        const r = await pairRooms.sendMessage(room.id, chatInput.trim());
        const msg = r.data.data.message;
        setMessages((prev) => appendMessage(prev, msg));
        setChatInput('');
        notifyNotificationsUpdated();
      } catch {
        /* ignore */
      }
    },
    [chatInput, room?.id, joined]
  );

  const saveCode = useCallback(async () => {
    if (!room?.id || !joined) return;
    try {
      await pairRooms.updateCode(room.id, code);
    } catch {
      /* ignore */
    }
  }, [room?.id, joined, code]);

  useEffect(() => {
    if (!joined || !room?.id) return undefined;
    const t = setTimeout(saveCode, 1500);
    return () => clearTimeout(t);
  }, [code, joined, room?.id, saveCode]);

  if (isLoading) return <div className="container loading">ЗАВАНТАЖЕННЯ...</div>;
  if (error || !room) {
    return (
      <div className="container">
        <p className="error">Кімнату не знайдено</p>
        <Link to="/pair-rooms" className="btn">НАЗАД</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <span className="tag">{room.topic}</span>
        <h1 className="page-title">{room.title}</h1>
        <p className="page-subtitle">{room.description || 'Спільна сесія кодування'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {!joined && isAuthenticated && (
            <button type="button" className="btn btn-primary" onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
              ПРИЄДНАТИСЬ
            </button>
          )}
          {joined && (
            <button type="button" className="btn" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
              ВИЙТИ
            </button>
          )}
          <Link to="/pair-rooms" className="btn">ВСІ КІМНАТИ</Link>
        </div>
      </div>

      <p className="social-muted" style={{ marginBottom: 'var(--space-3)' }}>
        Учасники: {members.map((m) => m.username).join(', ') || '—'}
      </p>

      <div className="social-room-layout">
        <div>
          <h3 className="social-section-title">РЕДАКТОР КОДУ</h3>
          <textarea
            className="social-code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={!joined}
            spellCheck={false}
          />
          {joined && <p className="social-muted">Зміни синхронізуються з кімнатою автоматично</p>}
        </div>

        <div className="social-chat">
          <h3 className="social-section-title" style={{ padding: 'var(--space-2)' }}>
            ЧАТ
          </h3>
          <div className="social-chat-messages">
            {messages.map((m) => (
              <div key={m.id} className="social-chat-msg">
                <strong>{m.username}:</strong> {m.body}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {joined ? (
            <form className="social-chat-form" onSubmit={sendMessage}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Повідомлення..."
                maxLength={4000}
              />
              <button type="submit" className="btn btn-primary">
                →
              </button>
            </form>
          ) : (
            <p className="social-muted" style={{ padding: 'var(--space-2)' }}>
              {isAuthenticated ? 'Приєднайтесь, щоб писати в чат' : 'Увійдіть, щоб брати участь'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

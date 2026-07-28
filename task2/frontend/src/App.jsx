import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [health, setHealth] = useState('checking...');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      setHealth(res.ok ? 'connected' : 'unhealthy');
    } catch {
      setHealth('disconnected');
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (res.ok) setTasks(await res.json());
    } catch {
      console.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkHealth(); fetchTasks(); }, [checkHealth, fetchTasks]);

  const addTask = async (e) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [task, ...prev]);
        setTitle('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Failed to add task', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTask = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      }
    } catch (err) {
      console.error('Failed to toggle task', err);
    }
  };

  const deleteTask = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete task', err);
    }
  };

  const pending = tasks.filter((t) => t.status === 'pending');
  const done = tasks.filter((t) => t.status === 'done');

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <h1>TaskFlow</h1>
          <span className="task-count">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        </div>
        <span className={`health health--${health}`}>
          <span className="health-dot" />
          {health}
        </span>
      </header>

      <form onSubmit={addTask} className="add-form">
        <div className="input-wrap">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            maxLength={200}
            disabled={submitting}
          />
          <span className="char-count">{title.length}/200</span>
        </div>
        <button type="submit" disabled={!title.trim() || submitting}>
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </form>

      {loading ? (
        <div className="loading">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" />
          <p className="empty-title">No tasks yet</p>
          <p className="empty-hint">Add one above to get started</p>
        </div>
      ) : (
        <div className="task-groups">
          {pending.length > 0 && (
            <section>
              <h2 className="group-title">Pending ({pending.length})</h2>
              <ul className="task-list">
                {pending.map((task) => (
                  <li key={task.id}>
                    <button
                      className="checkbox"
                      onClick={() => toggleTask(task.id)}
                      aria-label="Mark done"
                    />
                    <span className="task-title">{task.title}</span>
                    <button
                      className="btn-delete"
                      onClick={() => deleteTask(task.id)}
                      aria-label="Delete task"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <section>
              <h2 className="group-title done-title">Done ({done.length})</h2>
              <ul className="task-list">
                {done.map((task) => (
                  <li key={task.id} className="done">
                    <button
                      className="checkbox checked"
                      onClick={() => toggleTask(task.id)}
                      aria-label="Mark pending"
                    />
                    <span className="task-title">{task.title}</span>
                    <button
                      className="btn-delete"
                      onClick={() => deleteTask(task.id)}
                      aria-label="Delete task"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default App;

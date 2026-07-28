import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [health, setHealth] = useState('checking...');

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) setHealth('connected');
      else setHealth('unhealthy');
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
    }
  }, []);

  useEffect(() => { checkHealth(); fetchTasks(); }, [checkHealth, fetchTasks]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [task, ...prev]);
        setTitle('');
      }
    } catch (err) {
      console.error('Failed to add task', err);
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

  const healthClass = health === 'connected' ? 'health-ok' : 'health-err';

  return (
    <div className="app">
      <header>
        <h1>TaskFlow</h1>
        <span className={`health ${healthClass}`}>
          Backend: {health}
        </span>
      </header>

      <form onSubmit={addTask} className="add-form">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          autoFocus
        />
        <button type="submit">Add</button>
      </form>

      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.status === 'done' ? 'done' : ''}>
            <span onClick={() => toggleTask(task.id)} className="task-title">
              {task.title}
            </span>
            <button className="btn-toggle" onClick={() => toggleTask(task.id)}>
              {task.status === 'done' ? 'Undo' : 'Done'}
            </button>
            <button className="btn-delete" onClick={() => deleteTask(task.id)}>
              Delete
            </button>
          </li>
        ))}
        {tasks.length === 0 && <li className="empty">No tasks yet</li>}
      </ul>
    </div>
  );
}

export default App;

import React, { useState } from 'react';
import styles from './LoginPage.module.scss';
import { useAppDispatch } from '@/shared/store/config/AppStore';
import { authActions } from '@/shared/auth/model/slice';

export const LoginPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ошибка входа');
      dispatch(authActions.setAuthenticated(data.user));
    } catch (err: any) {
      setError(err.message || 'Ошибка входа');
    }
  };

  return (
    <div className={styles.LoginPage}>
      <div className={styles.Card}>
        <div className={styles.Title}>Вход</div>
        <form onSubmit={onLogin}>
          <div className={styles.Field}>
            <label>Логин</label>
            <input className={styles.Input} value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className={styles.Field}>
            <label>Пароль</label>
            <input className={styles.Input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className={styles.Note} style={{ color: '#e53935' }}>{error}</div>}
          <button className={styles.Button} type="submit">Войти</button>
        </form>
        <div className={styles.Note}></div>
      </div>
    </div>
  );
};


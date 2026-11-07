// There is no login in this project (out of scope). Instead the header has a
// drop-down to pick which sample user you are "acting as". The chosen
// user_id is shared with every page through this React context and kept in
// localStorage so it survives a page refresh.
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const UserContext = createContext(null);

function readSaved() {
  try { return Number(localStorage.getItem('moviedb.userId')) || null; } catch { return null; }
}

export function UserProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserIdState] = useState(readSaved);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.users()
      .then((list) => {
        setUsers(list);
        // default to the first user if nothing (or a deleted user) was saved
        setUserIdState((cur) => (list.some((u) => u.user_id === cur) ? cur : list[0]?.user_id ?? null));
      })
      .catch((e) => setError(e.message));
  }, []);

  function setUserId(id) {
    setUserIdState(id);
    try { localStorage.setItem('moviedb.userId', String(id)); } catch { /* ignore */ }
  }

  const user = users.find((u) => u.user_id === userId) || null;
  return (
    <UserContext.Provider value={{ users, user, userId, setUserId, error }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);

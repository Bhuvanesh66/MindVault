import React, { createContext, useState } from "react";
export const ContentContext = createContext();
export const ContentProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  return (
    <ContentContext.Provider value={{ items, setItems }}>
      {children}
    </ContentContext.Provider>
  );
};

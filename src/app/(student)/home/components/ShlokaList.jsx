"use client";
import React from "react";
import ShlokaCard from "./ShlokaCard";

const ShlokaList = ({ shlokas }) => {
  if (!shlokas || shlokas.length === 0) {
    return <p className="text-sm text-gray-500">No shlokas yet.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {shlokas.map((s) => (
        <div key={s.id}>
          <ShlokaCard shloka={s} />
        </div>
      ))}
    </div>
  );
};

export default ShlokaList;

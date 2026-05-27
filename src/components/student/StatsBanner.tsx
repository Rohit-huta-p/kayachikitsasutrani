"use client";

import React from "react";

interface Stat {
  value: string | number;
  label: string;
}

const StatsBanner: React.FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <div
      className="rounded-xl p-3.5 text-white flex justify-around text-center"
      style={{ background: "linear-gradient(135deg, #D4A574 0%, #C9A878 100%)" }}
    >
      {stats.map((s, i) => (
        <div key={i}>
          <div className="text-lg font-bold">{s.value}</div>
          <div className="text-[10px] opacity-90">{s.label}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsBanner;

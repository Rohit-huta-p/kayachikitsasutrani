"use client";
import React, { useEffect, useState } from "react";
import SearchComponent from "@/components/SearchComponent";
import ShlokaList from "./components/ShlokaList";
import { api } from "@/lib/api";

const Dashboard = () => {
  const [shlokas, setShlokas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.shlokas
      .list()
      .then(({ items }) => {
        if (!cancelled) setShlokas(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load shlokas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-5">
      <h1 className="text-brown">Learn Ancient Sanskrit Shlokas</h1>
      <p className="text-center w-[60%]">
        Discover the wisdom of ancient Sanskrit verses through an immersive
        learning experience designed to help you memorize and understand sacred
        shlokas.
      </p>
      <SearchComponent
        placeholder="Search for Shlokas"
        className="w-full max-w-md rounded"
      />
      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && <ShlokaList shlokas={shlokas} />}
    </div>
  );
};

export default Dashboard;

"use client";
import React, { useState, useMemo, useTransition } from "react";
import { simulateDelay } from "./util";

export default function SearchList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending] = useTransition();

  // Delayed search with useTransition
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Delayed Search List</h1>
      <div className="mb-4">
        <label htmlFor="search" className="block text-sm font-medium mb-2">
          Search Programming Languages
        </label>
        <input
          id="search"
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Type to search..."
          className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {isPending ? (
        <div className="text-center p-4">
          <span className="text-gray-500">Filtering results...</span>
        </div>
      ) : (
        <SearchResults searchTerm={searchTerm} />
      )}
    </div>
  );
}

function SearchResults({ searchTerm }: { searchTerm: string }) {
  // Filter languages with artificial delay
  const filteredLanguages = useMemo(() => {
    if (!searchTerm) return languages;

    return languages.filter((lang) =>
      lang.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm]);

  return (
    <div className="mt-4">
      <h2 className="text-lg font-medium mb-2">
        Results ({filteredLanguages.length})
      </h2>

      <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
        {filteredLanguages.length > 0 ? (
          filteredLanguages.map((language) => (
            <LanguageItem
              key={language}
              name={language}
              searchTerm={searchTerm}
            />
          ))
        ) : (
          <li className="p-4 text-center text-gray-500">No results found</li>
        )}
      </ul>
    </div>
  );
}

function LanguageItem({
  name,
  searchTerm,
}: {
  name: string;
  searchTerm: string;
}) {
  // Simulate delay per item for more realistic rendering behavior
  simulateDelay(10);

  // Highlight the matching part
  const highlightedName = () => {
    if (!searchTerm) return name;

    const regex = new RegExp(`(${searchTerm})`, "gi");
    const parts = name.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-yellow-200 font-medium">
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <li className="p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div>{highlightedName()}</div>
        <span className="text-gray-400 text-sm">Click to select</span>
      </div>
    </li>
  );
}

// Sample data - list of popular programming languages
const languages = [
  "JavaScript",
  "Python",
  "Java",
  "C#",
  "PHP",
  "C++",
  "TypeScript",
  "Ruby",
  "Swift",
  "Kotlin",
  "Go",
  "Rust",
  "Scala",
  "Dart",
  "Elixir",
  "Haskell",
  "Clojure",
  "Groovy",
  "Lua",
  "R",
  "MATLAB",
  "Objective-C",
  "Perl",
  "Julia",
  "Erlang",
];

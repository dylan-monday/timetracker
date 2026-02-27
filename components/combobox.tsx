"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Plus } from "lucide-react";

export interface ComboBoxOption {
  id: string;
  label: string;
}

interface ComboBoxProps {
  options: ComboBoxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCreate?: boolean;
  createLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  dropUp?: boolean;
}

export function ComboBox({
  options,
  value,
  onChange,
  placeholder = "Type to search...",
  allowCreate = true,
  createLabel = "Create",
  disabled = false,
  autoFocus = false,
  dropUp = false
}: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedValue = value.trim().toLowerCase();

  // Filter options based on input value
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(trimmedValue)
  );

  // Check if exact match exists
  const exactMatch = options.find(
    (option) => option.label.toLowerCase() === trimmedValue
  );

  // Show "add new" option if no exact match and value is not empty
  const showAddNew = allowCreate && trimmedValue && !exactMatch;

  // Combined list of items (filtered options + add new)
  const totalItems = filteredOptions.length + (showAddNew ? 1 : 0);

  // Handle option selection
  const handleSelect = useCallback(
    (label: string) => {
      onChange(label);
      setIsOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    },
    [onChange]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          setIsOpen(true);
          event.preventDefault();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev < totalItems - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : totalItems - 1
          );
          break;
        case "Enter":
          event.preventDefault();
          if (highlightedIndex >= 0) {
            if (highlightedIndex < filteredOptions.length) {
              handleSelect(filteredOptions[highlightedIndex].label);
            } else if (showAddNew) {
              handleSelect(value.trim());
            }
          } else if (trimmedValue) {
            // If nothing highlighted but there's a value, select it (create new or exact match)
            handleSelect(value.trim());
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          inputRef.current?.blur();
          break;
        case "Tab":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [
      isOpen,
      highlightedIndex,
      totalItems,
      filteredOptions,
      showAddNew,
      handleSelect,
      value,
      trimmedValue
    ]
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when filtered options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [trimmedValue]);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-base outline-none focus:border-black/30 disabled:opacity-50 sm:text-sm"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls="combobox-listbox"
      />

      {isOpen && totalItems > 0 && (
        <ul
          ref={listRef}
          id="combobox-listbox"
          role="listbox"
          className={`absolute left-0 right-0 z-50 max-h-48 overflow-auto rounded-xl border border-black/10 bg-white py-1 shadow-lg ${
            dropUp
              ? "bottom-full mb-1"
              : "bottom-full mb-1 sm:bottom-auto sm:top-full sm:mb-0 sm:mt-1"
          }`}
        >
          {filteredOptions.map((option, index) => {
            const isHighlighted = index === highlightedIndex;
            const isSelected = option.label.toLowerCase() === trimmedValue;

            return (
              <li
                key={option.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.label)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                  isHighlighted ? "bg-black/5" : ""
                } ${isSelected ? "font-medium" : ""}`}
              >
                {isSelected && <Check className="h-3.5 w-3.5 text-accent" />}
                <span className={isSelected ? "" : "pl-5.5"}>{option.label}</span>
              </li>
            );
          })}

          {showAddNew && (
            <li
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(value.trim())}
              onMouseEnter={() => setHighlightedIndex(filteredOptions.length)}
              className={`flex cursor-pointer items-center gap-2 border-t border-black/5 px-3 py-2 text-sm ${
                highlightedIndex === filteredOptions.length ? "bg-black/5" : ""
              }`}
            >
              <Plus className="h-3.5 w-3.5 text-muted" />
              <span>
                {createLabel} <strong className="font-medium">"{value.trim()}"</strong>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

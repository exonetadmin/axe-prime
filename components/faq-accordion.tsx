"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { FaqItem } from "@/lib/site-content";

export default function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="faq-grid">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <button
            key={item.question}
            className={`faq-card faq-accordion${isOpen ? " is-open" : ""}`}
            onClick={() => toggle(index)}
            aria-expanded={isOpen}
          >
            <div className="faq-header">
              <h3 className="faq-question">{item.question}</h3>
              <span className={`faq-icon${isOpen ? " is-open" : ""}`} aria-hidden="true">
                <Plus size={18} strokeWidth={1.8} />
              </span>
            </div>
            <div className="faq-body">
              <p className="faq-answer">{item.answer}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

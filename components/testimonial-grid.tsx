import Image from "next/image";
import type { Testimonial } from "@/lib/site-content";

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <article className="testimonial-card">
      <div className="testimonial-quote-mark" aria-hidden="true">&ldquo;</div>
      <p className="testimonial-text">{item.quote}</p>
      <div className="testimonial-author">
        <div className="testimonial-avatar" aria-label={`Foto de ${item.name}`}>
          {item.photo ? (
            <Image
              src={item.photo}
              alt={item.name}
              width={56}
              height={56}
              className="testimonial-photo"
            />
          ) : (
            <span className="testimonial-initials">{item.initials}</span>
          )}
        </div>
        <div>
          <p className="testimonial-name">{item.name}</p>
          <p className="testimonial-meta">
            <span>{item.role}</span>
            <span className="testimonial-tier">{item.tier}</span>
          </p>
        </div>
      </div>
    </article>
  );
}

export default function TestimonialGrid({
  items,
}: {
  items: readonly Testimonial[];
}) {
  return (
    <div className="testimonial-grid">
      {items.map(item => (
        <TestimonialCard key={item.name} item={item} />
      ))}
    </div>
  );
}

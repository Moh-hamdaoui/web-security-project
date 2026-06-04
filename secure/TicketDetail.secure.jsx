// VERSION CORRIGÉE — VLN-03 (XSS Stocké)
// Corrections appliquées :
//   1. DOMPurify pour sanitiser le HTML avant rendu
//   2. Ou simplement ne pas utiliser dangerouslySetInnerHTML du tout

// Option A — Texte brut (recommandé si le HTML n'est pas nécessaire)
function TicketDescriptionSafe({ description }) {
  return <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{description}</p>;
}

// Option B — HTML sanitisé avec DOMPurify (si le rendu HTML est requis)
// npm install dompurify @types/dompurify
import DOMPurify from "dompurify";

function TicketDescriptionSanitized({ description }) {
  const sanitized = DOMPurify.sanitize(description, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "ul", "ol", "li", "code"],
    ALLOWED_ATTR: [],  // Aucun attribut autorisé → pas d'onerror, onclick, etc.
  });

  return (
    <div
      className="text-gray-600 text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

// Option C — Markdown sécurisé avec remark/rehype (meilleure expérience utilisateur)
// npm install react-markdown rehype-sanitize
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";

function TicketDescriptionMarkdown({ description }) {
  return (
    <ReactMarkdown
      className="text-gray-600 text-sm leading-relaxed prose prose-sm"
      rehypePlugins={[rehypeSanitize]}
    >
      {description}
    </ReactMarkdown>
  );
}

export { TicketDescriptionSafe, TicketDescriptionSanitized, TicketDescriptionMarkdown };

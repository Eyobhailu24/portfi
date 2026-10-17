import type { ReactNode } from "react";

/** A deliberately small inline format: bold, emphasis and safe HTTPS/email links.
 * Raw HTML is always rendered as text. */
export function RichText({ text }: { text: string }) {
  const output: ReactNode[] = [];
  const token = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  for (const match of text.matchAll(token)) {
    if (match.index! > last) output.push(text.slice(last, match.index));
    if (match[2]) output.push(<strong key={match.index}>{match[2]}</strong>);
    else if (match[3]) output.push(<em key={match.index}>{match[3]}</em>);
    else if (/^(https:\/\/|mailto:)[^\s]+$/.test(match[5])) output.push(<a key={match.index} href={match[5]} className="folio-inline-link">{match[4]}</a>);
    else output.push(match[0]);
    last = match.index! + match[0].length;
  }
  output.push(text.slice(last));
  return <>{output}</>;
}

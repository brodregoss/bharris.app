import React from 'react';
import { legalCopy, legalRuns } from '@/lib/legal';

export function LegalText({ text, className }) {
  return (
    <span className={className}>
      {legalRuns(text).map((run, index) => {
        if (run.kind === 'strong') return <strong key={index} className="font-semibold text-foreground">{run.value}</strong>;
        if (run.kind === 'email') {
          return (
            <a key={index} href={`mailto:${run.value}`} className="underline underline-offset-4">
              {run.value}
            </a>
          );
        }
        if (run.kind === 'link') {
          return (
            <a key={index} href={run.value} className="underline underline-offset-4 break-all" target="_blank" rel="noopener noreferrer">
              {run.value}
            </a>
          );
        }
        return <React.Fragment key={index}>{run.value}</React.Fragment>;
      })}
    </span>
  );
}

function Paragraphs({ lines }) {
  return lines.map((paragraph) => (
    <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed">
      <LegalText text={paragraph} />
    </p>
  ));
}

function BulletList({ items }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground leading-relaxed">
      {items.map((item) => (
        <li key={item}><LegalText text={item} /></li>
      ))}
    </ul>
  );
}

function LegalTable({ table }) {
  if (!table?.headers?.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm text-muted-foreground">
        <thead>
          <tr>
            {table.headers.map((header) => (
              <th key={header} className="border-b border-border py-2 pr-3 text-left text-xs font-semibold text-foreground first:pl-0">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell) => (
                <td key={cell} className="border-b border-border py-2 pr-3 align-top first:pl-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyBlock({ section, heading }) {
  const copy = legalCopy(section);
  const Heading = heading;
  return (
    <div className="space-y-2">
      {Heading && section.title ? (
        <Heading className="text-sm font-semibold text-foreground">{section.title}</Heading>
      ) : null}
      {Paragraphs({ lines: copy.before })}
      <BulletList items={copy.items} />
      {section.table ? <LegalTable table={section.table} /> : null}
      {(section.groups || []).map((group) => (
        <CopyBlock key={group.title} section={group} heading="h4" />
      ))}
      {Paragraphs({ lines: copy.after })}
    </div>
  );
}

export default function LegalSections({ sections }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <CopyBlock key={section.title} section={section} heading="h3" />
      ))}
    </div>
  );
}
